import { useState } from "react";
import Dashboard  from "./components/Dashboard/Dashboard";
import Reports    from "./components/Reports/Reports";
import Simulation from "./components/Simulation/Simulation";

const PAGES = { Dashboard, Reports, Simulation };

export default function App() {
  const [page, setPage] = useState("Dashboard");
  const Page = PAGES[page];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden" }}>

      {/* NAV */}
      <nav style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 22px", height:52,
        background:"var(--bg-card)",
        borderBottom:"1px solid var(--border)",
        flexShrink:0, position:"relative", zIndex:10,
      }}>
        <div style={{ position:"absolute",bottom:0,left:0,right:0,height:1,
          background:"linear-gradient(90deg,transparent,rgba(59,130,246,.35),transparent)" }}/>

        {/* Brand */}
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:29,height:29,borderRadius:7,display:"flex",alignItems:"center",
            justifyContent:"center",fontSize:15,
            background:"linear-gradient(135deg,#3b82f6,#14b8a6)" }}>⬡</div>
          <span style={{ fontSize:18,fontWeight:700,letterSpacing:"-.4px" }}>RiskSage</span>
        </div>

        {/* Nav links - only 3 pages */}
        <div style={{ display:"flex", gap:2 }}>
          {Object.keys(PAGES).map(p=>(
            <button key={p} onClick={()=>setPage(p)} style={{
              padding:"5px 15px", borderRadius:6, cursor:"pointer",
              background:page===p?"rgba(59,130,246,.1)":"transparent",
              border:page===p?"1px solid rgba(96,165,250,.26)":"1px solid transparent",
              color:page===p?"#3b82f6":"var(--text-secondary)",
              fontFamily:"var(--font)",fontSize:13.5,fontWeight:500,
              transition:"all .15s",position:"relative",
            }}>
              {p}
              {page===p && (
                <div style={{ position:"absolute",bottom:-7,left:"50%",transform:"translateX(-50%)",
                  width:"38%",height:2,background:"#3b82f6",borderRadius:1 }}/>
              )}
            </button>
          ))}
        </div>

        {/* Icons */}
        <div style={{ display:"flex", gap:6 }}>
          {["🔔","🌐","👤"].map(ic=>(
            <button key={ic} style={{ width:30,height:30,borderRadius:6,
              border:"1px solid var(--border)",background:"var(--bg-card2)",
              color:"var(--text-secondary)",cursor:"pointer",fontSize:13,
              display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s" }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--border-bright)";e.currentTarget.style.color="var(--text-primary)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-secondary)";}}
            >{ic}</button>
          ))}
        </div>
      </nav>

      {/* Page content */}
      <div style={{ flex:1, overflow:"hidden" }}>
        <Page/>
      </div>
    </div>
  );
}
