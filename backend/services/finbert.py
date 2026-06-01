import os, numpy as np, logging
logger = logging.getLogger(__name__)
_pipe = None

def _get_pipe():
    global _pipe
    if _pipe is None:
        try:
            from transformers import pipeline
            _pipe = pipeline(
                "text-classification",
                model=os.getenv("FINBERT_MODEL", "ProsusAI/finbert"),
                top_k=None, truncation=True, max_length=512
            )
            logger.info("FinBERT loaded successfully")
        except Exception as e:
            logger.warning(f"FinBERT unavailable ({e}) — using keyword fallback")
            _pipe = "mock"
    return _pipe

def _mock(text):
    t = text.lower()
    neg = ["plunge","crash","loss","decline","risk","warning","disappointing",
           "restrict","layoff","fail","drop","slump","fear","recession","deficit"]
    pos = ["beat","growth","surge","strong","profit","record","better","rally",
           "gain","exceed","outperform","boom","bullish","upgrade","positive"]
    if any(w in t for w in neg): return {"positive":.05,"neutral":.15,"negative":.80}
    if any(w in t for w in pos): return {"positive":.80,"neutral":.15,"negative":.05}
    return {"positive":.25,"neutral":.55,"negative":.20}

def score_sentiment(text):
    pipe = _get_pipe()
    if pipe == "mock":
        scores = _mock(text)
    else:
        r = pipe(text[:512])
        scores = {x["label"].lower(): x["score"] for x in (r[0] if isinstance(r[0], list) else r)}
    compound = (scores.get("positive", 0) - scores.get("negative", 0)) * 100
    label = max(scores, key=scores.get)
    return {
        "label": label,
        "compound": round(compound, 2),
        "scores": {k: round(v, 4) for k, v in scores.items()}
    }

def score_headlines(headlines):
    if not headlines:
        return {
            "individual": [],
            "aggregate_compound": 0.0,
            "sentiment_distribution": {"positive": 0, "neutral": 0, "negative": 0},
            "risk_level": "Moderate"
        }
    individual = [score_sentiment(h) for h in headlines]
    compounds  = [s["compound"] for s in individual]
    agg  = float(np.mean(compounds))
    dist = {"positive": 0, "neutral": 0, "negative": 0}
    for s in individual:
        dist[s["label"]] += 1
    risk = "High" if agg < -30 else "Low" if agg > 20 else "Moderate"
    return {
        "individual": individual,
        "aggregate_compound": round(agg, 2),
        "sentiment_distribution": dist,
        "risk_level": risk
    }

def score_news_by_ticker(ticker_headlines):
    results = {}
    all_c   = []
    for ticker, headlines in ticker_headlines.items():
        scored = score_headlines(headlines)
        results[ticker] = scored
        all_c.extend([s["compound"] for s in scored["individual"]])
    pc = round(float(np.mean(all_c)), 2) if all_c else 0.0
    pr = "High" if pc < -30 else "Low" if pc > 20 else "Moderate"
    return {"per_ticker": results, "portfolio_compound": pc, "portfolio_risk": pr}
