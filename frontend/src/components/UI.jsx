// ─── Shared UI Components ────────────────────────────────────────────────────

export function Card({ children, style }) {
  return (
    <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)",
      borderRadius:"var(--rl)", padding:"15px", ...style }}>{children}</div>
  );
}

export function SHead({ title, sub, right }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12 }}>
      <div>
        <div style={{ fontSize:13.5, fontWeight:600, color:"var(--text-primary)" }}>{title}</div>
        {sub && <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

const RBCOL = {
  High:     ["rgba(239,68,68,.15)",  "#ef4444", "rgba(239,68,68,.28)"],
  Moderate: ["rgba(245,158,11,.13)", "#f59e0b", "rgba(245,158,11,.28)"],
  Low:      ["rgba(34,197,94,.12)",  "#22c55e", "rgba(34,197,94,.22)"],
};
export function RiskBadge({ level = "Moderate" }) {
  const [bg,col,bdr] = RBCOL[level] || RBCOL.Moderate;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5,
      padding:"3px 11px", borderRadius:16, fontSize:11.5, fontWeight:700,
      background:bg, color:col, border:`1px solid ${bdr}` }}>● {level}</span>
  );
}

const SPCOL = {
  positive: ["rgba(34,197,94,.13)",  "#22c55e", "rgba(34,197,94,.22)"],
  neutral:  ["rgba(245,158,11,.11)", "#f59e0b", "rgba(245,158,11,.22)"],
  negative: ["rgba(239,68,68,.13)",  "#ef4444", "rgba(239,68,68,.25)"],
};
export function SPill({ label }) {
  const key = (label||"neutral").toLowerCase();
  const [bg,col,bdr] = SPCOL[key] || SPCOL.neutral;
  return (
    <span style={{ flexShrink:0, padding:"2px 9px", borderRadius:10,
      fontSize:11, fontWeight:700, background:bg, color:col, border:`1px solid ${bdr}` }}>
      {label?.charAt(0).toUpperCase()+(label?.slice(1)||"")}
    </span>
  );
}

export function PulseDot({ color="var(--teal)" }) {
  return <span style={{ width:7,height:7,borderRadius:"50%",background:color,
    display:"inline-block",animation:"pulse 1.4s ease-in-out infinite" }}/>;
}

export function Dots() {
  return (
    <span style={{ display:"inline-flex", gap:3, marginLeft:5 }}>
      {[0,1,2].map(i=>(
        <span key={i} style={{ width:4,height:4,borderRadius:"50%",background:"var(--accent)",
          display:"inline-block",animation:`blink 1.4s ${i*.2}s ease-in-out infinite` }}/>
      ))}
    </span>
  );
}

export function AIBox({ text, loading, placeholder }) {
  const base = {
    background:"var(--bg-card2)", borderRadius:"var(--r)",
    padding:"13px 14px", fontSize:13, lineHeight:1.75,
    border:"1px solid var(--border)", borderLeft:"3px solid var(--accent)",
  };
  if (loading && !text) return (
    <div style={{ ...base, color:"var(--text-muted)", display:"flex", alignItems:"center", gap:8 }}>
      <PulseDot/> Analyzing with Claude<Dots/>
    </div>
  );
  if (!text && !loading) return placeholder
    ? <div style={{ color:"var(--text-muted)", fontSize:13, padding:"6px 0" }}>{placeholder}</div>
    : null;
  return (
    <div style={{ ...base, animation:"fadeUp .3s ease", color:"var(--text-primary)" }}>
      <span style={{ marginRight:7 }}><PulseDot/></span>
      {text.split("\n\n").filter(Boolean).map((p,i)=>(
        <p key={i} style={{ marginBottom: i<text.split("\n\n").length-1?8:0 }}
          dangerouslySetInnerHTML={{ __html:
            p.replace(/\*\*(.*?)\*\*/g,'<strong style="color:var(--accent)">$1</strong>') }}/>
      ))}
      {loading && <Dots/>}
    </div>
  );
}

