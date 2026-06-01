import { useState, useEffect, useRef } from "react";
import { Card, SHead, AIBox, Gauge, BarChart, SPill, Chip, OBtn, FLabel } from "../UI";
import { analyzeSentiment, streamSentimentExplain } from "../../api/client";

const TICKERS = ["AAPL", "MSFT", "TSLA", "NVDA"];

// Demo data shown before backend responds
const DEMO_NEWS = [
  { headline:"Microsoft reports better-than-expected earnings driven by strong cloud growth", ticker:"MSFT", sentiment:"positive", compound:62,  source:"CNBC" },
  { headline:"Apple unveils new AI features driving strong iPhone upgrade cycle expectations", ticker:"AAPL", sentiment:"positive", compound:48,  source:"Bloomberg" },
  { headline:"Tesla shares plunge after disappointing earnings and mass layoffs announcement", ticker:"TSLA", sentiment:"negative", compound:-71, source:"Reuters" },
  { headline:"NVIDIA faces US export restrictions; analysts cut price targets significantly",  ticker:"NVDA", sentiment:"negative", compound:-55, source:"WSJ" },
  { headline:"Fed signals rate hikes may pause; markets react cautiously",                    ticker:null,   sentiment:"neutral",  compound:-8,  source:"FT" },
  { headline:"S&P 500 tech sector outperforms on AI infrastructure spending boom",            ticker:null,   sentiment:"positive", compound:35,  source:"MarketWatch" },
  { headline:"Recession fears resurface as yield curve inversion deepens further",           ticker:null,   sentiment:"negative", compound:-42, source:"Bloomberg" },
  { headline:"Amazon AWS beats estimates sharply as cloud infrastructure spending surges",    ticker:"AMZN", sentiment:"positive", compound:58,  source:"CNBC" },
];

const DEMO_SCORES = {
  per_ticker: {
    MSFT: { aggregate_compound: 62  },
    AAPL: { aggregate_compound: 38  },
    TSLA: { aggregate_compound: -71 },
    NVDA: { aggregate_compound: -41 },
  },
  portfolio_compound: -40.2,
  portfolio_risk: "High",
};

const EVENTS  = ["Earnings", "Fed Rate", "Tech Stocks", "Layoffs"];
const SOURCES = ["FINBERT", "NewsAPI", "RSS", "CNBC"];
const HOUR_BARS = [
  {l:"3:00",v:12,c:"#14b8a6"},{l:"6:00",v:45,c:"#14b8a6"},{l:"9:00",v:82,c:"#14b8a6"},
  {l:"12pm",v:180,c:"#14b8a6"},{l:"15:00",v:160,c:"#14b8a6"},{l:"18:00",v:280,c:"#14b8a6"},
];

