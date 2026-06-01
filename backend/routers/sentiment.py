from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.finbert import score_sentiment, score_news_by_ticker
from services.news_service import fetch_headlines, get_news_with_sentiment
from services.llm import explain_sentiment

router = APIRouter()

class ScoreReq(BaseModel):
    texts: list[str]

class ExplainReq(BaseModel):
    tickers: list[str]

@router.get("/analyze")
def analyze(tickers: str = Query(...), days_back: int = Query(3)):
    """Score headlines for each ticker with FinBERT. Returns scores + full news feed."""
    t = [x.strip().upper() for x in tickers.split(",") if x.strip()]
    if not t: raise HTTPException(400, "Tickers required")
    try:
        hmap   = fetch_headlines(t, days_back)
        scored = score_news_by_ticker(hmap)
        feed   = get_news_with_sentiment(t)
        return {"sentiment_scores": scored, "news_feed": feed[:20], "tickers": t}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/score")
def score(req: ScoreReq):
    """Score arbitrary text snippets with FinBERT."""
    if not req.texts: raise HTTPException(400, "Texts required")
    return {"results": [score_sentiment(t) for t in req.texts]}

@router.post("/explain")
def explain(req: ExplainReq):
    """Stream Claude interpretation of FinBERT sentiment scores."""
    t = [x.strip().upper() for x in req.tickers if x.strip()]
    if not t: raise HTTPException(400, "Tickers required")
    try:
        hmap = fetch_headlines(t)
        sd   = score_news_by_ticker(hmap)
        feed = get_news_with_sentiment(t)
    except Exception as e:
        raise HTTPException(500, str(e))

    def gen():
        try:
            for chunk in explain_sentiment(sd, t, news_feed=feed):
                yield chunk
        except Exception as e:
            yield f"\n[Error: {e}]"

    return StreamingResponse(gen(), media_type="text/plain")