export function Spark({ data=[], color="#3b82f6", h=28 }) {
  if (!data.length) return null;
  const W=100; const min=Math.min(...data), max=Math.max(...data), rng=max-min||1;
  const pts = data.map((v,i)=>`${(i/(data.length-1)*W).toFixed(1)},${(h-((v-min)/rng*(h-2)-1)).toFixed(1)}`);
  const id=`sg${color.replace(/\W/g,"")}`;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} style={{ width:"100%",height:h }} preserveAspectRatio="none">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity=".28"/>
        <stop offset="100%" stopColor={color} stopOpacity="0"/>
      </linearGradient></defs>
      <path d={`M${pts[0]} L${pts.join(" L")} L${W},${h} L0,${h} Z`} fill={`url(#${id})`}/>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function MCard({ label, value, color="var(--text-primary)", variant, spark }) {
  const bad=variant==="danger", good=variant==="safe";
  return (
    <div style={{
      background:"var(--bg-card)", borderRadius:"var(--r)", padding:"12px 13px",
      border:`1px solid ${bad?"rgba(239,68,68,.22)":good?"rgba(34,197,94,.18)":"var(--border)"}`,
      position:"relative", overflow:"hidden", cursor:"default", transition:"transform .15s",
    }}
      onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
      onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}
    >
      {(bad||good)&&<div style={{ position:"absolute",inset:0,pointerEvents:"none",
        background:bad?"linear-gradient(135deg,rgba(239,68,68,.05),transparent)":"linear-gradient(135deg,rgba(34,197,94,.04),transparent)" }}/>}
      <div style={{ fontSize:10.5,color:"var(--text-muted)",fontWeight:500,marginBottom:4,
        textTransform:"uppercase",letterSpacing:".06em" }}>{label}</div>
      <div style={{ fontSize:23,fontWeight:700,fontFamily:"var(--mono)",color,lineHeight:1.1 }}>{value}</div>
      {spark && <div style={{ marginTop:7 }}><Spark data={spark} color={color} h={26}/></div>}
    </div>
  );
}

export function Gauge({ value=0 }) {
  const v=Math.max(-100,Math.min(100,value));
  const rad=((-90+(v/100*90))*Math.PI)/180;
  const cx=80,cy=76,r=56;
  const nx=cx+r*Math.cos(rad), ny=cy+r*Math.sin(rad);
  const col=v<-20?"#ef4444":v>20?"#22c55e":"#f59e0b";
  const lbl=v<-20?"Negative Sentiment":v>20?"Positive Sentiment":"Neutral";
  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",padding:"6px 0" }}>
      <svg width="160" height="96" viewBox="0 0 160 96">
        <defs><linearGradient id="gt" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ef4444"/>
          <stop offset="40%" stopColor="#f59e0b"/>
          <stop offset="70%" stopColor="#84cc16"/>
          <stop offset="100%" stopColor="#22c55e"/>
        </linearGradient></defs>
        <path d="M24,76 A56,56 0 0,1 136,76" fill="none" stroke="rgba(96,165,250,.08)" strokeWidth="11" strokeLinecap="round"/>
        <path d="M24,76 A56,56 0 0,1 136,76" fill="none" stroke="url(#gt)" strokeWidth="11" strokeLinecap="round"/>
        <line x1={cx} y1={cy} x2={nx.toFixed(1)} y2={ny.toFixed(1)} stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r="4.5" fill="white"/>
        <text x="18" y="92" fill="#22c55e" fontSize="8.5" fontFamily="Space Grotesk">Positive</text>
        <text x="66" y="92" fill="#f59e0b" fontSize="8.5" fontFamily="Space Grotesk">Neutral</text>
        <text x="116" y="92" fill="#ef4444" fontSize="8.5" fontFamily="Space Grotesk">Negative</text>
      </svg>
      <div style={{ fontSize:36,fontWeight:700,fontFamily:"var(--mono)",color,lineHeight:1 }}>
        {v>0?"+":""}{value.toFixed(1)}
      </div>
      <div style={{ fontSize:11.5,color:col,fontWeight:600,marginTop:4 }}>{lbl}</div>
    </div>
  );
}

