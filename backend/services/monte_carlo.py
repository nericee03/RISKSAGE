import numpy as np, pandas as pd, yfinance as yf

SCENARIOS = {
    "base":      {"drift_mult":  1.0, "vol_mult": 1.0, "label": "Base Case"},
    "bull":      {"drift_mult":  1.8, "vol_mult": 0.7, "label": "Bull Market"},
    "crash":     {"drift_mult": -3.0, "vol_mult": 2.5, "label": "Market Crash"},
    "recession": {"drift_mult": -1.5, "vol_mult": 1.8, "label": "Recession"},
}

def run_simulation(tickers, n_paths=5000, horizon=252, scenario="base", weights=None, period="2y", initial_value=100_000):
    p  = SCENARIOS.get(scenario, SCENARIOS["base"])
    df = yf.download(tickers, period=period, progress=False, auto_adjust=True)["Close"].dropna()
    r  = df.pct_change().dropna()
    mu = r.mean().values; cov = r.cov().values; n = len(tickers)
    w  = np.array(weights if weights else [1/n]*n); w /= w.sum()
    mu_adj  = mu  * p["drift_mult"]
    cov_adj = cov * p["vol_mult"]**2
    try:    L = np.linalg.cholesky(cov_adj + np.eye(n)*1e-8)
    except: L = np.diag(np.sqrt(np.diag(cov_adj)))
    z       = np.random.standard_normal((n_paths, horizon, n))
    port_r  = (mu_adj + z @ L.T) @ w
    vals    = initial_value * np.cumprod(1 + port_r, axis=1)
    final   = (vals[:,-1] - initial_value) / initial_value * 100
    step    = max(1, horizon//60)
    sampled = [{"percentile": pct, "values": [round(v,2) for v in vals[np.argmin(np.abs(final-np.percentile(final,pct))),::step].tolist()], "final_return": round(float(final[np.argmin(np.abs(final-np.percentile(final,pct)))]),2)} for pct in [5,25,50,75,95]]
    hc, he  = np.histogram(final, bins=20)
    return {
        "scenario": scenario, "scenario_label": p["label"],
        "n_paths": n_paths, "horizon_days": horizon, "initial_value": initial_value,
        "tickers": tickers, "weights": w.tolist(),
        "statistics": {
            "p5": round(float(np.percentile(final,5)),2), "p25": round(float(np.percentile(final,25)),2),
            "p50": round(float(np.percentile(final,50)),2), "p75": round(float(np.percentile(final,75)),2),
            "p95": round(float(np.percentile(final,95)),2), "mean": round(float(final.mean()),2),
            "prob_positive": round(float((final>0).mean()*100),2),
            "prob_loss_10":  round(float((final<-10).mean()*100),2),
            "prob_loss_20":  round(float((final<-20).mean()*100),2),
        },
        "sampled_paths": sampled,
        "histogram": [{"midpoint": round(float((he[i]+he[i+1])/2),2), "count": int(hc[i])} for i in range(len(hc))],
    }
