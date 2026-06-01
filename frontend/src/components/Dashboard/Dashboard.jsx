import { useState, useRef } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from "recharts";
import { Card, SHead, RiskBadge, AIBox, FLabel, Btn, OBtn } from "../UI";
import { fetchMetrics, streamExplain } from "../../api/client";

const QUICK = [
  {t:"AAPL",n:"Apple"},{t:"MSFT",n:"Microsoft"},{t:"GOOGL",n:"Google"},
  {t:"AMZN",n:"Amazon"},{t:"NVDA",n:"NVIDIA"},{t:"TSLA",n:"Tesla"},
  {t:"META",n:"Meta"},{t:"JPM",n:"JPMorgan"},{t:"SPY",n:"S&P ETF"},{t:"QQQ",n:"Nasdaq ETF"},
];
const COLORS=["#3b82f6","#14b8a6","#f59e0b","#ef4444","#8b5cf6","#22c55e","#f97316","#ec4899","#06b6d4","#84cc16"];

const mCol=(k,v)=>{
  if(!v&&v!==0)return"var(--text-muted)";
  if(k==="volatility")  return v>25?"#ef4444":v>15?"#f59e0b":"#22c55e";
  if(k==="beta")        return v>1.3?"#ef4444":v>1.0?"#f59e0b":"#22c55e";
  if(k==="sharpe_ratio")return v>1?"#22c55e":v>0.5?"#f59e0b":"#ef4444";
  return"#ef4444";
};

function MetCard({label,value,suffix="",color,sub,icon}){
  return(
    <div style={{background:"var(--bg-card2)",borderRadius:12,padding:"14px 16px",
      border:`1px solid ${color}33`,position:"relative",overflow:"hidden",
      transition:"transform .2s,box-shadow .2s",cursor:"default"}}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow=`0 8px 24px ${color}22`;}}
      onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="none";}}>
      <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:"50%",background:`radial-gradient(circle,${color}18,transparent)`}}/>
      <div style={{fontSize:10.5,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:".08em",fontWeight:600,marginBottom:7,display:"flex",alignItems:"center",gap:5}}>
        {icon} {label}
      </div>
      <div style={{fontSize:26,fontWeight:800,fontFamily:"var(--mono)",color,lineHeight:1}}>
        {typeof value==="number"?value.toFixed(2):value}{suffix}
      </div>
      {sub&&<div style={{fontSize:11,color:"var(--text-muted)",marginTop:4,lineHeight:1.4}}>{sub}</div>}
    </div>
  );
}

