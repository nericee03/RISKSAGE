# RiskSage: AI-Powered Investment Risk Analyzer

## Overview
RiskSage is an AI-powered financial analysis platform designed to help retail investors understand and evaluate investment risk. The system combines quantitative financial metrics with advanced AI techniques to provide clear, interpretable insights.

It integrates:
- Quantitative risk metrics (Beta, VaR, Sharpe Ratio, etc.)
- Large Language Models (Claude Sonnet) for explanations
- Retrieval-Augmented Generation (RAG) for 10-K financial document analysis
- Monte Carlo simulation for portfolio forecasting

The goal is to translate complex financial data into simple, actionable insights for non-expert users.

---

## Key Features

### Portfolio Risk Analysis
- Computes key financial metrics:
  - Volatility
  - Beta
  - Sharpe Ratio
  - Value-at-Risk (VaR)
  - Maximum Drawdown
- Generates **plain-English AI explanations**

---

### RAG-based 10-K Analysis
- Upload SEC 10-K reports (PDF)
- Ask questions about company risks
- Returns **grounded, citation-based answers**
- Reduces hallucination using FAISS-based retrieval

---

### Monte Carlo Simulation
- Simulates thousands of possible future outcomes
- Supports scenarios:
  - Base Case
  - Bull Market
  - Market Crash
  - Recession
- Outputs probability distributions and future portfolio values

---

### Real-Time Data Integration
- Uses Yahoo Finance (yfinance)
- Supports live portfolio analysis

---

## Project Structure

\`\`\`
RiskSage/
│
├── backend/
├── frontend/
├── data/
├── requirements.txt
├── README.md
\`\`\`

---

## Installation

### 1. Clone the Repository
\`\`\`bash
git clone <your-repo-link>
cd RiskSage
\`\`\`

### 2. Install Backend Dependencies
\`\`\`bash
pip install -r requirements.txt
\`\`\`

### 3. Install Frontend Dependencies
\`\`\`bash
cd frontend
npm install
\`\`\`

---

## ▶Running the Application

### Start Backend
\`\`\`bash
uvicorn main:app --reload
\`\`\`

### Start Frontend
\`\`\`bash
npm run dev
\`\`\`

Open in browser:
http://localhost:5173

---

## API Requirements

Set environment variables:
\`\`\`bash
export ANTHROPIC_API_KEY=your_key_here
export NEWS_API_KEY=your_key_here
\`\`\`

---

## Data Sources
- Yahoo Finance (yfinance)
- 10-K PDFs (user uploaded)
- NewsAPI / mock dataset

---

## Evaluation
- Readability > 60 (Flesch)
- RAG accuracy: 91%
- User study (n=8): improved confidence, speed, comprehension

---

## Limitations
- Small sample size (n=8)
- Depends on external APIs
- Uses historical data

---

## Ethical Considerations
- Not financial advice
- No user data stored
- RAG reduces hallucination
- Low compute usage

---

## Authors
- Disha Churi – Backend & LLM  
- Nerice Rodrigues – RAG  
- Rachana Dharani – Simulation  

---

## License
Academic use only.
