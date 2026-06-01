import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, SHead, AIBox, RiskBadge, OBtn, Btn } from "../UI";
import { ingestDocument, queryRAG } from "../../api/client";

const RC={
  High:    {bg:"rgba(239,68,68,.13)", col:"#ef4444",border:"rgba(239,68,68,.3)"},
  Moderate:{bg:"rgba(245,158,11,.11)",col:"#f59e0b",border:"rgba(245,158,11,.3)"},
  Low:     {bg:"rgba(34,197,94,.11)", col:"#22c55e",border:"rgba(34,197,94,.25)"},
};

function RTag({level="Moderate"}){
  const c=RC[level]||RC.Moderate;
  return(<span style={{background:c.bg,color:c.col,border:`1px solid ${c.border}`,
    padding:"2px 9px",borderRadius:10,fontSize:10.5,fontWeight:700,display:"inline-block",marginBottom:4}}>
    {level} Risk
  </span>);
}

function StepBar({step}){
  const steps=[[1,"Upload Doc"],[2,"Indexing"],[3,"Ask Question"],[4,"Answer Ready"]];
  return(
    <div style={{display:"flex",alignItems:"center",gap:4,background:"rgba(0,0,0,.3)",
      borderRadius:30,padding:"7px 14px",border:"1px solid var(--border)",flexShrink:0}}>
      {steps.map(([n,l],i)=>(
        <div key={n} style={{display:"flex",alignItems:"center",gap:4}}>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",
              justifyContent:"center",fontSize:10,fontWeight:700,flexShrink:0,transition:"all .3s",
              background:step>n?"#22c55e":step===n?"#14b8a6":"var(--bg-hover)",
              color:step>=n?"#fff":"var(--text-muted)",
              border:`2px solid ${step>n?"#22c55e":step===n?"#14b8a6":"var(--border)"}`}}>
              {step>n?"✓":n}
            </div>
            <span style={{fontSize:11,fontWeight:step===n?600:400,whiteSpace:"nowrap",
              color:step===n?"var(--text-primary)":step>n?"#22c55e":"var(--text-muted)",transition:"color .3s"}}>
              {l}
            </span>
          </div>
          {i<3&&<div style={{width:16,height:1,background:step>n?"#22c55e33":"var(--border)",margin:"0 2px"}}/>}
        </div>
      ))}
    </div>
  );
}

const DEMO_PASSAGES=[
  {id:1,risk_level:"High",    text:"Disruptions in our supply chain or unavailability of key components could adversely affect our ability to meet demand for our products and hurt our financial performance.",doc_name:"Apple 10-K (2023)",chunk_idx:12},
  {id:2,risk_level:"High",    text:"A significant portion of our net sales comes from iPhone products. Any failure to innovate or prolonged decline in iPhone sales would materially harm our business and operating results.",doc_name:"Apple 10-K (2023)",chunk_idx:15},
  {id:3,risk_level:"Moderate",text:"Fluctuations in foreign currency exchange rates may adversely impact our international revenues and results of operations.",doc_name:"Apple 10-K (2023)",chunk_idx:46},
  {id:4,risk_level:"Moderate",text:"If we do not comply with current or future global regulatory requirements, we may be subject to material fines, business restrictions, and reputational harm.",doc_name:"Apple 10-K (2023)",chunk_idx:19},
];

const SAMPLE_QS=[
  "What is the most critical risk for this company?",
  "How does currency fluctuation affect revenues?",
  "What are the supply chain vulnerabilities?",
  "What regulatory risks does the company face?",
];

const DEMO_DOCS=[
  {doc_name:"Apple 10-K (2023)",doc_type:"10-K",chunks:347},
  {doc_name:"Tesla Earnings Call Q1",doc_type:"Transcript",chunks:89},
];

const AI_RISKS=[
  {title:"Supply Chain",      level:"Moderate",desc:"Component shortages may impact product availability and revenue growth.",src:"Item 1A, Page 12"},
  {title:"iPhone Dependency", level:"High",    desc:"Over 52% of net sales depend on iPhone — concentration risk is significant.",src:"Item 1A, Page 15"},
  {title:"Regulatory Scrutiny",level:"Moderate",desc:"Global regulations may lead to fines, restrictions, or operational changes.",src:"Item 1A, Page 19"},
  {title:"FX Exposure",       level:"Low",     desc:"Currency fluctuations affect international revenue but are partially hedged.",src:"Item 7A, Page 46"},
];

