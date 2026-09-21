#!/usr/bin/env bash
# One-time setup: creates the virtualenv, installs everything, seeds the database.
set -e
cd "$(dirname "$0")"

echo "==> Backend"
cd backend
python3 -m venv venv
./venv/bin/pip install --upgrade pip -q
./venv/bin/pip install -r requirements.txt -q
./venv/bin/python manage.py migrate
./venv/bin/python manage.py seed_data
cd ..

echo "==> Frontend"
cd frontend
npm install
cd ..

echo ""
echo "Setup complete. Now run ./run-backend.sh and ./run-frontend.sh in two terminals."
