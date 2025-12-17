source venv/Scripts/activate

python backend/app.py

ngrok http 5000

python bot.py

чтобы сбросить базу данных
cd backend
python reset_users.py
или
python backend/reset_users.py