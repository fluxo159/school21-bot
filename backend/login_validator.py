"""Validate self-entered School 21 peer-login fields."""

import re


def validate_login(login: str) -> tuple[bool, str]:
    """Validate the eight-letter School 21 peer-login format."""
    if not login:
        return False, "Логин не может быть пустым"

    login = login.strip()

    # 1. Проверка длины
    if len(login) != 8:
        return False, f"Логин должен быть ровно 8 символов. Текущая длина: {len(login)}"

    # 2. Проверка на только строчные английские буквы
    if not re.match(r"^[a-z]{8}$", login):
        # Проверяем, что именно не так
        if re.search(r"[A-Z]", login):
            return (
                False,
                "Логин не должен содержать заглавные буквы. Используйте только строчные буквы (a-z)",
            )
        if re.search(r"[0-9]", login):
            return False, "Логин не должен содержать цифры. Используйте только строчные буквы (a-z)"
        if re.search(r"[^a-z]", login):
            return (
                False,
                "Логин не должен содержать специальные символы. Используйте только строчные буквы (a-z)",
            )
        return False, "Логин должен содержать только строчные английские буквы (a-z)"

    # 3. Проверка гласных в первых 6 символах
    first_six = login[:6]
    vowels = set("aeiou")
    has_vowel = any(char in vowels for char in first_six)

    if not has_vowel:
        return (
            False,
            "Первые 6 символов логина должны содержать хотя бы одну гласную букву (a, e, i, o, u)",
        )

    # 4. Последние 2 символа - любые строчные буквы (уже проверено выше)
    # Все проверки пройдены
    return True, ""
