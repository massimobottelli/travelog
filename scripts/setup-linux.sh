#!/usr/bin/env bash
set -euo pipefail

echo "========================================================"
echo " Travelog — Linux Deployment Setup (Debian/Ubuntu)"
echo "========================================================"
echo ""

# Require root
if [[ $EUID -ne 0 ]]; then
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

# Detect OS
DISTRO="unknown"
if [[ -f /etc/os-release ]]; then
    DISTRO=$(. /etc/os-release && echo "$ID")
elif [[ -f /etc/debian_version ]]; then
    DISTRO="debian"
fi

echo "ℹ️  Detected OS: $DISTRO"
echo ""

# ----------------------------------------------------------
# 0. Prerequisites
# ----------------------------------------------------------
apt-get update

DEPS=(
    curl
    gnupg
    ca-certificates
    wget
    unzip
    software-properties-common
)
echo "📦 Installing system dependencies…"
apt-get install -y "${DEPS[@]}"
echo "✅ System dependencies installed"
echo ""

# ----------------------------------------------------------
# 1. Node.js (LTS via NodeSource)
# ----------------------------------------------------------
NODE_MAJOR=22
if command -v node &>/dev/null; then
    echo "✅ Node.js already installed: $(node -v)"
else
    echo "📦 Installing Node.js $NODE_MAJOR via NodeSource…"
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" \
        | tee /etc/apt/sources.list.d/nodesource.list
    apt-get update
    apt-get install -y nodejs
fi
echo "✅ Node.js ready: $(node -v)"
echo ""
# ----------------------------------------------------------
# 2. PostgreSQL + PostGIS
# ----------------------------------------------------------
if dpkg -l postgresql 2>/dev/null | grep -q '^ii'; then
    echo "✅ PostgreSQL already installed"
else
    echo "📦 Installing PostgreSQL…"
    apt-get install -y postgresql postgresql-contrib
fi

PG_VERSION=$(postgres --version | grep -oP '\d+' | head -1)
POSTGIS_PKG="postgresql-${PG_VERSION}-postgis-3"

if dpkg -l "$POSTGIS_PKG" 2>/dev/null | grep -q '^ii'; then
    echo "✅ PostGIS already installed ($POSTGIS_PKG)"
else
    if dpkg -l postgresql-postgis 2>/dev/null | grep -q '^ii'; then
        echo "✅ PostGIS already installed"
    else
        echo "📦 Installing PostGIS ($POSTGIS_PKG)…"
        apt-get install -y "$POSTGIS_PKG" || {
            echo "⚠️  Package $POSTGIS_PKG not found, trying postgresql-postgis…"
            apt-get install -y postgresql-postgis
        }
    fi
fi
echo "✅ PostGIS ready"
echo ""

systemctl enable postgresql
systemctl start postgresql
echo "⏳ Waiting for PostgreSQL to be ready…"
for i in {1..30}; do
    if su - postgres -c "pg_isready -q" 2>/dev/null; then
        break
    fi
    sleep 1
done
echo "✅ PostgreSQL is ready"
echo ""

# Create databases
su - postgres -c "psql -c \"ALTER USER postgres PASSWORD 'travelog';\"" 2>/dev/null || true
su - postgres -c "psql -c \"CREATE DATABASE travelog_dev;\"" 2>/dev/null || true
su - postgres -c "psql -c \"CREATE DATABASE travelog_test;\"" 2>/dev/null || true

for DB_NAME in travelog_dev travelog_test; do
    HAS_EXT=$(su - postgres -c "psql -d $DB_NAME -tAc \"SELECT extname FROM pg_extension WHERE extname='postgis';\"" 2>/dev/null || echo "")
    if [[ -z "$HAS_EXT" ]]; then
        echo "📦 Enabling PostGIS in '$DB_NAME'…"
        su - postgres -c "psql -d $DB_NAME -c 'CREATE EXTENSION IF NOT EXISTS postgis;'"
    fi
done
echo "✅ Databases created with PostGIS enabled"
echo ""

# ----------------------------------------------------------
# 3. ExifTool
# ----------------------------------------------------------
if command -v exiftool &>/dev/null; then
    echo "✅ ExifTool already installed"
else
    echo "📦 Installing ExifTool…"
    apt-get install -y libimage-exiftool-perl
fi
echo ""

# ----------------------------------------------------------
# 4. Nginx
# ----------------------------------------------------------
if command -v nginx &>/dev/null; then
    echo "✅ Nginx already installed"
else
    echo "📦 Installing Nginx…"
    apt-get install -y nginx
fi

NGINX_SITE="/etc/nginx/sites-available/travelog"
cat > "$NGINX_SITE" << 'NGINX_EOF'
server {
    listen 80 default_server;
    server_name _;
    location / { root /opt/travelog/frontend/dist; try_files $uri $uri/ /index.html; }
    location /api { proxy_pass http://localhost:3000; proxy_http_version 1.1; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_cache_bypass $http_upgrade; }
}
NGINX_EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx 2>/dev/null || echo "⚠️  Nginx config tested but reload skipped"
echo ""

# ----------------------------------------------------------
# 5. Systemd service
# ----------------------------------------------------------
cat > /etc/systemd/system/travelog.service << 'SVCEOF'
[Unit]
Description=Travelog Backend Service
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/travelog/backend
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=LOG_LEVEL=warn

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable travelog
echo "✅ Systemd service configured"
echo ""

# ----------------------------------------------------------
# Summary
# ----------------------------------------------------------
echo "========================================================"
echo " Setup complete!"
echo "========================================================"
echo ""
echo "Next steps:"
echo "  1. Deploy project to /opt/travelog"
echo "  2. cp .env.example .env"
echo "  3. sed -i 's/NODE_ENV=development/NODE_ENV=production/' .env"
echo "  4. Edit .env with your configuration"
echo "  5. npm install && npm run build"
echo "  6. systemctl start travelog"
echo "  7. journalctl -u travelog -f"
echo ""
