"""
LLM Service — Anthropic Claude API with streaming
"""
import os, json, logging
logger = logging.getLogger(__name__)

MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")


def _client():
    from anthropic import Anthropic
    key = os.getenv("ANTHROPIC_API_KEY", "")
    if not key or key == "your_claude_api_key_here":
        raise ValueError("ANTHROPIC_API_KEY not set in backend/.env")
    return Anthropic(api_key=key)


def stream(system: str, user: str):
    """Stream tokens from Claude. Yields text chunks."""
    try:
        client = _client()
        with client.messages.stream(
            model=MODEL,
            max_tokens=600,
            system=system,
            messages=[{"role": "user", "content": user}],
        ) as s:
            for text in s.text_stream:
                yield text
    except ValueError as e:
        yield f"⚠️ {str(e)}. Open backend/.env and add your ANTHROPIC_API_KEY."
    except Exception as e:
        logger.error(f"Claude API error: {e}")
        yield f"⚠️ AI Error: {str(e)}"


def explain_portfolio(metrics, tickers, risk_tolerance, horizon):
    p   = metrics.get("portfolio", {})
    per = metrics.get("per_stock", {})
    sys = (
        "You are RiskSage, an expert AI investment risk analyst explaining portfolio risk "
        "to retail investors. Use plain English. Bold key numbers with **number**. "
        "Write 3-4 short paragraphs covering: overall assessment, key risk drivers, "
        "what it means for the investor, and one actionable suggestion."
    )
    usr = (
        f"Portfolio: {', '.join(tickers)} | Risk Tolerance: {risk_tolerance} | Horizon: {horizon}\n"
        f"Beta: {p.get('beta','N/A')} | Sharpe: {p.get('sharpe_ratio','N/A')} | "
        f"Volatility: {p.get('volatility','N/A')}% | VaR(95%): {p.get('var_95','N/A')}% | "
        f"Max Drawdown: {p.get('max_drawdown','N/A')}% | Risk Level: {p.get('risk_level','N/A')}\n"
        f"Per-stock risk: {json.dumps({t: m['risk_level'] for t,m in per.items()})}\n"
        "Explain in plain English for a retail investor."
    )
    return stream(sys, usr)


def explain_sentiment(sentiment_data, tickers, news_feed=None):
    c   = sentiment_data.get("portfolio_compound", 0)
    r   = sentiment_data.get("portfolio_risk", "Moderate")
    per = {t: d.get("aggregate_compound", 0)
           for t, d in sentiment_data.get("per_ticker", {}).items()}

    headlines_ctx = ""
    if news_feed:
        lines = [f"- [{n['sentiment'].upper()}] {n['headline']}" for n in news_feed[:6]]
        headlines_ctx = "\nRecent headlines:\n" + "\n".join(lines)

    sys = (
        "You are a financial sentiment analyst. Write 2 concise paragraphs. "
        "Bold key points with **text**. Explain the practical portfolio risk impact clearly."
    )
    usr = (
        f"Overall FinBERT portfolio sentiment: {c:.1f} (scale: -100 = very negative, +100 = very positive)\n"
        f"Portfolio risk from sentiment: {r}\n"
        f"Tickers: {', '.join(tickers)}\n"
        f"Per-ticker scores: {json.dumps(per)}"
        f"{headlines_ctx}\n"
        "Interpret and explain short-term risk implications for the investor."
    )
    return stream(sys, usr)


def explain_simulation(sim):
    stats = sim.get("statistics", {})
    label = sim.get("scenario_label", "Base Case")
    n     = sim.get("n_paths", 5000)
    h     = sim.get("horizon_days", 252)
    iv    = sim.get("initial_value", 100_000)
    sys = (
        "You are a quantitative risk analyst. Explain Monte Carlo results to retail investors. "
        "No jargon. Use dollar amounts. 2-3 paragraphs. Bold key findings."
    )
    usr = (
        f"Scenario: {label} | {n:,} paths | {h//21} months | ${iv:,.0f} initial\n"
        f"5th pct: {stats.get('p5',0):.1f}% | 25th: {stats.get('p25',0):.1f}% | "
        f"Median: {stats.get('p50',0):.1f}% | 75th: {stats.get('p75',0):.1f}% | 95th: {stats.get('p95',0):.1f}%\n"
        f"P(gain): {stats.get('prob_positive',0):.1f}% | P(loss>10%): {stats.get('prob_loss_10',0):.1f}% | "
        f"P(loss>20%): {stats.get('prob_loss_20',0):.1f}%\n"
        f"Explain using dollar amounts based on ${iv:,.0f} initial investment."
    )
    return stream(sys, usr)


def explain_rag(question: str, context: str):
    sys = (
        "You are a financial document analyst specializing in SEC 10-K filings. "
        "Answer ONLY from the provided excerpts. Cite Item/page refs. "
        "Flag risk levels (High/Moderate/Low). Under 200 words."
    )
    usr = f"Document excerpts:\n{context}\n\nQuestion: {question}"
    return stream(sys, usr)
