#!/usr/bin/env bash
# ============================================================
#  CyberQRM – Start Script (macOS / Linux)
# ============================================================
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo ""
echo "============================================"
echo "  CyberQRM - FAIR Risk Management Platform"
echo "============================================"
echo ""

# ── Check dependencies are installed ─────────────────────────
if [ ! -d "$SCRIPT_DIR/backend/node_modules" ] || [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
  echo -e "${YELLOW}Dependencies not found. Running installer first...${NC}"
  echo ""
  bash "$SCRIPT_DIR/install.sh"
  echo ""
fi

# ── Check Node.js version ─────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${RED}Error: Node.js is not installed. Run ./install.sh first.${NC}"
  exit 1
fi

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo -e "${RED}Error: Node.js 22.5+ is required. Run ./install.sh for guidance.${NC}"
  exit 1
fi

# ── Helper: open browser ──────────────────────────────────────
open_browser() {
  local url="$1"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    open "$url"
  elif command -v xdg-open &>/dev/null; then
    xdg-open "$url" 2>/dev/null
  elif command -v gnome-open &>/dev/null; then
    gnome-open "$url" 2>/dev/null
  fi
}

# ── Helper: start process in new terminal window ──────────────
start_in_terminal() {
  local title="$1"
  local dir="$2"
  local cmd="$3"
  local full_cmd="cd '$dir' && $cmd"

  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS – open a new Terminal.app window
    osascript -e "
      tell application \"Terminal\"
        do script \"printf '\\\\033]0;${title}\\\\007'; ${full_cmd}\"
        set frontmost to true
      end tell"
  elif command -v gnome-terminal &>/dev/null; then
    gnome-terminal --title="$title" -- bash -c "${full_cmd}; exec bash" 2>/dev/null &
  elif command -v xterm &>/dev/null; then
    xterm -title "$title" -e bash -c "${full_cmd}; exec bash" &
  elif command -v konsole &>/dev/null; then
    konsole --title "$title" -e bash -c "${full_cmd}; exec bash" &
  else
    # Fallback: background process (output goes to log file)
    bash -c "${full_cmd}" >> "$SCRIPT_DIR/${title// /_}.log" 2>&1 &
    echo -e "  ${YELLOW}Note: No terminal emulator found. Output → ${title// /_}.log${NC}"
  fi
}

# ── Start backend ─────────────────────────────────────────────
echo -e "${BOLD}Starting backend...${NC}"
start_in_terminal "CyberQRM Backend (port 3001)" "$SCRIPT_DIR/backend" "npm run dev"
BACKEND_PID=$!

# ── Wait for backend to respond ───────────────────────────────
echo -n "  Waiting for backend"
for i in {1..30}; do
  if curl -s http://localhost:3001/api/health >/dev/null 2>&1; then
    echo -e " ${GREEN}ready${NC}"
    break
  fi
  echo -n "."
  sleep 1
  if [ $i -eq 30 ]; then
    echo -e " ${YELLOW}(timeout – starting frontend anyway)${NC}"
  fi
done

# ── Start frontend ────────────────────────────────────────────
echo -e "${BOLD}Starting frontend...${NC}"
start_in_terminal "CyberQRM Frontend (port 5173)" "$SCRIPT_DIR/frontend" "npm run dev"
FRONTEND_PID=$!

# ── Open browser ──────────────────────────────────────────────
echo ""
echo -e "  ${CYAN}Backend API :${NC}  http://localhost:3001"
echo -e "  ${CYAN}Frontend App:${NC}  http://localhost:5173"
echo ""
echo "  Opening browser in 3 seconds..."
sleep 3
open_browser "http://localhost:5173"

echo ""
echo -e "${GREEN}CyberQRM is running.${NC}"
echo "  Press Ctrl+C to stop both services."
echo ""

# ── Keep script alive; kill children on exit ──────────────────
cleanup() {
  echo ""
  echo "Shutting down CyberQRM..."
  # Kill any processes still listening on these ports
  lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true
  lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null || true
  lsof -ti:5174 2>/dev/null | xargs kill -9 2>/dev/null || true
  echo "Done."
}
trap cleanup INT TERM

# Block until Ctrl+C (the terminal windows run independently)
while true; do sleep 60; done
