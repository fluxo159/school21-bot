# backend/models.py
from datetime import datetime
from database import get_connection

class User:
    @staticmethod
    def get_or_create(telegram_id, school_login=None, phone=None):
        """Получить пользователя или создать нового с 100 коинами"""
        conn = get_connection()
        cursor = conn.cursor()
        
        # Проверяем существует ли пользователь
        cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
        user = cursor.fetchone()
        
        if user:
            # Пользователь существует
            conn.close()
            return {
                'id': user[0],
                'telegram_id': user[1],
                'school_login': user[2],
                'phone': user[3],
                'coins': user[4],
                'created_at': user[5],
                'is_new': False
            }
        else:
            # Создаем нового пользователя с 100 коинами
            cursor.execute(
                "INSERT INTO users (telegram_id, school_login, phone, coins) VALUES (?, ?, ?, 1000)",  # Для тестирования установлено 1000 коинов
                (telegram_id, school_login, phone)
            )
            conn.commit()
            user_id = cursor.lastrowid
            
            conn.close()
            return {
                'id': user_id,
                'telegram_id': telegram_id,
                'school_login': school_login,
                'phone': phone,
                'coins': 1000,  # Для тестирования установлено 1000 коинов
                'created_at': datetime.now(),
                'is_new': True
            }
    
    @staticmethod
    def get_coins(telegram_id):
        """Получить количество коинов пользователя"""
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT coins FROM users WHERE telegram_id = ?", (telegram_id,))
            result = cursor.fetchone()
            return result[0] if result else 0
        finally:
            conn.close()
    
    @staticmethod
    def update_profile(telegram_id, school_login, phone):
        """Обновить профиль пользователя"""
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            # Сначала проверяем существует ли пользователь
            cursor.execute("SELECT id, school_login FROM users WHERE telegram_id = ?", (telegram_id,))
            user = cursor.fetchone()
            
            if not user:
                conn.close()
                return {'success': False, 'error': 'Пользователь не найден'}
            
            # Проверяем, не занят ли school_login другим пользователем
            cursor.execute("SELECT telegram_id FROM users WHERE school_login = ? AND telegram_id != ?", 
                         (school_login, telegram_id))
            existing_user = cursor.fetchone()
            
            if existing_user:
                conn.close()
                return {'success': False, 'error': 'Этот школьный логин уже занят другим пользователем'}
            
            # Обновляем данные
            cursor.execute(
                "UPDATE users SET school_login = ?, phone = ? WHERE telegram_id = ?",
                (school_login, phone, telegram_id)
            )
            
            conn.commit()
            affected_rows = cursor.rowcount
            conn.close()
            
            if affected_rows == 0:
                return {'success': False, 'error': 'Не удалось обновить профиль'}
                
            return {'success': True}
            
        except Exception as e:
            raise e

class Room:
    @staticmethod
    def get_all():
        """Получить все активные комнаты"""
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM rooms WHERE is_active = 1 ORDER BY floor, type, price")
        rooms = cursor.fetchall()
        conn.close()
        
        return [{
            'id': r[0],
            'name': r[1],
            'type': r[2],
            'floor': r[3],  # ДОБАВЛЕНО ПОЛЕ ЭТАЖА
            'price': r[4],
            'description': r[5],
            'photo_url': r[6],
            'max_persons': r[7]
        } for r in rooms]
    
    @staticmethod
    def get_by_floor(floor_number):
        """Получить комнаты по этажу"""
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM rooms WHERE is_active = 1 AND floor = ? ORDER BY type, price", (floor_number,))
        rooms = cursor.fetchall()
        conn.close()
        
        return [{
            'id': r[0],
            'name': r[1],
            'type': r[2],
            'floor': r[3],
            'price': r[4],
            'description': r[5],
            'photo_url': r[6],
            'max_persons': r[7]
        } for r in rooms]
    
    @staticmethod
    def get_by_id(room_id):
        """Получить комнату по ID"""
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM rooms WHERE id = ?", (room_id,))
        room = cursor.fetchone()
        conn.close()
        
        if room:
            return {
                'id': room[0],
                'name': room[1],
                'type': room[2],
                'floor': room[3],
                'price': room[4],
                'description': room[5],
                'photo_url': room[6],
                'max_persons': room[7]
            }
        return None

