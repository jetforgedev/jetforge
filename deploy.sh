#!/usr/bin/env bash
# ─── JetForge deploy script ────────────────────────────────────────────────────
# Usage:
#   ./deploy.sh            → deploy both backend + frontend
#   ./deploy.sh backend    → deploy backend only
#   ./deploy.sh frontend   → deploy frontend only
#
# Always: git pull → npm ci → npm run build → pm2 restart
# Order matters: NEVER restart PM2 before the build succeeds.

set -euo pipefail   # exit on error, undefined var, or pipe failure

BRANCH="feat/volume-buckets"
BACKEND_DIR="/var/www/jetforge/backend"
FRONTEND_DIR="/var/www/jetforge/frontend"

deploy_backend() {
  echo "=== Backend deploy ==="
  cd "$BACKEND_DIR"
  git pull origin "$BRANCH"
  npm ci                   # clean install (postinstall runs prisma generate)
  npm run build            # tsc — fails fast if there are type errors
  pm2 restart jetforge-backend --update-env
  echo "=== Backend done ==="
}

deploy_frontend() {
  echo "=== Frontend deploy ==="
  cd "$FRONTEND_DIR"
  git pull origin "$BRANCH"
  npm ci
  npm run build            # next build — fails fast on errors
  pm2 restart jetforge-frontend --update-env
  echo "=== Frontend done ==="
}

TARGET="${1:-both}"

case "$TARGET" in
  backend)  deploy_backend  ;;
  frontend) deploy_frontend ;;
  both)
    deploy_backend
    deploy_frontend
    ;;
  *)
    echo "Usage: $0 [backend|frontend|both]"
    exit 1
    ;;
esac

pm2 status
echo ""
echo "Health check:"
sleep 2   # give PM2 a moment to start the new processes
curl -s http://localhost:4000/health
echo ""
