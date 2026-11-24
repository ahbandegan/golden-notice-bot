#!/usr/bin/env bash

# ==============================================================================
#  Golden Notice Telegram Bot - Automated Setup & Management Script
# ==============================================================================

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

SERVICE_NAME="golden-bot"
SYSTEMD_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Banner Display
print_banner() {
    clear
    echo -e "${YELLOW}${BOLD}"
    cat << "EOF"
  ██████╗  ██████╗ ██╗     ██████╗ ███████╗███╗   ██╗
 ██╔════╝ ██╔═══██╗██║     ██╔══██╗██╔════╝████╗  ██║
 ██║  ███╗██║   ██║██║     ██║  ██║█████╗  ██╔██╗ ██║
 ██║   ██║██║   ██║██║     ██║  ██║██╔══╝  ██║╚██╗██║
 ╚██████╔╝╚██████╔╝███████╗██████╔╝███████╗██║ ╚████║
  ╚═════╝  ╚═════╝ ╚══════╝╚═════╝ ╚══════╝╚═╝  ╚═══╝
   GOLDEN NOTICE TELEGRAM BOT - INSTALLER & MANAGER
EOF
    echo -e "${CYAN}====================================================${NC}"
    echo -e "${PURPLE}  Real-time Gold, Coin, Currency Rates & Calculator  ${NC}"
    echo -e "${CYAN}====================================================${NC}\n"
}

# Logger helpers
info() { echo -e "${CYAN}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check root privileges for systemd actions
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This operation requires root or sudo privileges."
        echo -e "Please run with: ${BOLD}sudo ./install.sh${NC}\n"
        exit 1
    fi
}

# Environment Configuration Wizard
configure_env() {
    info "Configuring environment variables..."

    local env_file="${PROJECT_DIR}/.env"
    local default_token="7292116679:AAGqOqlZcw26DQCs-Xk5LPPvuLc0ng2byu0"
    local default_admin="6850969968"
    local default_api="6850969968:uQODiyGTc3VtwvD9@GFwAPIBOT"
    local default_proxy=""

    if [[ -f "$env_file" ]]; then
        info "Found existing .env file. Would you like to reconfigure it? (y/N)"
        read -r -p "> " reconf
        if [[ ! "$reconf" =~ ^[Yy]$ ]]; then
            info "Keeping existing configuration."
            return
        fi
    fi

    echo -e "\n${BOLD}--- Telegram & API Configuration ---${NC}"

    read -r -p "Enter Telegram Bot Token [Default: ${default_token}]: " input_token
    input_token="${input_token:-$default_token}"

    read -r -p "Enter Primary Admin Telegram Chat ID [Default: ${default_admin}]: " input_admin
    input_admin="${input_admin:-$default_admin}"

    read -r -p "Enter Target Channel/Group ID (e.g. -100123456789 or leave empty): " input_target

    read -r -p "Enter GFw API Key [Default: ${default_api}]: " input_api
    input_api="${input_api:-$default_api}"

    read -r -p "Enter Proxy URL (Optional, e.g. http://127.0.0.1:10809 or leave empty): " input_proxy

    cat > "$env_file" << EOF
# Telegram Bot Configuration
BOT_TOKEN=${input_token}
ADMIN_ID=${input_admin}
TARGET_CHAT_ID=${input_target}
ERROR_CHAT_ID=
FORCED_JOIN_CHANNEL=
GFW_API_KEY=${input_api}
PROXY_URL=${input_proxy}
EOF

    # Update data/settings.json if it exists to match admin ID
    mkdir -p "${PROJECT_DIR}/data"
    if [[ ! -f "${PROJECT_DIR}/data/settings.json" ]]; then
        cat > "${PROJECT_DIR}/data/settings.json" << EOF
{
  "adminIds": [${input_admin}],
  "targetChatId": ${input_target:+"\"$input_target\""}${input_target:-null},
  "targetChatTitle": null,
  "autoSend": false,
  "scheduleType": "interval",
  "intervalMinutes": 60,
  "dailyTimes": ["11:00", "14:30", "18:00"],
  "enabledItems": ["price_dollar_rl","geram18","geram24","mesghal","sekeb","sekeb_old","nim_sekeh","rob_sekkeh","gerami","gold_global","onz"],
  "channelSignature": "",
  "lastSentAt": null,
  "errorChatId": null,
  "errorNotificationEnabled": true,
  "forcedJoinEnabled": false,
  "forcedJoinChannel": null,
  "forcedJoinChannelTitle": null,
  "templateStyle": "deluxe",
  "customIcons": {}
}
EOF
    fi

    success "Environment file (.env) created successfully."
}

