import axios from "axios";

const BASE = "/api";
const api  = axios.create({ baseURL: BASE, timeout: 60000 });

async function readStream(url, body, onChunk, onDone) {
  const r = await fetch(`${BASE}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => `HTTP ${r.status}`);
    throw new Error(txt || `HTTP ${r.status}`);
  }
  const reader = r.body.getReader();
  const dec    = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = dec.decode(value, { stream: true });
    if (chunk) onChunk(chunk);
  }
  onDone?.();
}

// Dashboard
export const fetchMetrics   = (tickers, period = "2y") =>
  api.get("/dashboard/metrics", { params: { tickers: tickers.join(","), period } });
export const streamExplain  = (payload, onChunk, onDone) =>
  readStream("/dashboard/explain", payload, onChunk, onDone);

// Reports
export const ingestDocument = (file, docType = "10-K") => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("doc_type", docType);
  return api.post("/reports/ingest", fd);
};
export const queryRAG       = (question, top_k = 5) =>
  api.post("/reports/query", { question, top_k });
export const listDocuments  = () => api.get("/reports/list");

// Simulation
export const runSimulation    = (payload) => api.post("/simulation/run", payload);
export const streamSimExplain = (sim_results, onChunk, onDone) =>
  readStream("/simulation/explain", { sim_results }, onChunk, onDone);