const RISK_DIST=[
  {label:"Market Risk",pct:70,color:"#ef4444"},
  {label:"Operational",pct:55,color:"#f59e0b"},
  {label:"Regulatory", pct:40,color:"#3b82f6"},
  {label:"FX Exposure",pct:30,color:"#14b8a6"},
  {label:"Cyber Risk", pct:45,color:"#8b5cf6"},
];

export default function Reports(){
  const [docs,     setDocs]     = useState(DEMO_DOCS);
  const [uploading,setUploading]= useState(false);
  const [upMsg,    setUpMsg]    = useState("");
  const [passages, setPassages] = useState(DEMO_PASSAGES);
  const [selIdx,   setSelIdx]   = useState(0);
  const [question, setQuestion] = useState("");
  const [answer,   setAnswer]   = useState("");
  const [qLoad,    setQLoad]    = useState(false);
  const [activeDoc,setActiveDoc]= useState("Apple 10-K (2023)");
  const [step,     setStep]     = useState(1);
  const [riskDist, setRiskDist] = useState(RISK_DIST);
  const [aiRisks,  setAiRisks]  = useState(AI_RISKS);

  const onDrop=useCallback(async(files)=>{
    if(!files.length)return;
    setUploading(true);setUpMsg("");setStep(2);
    try{
      const{data}=await ingestDocument(files[0]);
      setUpMsg(`✓ "${data.doc_name}" ingested — ${data.n_chunks} chunks indexed`);
      setDocs(p=>[{doc_name:data.doc_name,doc_type:data.doc_type,chunks:data.n_chunks},...p]);
      setActiveDoc(data.doc_name);
      setStep(3);
    }catch(e){
      setUpMsg(`✗ ${e?.response?.data?.detail||"Upload failed. Make sure backend is running."}`);
      setStep(1);
    }
    setUploading(false);
  },[]);

  const{getRootProps,getInputProps,isDragActive}=useDropzone({
    onDrop,accept:{"application/pdf":[".pdf"],"text/plain":[".txt"]},maxFiles:1,
  });

  async function ask(q){
    const qf=q||question;
    if(!qf.trim())return;
    setQuestion(qf);setQLoad(true);setAnswer("");setStep(3);
    try{
      const{data}=await queryRAG(qf);
      setAnswer(data.answer);
      if(data.passages?.length){
        setPassages(data.passages);
        // Update risk distribution based on retrieved passages
        const high=data.passages.filter(p=>p.risk_level==="High").length;
        const mod=data.passages.filter(p=>p.risk_level==="Moderate").length;
        const low=data.passages.filter(p=>p.risk_level==="Low").length;
        setRiskDist(prev=>prev.map((r,i)=>({...r,pct:Math.min(95,Math.max(10,r.pct+(i===0?high*5:i===1?mod*3:-low*2)))})));
      }
      setStep(4);
    }catch(e){
      setAnswer(e?.response?.data?.detail||"Query failed — make sure a document is ingested first.");
      setStep(3);
    }
    setQLoad(false);
  }

  function selectDoc(name){
    setActiveDoc(name);
    setPassages(DEMO_PASSAGES);
    setAnswer("");setQuestion("");
    setStep(3);
  }

  return(
    <div style={{height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>

      {/* ── STICKY HEADER ── */}
      <div style={{flexShrink:0,background:"linear-gradient(135deg,#0c1726,#0f2040)",
        borderBottom:"1px solid var(--border)",padding:"12px 20px",
        position:"relative",overflow:"hidden",zIndex:10}}>
        <div style={{position:"absolute",top:-20,right:-20,width:140,height:140,
          borderRadius:"50%",background:"radial-gradient(circle,rgba(20,184,166,.12),transparent)"}}/>
        <div style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:18,fontWeight:800,letterSpacing:"-.4px",marginBottom:2}}>
              📄 Financial Disclosure Analyzer
            </div>
            <div style={{fontSize:12,color:"var(--text-secondary)"}}>
              Upload 10-K or transcript → FAISS indexes it → Ask Claude anything → Cited answers
            </div>
          </div>
          <StepBar step={step}/>
        </div>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div style={{flex:1,overflowY:"auto",padding:"14px 18px",display:"flex",flexDirection:"column",gap:14}}>

        {/* Pipeline info bar */}
        <div style={{display:"flex",gap:0,background:"var(--bg-card2)",borderRadius:12,
          border:"1px solid var(--border)",overflow:"hidden"}}>
          {[["✂️","Chunk","512 tokens, 50 overlap"],
            ["🧬","Embed","all-MiniLM-L6-v2 (384-dim)"],
            ["⚡","FAISS Index","Flat IP similarity search"],
            ["🎯","Retrieve","Top-5 nearest passages"],
            ["🤖","Claude","Answer with citations"],
          ].map((s,i)=>(
            <div key={i} style={{flex:1,padding:"10px 12px",
              borderRight:i<4?"1px solid var(--border)":"none",
              background:step-1===i?"rgba(59,130,246,.08)":"transparent",
              transition:"background .3s"}}>
              <div style={{fontSize:14,marginBottom:3}}>{s[0]}</div>
              <div style={{fontSize:11.5,fontWeight:700,color:step-1===i?"var(--accent)":"var(--text-primary)"}}>{s[1]}</div>
              <div style={{fontSize:10.5,color:"var(--text-muted)",marginTop:1}}>{s[2]}</div>
            </div>
          ))}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"220px 1fr 220px",gap:14}}>

          {/* LEFT */}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Card>
              <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",
                textTransform:"uppercase",letterSpacing:".07em",marginBottom:10}}>
                Step 1 — Upload Document
              </div>
              <div {...getRootProps()} style={{
                border:`2px dashed ${isDragActive?"var(--accent)":"var(--border-bright)"}`,
                borderRadius:10,padding:"16px 12px",textAlign:"center",cursor:"pointer",
                marginBottom:10,transition:"all .2s",
                background:isDragActive?"rgba(59,130,246,.06)":"transparent"}}>
                <input {...getInputProps()}/>
                <div style={{fontSize:26,marginBottom:6}}>{uploading?"⏳":"📄"}</div>
                <div style={{fontSize:12,color:"var(--accent)",fontWeight:600,marginBottom:2}}>
                  {uploading?"Indexing with FAISS…":"Upload 10-K or Transcript"}
                </div>
                <div style={{fontSize:11,color:"var(--text-muted)"}}>
                  {isDragActive?"Drop it!":"PDF or TXT · drag & drop or click"}
                </div>
              </div>

              {upMsg&&(
                <div style={{fontSize:11.5,marginBottom:10,padding:"7px 10px",borderRadius:8,lineHeight:1.5,
                  background:upMsg.startsWith("✓")?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",
                  color:upMsg.startsWith("✓")?"var(--green)":"var(--red)",
                  border:`1px solid ${upMsg.startsWith("✓")?"rgba(34,197,94,.2)":"rgba(239,68,68,.2)"}`}}>
                  {upMsg}
                </div>
              )}

              <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",
                textTransform:"uppercase",letterSpacing:".07em",marginBottom:8}}>
                Indexed Documents ({docs.length})
              </div>
              {docs.map((d,i)=>(
                <div key={i} onClick={()=>selectDoc(d.doc_name)} style={{
                  padding:"9px 11px",marginBottom:7,cursor:"pointer",transition:"all .15s",
                  background:activeDoc===d.doc_name?"var(--bg-hover)":"var(--bg-card2)",
                  border:`1px solid ${activeDoc===d.doc_name?"var(--border-bright)":"var(--border)"}`,
                  borderRadius:9,borderLeft:`3px solid ${activeDoc===d.doc_name?"var(--accent)":"transparent"}`}}>
                  <div style={{fontSize:12,fontWeight:600}}>{d.doc_name}</div>
                  <div style={{fontSize:10.5,color:"var(--text-muted)",marginTop:2,display:"flex",gap:8}}>
                    <span>{d.doc_type}</span>
                    {d.chunks&&<span>· {d.chunks} chunks</span>}
                  </div>
                </div>
              ))}
            </Card>
          </div>

          {/* MAIN */}
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Card>
              <div style={{marginBottom:14}}>
                <div style={{fontSize:17,fontWeight:800}}>{activeDoc}</div>
                <div style={{fontSize:11.5,color:"var(--text-muted)",marginTop:3}}>
                  RAG-indexed · Risk passages extracted automatically · Relevance scored
                </div>
              </div>
              <SHead title="Key Risk Passages" sub={`${passages.length} passages · click to expand`}/>
              {passages.map((p,i)=>(
                <div key={p.id||i} onClick={()=>setSelIdx(selIdx===i?-1:i)} style={{
                  background:selIdx===i?"var(--bg-hover)":"var(--bg-card2)",
                  border:`1px solid ${selIdx===i?"var(--border-bright)":"var(--border)"}`,
                  borderRadius:10,padding:"12px 14px",marginBottom:9,cursor:"pointer",transition:"all .15s",
                  borderLeft:`3px solid ${RC[p.risk_level||"Moderate"].col}`}}>
                  <RTag level={p.risk_level||"Moderate"}/>
                  <div style={{fontSize:13,lineHeight:1.65,marginBottom:6,color:"var(--text-primary)"}}>{p.text}</div>
                  <div style={{fontSize:11,color:"var(--text-muted)",fontFamily:"var(--mono)",display:"flex",gap:10,flexWrap:"wrap"}}>
                    <span>📌 {p.doc_name}</span>
                    <span>Chunk {p.chunk_idx}</span>
                    {p.score!=null&&<span style={{color:"var(--accent)"}}>Relevance: {(p.score*100).toFixed(0)}%</span>}
                  </div>
                </div>
              ))}
            </Card>

            {/* Q&A — Step 3 */}
            <Card style={{borderLeft:`4px solid ${step>=3?"#14b8a6":"var(--border)"}`}}>
              <SHead title="💬 Step 3 — Ask About This Document"
                sub="Claude answers using only retrieved passages — no hallucinations"/>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                {SAMPLE_QS.map(q=>(
                  <button key={q} onClick={()=>ask(q)} style={{
                    padding:"5px 11px",borderRadius:20,cursor:"pointer",fontSize:11.5,
                    background:"var(--bg-card2)",border:"1px solid var(--border)",
                    color:"var(--text-secondary)",transition:"all .15s"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-secondary)";}}>
                    {q}
                  </button>
                ))}
              </div>
              <div style={{display:"flex",gap:8}}>
                <input value={question} onChange={e=>setQuestion(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&ask(question)}
                  placeholder="Ask anything about the document…"
                  style={{flex:1,background:"var(--bg-card2)",border:"1px solid var(--border)",
                    borderRadius:9,color:"var(--text-primary)",fontSize:13,padding:"9px 12px",
                    outline:"none",fontFamily:"var(--font)",transition:"border-color .15s"}}
                  onFocus={e=>e.target.style.borderColor="var(--border-bright)"}
                  onBlur={e=>e.target.style.borderColor="var(--border)"}/>
                <OBtn onClick={()=>ask(question)} disabled={qLoad}>
                  {qLoad?"Searching…":"Ask ↗"}
                </OBtn>
              </div>
              {(answer||qLoad)&&(
                <div style={{marginTop:12}}>
                  <AIBox text={answer} loading={qLoad}/>
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT */}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Card>
              <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",
                textTransform:"uppercase",letterSpacing:".07em",marginBottom:10}}>
                AI Risk Summary
              </div>
              {aiRisks.map((r,i)=>(
                <div key={i} style={{padding:"10px 0",borderBottom:i<aiRisks.length-1?"1px solid var(--border)":"none"}}>
                  <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{r.title}</div>
                  <RTag level={r.level}/>
                  <div style={{fontSize:11.5,color:"var(--text-secondary)",marginTop:4,lineHeight:1.6}}>{r.desc}</div>
                  <div style={{fontSize:10.5,color:"var(--text-muted)",marginTop:3,fontFamily:"var(--mono)"}}>{r.src}</div>
                </div>
              ))}
            </Card>

            {/* Risk distribution — updates when passages change */}
            <Card>
              <SHead title="Risk Distribution" sub={step===4?"Updated from query":"Demo values"}/>
              {riskDist.map(b=>(
                <div key={b.label} style={{marginBottom:9}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11.5,marginBottom:4}}>
                    <span style={{color:"var(--text-secondary)"}}>{b.label}</span>
                    <span style={{color:b.color,fontFamily:"var(--mono)",fontWeight:600}}>{b.pct}%</span>
                  </div>
                  <div style={{height:4,background:"var(--bg-hover)",borderRadius:2,overflow:"hidden"}}>
                    <div style={{width:`${b.pct}%`,height:"100%",background:b.color,borderRadius:2,transition:"width .6s ease"}}/>
                  </div>
                </div>
              ))}
            </Card>

            <Card>
              <SHead title="Document Info"/>
              {[["Active Doc",activeDoc.split(" ").slice(0,2).join(" ")],
                ["Type",docs.find(d=>d.doc_name===activeDoc)?.doc_type||"10-K"],
                ["Chunks",docs.find(d=>d.doc_name===activeDoc)?.chunks||"~347"],
                ["Embedding","all-MiniLM-L6-v2"],
                ["Vector DB","FAISS (local)"],
                ["Top-K","5 passages"],
                ["LLM","Claude Sonnet"],
              ].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",
                  padding:"6px 0",borderBottom:"1px solid rgba(96,165,250,.05)",fontSize:12}}>
                  <span style={{color:"var(--text-muted)"}}>{k}</span>
                  <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--text-secondary)"}}>{v}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