class Booking:
    @staticmethod
    def create(user_id, room_id, date, start_time, end_time):
        """Создать бронирование с проверкой на race condition"""
        from datetime import datetime
        
        # Валидация даты - не должна быть в прошлом
        # Используем локальное время сервера (для Узбекистана UTC+5)
        try:
            booking_date = datetime.strptime(date, '%Y-%m-%d').date()
            # datetime.now().date() использует локальное время сервера
            # Убедитесь, что сервер настроен на правильный часовой пояс (UTC+5 для Узбекистана)
            if booking_date < datetime.now().date():
                return {'error': 'Нельзя бронировать прошедшие даты'}
        except ValueError:
            return {'error': 'Неверный формат даты'}
        
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Начинаем транзакцию для предотвращения race condition
            cursor.execute("BEGIN IMMEDIATE")
            
            # Проверяем достаточно ли коинов
            cursor.execute("SELECT price FROM rooms WHERE id = ?", (room_id,))
            room = cursor.fetchone()
            if not room:
                return {'error': 'Комната не найдена'}
            
            price = room[0]
            cursor.execute("SELECT coins FROM users WHERE id = ?", (user_id,))
            user_result = cursor.fetchone()
            
            if not user_result:
                return {'error': 'Пользователь не найден'}
            
            user_coins = user_result[0]
            
            if user_coins < price:
                return {'error': 'Недостаточно коинов'}
            
            # ИСПРАВЛЕННАЯ логика проверки пересечений с учетом перехода через полночь
            # Если end_time < start_time, это означает переход через полночь
            crosses_midnight = end_time < start_time
            
            if crosses_midnight:
                # Проверяем пересечения на текущий день (от start_time до 23:59:59)
                # и на следующий день (от 00:00:00 до end_time)
                from datetime import datetime, timedelta
                next_date = (datetime.strptime(date, '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
                
                # Проверяем пересечения на текущий день (бронирования, которые заканчиваются после start_time)
                cursor.execute('''
                    SELECT id FROM bookings 
                    WHERE room_id = ? AND date = ? AND status = 'confirmed'
                    AND NOT (end_time <= ? OR start_time >= '23:59:59')
                ''', (room_id, date, start_time))
                
                if cursor.fetchone():
                    return {'error': 'Это время уже занято'}
                
                # Проверяем пересечения на следующий день (бронирования, которые начинаются до end_time)
                cursor.execute('''
                    SELECT id FROM bookings 
                    WHERE room_id = ? AND date = ? AND status = 'confirmed'
                    AND NOT (end_time <= '00:00:00' OR start_time >= ?)
                ''', (room_id, next_date, end_time))
                
                if cursor.fetchone():
                    return {'error': 'Это время уже занято'}
                
                # Также проверяем бронирования на следующий день, которые переходят через полночь
                cursor.execute('''
                    SELECT id FROM bookings 
                    WHERE room_id = ? AND date = ? AND status = 'confirmed'
                    AND end_time < start_time
                    AND NOT (end_time <= '00:00:00' OR start_time >= ?)
                ''', (room_id, next_date, end_time))
                
                if cursor.fetchone():
                    return {'error': 'Это время уже занято'}
            else:
                # Обычная проверка без перехода через полночь
                cursor.execute('''
                    SELECT id FROM bookings 
                    WHERE room_id = ? AND date = ? AND status = 'confirmed'
                    AND NOT (end_time <= ? OR start_time >= ?)
                ''', (room_id, date, start_time, end_time))
                
                if cursor.fetchone():
                    return {'error': 'Это время уже занято'}
                
                # Также проверяем бронирования на предыдущий день, которые переходят через полночь
                from datetime import datetime, timedelta
                prev_date = (datetime.strptime(date, '%Y-%m-%d') - timedelta(days=1)).strftime('%Y-%m-%d')
                cursor.execute('''
                    SELECT id FROM bookings 
                    WHERE room_id = ? AND date = ? AND status = 'confirmed'
                    AND end_time < start_time
                    AND NOT (end_time <= ? OR start_time >= '23:59:59')
                ''', (room_id, prev_date, start_time))
                
                if cursor.fetchone():
                    return {'error': 'Это время уже занято'}
            
            if cursor.fetchone():
                return {'error': 'Это время уже занято'}
            
            # Создаем бронирование и списываем коины
            cursor.execute(
                "INSERT INTO bookings (user_id, room_id, date, start_time, end_time) VALUES (?, ?, ?, ?, ?)",
                (user_id, room_id, date, start_time, end_time)
            )
            
            cursor.execute(
                "UPDATE users SET coins = coins - ? WHERE id = ?",
                (price, user_id)
            )
            
            conn.commit()
            booking_id = cursor.lastrowid
            
            return {'success': True, 'booking_id': booking_id}
            
        except Exception as e:
            conn.rollback()
            return {'error': f'Ошибка при создании бронирования: {str(e)}'}
        finally:
            conn.close()
    
    @staticmethod
    def get_user_bookings(telegram_id):
        """Получить все бронирования пользователя, включая те, что переходят через полночь"""
        from datetime import datetime, timedelta
        conn = get_connection()
        cursor = conn.cursor()
        
        # Получаем все бронирования пользователя
        cursor.execute('''
            SELECT b.id, r.name, r.type, r.price, b.date, b.start_time, b.end_time, b.status, b.created_at
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            JOIN users u ON b.user_id = u.id
            WHERE u.telegram_id = ? AND b.status = 'confirmed'
            ORDER BY b.date DESC, b.start_time DESC
        ''', (telegram_id,))
        
        bookings = cursor.fetchall()
        conn.close()
        
        result = []
        for b in bookings:
            booking_date = b[4]
            start_time = b[5]
            end_time = b[6]
            
            # Проверяем, переходит ли бронирование через полночь
            crosses_midnight = end_time < start_time
            
            result.append({
                'id': b[0],
                'room_name': b[1],
                'type': b[2],
                'price': b[3],
                'date': booking_date,
                'start_time': start_time,
                'end_time': end_time,
                'status': b[7],
                'created_at': b[8],
                'crosses_midnight': crosses_midnight
            })
            
            # Если бронирование переходит через полночь, добавляем его также на следующий день
            if crosses_midnight:
                next_date = (datetime.strptime(booking_date, '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
                result.append({
                    'id': b[0],
                    'room_name': b[1],
                    'type': b[2],
                    'price': b[3],
                    'date': next_date,  # Показываем также на следующий день
                    'start_time': start_time,
                    'end_time': end_time,
                    'status': b[7],
                    'created_at': b[8],
                    'crosses_midnight': True,
                    'is_continuation': True  # Флаг, что это продолжение с предыдущего дня
                })
        
        # Сортируем по дате и времени
        result.sort(key=lambda x: (x['date'], x['start_time']), reverse=True)
        
        return result