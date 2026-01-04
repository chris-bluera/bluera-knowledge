#!/bin/bash
# Bluera Knowledge Plugin - Dependency Checker
# Automatically checks and installs dependencies for the plugin

set -e

# Get the plugin root directory
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$0")")}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# =====================
# Node.js Dependencies
# =====================

# Check if node_modules exists
if [ ! -d "$PLUGIN_ROOT/node_modules" ]; then
    echo -e "${YELLOW}[bluera-knowledge] Installing Node.js dependencies...${NC}"

    # Try bun first (faster), fall back to npm
    if command -v bun &> /dev/null; then
        (cd "$PLUGIN_ROOT" && bun install --frozen-lockfile 2>/dev/null) && \
            echo -e "${GREEN}[bluera-knowledge] Node.js dependencies installed ✓${NC}" || \
            echo -e "${RED}[bluera-knowledge] Failed to install Node.js dependencies${NC}"
    elif command -v npm &> /dev/null; then
        (cd "$PLUGIN_ROOT" && npm ci --silent 2>/dev/null) && \
            echo -e "${GREEN}[bluera-knowledge] Node.js dependencies installed ✓${NC}" || \
            echo -e "${RED}[bluera-knowledge] Failed to install Node.js dependencies${NC}"
    else
        echo -e "${RED}[bluera-knowledge] Neither bun nor npm found. Please install Node.js dependencies manually.${NC}"
    fi
fi

# =====================
# Python Dependencies
# =====================

# Check if Python3 is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}[bluera-knowledge] Python3 is not installed${NC}"
    echo -e "${YELLOW}Web crawling features require Python 3.x${NC}"
    echo -e "${YELLOW}Install Python3: https://www.python.org/downloads/${NC}"
    exit 0  # Don't block the session, just warn
fi

# Check Python version (require 3.8+)
python_version=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
required_version="3.8"

if ! python3 -c "import sys; exit(0 if sys.version_info >= (3, 8) else 1)"; then
    echo -e "${YELLOW}[bluera-knowledge] Python ${python_version} detected. Python 3.8+ recommended for crawl4ai${NC}"
fi

# Check if crawl4ai is installed
if python3 -c "import crawl4ai" 2>/dev/null; then
    # Already installed - get version
    crawl4ai_version=$(python3 -c "import crawl4ai; print(crawl4ai.__version__)" 2>/dev/null || echo "unknown")
    echo -e "${GREEN}[bluera-knowledge] crawl4ai ${crawl4ai_version} is installed ✓${NC}"
    exit 0
fi

# crawl4ai not installed - attempt installation
echo -e "${YELLOW}[bluera-knowledge] crawl4ai not found. Web crawling features will be unavailable.${NC}"
echo ""
echo -e "${YELLOW}To enable web crawling, install crawl4ai:${NC}"
echo -e "  ${GREEN}pip install crawl4ai${NC}"
echo ""

# Check if we should auto-install
if command -v pip3 &> /dev/null || command -v pip &> /dev/null; then
    echo -e "${YELLOW}Attempting automatic installation via pip...${NC}"

    # Try to install using pip3 or pip
    if command -v pip3 &> /dev/null; then
        PIP_CMD="pip3"
    else
        PIP_CMD="pip"
    fi

    # Try with --break-system-packages for PEP 668 environments (Python 3.11+)
    # This is needed on modern Python versions (macOS Homebrew, some Linux distros)
    if $PIP_CMD install --quiet --break-system-packages crawl4ai 2>/dev/null; then
        echo -e "${GREEN}[bluera-knowledge] Successfully installed crawl4ai ✓${NC}"
        crawl4ai_version=$(python3 -c "import crawl4ai; print(crawl4ai.__version__)" 2>/dev/null || echo "installed")
        echo -e "${GREEN}[bluera-knowledge] crawl4ai ${crawl4ai_version} ready${NC}"
    else
        # Fallback: try without --break-system-packages for older Python
        if $PIP_CMD install --quiet --user crawl4ai 2>/dev/null; then
            echo -e "${GREEN}[bluera-knowledge] Successfully installed crawl4ai ✓${NC}"
            crawl4ai_version=$(python3 -c "import crawl4ai; print(crawl4ai.__version__)" 2>/dev/null || echo "installed")
            echo -e "${GREEN}[bluera-knowledge] crawl4ai ${crawl4ai_version} ready${NC}"
        else
            echo -e "${RED}[bluera-knowledge] Auto-installation failed${NC}"
            echo ""
            echo -e "${YELLOW}For Python 3.11+ (externally-managed), install manually:${NC}"
            echo -e "  ${GREEN}pip install --break-system-packages crawl4ai${NC}"
            echo -e "${YELLOW}Or use a virtual environment:${NC}"
            echo -e "  ${GREEN}python3 -m venv venv && source venv/bin/activate && pip install crawl4ai${NC}"
        fi
    fi
else
    echo -e "${YELLOW}pip not found. Please install crawl4ai manually.${NC}"
fi

# Always exit 0 to not block the session
exit 0