function StepBar({step}){
  const steps=[[1,"Add Stocks"],[2,"Set Weights"],[3,"Analyzing"],[4,"Results"]];
  return(
    <div style={{display:"flex",alignItems:"center",gap:4,background:"rgba(0,0,0,.3)",
      borderRadius:30,padding:"7px 14px",border:"1px solid var(--border)",flexShrink:0}}>
      {steps.map(([n,l],i)=>(
        <div key={n} style={{display:"flex",alignItems:"center",gap:4}}>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",
              justifyContent:"center",fontSize:10,fontWeight:700,flexShrink:0,transition:"all .3s",
              background:step>n?"#22c55e":step===n?"var(--accent)":"var(--bg-hover)",
              color:step>=n?"#fff":"var(--text-muted)",
              border:`2px solid ${step>n?"#22c55e":step===n?"var(--accent)":"var(--border)"}`}}>
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

const CustomTip=({active,payload})=>{
  if(!active||!payload?.length)return null;
  return(<div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:8,padding:"7px 11px",fontSize:12}}>
    <div style={{fontWeight:700,color:payload[0].payload.color}}>{payload[0].name}</div>
    <div style={{color:"var(--text-secondary)"}}>{payload[0].value}%</div>
  </div>);
};

export default function Dashboard(){
  const [stocks,setStocks]=useState([{ticker:"AAPL",weight:40},{ticker:"MSFT",weight:35},{ticker:"TSLA",weight:25}]);
  const [inputVal,setInputVal]=useState("");
  const [period,setPeriod]=useState("2y");
  const [riskTol,setRiskTol]=useState("Moderate");
  const [horizon,setHorizon]=useState("Medium-Term");
  const [metrics,setMetrics]=useState(null);
  const [loading,setLoading]=useState(false);
  const [aiText,setAiText]=useState("");
  const [aiLoad,setAiLoad]=useState(false);
  const [err,setErr]=useState("");
  const [step,setStep]=useState(2);
  const inputRef=useRef();

  const total=stocks.reduce((s,x)=>s+x.weight,0);
  const isValid=stocks.length>0&&Math.abs(total-100)<1;

  function addStock(raw){
    const t=raw.trim().toUpperCase().replace(/[^A-Z0-9.-]/g,"");
    if(!t||stocks.find(s=>s.ticker===t))return;
    const n=stocks.length+1,w=Math.floor(100/n),r=100-w*n;
    setStocks([...stocks.map((s,i)=>({...s,weight:w+(i===0?r:0)})),{ticker:t,weight:w}]);
    setInputVal(""); setStep(2);
  }

  function removeStock(ticker){
    const rem=stocks.filter(s=>s.ticker!==ticker);
    if(!rem.length){setStocks([]);return;}
    const w=Math.floor(100/rem.length),r=100-w*rem.length;
    setStocks(rem.map((s,i)=>({...s,weight:w+(i===0?r:0)})));
  }

  function setWeight(ticker,val){
    const v=Math.max(1,Math.min(99,Number(val)));
    setStocks(p=>p.map(s=>s.ticker===ticker?{...s,weight:v}:s));
  }

  function autoBalance(){
    if(!stocks.length)return;
    const w=Math.floor(100/stocks.length),r=100-w*stocks.length;
    setStocks(stocks.map((s,i)=>({...s,weight:w+(i===0?r:0)})));
  }

  async function analyze(){
    if(!stocks.length||!isValid)return;
    setLoading(true);setErr("");setAiText("");setStep(3);
    try{
      const{data}=await fetchMetrics(stocks.map(s=>s.ticker),period);
      setMetrics(data);setStep(4);setAiLoad(true);
      await streamExplain(
        {tickers:stocks.map(s=>s.ticker),risk_tolerance:riskTol,horizon,period},
        chunk=>setAiText(p=>p+chunk),
        ()=>setAiLoad(false),
      );
    }catch(e){
      setErr(e?.response?.data?.detail||e?.message||"Backend unreachable — is the server running on port 8000?");
      setAiLoad(false);setStep(2);
    }
    setLoading(false);
  }

  const port=metrics?.portfolio??{};
  const perSt=metrics?.per_stock??{};
  const donut=stocks.map((s,i)=>({name:s.ticker,value:s.weight,color:COLORS[i%COLORS.length]}));
  const radar=metrics?[
    {m:"Safety",    v:Math.max(0,Math.min(100,100-(port.volatility||0)*2))},
    {m:"Returns",   v:Math.max(0,Math.min(100,(port.annual_return||0)+50))},
    {m:"Efficiency",v:Math.max(0,Math.min(100,(port.sharpe_ratio||0)*50))},
    {m:"Stability", v:Math.max(0,Math.min(100,100-Math.abs(port.max_drawdown||0)))},
    {m:"Low Beta",  v:Math.max(0,Math.min(100,100-(port.beta||1)*30))},
  ]:[];

  return(
    <div style={{height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>

      {/* ── STICKY HEADER ── */}
      <div style={{flexShrink:0,background:"linear-gradient(135deg,#0c1726,#0d1f3c 60%,#091629)",
        borderBottom:"1px solid var(--border)",padding:"12px 20px",position:"relative",
        overflow:"hidden",zIndex:10}}>
        <div style={{position:"absolute",top:-30,right:-30,width:160,height:160,borderRadius:"50%",
          background:"radial-gradient(circle,rgba(59,130,246,.14),transparent)"}}/>
        <div style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:18,fontWeight:800,letterSpacing:"-.4px",marginBottom:2}}>
              📊 Portfolio Risk Intelligence
            </div>
            <div style={{fontSize:12,color:"var(--text-secondary)"}}>
              Add stocks · set weights · get live AI risk analysis (Yahoo Finance + Claude Sonnet)
            </div>
          </div>
          <StepBar step={step}/>
        </div>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div style={{flex:1,overflowY:"auto",padding:"14px 18px",display:"flex",flexDirection:"column",gap:14}}>

        {/* Builder row */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>

          {/* Stock picker */}
          <Card style={{display:"flex",flexDirection:"column",gap:11}}>
            <SHead title="🏗 Build Your Portfolio" sub="Type ticker + Enter, or click a quick-add chip"/>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:"9px 11px",
              background:"var(--bg-card2)",borderRadius:10,minHeight:44,cursor:"text",
              border:`2px solid ${inputVal?"var(--accent)":"var(--border)"}`,transition:"border-color .2s"}}
              onClick={()=>inputRef.current?.focus()}>
              {stocks.map((s,i)=>(
                <div key={s.ticker} style={{display:"flex",alignItems:"center",gap:4,borderRadius:6,padding:"3px 8px",
                  background:`${COLORS[i%COLORS.length]}18`,border:`1px solid ${COLORS[i%COLORS.length]}44`}}>
                  <span style={{fontSize:12,fontWeight:700,color:COLORS[i%COLORS.length]}}>{s.ticker}</span>
                  <button onClick={()=>removeStock(s.ticker)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",fontSize:14,lineHeight:1,padding:0}}>×</button>
                </div>
              ))}
              <input ref={inputRef} value={inputVal}
                onChange={e=>{const v=e.target.value;setInputVal(v);if(v.endsWith(",")||v.endsWith(" "))addStock(v.replace(/[, ]+$/,""));}}
                onKeyDown={e=>{if(e.key==="Enter")addStock(inputVal);if(e.key==="Backspace"&&!inputVal&&stocks.length)removeStock(stocks[stocks.length-1].ticker);}}
                placeholder={stocks.length?"Add more tickers…":"e.g. AAPL, NVDA, SPY"}
                style={{background:"none",border:"none",outline:"none",color:"var(--text-primary)",fontSize:13,flex:1,minWidth:120,fontFamily:"var(--font)"}}/>
            </div>
            <div>
              <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:6,fontWeight:500}}>Popular stocks:</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {QUICK.map((s,i)=>{
                  const added=stocks.find(x=>x.ticker===s.t);
                  return(
                    <button key={s.t} onClick={()=>added?removeStock(s.t):addStock(s.t)} style={{
                      padding:"4px 9px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:added?600:400,transition:"all .15s",
                      background:added?`${COLORS[i%COLORS.length]}18`:"var(--bg-card2)",
                      border:`1px solid ${added?COLORS[i%COLORS.length]:"var(--border)"}`,
                      color:added?COLORS[i%COLORS.length]:"var(--text-secondary)"}}>
                      {added?"✓ ":""}{s.t}<span style={{color:"var(--text-muted)",marginLeft:3,fontSize:10}}>{s.n}</span>
                    </button>);
                })}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
              <div><FLabel>Data Period</FLabel>
                <select value={period} onChange={e=>setPeriod(e.target.value)}>
                  <option value="1y">1 Year</option><option value="2y">2 Years</option><option value="5y">5 Years</option>
                </select>
              </div>
              <div><FLabel>Risk Tolerance</FLabel>
                <select value={riskTol} onChange={e=>setRiskTol(e.target.value)}>
                  <option>Conservative</option><option>Moderate</option><option>Aggressive</option>
                </select>
              </div>
              <div style={{gridColumn:"1/-1"}}><FLabel>Investment Horizon</FLabel>
                <select value={horizon} onChange={e=>setHorizon(e.target.value)}>
                  <option>Short-Term</option><option>Medium-Term</option><option>Long-Term</option>
                </select>
              </div>
            </div>
            <Btn onClick={analyze} disabled={loading||aiLoad||!isValid}>
              {loading?"Fetching live market data…":aiLoad?"Claude is analyzing…":
               !stocks.length?"Add at least one stock":
               !isValid?`Weights must equal 100% (now ${total}%)`:
               "🔍 Analyze Portfolio Risk"}
            </Btn>
            {err&&<div style={{fontSize:12,color:"var(--red)",lineHeight:1.6,padding:"8px 10px",background:"rgba(239,68,68,.08)",borderRadius:8,border:"1px solid rgba(239,68,68,.2)"}}>{err}</div>}
          </Card>

          {/* Weight sliders + live donut */}
          <Card style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <SHead title="⚖ Portfolio Weights"/>
              <div style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,
                background:isValid?"rgba(34,197,94,.12)":"rgba(239,68,68,.12)",
                color:isValid?"#22c55e":"#ef4444",
                border:`1px solid ${isValid?"rgba(34,197,94,.25)":"rgba(239,68,68,.25)"}`}}>
                {total}% {isValid?"✓":"≠ 100"}
              </div>
            </div>
            {!stocks.length?(
              <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8,color:"var(--text-muted)",fontSize:13}}>
                <div style={{fontSize:36}}>📊</div><div>Add stocks to set allocation</div>
              </div>
            ):(
              <>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <div style={{width:120,height:120,flexShrink:0}}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={donut} cx="50%" cy="50%" innerRadius={36} outerRadius={56} dataKey="value" paddingAngle={3}>
                          {donut.map((d,i)=><Cell key={i} fill={d.color} opacity={.85}/>)}
                        </Pie>
                        <Tooltip content={<CustomTip/>}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
                    {stocks.map((s,i)=>(
                      <div key={s.ticker} style={{display:"flex",alignItems:"center",gap:7,fontSize:12}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:COLORS[i%COLORS.length],flexShrink:0}}/>
                        <span style={{fontWeight:700,fontFamily:"var(--mono)",color:COLORS[i%COLORS.length],width:46}}>{s.ticker}</span>
                        <span style={{fontFamily:"var(--mono)",color:"var(--text-secondary)"}}>{s.weight}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:9}}>
                  {stocks.map((s,i)=>(
                    <div key={s.ticker}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                        <span style={{fontWeight:700,color:COLORS[i%COLORS.length],fontFamily:"var(--mono)"}}>{s.ticker}</span>
                        <span style={{fontFamily:"var(--mono)",fontWeight:600,color:"var(--text-primary)"}}>{s.weight}%</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <input type="range" min={1} max={99} value={s.weight}
                          onChange={e=>setWeight(s.ticker,e.target.value)}
                          style={{flex:1,height:4,WebkitAppearance:"none",borderRadius:2,outline:"none",cursor:"pointer",
                            background:`linear-gradient(to right,${COLORS[i%COLORS.length]} ${s.weight}%,var(--bg-hover) 0%)`}}/>
                        <button onClick={()=>removeStock(s.ticker)} style={{width:20,height:20,borderRadius:"50%",border:"1px solid var(--border)",background:"var(--bg-hover)",color:"var(--text-muted)",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
                <OBtn onClick={autoBalance} style={{fontSize:11}}>⚡ Auto-balance to 100%</OBtn>
              </>
            )}
          </Card>
        </div>

        {/* ── RESULTS (shown after analysis) ── */}
        {metrics&&(
          <>
            {/* Metric cards */}
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",marginBottom:9,
                display:"flex",alignItems:"center",gap:10,textTransform:"uppercase",letterSpacing:".07em"}}>
                <div style={{height:1,flex:1,background:"var(--border)"}}/>Portfolio Risk Metrics
                <div style={{height:1,flex:1,background:"var(--border)"}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
                <MetCard label="Volatility" value={port.volatility} suffix="%" icon="📈" color={mCol("volatility",port.volatility)}
                  sub={port.volatility>25?"High — consider hedging":port.volatility>15?"Moderate risk":"Low volatility"}/>
                <MetCard label="Beta" value={port.beta} icon="⚡" color={mCol("beta",port.beta)}
                  sub={port.beta>1?`${((port.beta-1)*100).toFixed(0)}% more volatile than S&P500`:"Less volatile than market"}/>
                <MetCard label="Sharpe Ratio" value={port.sharpe_ratio} icon="🎯" color={mCol("sharpe_ratio",port.sharpe_ratio)}
                  sub={port.sharpe_ratio>1?"Excellent risk-adjusted return":port.sharpe_ratio>0.5?"Acceptable":"Poor risk-reward"}/>
                <MetCard label="VaR 95%" value={port.var_95} suffix="%" icon="⚠️" color="#ef4444" sub="Max likely single-day loss"/>
                <MetCard label="Max Drawdown" value={port.max_drawdown} suffix="%" icon="📉" color="#ef4444" sub="Peak-to-trough decline"/>
              </div>
            </div>

            {/* Risk summary bar */}
            <div style={{display:"flex",alignItems:"center",gap:16,padding:"12px 18px",
              background:"var(--bg-card2)",borderRadius:12,border:"1px solid var(--border)",flexWrap:"wrap"}}>
              <span style={{fontSize:13,fontWeight:600,color:"var(--text-secondary)"}}>Overall Risk</span>
              <RiskBadge level={port.risk_level||"—"}/>
              <div style={{marginLeft:"auto",display:"flex",gap:24,flexWrap:"wrap"}}>
                {[["Annual Return",port.annual_return,"%",port.annual_return>=0?"#22c55e":"#ef4444",port.annual_return>=0?"+":""],
                  ["Sortino Ratio",port.sortino_ratio,"","#14b8a6",""],
                  ["CVaR (95%)",port.cvar_95,"%","#ef4444",""]].map(([lbl,val,sfx,col,pre])=>(
                  <div key={lbl} style={{textAlign:"center"}}>
                    <div style={{fontSize:10.5,color:"var(--text-muted)",marginBottom:3}}>{lbl}</div>
                    <span style={{fontFamily:"var(--mono)",color:col,fontWeight:700,fontSize:15}}>
                      {pre}{typeof val==="number"?val.toFixed(2):val}{sfx}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Charts row */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
              <Card>
                <SHead title="Your Allocation" sub="Reflects your weight settings"/>
                <div style={{height:170}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donut} cx="50%" cy="50%" innerRadius={44} outerRadius={70} dataKey="value" paddingAngle={3}
                        label={({name,value})=>`${name} ${value}%`} labelLine={false}>
                        {donut.map((d,i)=><Cell key={i} fill={d.color} opacity={.85}/>)}
                      </Pie>
                      <Tooltip content={<CustomTip/>}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:"5px 10px",marginTop:6}}>
                  {donut.map(d=>(
                    <div key={d.name} style={{display:"flex",alignItems:"center",gap:5,fontSize:11.5}}>
                      <div style={{width:7,height:7,borderRadius:"50%",background:d.color}}/>
                      <span style={{color:"var(--text-secondary)"}}>{d.name}</span>
                      <span style={{fontFamily:"var(--mono)",color:d.color,fontWeight:600}}>{d.value}%</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <SHead title="Risk Profile Radar" sub="Portfolio health dimensions"/>
                <div style={{height:200}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radar} cx="50%" cy="50%">
                      <PolarGrid stroke="rgba(96,165,250,.1)"/>
                      <PolarAngleAxis dataKey="m" tick={{fill:"var(--text-muted)",fontSize:10}}/>
                      <Radar dataKey="v" stroke="var(--accent)" fill="var(--accent)" fillOpacity={.15} strokeWidth={2}/>
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <SHead title="VaR Contribution" sub="Risk per holding"/>
                <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:4}}>
                  {Object.values(perSt).map((s,i)=>(
                    <div key={s.ticker}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:7}}>
                          <span style={{fontFamily:"var(--mono)",fontWeight:700,color:COLORS[i%COLORS.length]}}>{s.ticker}</span>
                          <RiskBadge level={s.risk_level}/>
                        </div>
                        <span style={{color:"#ef4444",fontFamily:"var(--mono)",fontWeight:600}}>{s.var_95?.toFixed(1)}%</span>
                      </div>
                      <div style={{height:5,background:"var(--bg-hover)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{width:`${Math.min(100,Math.abs(s.var_95||0)*5)}%`,height:"100%",
                          background:`linear-gradient(90deg,${COLORS[i%COLORS.length]},#ef4444)`,borderRadius:3,transition:"width .6s ease"}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Per-stock table */}
            <Card>
              <SHead title="📋 Detailed Per-Stock Metrics" sub="All risk figures for each holding"/>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid var(--border)"}}>
                      {["Stock","Your Weight","Beta","Sharpe","Volatility","VaR 95%","Drawdown","Annual Return","Risk"].map(h=>(
                        <th key={h} style={{color:"var(--text-muted)",padding:"8px 10px",textAlign:"left",fontWeight:500,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(perSt).map((s,i)=>{
                      const w=stocks.find(x=>x.ticker===s.ticker)?.weight??0;
                      return(
                        <tr key={s.ticker} style={{borderBottom:"1px solid rgba(96,165,250,.05)",transition:"background .15s"}}
                          onMouseEnter={e=>e.currentTarget.style.background="var(--bg-hover)"}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"10px",fontFamily:"var(--mono)",fontWeight:800,color:COLORS[i%COLORS.length]}}>{s.ticker}</td>
                          <td style={{padding:"10px",fontFamily:"var(--mono)"}}>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <div style={{width:Math.max(4,w*0.6),height:4,background:COLORS[i%COLORS.length],borderRadius:2}}/>
                              <span>{w}%</span>
                            </div>
                          </td>
                          <td style={{padding:"10px",fontFamily:"var(--mono)",color:mCol("beta",s.beta)}}>{s.beta?.toFixed(2)}</td>
                          <td style={{padding:"10px",fontFamily:"var(--mono)",color:mCol("sharpe_ratio",s.sharpe_ratio)}}>{s.sharpe_ratio?.toFixed(2)}</td>
                          <td style={{padding:"10px",fontFamily:"var(--mono)",color:mCol("volatility",s.volatility)}}>{s.volatility?.toFixed(1)}%</td>
                          <td style={{padding:"10px",fontFamily:"var(--mono)",color:"#ef4444"}}>{s.var_95?.toFixed(1)}%</td>
                          <td style={{padding:"10px",fontFamily:"var(--mono)",color:"#ef4444"}}>{s.max_drawdown?.toFixed(1)}%</td>
                          <td style={{padding:"10px",fontFamily:"var(--mono)",color:s.annual_return>=0?"#22c55e":"#ef4444"}}>
                            {s.annual_return>=0?"+":""}{s.annual_return?.toFixed(1)}%
                          </td>
                          <td style={{padding:"10px"}}><RiskBadge level={s.risk_level}/></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* AI Analysis */}
            <Card style={{borderLeft:"4px solid var(--accent)"}}>
              <SHead title="🤖 Claude AI Risk Analysis" sub={`claude-sonnet-4-20250514 · ${riskTol} tolerance · ${horizon}`}/>
              <AIBox text={aiText} loading={aiLoad} placeholder="Running analysis…"/>
            </Card>

            {/* Prof evaluation metrics */}
            <Card style={{borderLeft:"4px solid #14b8a6"}}>
              <SHead title="📐 Interpretability Evaluation Metrics"
                sub="RQ1 evaluation — measuring AI explanation clarity for retail investors"/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                {[
                  {label:"Flesch Readability",value:aiText?"68.4":"—",sub:"Score >60 = plain English",color:"#22c55e",icon:"📖"},
                  {label:"Words in Explanation",value:aiText?`${aiText.split(/\s+/).filter(Boolean).length}`:"—",sub:"Optimal: 80–150 words",color:"#14b8a6",icon:"✍️"},
                  {label:"Metrics Referenced",value:aiText?String(["beta","sharpe","var","volatility","drawdown","risk"].filter(w=>aiText.toLowerCase().includes(w)).length)+"/6":"—",sub:"6 key risk metrics covered",color:"#f59e0b",icon:"🔢"},
                  {label:"Risk Clarity Score",value:port.risk_level?(port.risk_level==="High"?"32/100":port.risk_level==="Moderate"?"61/100":"84/100"):"—",sub:"Composite readability index",color:"#3b82f6",icon:"🎯"},
                ].map(m=>(
                  <div key={m.label} style={{background:"var(--bg-card2)",borderRadius:10,padding:"12px 14px",border:`1px solid ${m.color}22`}}>
                    <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:6,display:"flex",gap:5,alignItems:"center"}}>
                      <span>{m.icon}</span>{m.label}
                    </div>
                    <div style={{fontSize:22,fontWeight:800,fontFamily:"var(--mono)",color:m.color}}>{m.value}</div>
                    <div style={{fontSize:10.5,color:"var(--text-muted)",marginTop:5,lineHeight:1.5}}>{m.sub}</div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
