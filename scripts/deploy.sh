#!/bin/bash

# ============================================
# ShortsPusher - Automated Deploy Script
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/backend/.env"
DEPLOYED_FILE="$ROOT_DIR/.env.deployed"

echo -e "${CYAN}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║        ShortsPusher Deploy Script      ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"

# ---- Helper functions ----
spinner() {
  local pid=$1
  local msg=$2
  local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  local i=0
  while kill -0 "$pid" 2>/dev/null; do
    i=$(( (i+1) % ${#spin} ))
    printf "\r  ${BLUE}${spin:$i:1}${NC} %s" "$msg"
    sleep 0.1
  done
  printf "\r  ${GREEN}✓${NC} %s\n" "$msg"
}

ask() {
  local prompt=$1
  local var_name=$2
  local default=$3
  local current="${!var_name}"

  if [ -n "$current" ]; then
    echo -e "  ${GREEN}✓${NC} $prompt: ${CYAN}(already set)${NC}"
    return
  fi

  if [ -n "$default" ]; then
    read -p "  → $prompt [$default]: " value
    value="${value:-$default}"
  else
    read -p "  → $prompt: " value
  fi

  eval "$var_name='$value'"
}

ask_secret() {
  local prompt=$1
  local var_name=$2
  local current="${!var_name}"

  if [ -n "$current" ]; then
    echo -e "  ${GREEN}✓${NC} $prompt: ${CYAN}(already set)${NC}"
    return
  fi

  read -s -p "  → $prompt: " value
  echo ""
  eval "$var_name='$value'"
}

check_command() {
  if ! command -v "$1" &>/dev/null; then
    echo -e "  ${RED}✗${NC} $1 is not installed."
    echo -e "    Install with: ${YELLOW}$2${NC}"
    return 1
  fi
  echo -e "  ${GREEN}✓${NC} $1 found"
  return 0
}

# ---- Step 1: Check prerequisites ----
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}\n"

MISSING=0
check_command "node" "https://nodejs.org/" || MISSING=1
check_command "npm" "Comes with Node.js" || MISSING=1
check_command "npx" "Comes with npm" || MISSING=1
check_command "vercel" "npm i -g vercel" || MISSING=1
check_command "git" "https://git-scm.com/" || MISSING=1

if [ "$MISSING" -eq 1 ]; then
  echo -e "\n  ${RED}Missing prerequisites. Please install them and re-run.${NC}"
  exit 1
fi

echo ""

# ---- Step 2: Load existing .env ----
echo -e "${YELLOW}Step 2: Configuring environment variables...${NC}\n"

if [ -f "$ENV_FILE" ]; then
  echo -e "  ${GREEN}✓${NC} Loading existing .env"
  set -a
  source "$ENV_FILE"
  set +a
fi

# Generate automatic values
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -hex 32)
  echo -e "  ${GREEN}✓${NC} Generated JWT_SECRET"
fi

if [ -z "$ENCRYPTION_KEY" ]; then
  ENCRYPTION_KEY=$(openssl rand -hex 16)
  echo -e "  ${GREEN}✓${NC} Generated ENCRYPTION_KEY (32 chars)"
fi

echo ""
echo -e "  ${CYAN}--- App Credentials ---${NC}"
ask "App username" APP_USERNAME "admin"
ask_secret "App password" APP_PASSWORD

echo ""
echo -e "  ${CYAN}--- Database ---${NC}"
echo -e "  ${BLUE}ℹ${NC} You can use Render PostgreSQL or Neon.tech"
ask "DATABASE_URL (postgresql://...)" DATABASE_URL

echo ""
echo -e "  ${CYAN}--- Cloudflare R2 ---${NC}"
ask "R2 Account ID" R2_ACCOUNT_ID
ask "R2 Access Key ID" R2_ACCESS_KEY_ID
ask_secret "R2 Secret Access Key" R2_SECRET_ACCESS_KEY
ask "R2 Bucket Name" R2_BUCKET_NAME
ask "R2 Public URL (https://pub-xxx.r2.dev)" R2_PUBLIC_URL

echo ""
echo -e "  ${CYAN}--- YouTube OAuth ---${NC}"
ask "YouTube Client ID" YOUTUBE_CLIENT_ID
ask_secret "YouTube Client Secret" YOUTUBE_CLIENT_SECRET

echo ""
echo -e "  ${CYAN}--- Instagram/Meta OAuth ---${NC}"
ask "Instagram App ID" INSTAGRAM_APP_ID
ask_secret "Instagram App Secret" INSTAGRAM_APP_SECRET

echo ""
echo -e "  ${CYAN}--- TikTok OAuth ---${NC}"
ask "TikTok Client Key" TIKTOK_CLIENT_KEY
ask_secret "TikTok Client Secret" TIKTOK_CLIENT_SECRET

echo ""
echo -e "  ${CYAN}--- Deploy Services ---${NC}"
ask_secret "Render API Key" RENDER_API_KEY
echo -e "  ${BLUE}ℹ${NC} For Vercel, make sure you're logged in (vercel login)"

echo ""

# ---- Step 3: Save .env ----
echo -e "${YELLOW}Step 3: Saving configuration...${NC}\n"

cat > "$ENV_FILE" <<ENVEOF
# App
JWT_SECRET=$JWT_SECRET
APP_USERNAME=$APP_USERNAME
APP_PASSWORD=$APP_PASSWORD
ENCRYPTION_KEY=$ENCRYPTION_KEY

# Database
DATABASE_URL=$DATABASE_URL

# Cloudflare R2
R2_ACCOUNT_ID=$R2_ACCOUNT_ID
R2_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME=$R2_BUCKET_NAME
R2_PUBLIC_URL=$R2_PUBLIC_URL

# YouTube
YOUTUBE_CLIENT_ID=$YOUTUBE_CLIENT_ID
YOUTUBE_CLIENT_SECRET=$YOUTUBE_CLIENT_SECRET
YOUTUBE_REDIRECT_URI=

# Instagram
INSTAGRAM_APP_ID=$INSTAGRAM_APP_ID
INSTAGRAM_APP_SECRET=$INSTAGRAM_APP_SECRET
INSTAGRAM_REDIRECT_URI=

# TikTok
TIKTOK_CLIENT_KEY=$TIKTOK_CLIENT_KEY
TIKTOK_CLIENT_SECRET=$TIKTOK_CLIENT_SECRET
TIKTOK_REDIRECT_URI=

# Deploy
RENDER_API_KEY=$RENDER_API_KEY
FRONTEND_URL=
ENVEOF

echo -e "  ${GREEN}✓${NC} .env saved"

# ---- Step 4: Database migration ----
echo -e "\n${YELLOW}Step 4: Running database migrations...${NC}\n"

cd "$ROOT_DIR/backend"
npx prisma generate &
spinner $! "Generating Prisma client"

npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss &
spinner $! "Applying database schema"

echo ""

# ---- Step 5: Deploy Backend to Render ----
echo -e "${YELLOW}Step 5: Deploying backend to Render...${NC}\n"

if [ -z "$RENDER_API_KEY" ]; then
  echo -e "  ${YELLOW}⚠${NC} No Render API key. Skipping auto-deploy."
  echo -e "  ${BLUE}ℹ${NC} Deploy manually: push backend/ to a Git repo and connect to Render."
  read -p "  → Enter backend URL when deployed: " BACKEND_URL
else
  # Create Render web service via API
  echo -e "  ${BLUE}ℹ${NC} Creating Render service..."

  RENDER_RESPONSE=$(curl -s -X POST "https://api.render.com/v1/services" \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"type\": \"web_service\",
      \"name\": \"shortspusher-api\",
      \"runtime\": \"node\",
      \"plan\": \"free\",
      \"buildCommand\": \"npm install && npm run build\",
      \"startCommand\": \"npm start\",
      \"envVars\": [
        {\"key\": \"NODE_ENV\", \"value\": \"production\"},
        {\"key\": \"JWT_SECRET\", \"value\": \"$JWT_SECRET\"},
        {\"key\": \"APP_USERNAME\", \"value\": \"$APP_USERNAME\"},
        {\"key\": \"APP_PASSWORD\", \"value\": \"$APP_PASSWORD\"},
        {\"key\": \"ENCRYPTION_KEY\", \"value\": \"$ENCRYPTION_KEY\"},
        {\"key\": \"DATABASE_URL\", \"value\": \"$DATABASE_URL\"},
        {\"key\": \"R2_ACCOUNT_ID\", \"value\": \"$R2_ACCOUNT_ID\"},
        {\"key\": \"R2_ACCESS_KEY_ID\", \"value\": \"$R2_ACCESS_KEY_ID\"},
        {\"key\": \"R2_SECRET_ACCESS_KEY\", \"value\": \"$R2_SECRET_ACCESS_KEY\"},
        {\"key\": \"R2_BUCKET_NAME\", \"value\": \"$R2_BUCKET_NAME\"},
        {\"key\": \"R2_PUBLIC_URL\", \"value\": \"$R2_PUBLIC_URL\"},
        {\"key\": \"YOUTUBE_CLIENT_ID\", \"value\": \"$YOUTUBE_CLIENT_ID\"},
        {\"key\": \"YOUTUBE_CLIENT_SECRET\", \"value\": \"$YOUTUBE_CLIENT_SECRET\"},
        {\"key\": \"INSTAGRAM_APP_ID\", \"value\": \"$INSTAGRAM_APP_ID\"},
        {\"key\": \"INSTAGRAM_APP_SECRET\", \"value\": \"$INSTAGRAM_APP_SECRET\"},
        {\"key\": \"TIKTOK_CLIENT_KEY\", \"value\": \"$TIKTOK_CLIENT_KEY\"},
        {\"key\": \"TIKTOK_CLIENT_SECRET\", \"value\": \"$TIKTOK_CLIENT_SECRET\"}
      ]
    }")

  RENDER_SERVICE_URL=$(echo "$RENDER_RESPONSE" | grep -o '"url":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -n "$RENDER_SERVICE_URL" ]; then
    BACKEND_URL="https://$RENDER_SERVICE_URL"
    echo -e "  ${GREEN}✓${NC} Render service created: $BACKEND_URL"
  else
    echo -e "  ${YELLOW}⚠${NC} Auto-deploy may have failed. Check Render dashboard."
    read -p "  → Enter backend URL: " BACKEND_URL
  fi
fi

# Update redirect URIs
YOUTUBE_REDIRECT_URI="${BACKEND_URL}/api/connections/youtube/callback"
INSTAGRAM_REDIRECT_URI="${BACKEND_URL}/api/connections/instagram/callback"
TIKTOK_REDIRECT_URI="${BACKEND_URL}/api/connections/tiktok/callback"

# Update .env with redirect URIs
sed -i "s|YOUTUBE_REDIRECT_URI=.*|YOUTUBE_REDIRECT_URI=$YOUTUBE_REDIRECT_URI|" "$ENV_FILE"
sed -i "s|INSTAGRAM_REDIRECT_URI=.*|INSTAGRAM_REDIRECT_URI=$INSTAGRAM_REDIRECT_URI|" "$ENV_FILE"
sed -i "s|TIKTOK_REDIRECT_URI=.*|TIKTOK_REDIRECT_URI=$TIKTOK_REDIRECT_URI|" "$ENV_FILE"

echo ""

# ---- Step 6: Deploy Frontend to Vercel ----
echo -e "${YELLOW}Step 6: Deploying frontend to Vercel...${NC}\n"

cd "$ROOT_DIR/frontend"

echo -e "  ${BLUE}ℹ${NC} Running Vercel deploy..."
VERCEL_OUTPUT=$(vercel --prod \
  -e NEXT_PUBLIC_API_URL="$BACKEND_URL" \
  --yes 2>&1)

FRONTEND_URL=$(echo "$VERCEL_OUTPUT" | grep -oP 'https://[^\s]+\.vercel\.app' | tail -1)

if [ -n "$FRONTEND_URL" ]; then
  echo -e "  ${GREEN}✓${NC} Frontend deployed: $FRONTEND_URL"
else
  echo -e "  ${YELLOW}⚠${NC} Could not detect Vercel URL."
  read -p "  → Enter frontend URL: " FRONTEND_URL
fi

# Update backend FRONTEND_URL for CORS
sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=$FRONTEND_URL|" "$ENV_FILE"

echo ""

# ---- Step 7: Post-deploy ----
echo -e "${YELLOW}Step 7: Post-deploy summary${NC}\n"

cat > "$DEPLOYED_FILE" <<DEPEOF
FRONTEND_URL=$FRONTEND_URL
BACKEND_URL=$BACKEND_URL
YOUTUBE_REDIRECT_URI=$YOUTUBE_REDIRECT_URI
INSTAGRAM_REDIRECT_URI=$INSTAGRAM_REDIRECT_URI
TIKTOK_REDIRECT_URI=$TIKTOK_REDIRECT_URI
DEPLOYED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DEPEOF

echo -e "  ${GREEN}╔═══════════════════════════════════════╗${NC}"
echo -e "  ${GREEN}║         Deploy Complete!               ║${NC}"
echo -e "  ${GREEN}╚═══════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Frontend:${NC} $FRONTEND_URL"
echo -e "  ${CYAN}Backend:${NC}  $BACKEND_URL"
echo ""
echo -e "  ${YELLOW}⚠  IMPORTANT: Configure these redirect URIs:${NC}"
echo ""
echo -e "  ${CYAN}YouTube (Google Cloud Console > OAuth > Authorized redirect URIs):${NC}"
echo -e "    $YOUTUBE_REDIRECT_URI"
echo ""
echo -e "  ${CYAN}Instagram (Meta Developer > Facebook Login > Settings > Valid OAuth Redirect URIs):${NC}"
echo -e "    $INSTAGRAM_REDIRECT_URI"
echo ""
echo -e "  ${CYAN}TikTok (TikTok Developer Portal > App > Redirect URI):${NC}"
echo -e "    $TIKTOK_REDIRECT_URI"
echo ""
echo -e "  ${CYAN}Render Backend (Update FRONTEND_URL env var for CORS):${NC}"
echo -e "    FRONTEND_URL=$FRONTEND_URL"
echo ""
echo -e "  ${GREEN}URLs saved to .env.deployed${NC}"
echo ""
