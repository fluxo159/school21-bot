# backend/add_last_activity.py
# Миграция: добавление поля last_activity в таблицу users

import sqlite3
import os
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'school21.db')

def migrate_add_last_activity():
    """Добавляет поле last_activity в таблицу users"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Проверяем, существует ли уже поле last_activity
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'last_activity' not in columns:
            # Добавляем поле last_activity
            cursor.execute('''
                ALTER TABLE users 
                ADD COLUMN last_activity TIMESTAMP
            ''')
            
            # Устанавливаем текущее время для всех существующих пользователей
            current_time = datetime.now().isoformat()
            cursor.execute('''
                UPDATE users 
                SET last_activity = ?
            ''', (current_time,))
            
            conn.commit()
            print("[OK] Поле last_activity успешно добавлено в таблицу users")
            print(f"[OK] Обновлено время активности для всех существующих пользователей")
        else:
            print("[INFO] Поле last_activity уже существует в таблице users")
        
        conn.close()
        
    except Exception as e:
        print(f"[ERROR] Ошибка при миграции: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    migrate_add_last_activity()