# ------------------------------------------------------------------------------
# 1. Docker Installation
# ------------------------------------------------------------------------------
install_docker() {
    info "Preparing Docker deployment..."

    # Check for docker
    if ! command -v docker &> /dev/null; then
        warn "Docker not detected. Installing Docker via official get.docker.com script..."
        curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
        sh /tmp/get-docker.sh
        systemctl enable --now docker
        success "Docker installed successfully."
    fi

    configure_env

    info "Building and launching container with docker compose..."
    cd "$PROJECT_DIR"

    if docker compose version &> /dev/null; then
        docker compose down || true
        docker compose up -d --build
    elif command -v docker-compose &> /dev/null; then
        docker-compose down || true
        docker-compose up -d --build
    else
        error "Neither 'docker compose' nor 'docker-compose' found. Please install docker-compose-plugin."
        exit 1
    fi

    success "Golden Notice Bot is now running inside Docker!"
    info "Container Name: golden-notice-bot"
    info "Use Option [4] in this script to view logs."
}

# ------------------------------------------------------------------------------
# 2. Standard Systemd & Node.js Installation
# ------------------------------------------------------------------------------
install_systemd() {
    check_root
    info "Preparing standard Systemd service deployment..."

    # Check for Node.js
    if ! command -v node &> /dev/null; then
        warn "Node.js not detected. Installing Node.js 22 LTS..."
        if command -v apt-get &> /dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
            apt-get install -y nodejs build-essential
        elif command -v dnf &> /dev/null; then
            curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
            dnf install -y nodejs gcc-c++ make
        else
            error "Unsupported package manager. Please install Node.js 20+ manually."
            exit 1
        fi
    fi

    info "Node version: $(node -v)"
    info "NPM version:  $(npm -v)"

    configure_env

    info "Installing project dependencies..."
    cd "$PROJECT_DIR"
    npm ci || npm install

    info "Compiling TypeScript application..."
    npm run build

    # Create systemd service
    info "Configuring systemd service (${SERVICE_NAME})..."
    local node_path
    node_path="$(command -v node)"

    cat > "$SYSTEMD_FILE" << EOF
[Unit]
Description=Golden Notice Telegram Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${PROJECT_DIR}
ExecStart=${node_path} ${PROJECT_DIR}/dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    systemctl restart "$SERVICE_NAME"

    success "Service installed and started successfully!"
    info "Service status: $(systemctl is-active "$SERVICE_NAME")"
}

# ------------------------------------------------------------------------------
# 3. Update Bot
# ------------------------------------------------------------------------------
update_bot() {
    info "Updating Golden Notice Bot..."
    cd "$PROJECT_DIR"

    if [[ -d ".git" ]]; then
        info "Pulling latest changes from git repository..."
        git pull || warn "Git pull returned non-zero code."
    else
        warn "Not a git repository. Skipping git pull."
    fi

    if docker ps --format '{{.Names}}' | grep -q "golden-notice-bot"; then
        info "Updating Docker deployment..."
        if docker compose version &> /dev/null; then
            docker compose down
            docker compose up -d --build
        else
            docker-compose down
            docker-compose up -d --build
        fi
        success "Docker container rebuilt and restarted!"
    elif systemctl is-active --quiet "$SERVICE_NAME"; then
        check_root
        info "Rebuilding TypeScript code..."
        npm install
        npm run build
        systemctl restart "$SERVICE_NAME"
        success "Systemd service updated and restarted!"
    else
        info "Rebuilding project..."
        npm install
        npm run build
        success "Update finished."
    fi
}

# ------------------------------------------------------------------------------
# 4. View Logs
# ------------------------------------------------------------------------------
view_logs() {
    if docker ps -a --format '{{.Names}}' | grep -q "golden-notice-bot"; then
        info "Tailing Docker logs (Press Ctrl+C to exit)..."
        docker logs -f --tail=100 golden-notice-bot
    elif systemctl list-unit-files | grep -q "${SERVICE_NAME}.service"; then
        info "Tailing Systemd journal logs (Press Ctrl+C to exit)..."
        journalctl -u "$SERVICE_NAME" -f -n 100
    else
        warn "No active Docker container or Systemd service found for ${SERVICE_NAME}."
    fi
}

