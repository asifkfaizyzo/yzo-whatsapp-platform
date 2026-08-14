#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "🚀 Starting Automated Deployment for SudoReply Platform..."

# 1. Check for separate environment files
if [ ! -f ./backend/.env ]; then
  echo "⚠️ Warning: ./backend/.env file not found! Please create it before deploying."
fi

if [ ! -f ./admin-web/.env ]; then
  echo "⚠️ Warning: ./admin-web/.env file not found! Please create it before deploying."
fi

if [ ! -f ./tenant-web/.env ]; then
  echo "⚠️ Warning: ./tenant-web/.env file not found! Please create it before deploying."
fi

# Load tenant-web env for display if available
if [ -f ./tenant-web/.env ]; then
  export $(grep -v '^#' ./tenant-web/.env | xargs)
fi

# 2. Pull latest code from Git
echo "📥 Pulling latest code from Git repository..."
git pull origin prod || git pull origin main || echo "⚠️ Git pull failed or not a git repo branch, proceeding with local code..."

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
echo "📍 Backend API: Port 5000"
echo "📍 Tenant Web:  ${VITE_APP_URL:-Port 3002}"
echo "📍 Admin Web:   Port 3001"
echo "--------------------------------------------------------"