export function Donut({ data=[] }) {
  const r=43,cx=58,cy=58; let off=0;
  const segs=data.map(d=>{
    const sl=(d.value/100)*Math.PI*2;
    const x1=cx+r*Math.sin(off),y1=cy-r*Math.cos(off);
    const x2=cx+r*Math.sin(off+sl),y2=cy-r*Math.cos(off+sl);
    const lg=sl>Math.PI?1:0;
    const path=`M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${lg},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
    off+=sl; return {...d,path};
  });
  return (
    <div style={{ display:"flex",gap:14,alignItems:"center" }}>
      <svg width="116" height="116" viewBox="0 0 116 116" style={{ flexShrink:0 }}>
        {segs.map((s,i)=><path key={i} d={s.path} fill={s.color} opacity=".85"/>)}
        <circle cx={58} cy={58} r={26} fill="var(--bg-card)"/>
      </svg>
      <div style={{ flex:1,display:"flex",flexDirection:"column",gap:8 }}>
        {data.map((d,i)=>(
          <div key={i} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12 }}>
            <div style={{ display:"flex",alignItems:"center",gap:7 }}>
              <div style={{ width:7,height:7,borderRadius:"50%",background:d.color }}/>
              <span style={{ color:"var(--text-secondary)" }}>{d.label}</span>
            </div>
            <span style={{ fontFamily:"var(--mono)",fontSize:11 }}>{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarChart({ data=[] }) {
  const mx=Math.max(...data.map(d=>d.v),1);
  return (
    <div style={{ display:"flex",alignItems:"flex-end",gap:4,height:62 }}>
      {data.map((d,i)=>(
        <div key={i} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3 }}>
          <div style={{ width:"100%",borderRadius:"3px 3px 0 0",
            height:`${(d.v/mx)*52}px`,background:d.c||"var(--accent)",transition:"height .5s ease" }}/>
          <span style={{ fontSize:9,color:"var(--text-muted)" }}>{d.l}</span>
        </div>
      ))}
    </div>
  );
}

export function PBar({ label, pct, color, right }) {
  return (
    <div style={{ marginBottom:9 }}>
      <div style={{ display:"flex",justifyContent:"space-between",fontSize:11.5,marginBottom:4 }}>
        <span style={{ color:"var(--text-secondary)" }}>{label}</span>
        <span style={{ fontFamily:"var(--mono)",color,fontWeight:600 }}>{right??`${pct}%`}</span>
      </div>
      <div style={{ height:4,background:"var(--bg-hover)",borderRadius:2,overflow:"hidden" }}>
        <div style={{ width:`${Math.min(100,pct)}%`,height:"100%",background:color,
          borderRadius:2,transition:"width .5s ease" }}/>
      </div>
    </div>
  );
}

export function FLabel({ children }) {
  return <div style={{ fontSize:11.5,color:"var(--text-secondary)",fontWeight:500,marginBottom:6 }}>{children}</div>;
}

export function Slider({ label, min, max, step=1, value, onChange, fmt }) {
  return (
    <div style={{ marginBottom:13 }}>
      <FLabel>{label}: <span style={{ color:"var(--text-primary)",fontFamily:"var(--mono)" }}>{fmt?fmt(value):value}</span></FLabel>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e=>onChange(+e.target.value)}
        style={{ background:`linear-gradient(to right,var(--accent) ${((value-min)/(max-min))*100}%,var(--bg-hover) 0%)` }}/>
    </div>
  );
}

export function Toggle({ opts, value, onChange }) {
  return (
    <div style={{ display:"flex",gap:3,background:"var(--bg-card2)",borderRadius:6,padding:3 }}>
      {opts.map(o=>(
        <button key={o} onClick={()=>onChange(o)} style={{
          flex:1,padding:"5px 4px",border:"none",borderRadius:4,cursor:"pointer",
          background:value===o?"var(--bg-hover)":"transparent",
          color:value===o?"var(--text-primary)":"var(--text-muted)",
          fontFamily:"var(--font)",fontSize:11,fontWeight:value===o?600:400,transition:"all .15s",
        }}>{o}</button>
      ))}
    </div>
  );
}

export function Btn({ children, onClick, disabled, style }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width:"100%",padding:"10px",cursor:disabled?"not-allowed":"pointer",
      background:disabled?"var(--bg-hover)":"linear-gradient(135deg,var(--accent),#1d4ed8)",
      border:"none",borderRadius:"var(--r)",color:disabled?"var(--text-muted)":"#fff",
      fontFamily:"var(--font)",fontSize:13.5,fontWeight:600,
      transition:"all .15s",opacity:disabled?.6:1,...style,
    }}>{children}</button>
  );
}

export function OBtn({ children, onClick, disabled, style }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding:"6px 13px",background:"transparent",cursor:disabled?"not-allowed":"pointer",
      border:"1px solid var(--border-bright)",borderRadius:"var(--r)",
      color:disabled?"var(--text-muted)":"var(--accent)",
      fontFamily:"var(--font)",fontSize:12,fontWeight:500,
      transition:"background .15s",opacity:disabled?.6:1,...style,
    }}>{children}</button>
  );
}

export function Chip({ label, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      display:"inline-flex",alignItems:"center",padding:"4px 10px",
      borderRadius:6,cursor:"pointer",background:"var(--bg-card2)",
      border:`1px solid ${active?"var(--accent)":"var(--border)"}`,
      color:active?"var(--accent)":"var(--text-secondary)",
      fontSize:12,fontWeight:active?600:400,transition:"all .15s",
    }}>{label}</div>
  );
}
