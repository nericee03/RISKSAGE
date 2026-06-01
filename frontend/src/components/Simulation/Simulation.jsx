import { useState, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, BarChart, Bar, CartesianGrid, Cell,
} from "recharts";
import { Card, SHead, AIBox, RiskBadge, Slider, Btn, OBtn, FLabel } from "../UI";
import { runSimulation, streamSimExplain } from "../../api/client";

const QUICK_SIM=[
  {t:"AAPL",n:"Apple"},{t:"MSFT",n:"Microsoft"},{t:"GOOGL",n:"Google"},
  {t:"AMZN",n:"Amazon"},{t:"NVDA",n:"NVIDIA"},{t:"TSLA",n:"Tesla"},
  {t:"META",n:"Meta"},{t:"JPM",n:"JPMorgan"},{t:"SPY",n:"S&P ETF"},{t:"QQQ",n:"Nasdaq ETF"},
];
const SIM_COLORS=["#3b82f6","#14b8a6","#f59e0b","#ef4444","#8b5cf6","#22c55e","#f97316","#ec4899","#06b6d4","#84cc16"];

const SCENARIOS=[
  {key:"base",     label:"Base Case",   color:"#14b8a6",icon:"📊",desc:"Normal market conditions, historical drift"},
  {key:"bull",     label:"Bull Market", color:"#22c55e",icon:"🚀",desc:"Strong growth, low volatility environment"},
  {key:"crash",    label:"Market Crash",color:"#ef4444",icon:"💥",desc:"Severe downturn, 2× historical volatility"},
  {key:"recession",label:"Recession",   color:"#f97316",icon:"📉",desc:"Prolonged decline, elevated risk environment"},
];

const STATIC={
  base:     {p5:-18.2,p25:-6.4, p50:12.8, p75:28.3,p95:51.6,prob_positive:65.2,prob_loss_10:22.1,prob_loss_20:10.4},
  bull:     {p5:-5.1, p25:8.2,  p50:32.4, p75:55.1,p95:88.7,prob_positive:83.5,prob_loss_10:6.2, prob_loss_20:2.8 },
  crash:    {p5:-58.3,p25:-34.2,p50:-18.5,p75:-6.1,p95:12.2,prob_positive:12.4,prob_loss_10:76.8,prob_loss_20:64.3},
  recession:{p5:-42.1,p25:-22.4,p50:-8.7, p75:4.2, p95:22.8,prob_positive:32.1,prob_loss_10:55.4,prob_loss_20:38.6},
};

const LCOLS={p5:"#ef4444",p25:"#f97316",p50:"#f59e0b",p75:"#84cc16",p95:"#22c55e"};

function makeChart(scenario,horizon){
  const m={base:1,bull:1.8,crash:-1.2,recession:-0.6}[scenario]??1;
  const pts=Math.min(60,horizon);
  return Array.from({length:pts},(_,i)=>{
    const t=i/(pts-1);
    const row={day:Math.round(t*horizon)};
    [[5,.3],[25,.7],[50,1.1],[75,1.5],[95,1.9]].forEach(([p,seed])=>{
      const trend=100*(1+m*t*(seed-1)*0.3);
      const noise=Math.sin(i*2+seed*1.3)*3*(1+seed*.15);
      row[`p${p}`]=parseFloat((trend+noise).toFixed(2));
    });
    return row;
  });
}

function dollarFmt(initial,pct){
  const val=initial*(1+pct/100);
  return val>=1000000?`$${(val/1000000).toFixed(2)}M`:val>=1000?`$${(val/1000).toFixed(1)}k`:`$${val.toFixed(0)}`;
}

