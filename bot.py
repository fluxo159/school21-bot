# bot.py
from telegram import Update, WebAppInfo, KeyboardButton, ReplyKeyboardMarkup, MenuButtonWebApp
from telegram.ext import Application, CommandHandler, ContextTypes
import os
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
BACKEND_URL = os.getenv('BACKEND_URL')

if not TOKEN:
    raise ValueError("❌ TELEGRAM_BOT_TOKEN не установлен в .env файле!")
if not BACKEND_URL:
    raise ValueError("❌ BACKEND_URL не установлен в .env файле!")

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Генерируем ссылку с startapp параметром
    web_app_url = f"{BACKEND_URL}?startapp={update.effective_user.id}"
    
    # Кнопка "Открыть" для запуска мини-приложения
    button = KeyboardButton(
        text="Открыть",
        web_app=WebAppInfo(url=web_app_url)
    )
    keyboard = ReplyKeyboardMarkup([[button]], resize_keyboard=True)
    
    # Красивое приветственное сообщение
    welcome_message = (
        "🏢 <b>Бронирование комнат</b>\n"
        "Школа 21\n\n"
        "📋 Выберите этаж и забронируйте комнату для работы\n"
        "💼 Скайпницы и переговорки доступны 24/7\n\n"
        "Нажми кнопку <b>Открыть</b> чтобы начать 👇"
    )
    
    await update.message.reply_text(
        welcome_message,
        reply_markup=keyboard,
        parse_mode='HTML'
    )

async def post_init(app: Application) -> None:
    
    try:
        # Устанавливаем кнопку меню для всех пользователей (chat_id=None означает глобальная настройка)
        menu_button = MenuButtonWebApp(
            text="Открыть",
            web_app=WebAppInfo(url=BACKEND_URL)
        )
        await app.bot.set_chat_menu_button(chat_id=None, menu_button=menu_button)
        print("✅ Кнопка меню бота установлена в списке чатов")
    except Exception as e:
        print(f"⚠️ Не удалось установить кнопку меню: {e}")
        print("💡 Примечание: Кнопка меню можно также установить через @BotFather -> Bot Settings -> Menu Button")

app = Application.builder().token(TOKEN).post_init(post_init).build()
app.add_handler(CommandHandler("start", start))

print("Бот запущен...")
app.run_polling()