export default function Sentiment() {
  const [source,   setSource]   = useState("FINBERT");
  const [events,   setEvents]   = useState(["Earnings","Tech Stocks"]);
  const [news,     setNews]     = useState(DEMO_NEWS);
  const [scores,   setScores]   = useState(DEMO_SCORES);
  const [fetching, setFetching] = useState(false);
  const [aiText,   setAiText]   = useState("");
  const [aiLoad,   setAiLoad]   = useState(false);
  const [status,   setStatus]   = useState(""); // info/error messages
  const ranOnce = useRef(false);

  // Auto-run on page load
  useEffect(() => {
    if (!ranOnce.current) { ranOnce.current = true; doRefresh(); }
  }, []);

  async function doRefresh() {
    // ── Step 1: fetch FinBERT scores + news ──────────────────────
    setFetching(true);
    setStatus("Fetching sentiment scores…");
    try {
      const { data } = await analyzeSentiment(TICKERS);
      if (data?.sentiment_scores)         setScores(data.sentiment_scores);
      if (data?.news_feed?.length)        setNews(data.news_feed);
      setStatus("FinBERT scores loaded. Generating AI analysis…");
    } catch (e) {
      setStatus("⚠ Backend unreachable — showing demo data. Start the backend server first.");
    }
    setFetching(false);

    // ── Step 2: stream Claude explanation ────────────────────────
    setAiText("");
    setAiLoad(true);
    try {
      await streamSentimentExplain(
        TICKERS,
        chunk => setAiText(p => p + chunk),
        ()    => { setAiLoad(false); setStatus(""); },
      );
    } catch (e) {
      // Graceful fallback text when Claude API key not set
      setAiText(
        "The portfolio shows a **negative overall sentiment score of -40.2**, driven by " +
        "Tesla's disappointing earnings (-71) and NVIDIA's export restriction headwinds (-55). " +
        "These positions pull the portfolio firmly into negative territory.\n\n" +
        "Microsoft's strong cloud earnings (+62) provide a **partial buffer**, but are " +
        "outweighed by the negative signals. **Short-term downside risk is elevated** — " +
        "consider reducing TSLA and NVDA exposure or adding defensive positions " +
        "until sentiment recovers above -20."
      );
      setAiLoad(false);
      setStatus("");
    }
  }

  const compound = scores?.portfolio_compound ?? 0;
  const portRisk = scores?.portfolio_risk     ?? "Moderate";

  // Sentiment distribution from news
  const dist = { positive:0, neutral:0, negative:0 };
  news.forEach(n => { if (n.sentiment in dist) dist[n.sentiment]++; });

  return (
    <div style={{ display:"grid", gridTemplateColumns:"210px 1fr 210px",
      gap:11, padding:11, height:"100%", overflow:"hidden" }}>

      {/* ── LEFT ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:10, overflowY:"auto" }}>
        <Card>
          <div style={{ fontSize:11.5,fontWeight:700,color:"var(--text-muted)",
            textTransform:"uppercase",letterSpacing:".07em",marginBottom:12 }}>
            Sentiment Analysis
          </div>

          <FLabel>News Feed Source</FLabel>
          <select value={source} onChange={e=>setSource(e.target.value)} style={{ marginBottom:13 }}>
            {SOURCES.map(s=><option key={s}>{s}</option>)}
          </select>

          <FLabel>News Feed Sources</FLabel>
          <div style={{ display:"flex", gap:10, marginBottom:13 }}>
            {["NewsAPI","RSS","CNDC"].map(s=>(
              <div key={s} style={{ display:"flex",alignItems:"center",gap:5,fontSize:12,color:"var(--text-secondary)" }}>
                <div style={{ width:8,height:8,borderRadius:2,background:"#14b8a6" }}/> {s}
              </div>
            ))}
          </div>

          <FLabel>Selected Events</FLabel>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
            {EVENTS.map(e=>(
              <Chip key={e} label={e} active={events.includes(e)}
                onClick={()=>setEvents(p=>p.includes(e)?p.filter(x=>x!==e):[...p,e])}/>
            ))}
          </div>

          <OBtn onClick={doRefresh} disabled={fetching||aiLoad} style={{ width:"100%" }}>
            {fetching?"Fetching…":aiLoad?"Analyzing…":"Refresh Sentiment"}
          </OBtn>

          {status && (
            <div style={{ fontSize:11,marginTop:9,lineHeight:1.55,
              color:status.startsWith("⚠")?"var(--gold)":"var(--teal)" }}>
              {status}
            </div>
          )}
        </Card>

        {/* Sentiment mix */}
        <Card>
          <SHead title="Sentiment Mix"/>
          {[
            { label:"Positive", count:dist.positive, color:"#22c55e" },
            { label:"Neutral",  count:dist.neutral,  color:"#f59e0b" },
            { label:"Negative", count:dist.negative, color:"#ef4444" },
          ].map(d=>{
            const pct = Math.round((d.count/(news.length||1))*100);
            return (
              <div key={d.label} style={{ marginBottom:9 }}>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:11.5,marginBottom:4 }}>
                  <span style={{ color:"var(--text-secondary)" }}>{d.label}</span>
                  <span style={{ color:d.color,fontFamily:"var(--mono)",fontWeight:600 }}>{pct}%</span>
                </div>
                <div style={{ height:4,background:"var(--bg-hover)",borderRadius:2,overflow:"hidden" }}>
                  <div style={{ width:`${pct}%`,height:"100%",background:d.color,
                    borderRadius:2,transition:"width .5s" }}/>
                </div>
              </div>
            );
          })}
        </Card>

        {/* Source breakdown */}
        <Card>
          <SHead title="Source Breakdown"/>
          {[{l:"NewsAPI",pct:45,c:"#3b82f6"},{l:"RSS Feeds",pct:30,c:"#14b8a6"},{l:"CNBC",pct:25,c:"#f59e0b"}].map(b=>(
            <div key={b.l} style={{ marginBottom:9 }}>
              <div style={{ display:"flex",justifyContent:"space-between",fontSize:11.5,marginBottom:4 }}>
                <span style={{ color:"var(--text-secondary)" }}>{b.l}</span>
                <span style={{ color:b.c,fontFamily:"var(--mono)",fontWeight:600 }}>{b.pct}%</span>
              </div>
              <div style={{ height:4,background:"var(--bg-hover)",borderRadius:2,overflow:"hidden" }}>
                <div style={{ width:`${b.pct}%`,height:"100%",background:b.c,borderRadius:2 }}/>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* ── MAIN ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:10, overflowY:"auto" }}>

        {/* Gauge card */}
        <Card>
          <SHead title="Sentiment Analysis" sub="FinBERT · Real-time"
            right={
              <OBtn onClick={doRefresh} disabled={aiLoad||fetching} style={{ fontSize:11 }}>
                Re-analyze
              </OBtn>
            }/>
          <Gauge value={compound}/>
        </Card>

        {/* News feed */}
        <Card>
          <SHead title="Recent News" sub={`${news.length} articles · FinBERT scored`}/>
          {news.map((n,i)=>(
            <div key={i} style={{ display:"flex",alignItems:"flex-start",gap:10,
              padding:"10px 0",borderBottom:i<news.length-1?"1px solid var(--border)":"none" }}>
              <SPill label={n.sentiment}/>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:13,lineHeight:1.55,marginBottom:3 }}>{n.headline}</div>
                <div style={{ fontSize:11,color:"var(--text-muted)",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" }}>
                  {n.ticker && <span style={{ color:"var(--accent)",fontWeight:600 }}>{n.ticker}</span>}
                  <span>{n.source}</span>
                  <span style={{ fontFamily:"var(--mono)",fontWeight:600,
                    color:(n.compound??0)>=0?"var(--green)":"var(--red)" }}>
                    {(n.compound??0)>=0?"+":""}{typeof n.compound==="number"?n.compound.toFixed(1):n.compound}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </Card>

        {/* AI analysis */}
        <Card>
          <SHead title="🤖 AI Sentiment Interpretation" sub="Claude Sonnet · FinBERT-grounded"/>
          <AIBox text={aiText} loading={aiLoad}
            placeholder="Click Refresh Sentiment to generate an AI-powered interpretation."/>
        </Card>
      </div>

      {/* ── RIGHT ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:10, overflowY:"auto" }}>

        {/* Dynamic risk score */}
        <Card>
          <div style={{ fontSize:11.5,fontWeight:700,color:"var(--text-muted)",
            textTransform:"uppercase",letterSpacing:".07em",marginBottom:12 }}>
            Dynamic Sentiment Risk Score
          </div>
          <select defaultValue="Dynamic Sentiment Risk Score" style={{ marginBottom:12 }}>
            <option>Dynamic Sentiment Risk Score</option>
            <option>Raw FinBERT Score</option>
          </select>
          <div style={{ display:"flex",alignItems:"center",gap:8,padding:"10px 12px",
            background:"var(--bg-card2)",borderRadius:"var(--r)",marginBottom:12,
            border:"1px solid var(--border)" }}>
            <span style={{ fontSize:12,color:"var(--text-secondary)" }}>Score 2</span>
            <span style={{ padding:"3px 10px",borderRadius:10,fontSize:11,fontWeight:700,
              background:portRisk==="High"?"rgba(239,68,68,.14)":portRisk==="Low"?"rgba(34,197,94,.12)":"rgba(245,158,11,.12)",
              color:portRisk==="High"?"#ef4444":portRisk==="Low"?"#22c55e":"#f59e0b" }}>
              {portRisk} Risk
            </span>
            <span style={{ marginLeft:"auto",fontFamily:"var(--mono)",fontSize:14,fontWeight:700,
              color:compound<0?"var(--red)":"var(--green)" }}>
              {compound>0?"+":""}{compound.toFixed(1)}
            </span>
          </div>
          <BarChart data={HOUR_BARS}/>
          <div style={{ fontSize:11,color:"var(--text-muted)",marginTop:6 }}>News volume by hour</div>
        </Card>

        {/* Per-stock */}
        <Card>
          <SHead title="Per-Stock Sentiment"/>
          {Object.entries(scores?.per_ticker??{}).map(([ticker,data])=>{
            const c=data.aggregate_compound??0;
            const sent=c>10?"positive":c<-10?"negative":"neutral";
            return (
              <div key={ticker} style={{ display:"flex",alignItems:"center",
                justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid var(--border)" }}>
                <span style={{ fontFamily:"var(--mono)",fontSize:13,fontWeight:700 }}>{ticker}</span>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <SPill label={sent}/>
                  <span style={{ fontFamily:"var(--mono)",fontSize:12,fontWeight:700,
                    color:c>=0?"var(--green)":"var(--red)" }}>
                    {c>=0?"+":""}{c.toFixed(1)}
                  </span>
                </div>
              </div>
            );
          })}
        </Card>

        {/* Event impact */}
        <Card>
          <SHead title="Event Impact"/>
          {[
            { label:"Earnings Season", delta:-2.3, color:"#ef4444" },
            { label:"Fed Decision",    delta:-0.8, color:"#f59e0b" },
            { label:"Tech Rally",      delta:+1.4, color:"#22c55e" },
            { label:"Layoffs Signal",  delta:-1.2, color:"#f97316" },
          ].map(e=>(
            <div key={e.label} style={{ display:"flex",justifyContent:"space-between",
              padding:"7px 0",borderBottom:"1px solid rgba(96,165,250,.05)",fontSize:12 }}>
              <span style={{ color:"var(--text-secondary)" }}>{e.label}</span>
              <span style={{ color:e.color,fontFamily:"var(--mono)",fontWeight:600 }}>
                {e.delta>0?"+":""}{e.delta}%
              </span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
