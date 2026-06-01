import os, json, logging, numpy as np
from pathlib import Path
logger = logging.getLogger(__name__)

FAISS_IDX  = os.getenv("FAISS_INDEX_PATH", "data/faiss_index/index.faiss")
FAISS_META = os.getenv("FAISS_META_PATH",  "data/faiss_index/meta.json")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE",   "512"))
OVERLAP    = int(os.getenv("CHUNK_OVERLAP","50"))
TOP_K      = int(os.getenv("RAG_TOP_K",   "5"))
EMBED_DIM  = 384

_embedder = None
def _get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer
        _embedder = SentenceTransformer(os.getenv("EMBED_MODEL","all-MiniLM-L6-v2"))
    return _embedder

def _faiss():
    import faiss; return faiss

def extract_pdf(path):
    import fitz
    doc = fitz.open(path)
    pages = [f"[Page {i+1}]\n{p.get_text('text')}" for i,p in enumerate(doc) if p.get_text("text").strip()]
    doc.close()
    return "\n\n".join(pages)

def chunk_text(text):
    cs=CHUNK_SIZE*4; ov=OVERLAP*4; chunks=[]; start=0
    while start<len(text):
        c=text[start:start+cs].strip()
        if c: chunks.append(c)
        start+=cs-ov
    return chunks

def embed(texts):
    return _get_embedder().encode(texts, show_progress_bar=False, normalize_embeddings=True).astype("float32")

def _load():
    faiss=_faiss()
    if Path(FAISS_IDX).exists():
        idx=faiss.read_index(FAISS_IDX); meta=json.loads(Path(FAISS_META).read_text())
    else:
        idx=faiss.IndexFlatIP(EMBED_DIM); meta=[]
    return idx, meta

def _save(idx, meta):
    Path(FAISS_IDX).parent.mkdir(parents=True, exist_ok=True)
    _faiss().write_index(idx, FAISS_IDX)
    Path(FAISS_META).write_text(json.dumps(meta, ensure_ascii=False))

def ingest_document(path, name, doc_type="10-K"):
    text=extract_pdf(path); chunks=chunk_text(text); embs=embed(chunks)
    idx,meta=_load(); start=idx.ntotal; idx.add(embs)
    meta.extend([{"id":start+i,"doc_name":name,"doc_type":doc_type,"chunk_idx":i,"text":c} for i,c in enumerate(chunks)])
    _save(idx,meta)
    return {"doc_name":name,"doc_type":doc_type,"n_chunks":len(chunks),"total_docs":idx.ntotal,"status":"ingested"}

def retrieve(query, k=TOP_K):
    idx,meta=_load()
    if idx.ntotal==0: return []
    qe=embed([query]); dists,idxs=idx.search(qe, min(k,idx.ntotal))
    results=[]
    for d,i in zip(dists[0],idxs[0]):
        if 0<=i<len(meta):
            e=dict(meta[i]); e["score"]=round(float(d),4)
            kw={"High":["material","significant","critical","failure","harm"],"Moderate":["may","could","potential","impact"]}
            e["risk_level"]=next((lv for lv,ws in kw.items() if any(w in e["text"].lower() for w in ws)),"Low")
            results.append(e)
    return results

def rag_query(question, k=TOP_K):
    passages=retrieve(question, k)
    if not passages:
        return {"answer":"No documents ingested yet. Upload a 10-K PDF on the Reports page.","passages":[],"question":question}
    ctx="\n\n---\n\n".join(f"[{p['doc_name']}, Chunk {p['chunk_idx']}]\n{p['text']}" for p in passages)
    from services.llm import explain_rag
    answer="".join(explain_rag(question, ctx))
    return {"answer":answer,"passages":passages,"question":question}

def list_documents():
    _,meta=_load(); seen={}
    for m in meta:
        n=m["doc_name"]
        if n not in seen: seen[n]={"doc_name":n,"doc_type":m.get("doc_type",""),"n_chunks":0}
        seen[n]["n_chunks"]+=1
    return list(seen.values())
