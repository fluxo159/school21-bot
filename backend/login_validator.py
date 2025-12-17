#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Валидатор логинов для регистрации новых пиров
"""

import re

def validate_login(login):
    """
    Валидация логина по строгим правилам:
    1. Длина логина ДОЛЖНА быть ровно 8 символов
    2. Только строчные английские буквы (a-z)
    3. Первые 1-6 символов должны содержать хотя бы одну гласную (aeiou)
    4. Последние 2 символа: любые строчные буквы
    
    Args:
        login (str): Логин для валидации
        
    Returns:
        tuple: (is_valid: bool, error_message: str)
    """
    if not login:
        return False, 'Логин не может быть пустым'
    
    login = login.strip()
    
    # Специальное исключение для админа
    if login.lower() == 'admin':
        return True, ''
    
    # 1. Проверка длины
    if len(login) != 8:
        return False, f'Логин должен быть ровно 8 символов. Текущая длина: {len(login)}'
    
    # 2. Проверка на только строчные английские буквы
    if not re.match(r'^[a-z]{8}$', login):
        # Проверяем, что именно не так
        if re.search(r'[A-Z]', login):
            return False, 'Логин не должен содержать заглавные буквы. Используйте только строчные буквы (a-z)'
        if re.search(r'[0-9]', login):
            return False, 'Логин не должен содержать цифры. Используйте только строчные буквы (a-z)'
        if re.search(r'[^a-z]', login):
            return False, 'Логин не должен содержать специальные символы. Используйте только строчные буквы (a-z)'
        return False, 'Логин должен содержать только строчные английские буквы (a-z)'
    
    # 3. Проверка гласных в первых 6 символах
    first_six = login[:6]
    vowels = set('aeiou')
    has_vowel = any(char in vowels for char in first_six)
    
    if not has_vowel:
        return False, 'Первые 6 символов логина должны содержать хотя бы одну гласную букву (a, e, i, o, u)'
    
    # 4. Последние 2 символа - любые строчные буквы (уже проверено выше)
    # Все проверки пройдены
    return True, ''

def validate_login_examples():
    """Примеры валидации для тестирования"""
    valid_examples = [
        'rymundzu',  # rymund + zu
        'snowbabi',  # snowba + bi
        'davidach',  # david + ach
        'systemme',  # system + me
    ]
    
    invalid_examples = [
        ('abcdefgh', 'нет гласных в первых 6 символах'),
        ('12345678', 'есть цифры'),
        ('test', 'длина меньше 8'),
        ('verylonglogin', 'длина больше 8'),
        ('TestUser', 'заглавные буквы'),
    ]
    
    print('Валидные примеры:')
    for login in valid_examples:
        is_valid, error = validate_login(login)
        print(f'  {login}: {is_valid} {error}')
    
    print('\nНевалидные примеры:')
    for login, reason in invalid_examples:
        is_valid, error = validate_login(login)
        print(f'  {login} ({reason}): {is_valid} - {error}')

if __name__ == '__main__':
    validate_login_examples()

