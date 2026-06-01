import os, logging
logger = logging.getLogger(__name__)

MOCK = [
    {"headline": "Microsoft reports better-than-expected earnings driven by strong cloud growth", "ticker": "MSFT", "source": "CNBC"},
    {"headline": "Apple unveils new AI features driving strong iPhone upgrade cycle expectations", "ticker": "AAPL", "source": "Bloomberg"},
    {"headline": "Tesla shares plunge after disappointing earnings and mass layoffs announcement", "ticker": "TSLA", "source": "Reuters"},
    {"headline": "NVIDIA faces US export restrictions; analysts cut price targets significantly",  "ticker": "NVDA", "source": "WSJ"},
    {"headline": "Amazon AWS revenue beats estimates sharply as cloud infrastructure spending surges","ticker": "AMZN", "source": "CNBC"},
    {"headline": "Fed signals rate hikes may pause; markets react cautiously amid uncertainty",    "ticker": None,   "source": "FT"},
    {"headline": "S&P 500 tech sector outperforms on AI infrastructure spending boom",            "ticker": None,   "source": "MarketWatch"},
    {"headline": "Recession fears resurface as yield curve inversion deepens further",           "ticker": None,   "source": "Bloomberg"},
    {"headline": "Google reports strong ad revenue recovery; AI investments continue to accelerate","ticker": "GOOGL","source": "Reuters"},
    {"headline": "Meta beats earnings with strong ad growth; raises full-year guidance",          "ticker": "META", "source": "CNBC"},
]

def fetch_headlines(tickers, days_back=3):
    key = os.getenv("NEWS_API_KEY", "")
    if key and key not in ("your_newsapi_key_here", ""):
        try:
            from newsapi import NewsApiClient
            from datetime import datetime, timedelta
            client    = NewsApiClient(api_key=key)
            from_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
            result    = {"general": []}
            for t in tickers:
                resp       = client.get_everything(q=t, from_param=from_date, language="en", sort_by="relevancy", page_size=10)
                result[t]  = [
                    a["title"] for a in resp.get("articles", [])
                    if a.get("title") and "[Removed]" not in a["title"]
                ][:10]
            result["general"] = []
            return result
        except Exception as e:
            logger.warning(f"NewsAPI error: {e} — using mock data")

    # Fallback: mock data
    result = {"general": []}
    for t in tickers:
        result[t] = [m["headline"] for m in MOCK if m["ticker"] == t]
        if not result[t]:
            result[t] = [f"{t} trading within normal range amid mixed market signals"]
    result["general"] = [m["headline"] for m in MOCK if m["ticker"] is None]
    return result

def get_news_with_sentiment(tickers):
    from services.finbert import score_sentiment
    hmap  = fetch_headlines(tickers)
    items = []
    for key, headlines in hmap.items():
        for h in headlines:
            s = score_sentiment(h)
            # Find source from MOCK if available
            source = next((m["source"] for m in MOCK if m["headline"] == h), "NewsAPI")
            items.append({
                "headline":  h,
                "ticker":    key if key != "general" else None,
                "sentiment": s["label"],
                "compound":  s["compound"],
                "source":    source,
            })
    items.sort(key=lambda x: abs(x["compound"]), reverse=True)
    return items
