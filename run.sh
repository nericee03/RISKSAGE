#!/bin/bash
# RiskSage v3 — Quick Start
set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}RiskSage v3 — Claude API Edition${NC}"
echo "─────────────────────────────────"

# Check API key
if grep -q "your_claude_api_key_here" "$DIR/backend/.env"; then
  echo -e "${YELLOW}⚠ Add your Claude API key to backend/.env first:${NC}"
  echo "  ANTHROPIC_API_KEY=sk-ant-..."
  echo ""
  read -p "Paste your key now (or press Enter to skip): " K
  if [[ -n "$K" ]]; then
    sed -i.bak "s|your_claude_api_key_here|$K|" "$DIR/backend/.env"
    echo -e "${GREEN}✓ Key saved${NC}"
  fi
fi

# Backend
echo -e "\n${GREEN}Starting Backend...${NC}"
cd "$DIR/backend"
[ ! -d "venv" ] && python3 -m venv venv
source venv/bin/activate
pip install -q -r requirements.txt
mkdir -p data/faiss_index data/uploads
python -m uvicorn main:app --reload --port 8000 --log-level warning &
B_PID=$!

# Wait
for i in {1..20}; do curl -sf http://localhost:8000/health>/dev/null 2>&1 && break; sleep 1; done
echo -e "${GREEN}✓ Backend ready at http://localhost:8000${NC}"

# Frontend
echo -e "\n${GREEN}Starting Frontend...${NC}"
cd "$DIR/frontend"
[ ! -d "node_modules" ] && npm install --silent
npm run dev -- --host 0.0.0.0 &
F_PID=$!
sleep 3

echo ""
echo "  ┌──────────────────────────────────────┐"
echo -e "  │  ${GREEN}✓ RiskSage running!${NC}                 │"
echo -e "  │  App  →  ${BLUE}http://localhost:5173${NC}      │"
echo -e "  │  API  →  ${BLUE}http://localhost:8000${NC}      │"
echo "  │  Press Ctrl+C to stop               │"
echo "  └──────────────────────────────────────┘"
echo ""

[[ "$OSTYPE" == "darwin"* ]] && sleep 2 && open http://localhost:5173

cleanup() { kill $B_PID $F_PID 2>/dev/null; echo "Stopped."; exit 0; }
trap cleanup INT TERM
wait
