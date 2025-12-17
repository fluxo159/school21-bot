# ⚡ Быстрый старт - Деплой на Render.com

## 🎯 Минимальные шаги (5 минут)

### 1. GitHub (если еще нет репозитория)
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/school_21_bot_2.git
git push -u origin main
```

### 2. Render.com
1. Зарегистрируйтесь на [render.com](https://render.com)
2. **New +** → **Web Service**
3. Подключите GitHub репозиторий
4. Выберите репозиторий `school_21_bot_2`
5. Настройки:
   - **Name**: `school21-bot`
   - **Plan**: `Free`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `cd backend && gunicorn -c gunicorn_config.py app:app`
6. **Environment Variables**:
   - `TELEGRAM_BOT_TOKEN` = ваш токен от @BotFather
   - `BACKEND_URL` = `https://school21-bot.onrender.com` (обновите после деплоя!)
7. **Create Web Service**
8. Ждите 3-5 минут

### 3. Uptime Robot (чтобы не засыпал)
1. Зарегистрируйтесь на [uptimerobot.com](https://uptimerobot.com)
2. **Add New Monitor**
3. **Monitor Type**: `HTTP(s)`
4. **URL**: `https://school21-bot.onrender.com/api/ping`
5. **Interval**: `5 minutes`
6. **Create Monitor**

### 4. Запуск бота локально
```bash
# Создайте .env файл:
TELEGRAM_BOT_TOKEN=ваш_токен
BACKEND_URL=https://school21-bot.onrender.com

# Запустите:
python bot.py
```

## ✅ Готово!

**Подробная инструкция:** См. `DEPLOY_RENDER.md`

