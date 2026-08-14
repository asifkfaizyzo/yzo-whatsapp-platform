#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "🚀 Starting Automated Deployment for SudoReply Platform..."

# 1. Ensure .env file exists
if [ ! -f .env ]; then
  echo "⚠️ Warning: .env file not found! Copying from .env.example..."
  cp .env.example .env
  echo "❗ Please update your .env file with actual production secrets."
fi

# Load variables from .env for summary display
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# 2. Pull latest code from Git
echo "📥 Pulling latest code from Git repository..."
git pull origin main || echo "⚠️ Git pull failed or not a git repo branch, proceeding with local code..."

# 3. Build and recreate Docker containers with limits
echo "🔨 Building Docker images & starting containers with resource limits..."
docker compose up -d --build

# 4. Clean up unused Docker images to conserve disk space
echo "🧹 Pruning old unused Docker images..."
docker image prune -f

# 5. Display status of running services
echo "✅ Deployment successful! Service status:"
docker compose ps

echo "--------------------------------------------------------"
echo "🎉 Platform is up and running with 8GB RAM resource limits!"
echo "📍 Backend API: ${VITE_BACKEND_URL:-http://localhost:5000}"
echo "📍 Tenant Web:  ${VITE_APP_URL:-http://localhost:3002}"
echo "📍 Admin Web:   Port ${ADMIN_WEB_PORT:-3001}"
echo "--------------------------------------------------------"