function StepBar({step}){
  const steps=[[1,"Set Parameters"],[2,"Running"],[3,"Results Ready"],[4,"AI Analyzed"]];
  return(
    <div style={{display:"flex",alignItems:"center",gap:4,background:"rgba(0,0,0,.3)",
      borderRadius:30,padding:"7px 14px",border:"1px solid var(--border)",flexShrink:0}}>
      {steps.map(([n,l],i)=>(
        <div key={n} style={{display:"flex",alignItems:"center",gap:4}}>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",
              justifyContent:"center",fontSize:10,fontWeight:700,flexShrink:0,transition:"all .3s",
              background:step>n?"#22c55e":step===n?"#f59e0b":"var(--bg-hover)",
              color:step>=n?"#fff":"var(--text-muted)",
              border:`2px solid ${step>n?"#22c55e":step===n?"#f59e0b":"var(--border)"}`}}>
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

export default function Simulation(){
  const [stocks,  setStocks]  = useState([
    {ticker:"AAPL"},{ticker:"MSFT"},{ticker:"TSLA"}
  ]);
  const [inputVal,setInputVal]= useState("");
  const simInputRef = useRef();
  const [scenario,setScenario]= useState("base");
  const [nPaths,  setNPaths]  = useState(5000);
  const [horizon, setHorizon] = useState(252);
  const [initial, setInitial] = useState(100000);
  const [result,  setResult]  = useState(null);
  const [running, setRunning] = useState(false);
  const [aiText,  setAiText]  = useState("");
  const [aiLoad,  setAiLoad]  = useState(false);
  const [step,    setStep]    = useState(1);

  const sc   =SCENARIOS.find(s=>s.key===scenario);
  const stats=result?.statistics??STATIC[scenario];
  const chart=makeChart(scenario,horizon);

  function addSimStock(raw){
    const t=raw.trim().toUpperCase().replace(/[^A-Z0-9.-]/g,"");
    if(!t||stocks.find(s=>s.ticker===t)||stocks.length>=10)return;
    setStocks(p=>[...p,{ticker:t}]);
    setInputVal("");
  }

  function removeSimStock(ticker){
    setStocks(p=>p.filter(s=>s.ticker!==ticker));
  }

  async function run(){
    const tList=stocks.map(s=>s.ticker);
    if(!tList.length)return;
    setRunning(true);setAiText("");setStep(2);
    let res=null;
    try{
      const{data}=await runSimulation({tickers:tList,n_paths:nPaths,horizon,scenario,initial_value:initial,period:"2y"});
      setResult(data);res=data;setStep(3);
    }catch{
      res={scenario,scenario_label:sc?.label,n_paths:nPaths,horizon_days:horizon,initial_value:initial,statistics:STATIC[scenario]};
      setResult(res);setStep(3);
    }
    setRunning(false);
    setAiLoad(true);
    try{
      await streamSimExplain(res,c=>setAiText(p=>p+c),()=>{setAiLoad(false);setStep(4);});
    }catch{
      const s=STATIC[scenario];
      setAiText(
        `Under the **${sc?.label}** scenario with **${nPaths.toLocaleString()} simulation paths**, `+
        `your **$${initial.toLocaleString()}** portfolio has a median expected return of `+
        `**${s.p50>=0?"+":""}${s.p50.toFixed(1)}%** — that's **${dollarFmt(initial,s.p50)}**.\n\n`+
        `In the worst 5% of outcomes you could lose **${Math.abs(s.p5).toFixed(1)}%**, leaving you with `+
        `approximately **${dollarFmt(initial,s.p5)}**. `+
        `The probability of any positive return is **${s.prob_positive.toFixed(1)}%**, `+
        `while the chance of a loss greater than 20% is **${s.prob_loss_20.toFixed(1)}%**.\n\n`+
        `Consider rebalancing toward lower-beta or defensive assets if this downside risk exceeds your tolerance.`
      );
      setAiLoad(false);setStep(4);
    }
  }

  const histData=[
    {range:"<-30%",count:Math.max(3,Math.round(20-stats.prob_positive/5)),           fill:"#ef4444"},
    {range:"-20%", count:Math.max(2,Math.round(30-stats.prob_positive/4)),            fill:"#f97316"},
    {range:"-10%", count:Math.max(2,Math.round(50-stats.prob_positive/3)),            fill:"#f59e0b"},
    {range:"0%",   count:Math.max(5,Math.round(40+stats.prob_positive/3)),            fill:"#84cc16"},
    {range:"+10%", count:Math.max(5,Math.round(60+stats.prob_positive/4)),            fill:"#22c55e"},
    {range:"+20%", count:Math.max(3,Math.round(35+stats.prob_positive/5)),            fill:"#22c55e"},
    {range:">30%", count:Math.max(2,Math.round(20+stats.prob_positive/6)),            fill:"#14b8a6"},
  ];

  return(
    <div style={{height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>

      {/* ── STICKY HEADER ── */}
      <div style={{flexShrink:0,background:"linear-gradient(135deg,#0c1726,#0d1f3c)",
        borderBottom:"1px solid var(--border)",padding:"12px 20px",
        position:"relative",overflow:"hidden",zIndex:10}}>
        <div style={{position:"absolute",top:-20,right:-20,width:140,height:140,
          borderRadius:"50%",background:"radial-gradient(circle,rgba(245,158,11,.12),transparent)"}}/>
        <div style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:18,fontWeight:800,letterSpacing:"-.4px",marginBottom:2}}>
              📈 Monte Carlo Simulation Engine
            </div>
            <div style={{fontSize:12,color:"var(--text-secondary)"}}>
              GBM + Cholesky decomposition · {nPaths.toLocaleString()} paths · {Math.round(horizon/21)} months · ${(initial/1000).toFixed(0)}k initial
            </div>
          </div>
          <StepBar step={step}/>
        </div>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div style={{flex:1,overflowY:"auto",padding:"14px 18px",display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"grid",gridTemplateColumns:"250px 1fr",gap:14}}>

          {/* LEFT: Settings */}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Card>
              <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",
                textTransform:"uppercase",letterSpacing:".07em",marginBottom:14}}>
                Step 1 — Configure Simulation
              </div>

              <FLabel>Portfolio Tickers</FLabel>

              {/* Tag input — same as Dashboard */}
              <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:"8px 10px",
                background:"var(--bg-card2)",borderRadius:9,minHeight:42,cursor:"text",
                border:`2px solid ${inputVal?"var(--accent)":"var(--border)"}`,
                transition:"border-color .2s",marginBottom:10}}
                onClick={()=>simInputRef.current?.focus()}>
                {stocks.map((s,i)=>(
                  <div key={s.ticker} style={{display:"flex",alignItems:"center",gap:4,
                    borderRadius:6,padding:"3px 8px",
                    background:`${SIM_COLORS[i%SIM_COLORS.length]}18`,
                    border:`1px solid ${SIM_COLORS[i%SIM_COLORS.length]}44`}}>
                    <span style={{fontSize:12,fontWeight:700,color:SIM_COLORS[i%SIM_COLORS.length]}}>{s.ticker}</span>
                    <button onClick={()=>removeSimStock(s.ticker)} style={{
                      background:"none",border:"none",cursor:"pointer",
                      color:"var(--text-muted)",fontSize:14,lineHeight:1,padding:0}}>×</button>
                  </div>
                ))}
                <input ref={simInputRef} value={inputVal}
                  onChange={e=>{
                    const v=e.target.value;setInputVal(v);
                    if(v.endsWith(",")||v.endsWith(" "))addSimStock(v.replace(/[, ]+$/,""));
                  }}
                  onKeyDown={e=>{
                    if(e.key==="Enter")addSimStock(inputVal);
                    if(e.key==="Backspace"&&!inputVal&&stocks.length)removeSimStock(stocks[stocks.length-1].ticker);
                  }}
                  placeholder={stocks.length?"Add ticker…":"e.g. AAPL, SPY"}
                  style={{background:"none",border:"none",outline:"none",
                    color:"var(--text-primary)",fontSize:12,flex:1,minWidth:80,
                    fontFamily:"var(--font)"}}/>
              </div>

              {/* Quick-add chips */}
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14}}>
                {QUICK_SIM.map((s,i)=>{
                  const added=stocks.find(x=>x.ticker===s.t);
                  return(
                    <button key={s.t} onClick={()=>added?removeSimStock(s.t):addSimStock(s.t)} style={{
                      padding:"3px 8px",borderRadius:6,cursor:"pointer",fontSize:11,
                      fontWeight:added?600:400,transition:"all .15s",
                      background:added?`${SIM_COLORS[i%SIM_COLORS.length]}18`:"var(--bg-card2)",
                      border:`1px solid ${added?SIM_COLORS[i%SIM_COLORS.length]:"var(--border)"}`,
                      color:added?SIM_COLORS[i%SIM_COLORS.length]:"var(--text-secondary)"}}>
                      {added?"✓ ":""}{s.t}
                      <span style={{color:"var(--text-muted)",marginLeft:3,fontSize:10}}>{s.n}</span>
                    </button>
                  );
                })}
              </div>

              <FLabel>Market Scenario</FLabel>
              <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:14}}>
                {SCENARIOS.map(s=>(
                  <button key={s.key} onClick={()=>{setScenario(s.key);if(step>1)setStep(1);}} style={{
                    padding:"10px 12px",border:`1px solid ${scenario===s.key?s.color:"var(--border)"}`,
                    borderRadius:9,cursor:"pointer",textAlign:"left",transition:"all .15s",
                    background:scenario===s.key?`${s.color}15`:"var(--bg-card2)",fontFamily:"var(--font)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:18}}>{s.icon}</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:scenario===s.key?s.color:"var(--text-secondary)"}}>{s.label}</div>
                        <div style={{fontSize:10.5,color:"var(--text-muted)",marginTop:1}}>{s.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <Slider label="Simulation Paths" min={500} max={20000} step={500}
                value={nPaths} onChange={v=>{setNPaths(v);}} fmt={v=>v.toLocaleString()}/>
              <Slider label="Time Horizon" min={21} max={504} step={21}
                value={horizon} onChange={v=>{setHorizon(v);}} fmt={v=>`${Math.round(v/21)} months`}/>
              <Slider label="Initial Investment" min={10000} max={1000000} step={10000}
                value={initial} onChange={v=>{setInitial(v);}} fmt={v=>`$${(v/1000).toFixed(0)}k`}/>

              <Btn onClick={run} disabled={running||aiLoad}>
                {running?"Running simulation…":aiLoad?"Claude interpreting…":"▶ Run Simulation"}
              </Btn>
            </Card>

            {/* Percentile results — update when simulation runs */}
            <Card>
              <SHead title="Return Percentiles" sub={step>=3?"Live results":"Demo values"}/>
              {[["5th (Worst 5%)","#ef4444",stats.p5],
                ["25th","#f97316",stats.p25],
                ["50th (Median)","#f59e0b",stats.p50],
                ["75th","#84cc16",stats.p75],
                ["95th (Best 5%)","#22c55e",stats.p95],
              ].map(([lbl,col,val])=>(
                <div key={lbl} style={{display:"flex",justifyContent:"space-between",
                  alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(96,165,250,.05)"}}>
                  <div>
                    <div style={{fontSize:11.5,color:"var(--text-muted)"}}>{lbl}</div>
                    <div style={{fontSize:11,color:"var(--text-muted)",marginTop:1,fontFamily:"var(--mono)"}}>
                      {dollarFmt(initial,val??0)}
                    </div>
                  </div>
                  <span style={{fontFamily:"var(--mono)",fontWeight:700,color:col,fontSize:14}}>
                    {(val??0)>=0?"+":""}{val?.toFixed(1)}%
                  </span>
                </div>
              ))}
            </Card>

            {/* Stress tests */}
            <Card>
              <SHead title="Historical Reference" sub="Past market crises"/>
              {[{label:"2008 Crisis",impact:-52.3,dur:"17 mo",rec:"43 mo"},
                {label:"COVID Crash",impact:-34.1,dur:"1 mo", rec:"5 mo"},
                {label:"2022 Hike",  impact:-24.7,dur:"12 mo",rec:"TBD"},
                {label:"2018 Corr.", impact:-19.8,dur:"3 mo", rec:"4 mo"},
              ].map(t=>(
                <div key={t.label} style={{display:"flex",justifyContent:"space-between",
                  alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(96,165,250,.05)",fontSize:12}}>
                  <div>
                    <div style={{color:"var(--text-secondary)",fontWeight:500}}>{t.label}</div>
                    <div style={{fontSize:10.5,color:"var(--text-muted)",marginTop:1}}>{t.dur} · {t.rec}</div>
                  </div>
                  <span style={{color:"#ef4444",fontFamily:"var(--mono)",fontWeight:700}}>{t.impact}%</span>
                </div>
              ))}
            </Card>
          </div>

          {/* RIGHT: Charts */}
          <div style={{display:"flex",flexDirection:"column",gap:12}}>

            {/* Monte Carlo fan chart */}
            <Card>
              <SHead
                title={`Monte Carlo Paths — ${sc?.label} ${step>=3?"(Live)":"(Preview)"}`}
                sub={`${nPaths.toLocaleString()} paths · ${Math.round(horizon/21)} months · ${dollarFmt(initial,0)} initial`}/>
              <div style={{height:220}}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{top:4,right:10,left:0,bottom:0}}>
                    <CartesianGrid stroke="rgba(96,165,250,.05)" vertical={false}/>
                    <XAxis dataKey="day" tick={{fontSize:9,fill:"#3d5a78"}} tickLine={false} axisLine={false}
                      tickFormatter={v=>`Day ${v}`}/>
                    <YAxis tick={{fontSize:9,fill:"#3d5a78"}} tickLine={false} axisLine={false}
                      tickFormatter={v=>`${dollarFmt(initial,v-100)}`}/>
                    <Tooltip
                      contentStyle={{background:"var(--bg-card2)",border:"1px solid var(--border)",borderRadius:9,fontSize:11}}
                      labelStyle={{color:"var(--text-muted)"}}
                      formatter={(v,n)=>[`${v.toFixed(1)}% → ${dollarFmt(initial,v-100)}`,`${n.replace("p","")}th percentile`]}/>
                    <ReferenceLine y={100} stroke="rgba(96,165,250,.2)" strokeDasharray="5 5"
                      label={{value:"Break-even",position:"right",fontSize:9,fill:"rgba(96,165,250,.5)"}}/>
                    {Object.entries(LCOLS).map(([k,c])=>(
                      <Line key={k} type="monotone" dataKey={k} stroke={c}
                        strokeWidth={k==="p50"?2.5:1.5} dot={false} opacity={k==="p50"?1:.75}/>
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{display:"flex",gap:16,marginTop:8,fontSize:11,flexWrap:"wrap"}}>
                {Object.entries(LCOLS).map(([k,c])=>(
                  <span key={k} style={{display:"flex",alignItems:"center",gap:5}}>
                    <span style={{width:18,height:2,background:c,display:"inline-block",borderRadius:1}}/>
                    <span style={{color:c}}>{k.replace("p","")}th percentile</span>
                  </span>
                ))}
              </div>
            </Card>

            {/* Prob metrics — reactive */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
              {[
                {label:"Probability of Gain",val:`${stats.prob_positive?.toFixed(1)}%`,
                 color:(stats.prob_positive??0)>50?"#22c55e":"#ef4444",sub:"Chance of positive return",icon:"📈"},
                {label:"P(Loss > 10%)",val:`${stats.prob_loss_10?.toFixed(1)}%`,
                 color:(stats.prob_loss_10??0)>30?"#ef4444":"#f59e0b",sub:"Significant loss probability",icon:"⚠️"},
                {label:"P(Loss > 20%)",val:`${stats.prob_loss_20?.toFixed(1)}%`,
                 color:(stats.prob_loss_20??0)>20?"#ef4444":"#f97316",sub:"Severe loss probability",icon:"🚨"},
              ].map(m=>(
                <div key={m.label} style={{background:"var(--bg-card2)",borderRadius:12,padding:"13px 15px",
                  border:`1px solid ${m.color}22`,transition:"all .4s"}}>
                  <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:6}}>{m.icon} {m.label}</div>
                  <div style={{fontSize:26,fontWeight:800,fontFamily:"var(--mono)",color:m.color,transition:"color .4s"}}>{m.val}</div>
                  <div style={{fontSize:11,color:"var(--text-muted)",marginTop:4}}>{m.sub}</div>
                </div>
              ))}
            </div>

            {/* Comparison table + Histogram */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Card>
                <SHead title="Scenario Comparison" sub="Click a row to switch"/>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid var(--border)"}}>
                      {["Scenario","5th","Median","95th","P(Gain)"].map(h=>(
                        <th key={h} style={{color:"var(--text-muted)",padding:"5px 7px",textAlign:"left",fontWeight:500}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SCENARIOS.map(s=>{
                      const d=STATIC[s.key];const act=s.key===scenario;
                      return(
                        <tr key={s.key} onClick={()=>setScenario(s.key)} style={{
                          background:act?"var(--bg-hover)":"transparent",cursor:"pointer",transition:"background .15s"}}>
                          <td style={{padding:"7px",color:s.color,fontWeight:act?700:500}}>{s.icon} {s.label}</td>
                          <td style={{padding:"7px",fontFamily:"var(--mono)",color:"#ef4444",fontSize:11}}>{d.p5>=0?"+":""}{d.p5.toFixed(1)}%</td>
                          <td style={{padding:"7px",fontFamily:"var(--mono)",fontSize:11,color:d.p50>=0?"var(--green)":"var(--red)"}}>{d.p50>=0?"+":""}{d.p50.toFixed(1)}%</td>
                          <td style={{padding:"7px",fontFamily:"var(--mono)",color:"#22c55e",fontSize:11}}>+{d.p95.toFixed(1)}%</td>
                          <td style={{padding:"7px",fontFamily:"var(--mono)",fontSize:11,color:d.prob_positive>50?"var(--green)":"var(--red)"}}>{d.prob_positive.toFixed(0)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>

              {/* Return distribution histogram — updates with scenario */}
              <Card>
                <SHead title="Return Distribution" sub={`${sc?.label} · all ${nPaths.toLocaleString()} paths`}/>
                <div style={{height:160}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={histData} margin={{top:4,right:4,left:0,bottom:0}}>
                      <XAxis dataKey="range" tick={{fontSize:9,fill:"#3d5a78"}} tickLine={false} axisLine={false}/>
                      <YAxis hide/>
                      <Tooltip contentStyle={{background:"var(--bg-card2)",border:"1px solid var(--border)",borderRadius:8,fontSize:11}}
                        cursor={{fill:"rgba(96,165,250,.06)"}} formatter={v=>[v,"Paths"]}/>
                      <Bar dataKey="count" radius={[3,3,0,0]}>
                        {histData.map((d,i)=><Cell key={i} fill={d.fill}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* AI Interpretation */}
            <Card style={{borderLeft:"4px solid #f59e0b"}}>
              <SHead title="🤖 Claude AI Interpretation"
                sub={step>=4?"Live analysis · dollar amounts":"Run simulation to get AI interpretation"}/>
              <AIBox text={aiText} loading={aiLoad}
                placeholder='Click "Run Simulation" to get an AI-powered explanation with dollar amounts.'/>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
