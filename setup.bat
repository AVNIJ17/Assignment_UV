@echo off
REM One-time setup for Windows.
cd /d %~dp0
echo ==^> Backend
cd backend
python -m venv venv
venv\Scripts\pip install -r requirements.txt
venv\Scripts\python manage.py migrate
venv\Scripts\python manage.py seed_data
cd ..
echo ==^> Frontend
cd frontend
call npm install
cd ..
echo.
echo Setup complete.
echo Terminal 1:  cd backend ^&^& venv\Scripts\python manage.py runserver 8000
echo Terminal 2:  cd frontend ^&^& npm run dev
pause
