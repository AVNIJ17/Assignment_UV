#!/usr/bin/env bash
# Starts the React app on http://localhost:5173
set -e
cd "$(dirname "$0")/frontend"
npm run dev
