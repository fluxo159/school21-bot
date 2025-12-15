# backend/app.py
from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS
import os
from models import User, Room, Booking
from database import init_db

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)  # Разрешаем запросы из Web App

# Инициализируем БД при запуске
init_db()

# Главная страница Web App
@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

# Для любых других файлов
@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('../frontend', path)

# 🔐 Аутентификация пользователя
@app.route('/api/auth', methods=['POST'])
def auth():
    try:
        data = request.json
        telegram_id = data.get('telegram_id')
        
        if not telegram_id:
            return jsonify({'error': 'No telegram_id provided'}), 400
        
        # Проверяем и создаем пользователя если нужно
        user = User.get_or_create(telegram_id)
        
        return jsonify({
            'success': True,
            'user': {
                'id': user['id'],
                'telegram_id': user['telegram_id'],
                'school_login': user['school_login'],
                'phone': user['phone'],
                'coins': user['coins'],
                'is_new': user['is_new']
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 📝 Обновление профиля (логин + телефон) - ДОБАВЛЕНА ВАЛИДАЦИЯ
@app.route('/api/profile/update', methods=['POST'])
def update_profile():
    try:
        data = request.json
        telegram_id = data.get('telegram_id')
        school_login = data.get('school_login')
        phone = data.get('phone')
        
        if not telegram_id:
            return jsonify({'error': 'Требуется telegram_id'}), 400
        
        if not school_login:
            return jsonify({'error': 'Требуется школьный логин'}), 400
        
        # Проверяем что логин не пустой
        school_login = school_login.strip()
        if not school_login:
            return jsonify({'error': 'Школьный логин не может быть пустым'}), 400
        
        # ДОБАВЛЕНО: Валидация длины логина
        if len(school_login) > 50:
            return jsonify({'error': 'Школьный логин слишком длинный (макс. 50 символов)'}), 400
        
        # ДОБАВЛЕНО: Валидация формата логина (только буквы, цифры, дефис, подчеркивание)
        import re
        if not re.match(r'^[a-zA-Z0-9_-]+$', school_login):
            return jsonify({'error': 'Логин может содержать только буквы, цифры, дефис и подчеркивание'}), 400
        
        # ОБЯЗАТЕЛЬНАЯ валидация телефона (узбекский формат: +998-00-000-00-00)
        if not phone:
            return jsonify({'error': 'Требуется номер телефона'}), 400
        
        phone = phone.strip()
        # Валидация узбекского формата телефона: +998-XX-XXX-XX-XX (2-3-2-2 цифры)
        # Убираем все пробелы и дефисы для проверки количества цифр
        phone_clean = phone.replace(' ', '').replace('-', '')
        if not re.match(r'^\+998[0-9]{9}$', phone_clean):
            return jsonify({'error': 'Неверный формат телефона. Используйте формат: +998-XX-XXX-XX-XX (например: +998-90-870-50-11)'}), 400
        
        # Проверяем что телефон в правильном формате с дефисами: +998-XX-XXX-XX-XX
        if not re.match(r'^\+998-[0-9]{2}-[0-9]{3}-[0-9]{2}-[0-9]{2}$', phone):
            return jsonify({'error': 'Неверный формат телефона. Используйте формат: +998-XX-XXX-XX-XX (например: +998-90-870-50-11)'}), 400
        
        result = User.update_profile(telegram_id, school_login, phone)
        
        if not result.get('success'):
            error_msg = result.get('error', 'Неизвестная ошибка')
            return jsonify({'error': error_msg}), 400
        
        return jsonify({
            'success': True,
            'message': 'Профиль обновлен'
        })
        
    except Exception as e:
        return jsonify({'error': f'Ошибка сервера: {str(e)}'}), 500

# 🏠 Получить все комнаты
@app.route('/api/rooms')
def get_rooms():
    try:
        rooms = Room.get_all()
        return jsonify({
            'success': True,
            'rooms': rooms
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 🏢 Получить комнаты по этажу
@app.route('/api/rooms/floor/<int:floor_number>')
def get_rooms_by_floor(floor_number):
    try:
        rooms = Room.get_by_floor(floor_number)
        return jsonify({
            'success': True,
            'floor': floor_number,
            'rooms': rooms
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 📅 Создать бронирование - ДОБАВЛЕНА ВАЛИДАЦИЯ
@app.route('/api/bookings/create', methods=['POST'])
def create_booking():
    try:
        data = request.json
        telegram_id = data.get('telegram_id')
        room_id = data.get('room_id')
        date = data.get('date')
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        
        # Проверяем, что пользователь заполнил обязательные поля регистрации
        if telegram_id:
            user = User.get_or_create(telegram_id)
            if not user.get('school_login') or not user.get('phone'):
                return jsonify({
                    'error': 'Для бронирования необходимо завершить регистрацию. Заполните школьный логин и номер телефона.'
                }), 400
        
        print("=" * 50)
        print("📅 ЗАПРОС НА БРОНИРОВАНИЕ:")
        print(f"   telegram_id: {telegram_id}")
        print(f"   room_id: {room_id}")
        print(f"   date: {date}")
        print(f"   start_time: {start_time}")
        print(f"   end_time: {end_time}")
        print("=" * 50)
        
        if not all([telegram_id, room_id, date, start_time, end_time]):
            return jsonify({'error': 'Все поля обязательны'}), 400
        
        # ДОБАВЛЕНО: Валидация формата даты
        from datetime import datetime
        try:
            booking_date = datetime.strptime(date, '%Y-%m-%d').date()
            today = datetime.now().date()
            
            # Проверяем, что дата не в прошлом
            if booking_date < today:
                return jsonify({'error': 'Нельзя бронировать прошедшие даты'}), 400
            
            # Если выбрана сегодняшняя дата, проверяем, что время начала еще не прошло
            print(f"🔍 Проверка даты: booking_date={booking_date}, today={today}, equal={booking_date == today}")
            if booking_date == today:
                now = datetime.now()
                start_hour = int(start_time.split(':')[0])
                start_minute = int(start_time.split(':')[1]) if ':' in start_time else 0
                current_hour = now.hour
                current_minute = now.minute
                
                start_total_minutes = start_hour * 60 + start_minute
                current_total_minutes = current_hour * 60 + current_minute
                
                print(f"🔍 Проверка времени: start={start_time} ({start_total_minutes} мин), current={current_hour:02d}:{current_minute:02d} ({current_total_minutes} мин), check={start_total_minutes <= current_total_minutes}")
                
                # Время начала должно быть в будущем
                if start_total_minutes <= current_total_minutes:
                    error_msg = f'Нельзя бронировать прошедшее время! Выбранное время ({start_time}) уже прошло. Текущее время: {current_hour:02d}:{current_minute:02d}'
                    print(f"❌ {error_msg}")
                    return jsonify({'error': error_msg}), 400
                
                print(f"✅ Проверка времени пройдена: {start_time} > {current_hour:02d}:{current_minute:02d}")
            else:
                print(f"ℹ️ Будущая дата, проверка времени не требуется")
        except ValueError:
            return jsonify({'error': 'Неверный формат даты (требуется YYYY-MM-DD)'}), 400
        
        # ДОБАВЛЕНО: Валидация формата времени
        try:
            start_dt = datetime.strptime(start_time, '%H:%M')
            end_dt = datetime.strptime(end_time, '%H:%M')
        except ValueError:
            return jsonify({'error': 'Неверный формат времени (требуется HH:MM)'}), 400
        
        # Обработка перехода через полночь
        # Если end_time < start_time, это означает переход через полночь
        crosses_midnight = end_dt.time() < start_dt.time()
        
        if crosses_midnight:
            # Вычисляем длительность с учетом перехода через полночь
            # Например: 22:00 до 02:00 = 4 часа
            from datetime import timedelta
            end_time_next_day = (datetime.combine(datetime.now().date(), end_dt.time()) + timedelta(days=1))
            start_time_today = datetime.combine(datetime.now().date(), start_dt.time())
            duration = (end_time_next_day - start_time_today).total_seconds() / 3600
        else:
            # Обычный случай без перехода через полночь
            if start_time >= end_time:
                return jsonify({'error': 'Конец времени должен быть позже начала'}), 400
            duration = (end_dt - start_dt).total_seconds() / 3600
        
        # ДОБАВЛЕНО: Проверка максимальной длительности (например, не более 24 часов для 24-часового режима)
        if duration > 24:
            return jsonify({'error': 'Максимальная длительность бронирования - 24 часа'}), 400
        
        if duration <= 0:
            return jsonify({'error': 'Длительность бронирования должна быть больше 0'}), 400
        
        # Проверка минимальной длительности (минимум 1 час)
        if duration < 1:
            return jsonify({'error': 'Минимальная длительность бронирования - 1 час'}), 400
        
        # Получаем user_id по telegram_id
        from database import get_connection
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE telegram_id = ?", (telegram_id,))
        user = cursor.fetchone()
        conn.close()
        
        if not user:
            return jsonify({'error': 'Пользователь не найден'}), 404
        
        user_id = user[0]
        result = Booking.create(user_id, room_id, date, start_time, end_time)
        
        if 'error' in result:
            print(f"❌ Ошибка создания бронирования: {result['error']}")
            print(f"   Дата: {date}, Время: {start_time}-{end_time}")
            print(f"   Текущая дата: {datetime.now().date()}")
            return jsonify({'error': result['error']}), 400
        
        return jsonify({
            'success': True,
            'booking_id': result['booking_id'],
            'message': 'Бронирование создано!'
        })
        
    except Exception as e:
        print(f"🔥 Ошибка: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 📋 Получить мои бронирования (изменил на POST для консистентности)
@app.route('/api/my-bookings', methods=['POST'])
def my_bookings():
    try:
        data = request.json
        telegram_id = data.get('telegram_id')
        if not telegram_id:
            return jsonify({'error': 'Требуется telegram_id'}), 400
        
        bookings = Booking.get_user_bookings(telegram_id)
        
        return jsonify({
            'success': True,
            'bookings': bookings
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 💰 Получить баланс коинов (изменил на POST)
@app.route('/api/coins', methods=['POST'])
def get_coins():
    try:
        data = request.json
        telegram_id = data.get('telegram_id')
        if not telegram_id:
            return jsonify({'error': 'Требуется telegram_id'}), 400
        
        coins = User.get_coins(telegram_id)
        
        return jsonify({
            'success': True,
            'coins': coins
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 🔍 Проверить текущую занятость комнат на этаже (в реальном времени)
@app.route('/api/rooms/floor/<int:floor_number>/current-status', methods=['GET'])
def get_rooms_current_status(floor_number):
    """Проверяет, какие комнаты заняты прямо сейчас"""
    try:
        from datetime import datetime, date
        from database import get_connection
        
        conn = get_connection()
        cursor = conn.cursor()
        
        # Получаем текущую дату и время
        now = datetime.now()
        current_date = now.date().isoformat()
        current_time = now.time().strftime('%H:%M:%S')
        
        # Получаем все комнаты на этаже
        cursor.execute('''
            SELECT id FROM rooms WHERE floor = ? AND is_active = 1
        ''', (floor_number,))
        room_ids = [row[0] for row in cursor.fetchall()]
        
        # Проверяем занятость каждой комнаты
        busy_rooms = {}
        for room_id in room_ids:
            # Проверяем активные бронирования, которые пересекаются с текущим временем
            # Учитываем переход через полночь
            cursor.execute('''
                SELECT id, start_time, end_time 
                FROM bookings 
                WHERE room_id = ? 
                AND date = ? 
                AND status = 'confirmed'
                AND (
                    (start_time <= end_time AND start_time <= ? AND end_time > ?)
                    OR
                    (start_time > end_time AND (start_time <= ? OR end_time > ?))
                )
            ''', (room_id, current_date, current_time, current_time, current_time, current_time))
            
            active_booking = cursor.fetchone()
            busy_rooms[room_id] = active_booking is not None
        
        conn.close()
        
        return jsonify({
            'success': True,
            'busy_rooms': busy_rooms,
            'current_time': current_time,
            'current_date': current_date
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 🔍 Проверить доступность комнаты (ИСПРАВЛЕНО)
@app.route('/api/rooms/<int:room_id>/availability', methods=['GET'])
def check_availability(room_id):
    try:
        date = request.args.get('date')
        start_time = request.args.get('start_time')
        end_time = request.args.get('end_time')
        
        if not all([date, start_time, end_time]):
            return jsonify({'error': 'Все параметры обязательны'}), 400
        
        if start_time >= end_time:
            return jsonify({'error': 'Конец времени должен быть позже начала'}), 400
        
        from database import get_connection
        conn = get_connection()
        cursor = conn.cursor()
        
        # ИСПРАВЛЕННАЯ логика проверки пересечений
        cursor.execute('''
            SELECT id FROM bookings 
            WHERE room_id = ? AND date = ? AND status = 'confirmed'
            AND NOT (end_time <= ? OR start_time >= ?)
        ''', (room_id, date, start_time, end_time))
        
        conflicting = cursor.fetchall()
        conn.close()
        
        return jsonify({
            'success': True,
            'available': len(conflicting) == 0,
            'conflicting_bookings': len(conflicting)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ❌ Отменить бронирование
@app.route('/api/bookings/<int:booking_id>/cancel', methods=['POST'])
def cancel_booking(booking_id):
    try:
        print(f"🔍 ЗАПРОС НА ОТМЕНУ БРОНИРОВАНИЯ: booking_id={booking_id}")
        data = request.json
        print(f"🔍 Данные запроса: {data}")
        telegram_id = data.get('telegram_id')
        
        if not telegram_id:
            print("❌ Ошибка: telegram_id не предоставлен")
            return jsonify({'error': 'Требуется telegram_id'}), 400
        
        print(f"🔍 telegram_id: {telegram_id}")
        
        from database import get_connection
        conn = get_connection()
        cursor = conn.cursor()
        
        # Получаем информацию о бронировании
        cursor.execute('''
            SELECT b.id, b.user_id, b.room_id, r.price, b.status
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            JOIN users u ON b.user_id = u.id
            WHERE b.id = ? AND u.telegram_id = ?
        ''', (booking_id, telegram_id))
        
        booking = cursor.fetchone()
        print(f"🔍 Найдено бронирование: {booking}")
        
        if not booking:
            conn.close()
            print("❌ Бронирование не найдено")
            return jsonify({'error': 'Бронирование не найдено'}), 404
        
        print(f"🔍 Статус бронирования: {booking[4]}")
        if booking[4] != 'confirmed':
            conn.close()
            print(f"❌ Бронирование уже отменено или имеет статус: {booking[4]}")
            return jsonify({'error': 'Бронирование уже отменено'}), 400
        
        # Проверяем время до начала бронирования
        cursor.execute('''
            SELECT date, start_time FROM bookings WHERE id = ?
        ''', (booking_id,))
        booking_time = cursor.fetchone()
        
        print(f"🔍 Получено время бронирования: {booking_time}")
        
        # Проверяем время до начала бронирования
        if booking_time:
            try:
                from datetime import datetime
                booking_date = booking_time[0]
                booking_start_time = booking_time[1]
                
                print(f"🔍 Проверка времени отмены: booking_id={booking_id}, booking_date={booking_date}, booking_start_time={booking_start_time}, type={type(booking_start_time)}")
                
                # Создаем datetime для начала бронирования
                # Форматируем время (убираем секунды если есть)
                if isinstance(booking_start_time, str):
                    time_parts = booking_start_time.split(':')
                    if len(time_parts) >= 2:
                        time_str = f'{time_parts[0]}:{time_parts[1]}'
                    else:
                        raise ValueError(f"Неверный формат времени: {booking_start_time}")
                else:
                    # Если это объект time, преобразуем в строку
                    time_str = booking_start_time.strftime('%H:%M')
                
                # Проверяем формат даты
                if isinstance(booking_date, str):
                    booking_datetime = datetime.strptime(f'{booking_date} {time_str}', '%Y-%m-%d %H:%M')
                else:
                    # Если это объект date, преобразуем в строку
                    date_str = booking_date.strftime('%Y-%m-%d')
                    booking_datetime = datetime.strptime(f'{date_str} {time_str}', '%Y-%m-%d %H:%M')
                
                now = datetime.now()
                
                print(f"🔍 booking_datetime={booking_datetime}, now={now}")
                
                # Проверяем, что до начала бронирования осталось больше 1 часа
                time_until_booking = (booking_datetime - now).total_seconds() / 3600  # в часах
                
                print(f"🔍 time_until_booking={time_until_booking} часов")
                
                # Если бронирование уже прошло, разрешаем отмену (для очистки истории)
                # Но проверяем, что до начала было больше 1 часа
                if time_until_booking < 0:
                    print(f"⚠️ Бронирование уже прошло (time_until_booking={time_until_booking} часов)")
                    # Разрешаем отмену прошедших бронирований
                    pass
                # Если до начала меньше или равно 1 часа, не разрешаем отмену
                elif time_until_booking <= 1:
                    conn.close()
                    minutes_left = max(0, int(time_until_booking * 60))
                    print(f"❌ Нельзя отменить: до начала осталось {time_until_booking} часов ({minutes_left} минут) (требуется > 1 часа)")
                    if minutes_left > 0:
                        return jsonify({
                            'error': f'Нельзя отменить бронирование менее чем за 1 час до начала. До начала осталось {minutes_left} минут.'
                        }), 400
                    else:
                        return jsonify({
                            'error': 'Нельзя отменить бронирование менее чем за 1 час до начала.'
                        }), 400
            except ValueError as e:
                print(f"❌ Ошибка парсинга времени: {str(e)}")
                conn.close()
                return jsonify({
                    'error': f'Ошибка при проверке времени бронирования: {str(e)}'
                }), 400
            except Exception as e:
                print(f"❌ Неожиданная ошибка при проверке времени: {str(e)}")
                import traceback
                traceback.print_exc()
                # В случае неожиданной ошибки, разрешаем отмену (на случай проблем с форматом)
                pass
        
        # Возвращаем коины и помечаем как отменено
        cursor.execute('''
            UPDATE users SET coins = coins + ? 
            WHERE id = ?
        ''', (booking[3], booking[1]))
        
        cursor.execute('''
            UPDATE bookings SET status = 'cancelled' 
            WHERE id = ?
        ''', (booking_id,))
        
        # Получаем новый баланс коинов
        cursor.execute('SELECT coins FROM users WHERE id = ?', (booking[1],))
        new_balance = cursor.fetchone()[0]
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Бронирование отменено',
            'refunded_coins': booking[3],
            'new_balance': new_balance
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# УДАЛЕНЫ небезопасные debug endpoints
# Используйте прямой доступ к БД через SQLite CLI для отладки

# Тестовый API
@app.route('/api/ping')
def ping():
    return jsonify({"status": "ok", "message": "Backend живой!"})

# УДАЛЕН небезопасный admin endpoint
# Для обновления коинов используйте прямые SQL команды или создайте защищенный API с аутентификацией

# backend/app.py - добавьте этот эндпоинт

# 📅 Получить занятые слоты для комнаты на определенную дату
@app.route('/api/rooms/<int:room_id>/busy-slots', methods=['GET'])
def get_room_busy_slots(room_id):
    try:
        date = request.args.get('date')
        if not date:
            return jsonify({'error': 'Требуется параметр date'}), 400
        
        from database import get_connection
        from datetime import datetime, timedelta
        conn = get_connection()
        cursor = conn.cursor()
        
        # Получаем бронирования на указанную дату с логином пользователя
        cursor.execute('''
            SELECT b.start_time, b.end_time, COALESCE(u.school_login, u.telegram_id) as user_login
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            WHERE b.room_id = ? AND b.date = ? AND b.status = 'confirmed'
            ORDER BY b.start_time
        ''', (room_id, date))
        
        busy_slots = cursor.fetchall()
        
        # Также проверяем бронирования на предыдущий день, которые могут переходить через полночь
        prev_date = (datetime.strptime(date, '%Y-%m-%d') - timedelta(days=1)).strftime('%Y-%m-%d')
        cursor.execute('''
            SELECT b.start_time, b.end_time, COALESCE(u.school_login, u.telegram_id) as user_login
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            WHERE b.room_id = ? AND b.date = ? AND b.status = 'confirmed'
            AND b.end_time < b.start_time
            ORDER BY b.start_time
        ''', (room_id, prev_date))
        
        prev_day_slots = cursor.fetchall()
        conn.close()
        
        result = []
        for slot in busy_slots:
            start_time = slot[0]
            end_time = slot[1]
            user_login = slot[2] if len(slot) > 2 else None
            
            # Если бронирование переходит через полночь (end_time < start_time)
            # Для текущего дня показываем только часть до 23:59:59
            if end_time < start_time:
                result.append({
                    'start_time': start_time,
                    'end_time': '23:59:59',  # Обрезаем до конца текущего дня
                    'user_login': user_login
                })
            else:
                result.append({
                    'start_time': start_time,
                    'end_time': end_time,
                    'user_login': user_login
                })
        
        # Добавляем бронирования с предыдущего дня, которые переходят через полночь
        # Для них показываем только часть от 00:00:00 до end_time
        for slot in prev_day_slots:
            user_login = slot[2] if len(slot) > 2 else None
            result.append({
                'start_time': '00:00:00',  # Начинается с начала текущего дня
                'end_time': slot[1],  # Заканчивается в end_time
                'user_login': user_login
            })
        
        return jsonify({
            'success': True,
            'room_id': room_id,
            'date': date,
            'busy_slots': result
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # ИСПРАВЛЕНО: debug=False по умолчанию для безопасности
    # Используйте FLASK_DEBUG=True в .env для разработки
    import os
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    # Порт берется из переменной окружения PORT (для Railway, Render и т.д.)
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=debug_mode)