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
)
# software-properties-common is only available on Ubuntu; skip on Debian
if [[ "$DISTRO" == "ubuntu" ]]; then
    DEPS+=("software-properties-common")
fi
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

# Detect PostgreSQL version from installed packages (no postgres binary needed)
PG_VERSION=$(pg_lsclusters 2>/dev/null | awk '/active/{print $1}' | head -1)
if [[ -z "$PG_VERSION" ]]; then
    PG_VERSION=$(dpkg -l postgresql-* 2>/dev/null | grep '^ii' | grep -oP 'postgresql-\K\d+' | tail -1 || echo "")
    [[ -z "$PG_VERSION" ]] && PG_VERSION="17"
fi
echo "ℹ️  Detected PostgreSQL version: $PG_VERSION"
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

# ----------------------------------------------------------
# 2b. Start PostgreSQL service
# ----------------------------------------------------------
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
# 2c. Dedicated PostgreSQL user
# ----------------------------------------------------------
PG_USER="travelog"
if su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='$PG_USER';\"" | grep -q 1; then
    echo "ℹ️  Database user '$PG_USER' already exists"
else
    echo "📦 Creating database user '$PG_USER'…"
    su - postgres -c "psql -c \"CREATE USER \\\"$PG_USER\\\" WITH PASSWORD 'travelog';\""
    for DB_NAME in travelog_dev travelog_test; do
        su - postgres -c "psql -c \"GRANT CONNECT ON DATABASE \\\"$DB_NAME\\\" TO \\\"$PG_USER\\\";\""
        su - postgres -c "psql -c \"GRANT USAGE ON SCHEMA public TO \\\"$PG_USER\\\";\""
        su - postgres -c "psql -d \"$DB_NAME\" -c \"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \\\"$PG_USER\\\";\""
        su - postgres -c "psql -d \"$DB_NAME\" -c \"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \\\"$PG_USER\\\";\""
    done
    echo "✅ User '$PG_USER' created and granted access"
fi
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
# 4b. Service user + photo root
# ----------------------------------------------------------
if id -u travelog-service &>/dev/null; then
    echo "ℹ️  Service user 'travelog-service' already exists"
else
    echo "📦 Creating system user 'travelog-service'…"
    useradd --system --no-create-home --shell /usr/sbin/nologin travelog-service
    echo "✅ User 'travelog-service' created"
fi

PHOTO_ROOT="${TRAVELOG_PHOTO_ROOT:-/opt/travelog/photos}"
if [[ ! -d "$PHOTO_ROOT" ]]; then
    echo "⚠️  Photo root directory not found at $PHOTO_ROOT — creating it."
    mkdir -p "$PHOTO_ROOT"
    chown travelog-service:root "$PHOTO_ROOT"
    chmod 750 "$PHOTO_ROOT"
    echo "✅ Directory '$PHOTO_ROOT' created"
else
    echo "ℹ️  Photo root directory '$PHOTO_ROOT' already exists"
fi
echo ""

# ----------------------------------------------------------
# 5. Systemd service
# ----------------------------------------------------------
cat > /etc/systemd/system/travelog.service << SVCEOF
[Unit]
Description=Travelog Backend Service
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=travelog-service
WorkingDirectory=/opt/travelog
ExecStart=/usr/bin/node backend/dist/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=LOG_LEVEL=warn
Environment=TRAVELOG_PHOTO_ROOT=$PHOTO_ROOT

[Install]
WantedBy=multi-user.target
SVCEOF

# Ensure /opt/travelog ownership for service user
chown -R travelog-service:root /opt/travelog/backend /opt/travelog/frontend

systemctl daemon-reload
systemctl enable travelog
echo "✅ Systemd service configured"
echo ""

# ----------------------------------------------------------
# 6. Project dependencies
# ----------------------------------------------------------
echo "📦 Running 'npm install' at workspace root…"
cd /opt/travelog || { echo "❌ Directory /opt/travelog not found"; exit 1; }
npm install --prefer-offline
echo "✅ Node.js dependencies installed"
echo ""

# ----------------------------------------------------------
# Summary
# ----------------------------------------------------------
echo "========================================================"
echo " Setup complete!"
echo "========================================================"
echo ""
echo "Next steps:"
echo "  1. cp .env.example .env"
echo "  2. Edit .env with your configuration (set DATABASE_URL password, TRAVELOG_PHOTO_ROOT)"
echo "  3. npm run build             # compile TypeScript + Vite production build"
echo "  4. systemctl start travelog   # start backend service"
echo "  5. journalctl -u travelog -f  # watch logs"
echo ""