# ------------------------------------------------------------------------------
# 5. Restart Service
# ------------------------------------------------------------------------------
restart_service() {
    if docker ps -a --format '{{.Names}}' | grep -q "golden-notice-bot"; then
        info "Restarting Docker container..."
        docker restart golden-notice-bot
        success "Container restarted."
    elif systemctl list-unit-files | grep -q "${SERVICE_NAME}.service"; then
        check_root
        info "Restarting Systemd service..."
        systemctl restart "$SERVICE_NAME"
        success "Service restarted."
    else
        warn "No active service found to restart."
    fi
}

# ------------------------------------------------------------------------------
# 6. Stop Service
# ------------------------------------------------------------------------------
stop_service() {
    if docker ps --format '{{.Names}}' | grep -q "golden-notice-bot"; then
        info "Stopping Docker container..."
        docker stop golden-notice-bot
        success "Container stopped."
    elif systemctl is-active --quiet "$SERVICE_NAME"; then
        check_root
        info "Stopping Systemd service..."
        systemctl stop "$SERVICE_NAME"
        success "Service stopped."
    else
        warn "No running service found."
    fi
}

# ------------------------------------------------------------------------------
# 7. Uninstall Bot
# ------------------------------------------------------------------------------
uninstall_bot() {
    warn "You are about to completely uninstall Golden Notice Bot!"
    read -r -p "Are you sure you want to proceed? (yes/NO): " confirm
    if [[ "$confirm" != "yes" ]]; then
        info "Uninstallation aborted."
        return
    fi

    if docker ps -a --format '{{.Names}}' | grep -q "golden-notice-bot"; then
        info "Removing Docker container and image..."
        cd "$PROJECT_DIR"
        if docker compose version &> /dev/null; then
            docker compose down --rmi local -v || true
        elif command -v docker-compose &> /dev/null; then
            docker-compose down --rmi local -v || true
        fi
        success "Docker resources cleaned up."
    fi

    if [[ -f "$SYSTEMD_FILE" ]]; then
        check_root
        info "Disabling and removing Systemd service..."
        systemctl stop "$SERVICE_NAME" || true
        systemctl disable "$SERVICE_NAME" || true
        rm -f "$SYSTEMD_FILE"
        systemctl daemon-reload
        success "Systemd service removed."
    fi

    read -r -p "Do you want to delete settings.json and data directory? (y/N): " rm_data
    if [[ "$rm_data" =~ ^[Yy]$ ]]; then
        rm -rf "${PROJECT_DIR}/data" "${PROJECT_DIR}/.env"
        success "User data and configurations removed."
    else
        info "Preserved data/ directory for future installations."
    fi

    rm -rf "${PROJECT_DIR}/dist" "${PROJECT_DIR}/node_modules"
    success "Uninstallation completed successfully."
}

# ------------------------------------------------------------------------------
# Interactive Menu Loop
# ------------------------------------------------------------------------------
menu() {
    while true; do
        print_banner
        echo -e "${BOLD}Please select an option:${NC}\n"
        echo -e "  ${GREEN}[1]${NC} Install & Start with ${BOLD}Docker${NC} (Recommended)"
        echo -e "  ${GREEN}[2]${NC} Install & Start with ${BOLD}Node.js & Systemd${NC}"
        echo -e "  ${CYAN}[3]${NC} Update Bot (Git pull, Rebuild & Restart)"
        echo -e "  ${YELLOW}[4]${NC} View Live Logs"
        echo -e "  ${PURPLE}[5]${NC} Restart Bot Service"
        echo -e "  ${BLUE}[6]${NC} Stop Bot Service"
        echo -e "  ${RED}[7]${NC} Uninstall & Clean Up"
        echo -e "  ${BOLD}[0]${NC} Exit\n"

        read -r -p "Enter choice [0-7]: " choice
        echo ""

        case "$choice" in
            1) install_docker ; read -r -p "Press [Enter] to continue..." ;;
            2) install_systemd ; read -r -p "Press [Enter] to continue..." ;;
            3) update_bot ; read -r -p "Press [Enter] to continue..." ;;
            4) view_logs ; read -r -p "Press [Enter] to continue..." ;;
            5) restart_service ; read -r -p "Press [Enter] to continue..." ;;
            6) stop_service ; read -r -p "Press [Enter] to continue..." ;;
            7) uninstall_bot ; read -r -p "Press [Enter] to continue..." ;;
            0) echo "Goodbye!"; exit 0 ;;
            *) warn "Invalid selection. Please choose between 0 and 7." ; sleep 1 ;;
        esac
    done
}

menu
