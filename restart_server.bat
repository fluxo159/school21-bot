@echo off
echo Останавливаем процессы на порту 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
    echo Останавливаем процесс %%a
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo Запускаем сервер...
cd backend
python app.py
pause

