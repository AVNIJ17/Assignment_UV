#!/usr/bin/env bash
# Starts the Django API on http://127.0.0.1:8000
set -e
cd "$(dirname "$0")/backend"
./venv/bin/python manage.py runserver 8000
