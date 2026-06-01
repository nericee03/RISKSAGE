import numpy as np, pandas as pd, yfinance as yf

MARKET = "^GSPC"
DAYS   = 252

def _download(tickers, period="2y"):
    all_t = list(set(tickers + [MARKET]))
    raw   = yf.download(all_t, period=period, progress=False, auto_adjust=True)
    if isinstance(raw.columns, pd.MultiIndex):
        prices = raw["Close"]
    else:
        prices = raw[["Close"]].rename(columns={"Close": tickers[0]})
    return prices.dropna(how="all")

def _beta(r, m):
    cov = np.cov(r, m)
    return float(cov[0,1]/cov[1,1]) if cov[1,1] else 1.0

def _sharpe(r, rf=0.05):
    v = r.std()*np.sqrt(DAYS)
    return float((r.mean()*DAYS-rf)/v) if v else 0.0

def _vol(r):        return float(r.std()*np.sqrt(DAYS)*100)
def _var(r, c=.95): return float(np.percentile(r,(1-c)*100)*100)
def _cvar(r, c=.95):
    t = np.percentile(r,(1-c)*100); tail = r[r<=t]
    return float(tail.mean()*100) if len(tail) else 0.0
def _mdd(r):
    cum=(1+r).cumprod(); return float(((cum-cum.cummax())/cum.cummax()).min()*100)
def _sortino(r, rf=0.05):
    neg=r[r<0]; ds=neg.std()*np.sqrt(DAYS)
    return float((r.mean()*DAYS-rf)/ds) if ds else 0.0
def _risk_level(vol, beta, var):
    s = (2 if vol>25 else 1 if vol>15 else 0) + \
        (2 if beta>1.5 else 1 if beta>1.0 else 0) + \
        (2 if var<-15 else 1 if var<-8 else 0)
    return "High" if s>=4 else "Moderate" if s>=2 else "Low"

def get_portfolio_metrics(tickers, period="2y"):
    prices  = _download(tickers, period)
    returns = prices.pct_change().dropna()
    mkt     = returns[MARKET] if MARKET in returns.columns else None

    per_stock = {}
    for t in tickers:
        if t not in returns.columns: continue
        r  = returns[t].dropna()
        b  = _beta(r.values, mkt.values) if mkt is not None else 1.0
        v  = _vol(r); va = _var(r)
        per_stock[t] = {
            "ticker": t, "beta": round(b,3), "sharpe_ratio": round(_sharpe(r),3),
            "volatility": round(v,2), "var_95": round(va,2), "cvar_95": round(_cvar(r),2),
            "max_drawdown": round(_mdd(r),2), "sortino_ratio": round(_sortino(r),3),
            "annual_return": round(float(r.mean()*DAYS*100),2), "risk_level": _risk_level(v,b,va),
        }

    valid = {t: returns[t] for t in tickers if t in returns.columns}
    portfolio = {}
    if valid:
        port = pd.concat(valid.values(), axis=1).mean(axis=1)
        pb   = float(np.mean([v["beta"] for v in per_stock.values()]))
        pv   = _vol(port); pva = _var(port)
        portfolio = {
            "beta": round(pb,3), "sharpe_ratio": round(_sharpe(port),3),
            "volatility": round(pv,2), "var_95": round(pva,2), "cvar_95": round(_cvar(port),2),
            "max_drawdown": round(_mdd(port),2), "sortino_ratio": round(_sortino(port),3),
            "annual_return": round(float(port.mean()*DAYS*100),2), "risk_level": _risk_level(pv,pb,pva),
        }

    sparklines = {t: prices[t].dropna().tail(30).tolist() for t in tickers if t in prices.columns}
    return {"per_stock": per_stock, "portfolio": portfolio, "sparklines": sparklines, "tickers": tickers, "period": period}
