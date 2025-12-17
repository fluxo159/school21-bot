#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для импорта логинов из login.txt в базу данных
"""

import sqlite3
import os
import re

# Определяем путь к базе данных
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'school21.db')
LOGIN_FILE = os.path.join(os.path.dirname(BASE_DIR), 'login.txt')

def validate_login(login):
    """
    Валидация логина по строгим правилам:
    1. Длина логина ДОЛЖНА быть ровно 8 символов
    2. Только строчные английские буквы (a-z)
    3. Первые 1-6 символов должны содержать хотя бы одну гласную (aeiou)
    4. Последние 2 символа: любые строчные буквы
    """
    if not login or len(login) != 8:
        return False
    
    # Проверяем, что только строчные английские буквы
    if not re.match(r'^[a-z]{8}$', login):
        return False
    
    # Первые 6 символов должны содержать хотя бы одну гласную
    first_six = login[:6]
    vowels = set('aeiou')
    has_vowel = any(char in vowels for char in first_six)
    
    if not has_vowel:
        return False
    
    # Последние 2 символа - любые строчные буквы (уже проверено выше)
    return True

def import_logins():
    """Импортировать логины из файла в базу данных"""
    if not os.path.exists(DB_PATH):
        print(f"Ошибка: База данных не найдена по пути: {DB_PATH}")
        return
    
    if not os.path.exists(LOGIN_FILE):
        print(f"Ошибка: Файл login.txt не найден по пути: {LOGIN_FILE}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Читаем логины из файла
        with open(LOGIN_FILE, 'r', encoding='utf-8') as f:
            logins = [line.strip().lower() for line in f if line.strip()]
        
        # Убираем дубликаты, сохраняя порядок
        unique_logins = []
        seen = set()
        for login in logins:
            if login not in seen:
                unique_logins.append(login)
                seen.add(login)
        
        print(f"Найдено логинов в файле: {len(logins)}")
        print(f"Уникальных логинов: {len(unique_logins)}")
        
        # Валидируем логины
        valid_logins = []
        invalid_logins = []
        
        for login in unique_logins:
            if validate_login(login):
                valid_logins.append(login)
            else:
                invalid_logins.append(login)
        
        print(f"Валидных логинов: {len(valid_logins)}")
        if invalid_logins:
            print(f"Невалидных логинов: {len(invalid_logins)}")
            print("Примеры невалидных:", invalid_logins[:10])
        
        # Импортируем валидные логины
        imported_count = 0
        skipped_count = 0
        error_count = 0
        
        for login in valid_logins:
            try:
                # Проверяем, существует ли уже пользователь с таким логином
                cursor.execute('SELECT id FROM users WHERE school_login = ?', (login,))
                existing = cursor.fetchone()
                
                if existing:
                    skipped_count += 1
                    continue
                
                # Создаем пользователя с логином, но без телефона (телефон можно будет добавить при входе)
                # Используем специальный telegram_id для импортированных логинов
                cursor.execute('SELECT MAX(telegram_id) FROM users')
                max_telegram_id = cursor.fetchone()[0] or 0
                new_telegram_id = max_telegram_id + 1
                
                cursor.execute('''
                    INSERT INTO users (telegram_id, school_login, phone, coins)
                    VALUES (?, ?, NULL, 1000)
                ''', (new_telegram_id, login))
                
                imported_count += 1
            except Exception as e:
                error_count += 1
                print(f"Ошибка при импорте логина {login}: {e}")
        
        conn.commit()
        
        print(f"\nИмпорт завершен:")
        print(f"  Импортировано: {imported_count}")
        print(f"  Пропущено (уже существуют): {skipped_count}")
        print(f"  Ошибок: {error_count}")
        
    except Exception as e:
        conn.rollback()
        print(f"Ошибка при импорте: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    import_logins()

