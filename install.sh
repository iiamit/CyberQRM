#!/usr/bin/env bash
# ============================================================
#  CyberQRM – Install Script (macOS / Linux)
# ============================================================
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Colour

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo ""
echo "============================================"
echo "  CyberQRM - FAIR Risk Management Platform"
echo "  Installation Script"
echo "============================================"
echo ""

# ── 1. Check Node.js ─────────────────────────────────────────
echo -e "${BOLD}Checking prerequisites...${NC}"

if ! command -v node &>/dev/null; then
  echo -e "${RED}Error: Node.js is not installed.${NC}"
  echo ""
  echo "CyberQRM requires Node.js 22.5 or later."
  echo ""
  echo "Install options:"
  echo "  • Official installer : https://nodejs.org/en/download"
  echo "  • Via nvm            : https://github.com/nvm-sh/nvm"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "  • Via Homebrew       : brew install node"
  fi
  echo ""
  exit 1
fi

NODE_VERSION_FULL=$(node -v | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION_FULL" | cut -d. -f1)
NODE_MINOR=$(echo "$NODE_VERSION_FULL" | cut -d. -f2)

if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 5 ]; }; then
  echo -e "${RED}Error: Node.js 22.5+ is required (found v${NODE_VERSION_FULL}).${NC}"
  echo ""
  echo "Please upgrade Node.js:"
  echo "  • Official installer : https://nodejs.org/en/download"
  echo "  • Via nvm            : nvm install 22 && nvm use 22"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "  • Via Homebrew       : brew upgrade node"
  fi
  echo ""
  exit 1
fi

echo -e "  ${GREEN}✓${NC} Node.js v${NODE_VERSION_FULL}"

if ! command -v npm &>/dev/null; then
  echo -e "${RED}Error: npm is not installed (it usually ships with Node.js).${NC}"
  exit 1
fi

NPM_VERSION=$(npm -v)
echo -e "  ${GREEN}✓${NC} npm v${NPM_VERSION}"
echo ""

# ── 2. Install root dependencies ─────────────────────────────
echo -e "${BOLD}Installing root dependencies...${NC}"
cd "$SCRIPT_DIR"
npm install
echo ""

# ── 3. Install backend dependencies ──────────────────────────
echo -e "${BOLD}Installing backend dependencies...${NC}"
cd "$SCRIPT_DIR/backend"
npm install
echo ""

# ── 4. Install frontend dependencies ─────────────────────────
echo -e "${BOLD}Installing frontend dependencies...${NC}"
cd "$SCRIPT_DIR/frontend"
npm install
echo ""

# ── 5. Ensure data directories exist ─────────────────────────
mkdir -p "$SCRIPT_DIR/backend/data"
mkdir -p "$SCRIPT_DIR/backend/data/attack"

# ── 6. Download MITRE ATT&CK dataset ─────────────────────────
ATTACK_FILE="$SCRIPT_DIR/backend/data/attack/enterprise-attack-17.1.json"
ATTACK_URL="https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack-17.1.json"

if [ -f "$ATTACK_FILE" ]; then
  echo -e "  ${GREEN}✓${NC} MITRE ATT&CK dataset already present — skipping download."
  echo ""
else
  echo -e "${BOLD}Downloading MITRE ATT&CK dataset (~30 MB)...${NC}"
  echo "  Source: github.com/mitre-attack/attack-stix-data"
  echo ""
  if command -v curl &>/dev/null; then
    if curl -L --fail --progress-bar "$ATTACK_URL" -o "$ATTACK_FILE"; then
      echo -e "  ${GREEN}✓${NC} ATT&CK dataset downloaded successfully."
    else
      echo -e "  ${YELLOW}Warning: ATT&CK download failed.${NC} You can retry by re-running install.sh."
      echo "  ATT&CK-based features will show 'data unavailable' until the file is present."
      rm -f "$ATTACK_FILE"
    fi
  elif command -v wget &>/dev/null; then
    if wget -q --show-progress "$ATTACK_URL" -O "$ATTACK_FILE"; then
      echo -e "  ${GREEN}✓${NC} ATT&CK dataset downloaded successfully."
    else
      echo -e "  ${YELLOW}Warning: ATT&CK download failed.${NC} You can retry by re-running install.sh."
      echo "  ATT&CK-based features will show 'data unavailable' until the file is present."
      rm -f "$ATTACK_FILE"
    fi
  else
    echo -e "  ${YELLOW}Warning: Neither curl nor wget found.${NC}"
    echo "  Please manually download the ATT&CK dataset:"
    echo "  $ATTACK_URL"
    echo "  → save as: backend/data/attack/enterprise-attack-17.1.json"
  fi
  echo ""
fi

# ── 7. Make start script executable ──────────────────────────
chmod +x "$SCRIPT_DIR/start.sh"

# ── Done ──────────────────────────────────────────────────────
echo "============================================"
echo -e "  ${GREEN}Installation complete!${NC}"
echo "============================================"
echo ""
echo "To start CyberQRM, run:"
echo ""
echo -e "  ${BOLD}./start.sh${NC}"
echo ""
