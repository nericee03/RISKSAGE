from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from services.monte_carlo import run_simulation, SCENARIOS
from services.llm import explain_simulation

router = APIRouter()

class SimReq(BaseModel):
    tickers: list[str]
    n_paths: int = 5000
    horizon: int = 252
    scenario: str = "base"
    weights: Optional[list[float]] = None
    period: str = "2y"
    initial_value: float = 100_000

class ExplainReq(BaseModel):
    sim_results: dict

@router.post("/run")
def run(req: SimReq):
    t = [x.strip().upper() for x in req.tickers if x.strip()]
    if not t: raise HTTPException(400, "Tickers required")
    if req.scenario not in SCENARIOS: raise HTTPException(400, f"Scenario must be one of {list(SCENARIOS)}")
    if req.n_paths > 20000: raise HTTPException(400, "Max 20,000 paths")
    try: return run_simulation(t, req.n_paths, req.horizon, req.scenario, req.weights, req.period, req.initial_value)
    except Exception as e: raise HTTPException(500, str(e))

@router.post("/explain")
def explain(req: ExplainReq):
    def gen():
        try:
            for chunk in explain_simulation(req.sim_results): yield chunk
        except Exception as e: yield f"\n[Error: {e}]"
    return StreamingResponse(gen(), media_type="text/plain")

@router.get("/scenarios")
def scenarios():
    return {"scenarios": [{"key": k, "label": v["label"]} for k, v in SCENARIOS.items()]}
