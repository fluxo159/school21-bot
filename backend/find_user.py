#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для поиска информации о пользователе по telegram_id
Использование: python find_user.py <telegram_id>
"""

import sqlite3
import os
import sys
from datetime import datetime

# Определяем путь к базе данных
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'school21.db')

def find_user(telegram_id):
    """Найти пользователя по telegram_id и показать всю информацию"""
    if not os.path.exists(DB_PATH):
        print(f"Ошибка: База данных не найдена по пути: {DB_PATH}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Ищем пользователя
        cursor.execute('''
            SELECT id, telegram_id, school_login, phone, coins, created_at
            FROM users
            WHERE telegram_id = ?
        ''', (telegram_id,))
        
        user = cursor.fetchone()
        
        if not user:
            print(f"\n[!] Пользователь с telegram_id = {telegram_id} не найден в базе данных")
            print("\nВозможные причины:")
            print("  - Пользователь еще не зарегистрировался")
            print("  - Неверный telegram_id")
            return
        
        # Выводим информацию о пользователе
        print("\n" + "="*60)
        print("ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ")
        print("="*60)
        print(f"ID в базе:           {user[0]}")
        print(f"Telegram ID:         {user[1]}")
        print(f"Школьный логин:      {user[2] if user[2] else 'Не указан'}")
        print(f"Телефон:             {user[3] if user[3] else 'Не указан'}")
        print(f"Коины:               {user[4]}")
        print(f"Дата регистрации:    {user[5]}")
        print("="*60)
        
        # Ищем все бронирования пользователя
        cursor.execute('''
            SELECT 
                b.id,
                b.date,
                b.start_time,
                b.end_time,
                b.status,
                b.created_at,
                r.name as room_name,
                r.type as room_type,
                r.floor as room_floor,
                r.price
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            WHERE b.user_id = ?
            ORDER BY b.date DESC, b.start_time DESC
        ''', (user[0],))
        
        bookings = cursor.fetchall()
        
        print(f"\nБРОНИРОВАНИЯ (всего: {len(bookings)})")
        print("="*60)
        
        if not bookings:
            print("  Нет бронирований")
        else:
            confirmed_count = 0
            cancelled_count = 0
            
            for booking in bookings:
                booking_id, date, start_time, end_time, status, created_at, room_name, room_type, room_floor, price = booking
                
                status_symbol = "[OK]" if status == "confirmed" else "[X]" if status == "cancelled" else "[?]"
                status_text = "Подтверждено" if status == "confirmed" else "Отменено" if status == "cancelled" else status
                
                if status == "confirmed":
                    confirmed_count += 1
                elif status == "cancelled":
                    cancelled_count += 1
                
                print(f"\n{status_symbol} Бронирование #{booking_id}")
                print(f"   Комната:        {room_name} ({room_type}, этаж {room_floor})")
                print(f"   Дата:           {date}")
                print(f"   Время:          {start_time} - {end_time}")
                print(f"   Цена:           {price} коинов/час")
                print(f"   Статус:         {status_text}")
                print(f"   Создано:        {created_at}")
            
            print("\n" + "-"*60)
            print(f"[OK] Подтверждено: {confirmed_count}")
            print(f"[X] Отменено:     {cancelled_count}")
            print(f"[*] Всего:        {len(bookings)}")
        
        # Статистика по времени в комнатах
        cursor.execute('''
            SELECT 
                SUM(
                    CASE 
                        WHEN b.end_time < b.start_time THEN
                            (24 * 60 - (CAST(substr(b.start_time, 1, 2) AS INTEGER) * 60 + CAST(substr(b.start_time, 4, 2) AS INTEGER))) +
                            (CAST(substr(b.end_time, 1, 2) AS INTEGER) * 60 + CAST(substr(b.end_time, 4, 2) AS INTEGER))
                        ELSE
                            (CAST(substr(b.end_time, 1, 2) AS INTEGER) * 60 + CAST(substr(b.end_time, 4, 2) AS INTEGER)) -
                            (CAST(substr(b.start_time, 1, 2) AS INTEGER) * 60 + CAST(substr(b.start_time, 4, 2) AS INTEGER))
                    END
                ) / 60.0 as total_hours
            FROM bookings b
            WHERE b.user_id = ? AND b.status = 'confirmed'
        ''', (user[0],))
        
        total_hours_result = cursor.fetchone()
        total_hours = total_hours_result[0] if total_hours_result[0] else 0
        
        print("\n" + "="*60)
        print("СТАТИСТИКА")
        print("="*60)
        print(f"Всего часов в комнатах: {total_hours:.2f} ч")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"\n[!] Ошибка при поиске пользователя: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Использование: python find_user.py <telegram_id>")
        print("\nПример:")
        print("  python find_user.py 7771288299")
        sys.exit(1)
    
    try:
        telegram_id = int(sys.argv[1])
        find_user(telegram_id)
    except ValueError:
        print(f"[!] Ошибка: '{sys.argv[1]}' не является валидным telegram_id (должно быть число)")
        sys.exit(1)

