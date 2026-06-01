from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.risk_engine import get_portfolio_metrics
from services.llm import explain_portfolio

router = APIRouter()

class ExplainReq(BaseModel):
    tickers: list[str]
    risk_tolerance: str = "Moderate"
    horizon: str = "Medium-Term"
    period: str = "2y"

@router.get("/metrics")
def metrics(tickers: str = Query(...), period: str = Query("2y")):
    t = [x.strip().upper() for x in tickers.split(",") if x.strip()]
    if not t: raise HTTPException(400, "At least one ticker required")
    if len(t) > 10: raise HTTPException(400, "Max 10 tickers")
    try: return get_portfolio_metrics(t, period)
    except Exception as e: raise HTTPException(500, str(e))

@router.post("/explain")
def explain(req: ExplainReq):
    try: m = get_portfolio_metrics(req.tickers, req.period)
    except Exception as e: raise HTTPException(500, str(e))
    def gen():
        for chunk in explain_portfolio(m, req.tickers, req.risk_tolerance, req.horizon):
            yield chunk
    return StreamingResponse(gen(), media_type="text/plain")
