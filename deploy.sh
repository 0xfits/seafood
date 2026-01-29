#!/bin/bash

# Jinli Club Deployment Script

echo "🚀 Starting deployment..."

# 1. Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# 2. Build Frontend
echo "🏗️ Building frontend..."
cd frontend
npm install
npm run build
cd ..

# 3. Backend Setup (Sync dependencies)
echo "🐍 Updating backend dependencies..."
cd backend
# Check if venv exists, if not create it (optional, depends on environment)
# if [ ! -d ".venv" ]; then python3 -m venv .venv; fi
# source .venv/bin/activate
pip install -r requirements.txt
cd ..

# 4. Restart Services (Using PM2 as an example)
echo "♻️ Restarting services..."
# pm2 restart jinli-backend || pm2 start backend/apex.py --name jinli-backend --interpreter python3
# pm2 restart jinli-frontend-nginx # If managing nginx via pm2, otherwise use systemctl

echo "✅ Deployment finished!"
