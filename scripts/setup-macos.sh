#!/usr/bin/env bash
set -euo pipefail

echo "========================================================"
echo " Travelog — macOS Development Setup"
echo "========================================================"
echo ""

# Detect architecture for Homebrew path
ARCH=$(uname -m)
if [[ "$ARCH" == "arm64" ]]; then
    BREW_PREFIX="/opt/homebrew"
else
    BREW_PREFIX="/usr/local"
fi
export PATH="$BREW_PREFIX/bin:$BREW_PREFIX/sbin:$PATH"

# ----------------------------------------------------------
# 0. Prerequisites check
# ----------------------------------------------------------
if ! command -v brew &>/dev/null; then
    echo "❌ Homebrew is not installed."
    echo "   Install it first:"
    echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo ""
    exit 1
fi

echo "✅ Homebrew found: $(brew --version | head -1)"
echo ""

# ----------------------------------------------------------
# 1. Node.js
# ----------------------------------------------------------
if command -v node &>/dev/null; then
    NODE_VER=$(node -v 2>/dev/null || echo "unknown")
    echo "✅ Node.js already installed: $NODE_VER"
else
    echo "📦 Installing Node.js via Homebrew…"
    brew install node
    echo "✅ Node.js installed: $(node -v)"
fi
echo ""

# ----------------------------------------------------------
# 2. PostgreSQL + PostGIS
# ----------------------------------------------------------
PG_INSTALLED=false

if command -v psql &>/dev/null; then
    PG_INSTALLED=true
    echo "✅ PostgreSQL already installed: $(psql --version)"
fi

# Always ensure PATH includes PostgreSQL binaries from Homebrew keg
export PATH="$BREW_PREFIX/opt/postgresql@17/bin:$PATH"

if ! $PG_INSTALLED; then
    echo "📦 Installing PostgreSQL via Homebrew…"
    brew install postgresql@17
    echo "✅ PostgreSQL installed: $(psql --version)"
fi

# Start PostgreSQL service (ignore failure if already running)
echo "⏳ Starting PostgreSQL service…"
brew services start postgresql@17 2>/dev/null || true

# Wait for PostgreSQL to accept connections
echo "⏳ Waiting for PostgreSQL to be ready…"
for i in {1..30}; do
    if pg_isready -q 2>/dev/null; then
        break
    fi
    sleep 1
done
echo "✅ PostgreSQL is ready"
echo ""

# ----------------------------------------------------------
# 3. ExifTool
# ----------------------------------------------------------
if command -v exiftool &>/dev/null; then
    echo "✅ ExifTool already installed"
else
    echo "📦 Installing ExifTool via Homebrew…"
    brew install exiftool
    echo "✅ ExifTool installed"
fi
echo ""

# ----------------------------------------------------------
# 3.5. PostGIS
# ----------------------------------------------------------
if brew list postgis &>/dev/null; then
    echo "✅ PostGIS already installed via Homebrew"
else
    echo "📦 Installing PostGIS via Homebrew…"
    brew install postgis
    echo "✅ PostGIS installed"
fi
echo ""

# ----------------------------------------------------------
# 4. Create development databases
# ----------------------------------------------------------
PSQL_CMD="psql"
DB_USER="$(whoami)"

create_database() {
    local db_name=$1
    if $PSQL_CMD -U "$DB_USER" -d postgres -lqt 2>/dev/null | grep -qw "$db_name"; then
        echo "ℹ️  Database '$db_name' already exists — skipping"
    else
        echo "📦 Creating database '$db_name'…"
        $PSQL_CMD -U "$DB_USER" -d postgres -c "CREATE DATABASE \"${db_name}\";"
        echo "✅ Database '$db_name' created"
    fi
}

enable_postgis() {
    local db_name=$1
    local has_ext=$($PSQL_CMD -U "$DB_USER" -d "$db_name" -tAc
        "SELECT extname FROM pg_extension WHERE extname='postgis';" 2>/dev/null || echo "")
    if [[ -n "$has_ext" ]]; then
        echo "ℹ️  PostGIS extension already enabled in '$db_name'"
    else
        echo "📦 Enabling PostGIS in '$db_name'…"
        $PSQL_CMD -U "$DB_USER" -d "$db_name" -c "CREATE EXTENSION IF NOT EXISTS postgis;"
        echo "✅ PostGIS enabled in '$db_name'"
    fi
}

for DB in travelog_dev travelog_test; do
    create_database "$DB"
    enable_postgis "$DB"
done

echo ""

# ----------------------------------------------------------
# 5. Project dependencies
# ----------------------------------------------------------
echo "📦 Running 'npm install' at workspace root…"
cd "$(dirname "$0")/.."
npm install --prefer-offline

echo ""
echo "========================================================"
echo " Setup complete!"
echo "========================================================"
echo ""
echo "Next steps:"
echo "  1. cp .env.example .env"
echo "  2. Edit .env with your configuration"
echo "  3. npm run dev          # start both backend + frontend"
echo "  4. npm test             # verify tests pass"
echo ""
