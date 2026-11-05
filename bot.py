"""Async Telegram entry point for the School 21 room-booking Mini App."""

import logging
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from telegram import (
    KeyboardButton,
    MenuButtonWebApp,
    ReplyKeyboardMarkup,
    Update,
    WebAppInfo,
)
from telegram.ext import Application, CommandHandler, ContextTypes

from backend.config import BACKEND_URL, BOT_TOKEN

logger = logging.getLogger(__name__)


def web_app_url(user_id: int | None = None) -> str:
    """Build a Mini App URL while preserving existing query parameters."""
    parts = urlsplit(BACKEND_URL)
    query = dict(parse_qsl(parts.query))
    if user_id is not None:
        query["startapp"] = str(user_id)
    return urlunsplit(parts._replace(query=urlencode(query)))


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Reply to /start with the campus room-booking Mini App keyboard."""
    if update.effective_user is None or update.effective_message is None:
        return
    button = KeyboardButton(
        text="Открыть", web_app=WebAppInfo(url=web_app_url(update.effective_user.id))
    )
    keyboard = ReplyKeyboardMarkup([[button]], resize_keyboard=True)
    await update.effective_message.reply_text(
        "🏢 <b>Бронирование комнат</b>\nШкола 21\n\n"
        "📋 Выберите этаж и забронируйте комнату для работы\n"
        "💼 Скайпницы и переговорки доступны 24/7\n\n"
        "Нажми кнопку <b>Открыть</b> чтобы начать 👇",
        reply_markup=keyboard,
        parse_mode="HTML",
    )


async def post_init(app: Application) -> None:
    """Register the global Mini App menu button after Telegram connects."""
    try:
        await app.bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(text="Открыть", web_app=WebAppInfo(url=web_app_url()))
        )
    except Exception:
        # Do not log Telegram request URLs: they contain the bot token.
        logger.warning("Could not set menu button; configure it through BotFather.")


async def handle_error(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Log handler failures without including tokens or user payloads."""
    logger.error("Telegram update processing failed (%s).", type(context.error).__name__)


def build_application() -> Application:
    """Validate configuration and construct the bot without starting polling."""
    if not BOT_TOKEN or BOT_TOKEN == "replace-with-your-bot-token":
        raise ValueError("Set TELEGRAM_BOT_TOKEN in the environment or .env file.")
    parts = urlsplit(BACKEND_URL)
    if (
        parts.scheme != "https"
        or not parts.netloc
        or parts.username
        or parts.password
        or parts.fragment
    ):
        raise ValueError("Set BACKEND_URL to the public HTTPS URL of the web server.")
    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()
    app.add_handler(CommandHandler("start", start))
    app.add_error_handler(handle_error)
    return app


def main() -> None:
    """Start long polling; importing this module never contacts Telegram."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    build_application().run_polling()


if __name__ == "__main__":
    main()
