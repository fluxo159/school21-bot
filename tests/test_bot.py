"""Test bot construction and async replies without contacting Telegram."""

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import bot


class BotTests(unittest.IsolatedAsyncioTestCase):
    """Validate startup configuration and the actual /start handler."""

    async def test_start_replies_with_mini_app_keyboard(self) -> None:
        reply = AsyncMock()
        update = SimpleNamespace(
            effective_user=SimpleNamespace(id=101),
            effective_message=SimpleNamespace(reply_text=reply),
        )
        with patch.object(bot, "BACKEND_URL", "https://school21.example.com/?campus=test"):
            await bot.start(update, None)
        reply.assert_awaited_once()
        keyboard = reply.call_args.kwargs["reply_markup"]
        self.assertEqual(
            keyboard.keyboard[0][0].web_app.url,
            "https://school21.example.com/?campus=test&startapp=101",
        )

    async def test_start_ignores_updates_without_a_message(self) -> None:
        await bot.start(SimpleNamespace(effective_user=None, effective_message=None), None)

    async def test_build_rejects_missing_token_or_non_https_url(self) -> None:
        with patch.object(bot, "BOT_TOKEN", ""), self.assertRaises(ValueError):
            bot.build_application()
        with (
            patch.object(bot, "BOT_TOKEN", "12345:synthetic-test-token"),
            patch.object(bot, "BACKEND_URL", "http://localhost:5001"),
            self.assertRaises(ValueError),
        ):
            bot.build_application()

    async def test_menu_button_is_configured_without_polling(self) -> None:
        telegram_bot = SimpleNamespace(set_chat_menu_button=AsyncMock())
        with patch.object(bot, "BACKEND_URL", "https://school21.example.com"):
            await bot.post_init(SimpleNamespace(bot=telegram_bot))
        telegram_bot.set_chat_menu_button.assert_awaited_once()
