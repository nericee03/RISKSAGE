import os, uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from services.rag_engine import ingest_document, rag_query, list_documents

router = APIRouter()
UPDIR  = Path("data/uploads")
UPDIR.mkdir(parents=True, exist_ok=True)

class QueryReq(BaseModel):
    question: str
    top_k: int = 5

@router.post("/ingest")
async def ingest(file: UploadFile = File(...), doc_type: str = "10-K"):
    dest = UPDIR / f"{uuid.uuid4().hex}_{file.filename}"
    try:
        content = await file.read()
        if len(content) > 50*1024*1024: raise HTTPException(413, "File too large (max 50MB)")
        dest.write_bytes(content)
        return ingest_document(str(dest), file.filename, doc_type)
    except HTTPException: raise
    except Exception as e:
        if dest.exists(): dest.unlink()
        raise HTTPException(500, str(e))

@router.post("/query")
def query(req: QueryReq):
    if not req.question.strip(): raise HTTPException(400, "Question required")
    try: return rag_query(req.question, req.top_k)
    except Exception as e: raise HTTPException(500, str(e))

@router.get("/list")
def list_docs():
    try: return {"documents": list_documents()}
    except Exception as e: raise HTTPException(500, str(e))
