# backend/app.py
from flask import Flask, send_from_directory, jsonify, request, Response, abort
from flask_cors import CORS
import os
from models import User, Room, Booking
from database import init_db

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)  # Разрешаем запросы из Web App

# Добавляем заголовок для пропуска страницы предупреждения ngrok
@app.after_request
def add_ngrok_header(response):
    response.headers['ngrok-skip-browser-warning'] = 'true'
    return response

# Инициализируем БД при запуске
try:
    init_db()
    print("База данных успешно инициализирована")
except Exception as e:
    print(f"КРИТИЧЕСКАЯ ОШИБКА: Не удалось инициализировать базу данных: {e}")
    import traceback
    traceback.print_exc()
    # Не прерываем запуск, но логируем ошибку

# Главная страница Web App
@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

# 🔐 Аутентификация пользователя по telegram_id (для первой инициализации)
@app.route('/api/auth', methods=['POST'])
def auth():
    try:
        data = request.json
        telegram_id = data.get('telegram_id')
        
        if not telegram_id:
            return jsonify({'error': 'No telegram_id provided'}), 400
        
        # Проверяем и создаем пользователя если нужно
        user = User.get_or_create(telegram_id)
        
        # Обновляем активность пользователя
        update_user_activity(telegram_id=telegram_id)
        
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

# 🔐 Вход по логину и телефону (переключение профилей)
def validate_uzbek_operator(phone):
    """Валидация узбекского оператора по первым двум цифрам после +998"""
    import re
    
    # Убираем все пробелы и дефисы для проверки
    phone_clean = phone.replace(' ', '').replace('-', '')
    
    # Проверяем формат +998XXXXXXXXX
    if not re.match(r'^\+998[0-9]{9}$', phone_clean):
        return False, 'Неверный формат телефона'
    
    # Специальное исключение для админского номера +998-00-000-00-11
    if phone.strip() == '+998-00-000-00-11':
        return True, 'Admin (специальный номер)'
    
    # Извлекаем первые две цифры после +998
    prefix = phone_clean[4:6]  # После +998 берем 2 цифры
    
    # Список валидных операторов
    valid_operators = {
        '90': 'Beeline (Unitel)',
        '91': 'Beeline (Unitel)',
        '93': 'Ucell',
        '94': 'Ucell',
        '95': 'Uzmobile',
        '99': 'Uzmobile',
        '97': 'Mobiuz',
        '88': 'Uzmobile',
        '50': 'Uzmobile',
        '77': 'Uzmobile',
        '98': 'Uzmobile',
        '33': 'Humans (бывший Ucell)'
    }
    
    if prefix in valid_operators:
        return True, valid_operators[prefix]
    else:
        return False, f'Неизвестный оператор. Префикс {prefix} не поддерживается'

@app.route('/api/login', methods=['POST'])
def login():
    """Вход по логину и телефону для переключения профилей"""
    try:
        data = request.json
        school_login = data.get('school_login')
        phone = data.get('phone')
        
        if not school_login:
            return jsonify({'error': 'Требуется логин'}), 400
        
        if not phone:
            return jsonify({'error': 'Требуется номер телефона'}), 400
        
        phone = phone.strip()
        
        # Валидация формата телефона
        import re
        phone_clean = phone.replace(' ', '').replace('-', '')
        if not re.match(r'^\+998[0-9]{9}$', phone_clean):
            return jsonify({'error': 'Неверный формат телефона. Используйте формат: +998-XX-XXX-XX-XX (например: +998-90-870-50-11)'}), 400
        
        # Проверяем формат с дефисами
        if not re.match(r'^\+998-[0-9]{2}-[0-9]{3}-[0-9]{2}-[0-9]{2}$', phone):
            return jsonify({'error': 'Неверный формат телефона. Используйте формат: +998-XX-XXX-XX-XX (например: +998-90-870-50-11)'}), 400
        
        # Валидация оператора
        is_valid_operator, operator_info = validate_uzbek_operator(phone)
        if not is_valid_operator:
            return jsonify({'error': operator_info}), 400
        
        from database import get_connection
        conn = get_connection()
        cursor = conn.cursor()
        
        # Очищаем и нормализуем входные данные
        school_login_clean = school_login.strip().lower()
        phone_clean = phone.strip()
        
        # Сначала ищем пользователя только по логину (регистронезависимый поиск)
        cursor.execute('''
            SELECT id, telegram_id, school_login, phone, coins, created_at
            FROM users
            WHERE LOWER(school_login) = ?
        ''', (school_login_clean,))
        
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'error': 'Пользователь с таким логином не найден'}), 404
        
        # Если пользователь найден, обновляем его телефон (если он отличается или был NULL)
        current_phone = user[3]  # Текущий телефон из базы
        if current_phone != phone_clean:
            # Обновляем телефон в базе данных
            cursor.execute('''
                UPDATE users 
                SET phone = ? 
                WHERE id = ?
            ''', (phone_clean, user[0]))
            conn.commit()
            
            # Получаем обновленного пользователя
            cursor.execute('''
                SELECT id, telegram_id, school_login, phone, coins, created_at
                FROM users
                WHERE id = ?
            ''', (user[0],))
            user = cursor.fetchone()
        
        # Обновляем активность пользователя
        update_user_activity(user_id=user[0])
        
        conn.close()
        
        return jsonify({
            'success': True,
            'user': {
                'id': user[0],
                'telegram_id': user[1],
                'school_login': user[2],
                'phone': user[3],
                'coins': user[4],
                'created_at': user[5]
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
        
        # Валидация логина через login_validator (строгие правила для новых пиров)
        from login_validator import validate_login
        is_valid, error_msg = validate_login(school_login)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        # ОБЯЗАТЕЛЬНАЯ валидация телефона (узбекский формат: +998-00-000-00-00)
        if not phone:
            return jsonify({'error': 'Требуется номер телефона'}), 400
        
        phone = phone.strip()
        # Валидация узбекского формата телефона: +998-XX-XXX-XX-XX (2-3-2-2 цифры)
        import re
        # Убираем все пробелы и дефисы для проверки количества цифр
        phone_clean = phone.replace(' ', '').replace('-', '')
        if not re.match(r'^\+998[0-9]{9}$', phone_clean):
            return jsonify({'error': 'Неверный формат телефона. Используйте формат: +998-XX-XXX-XX-XX (например: +998-90-870-50-11)'}), 400
        
        # Проверяем что телефон в правильном формате с дефисами: +998-XX-XXX-XX-XX
        if not re.match(r'^\+998-[0-9]{2}-[0-9]{3}-[0-9]{2}-[0-9]{2}$', phone):
            return jsonify({'error': 'Неверный формат телефона. Используйте формат: +998-XX-XXX-XX-XX (например: +998-90-870-50-11)'}), 400
        
        # Валидация оператора
        is_valid_operator, operator_info = validate_uzbek_operator(phone)
        if not is_valid_operator:
            return jsonify({'error': operator_info}), 400
        
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
        # Поддерживаем оба способа: по telegram_id (старый) или по логину+телефону (новый)
        telegram_id = data.get('telegram_id')
        school_login = data.get('school_login')
        phone = data.get('phone')
        room_id = data.get('room_id')
        date = data.get('date')
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        
        from database import get_connection
        conn = get_connection()
        cursor = conn.cursor()
        
        # Определяем user_id по логину+телефону или telegram_id
        user_id = None
        if school_login and phone:
            # Новый способ: по логину и телефону (регистронезависимый поиск логина)
            cursor.execute('SELECT id FROM users WHERE LOWER(school_login) = ? AND phone = ?', 
                         (school_login.strip().lower(), phone.strip()))
            user_result = cursor.fetchone()
            if not user_result:
                conn.close()
                return jsonify({'error': 'Пользователь с таким логином и телефоном не найден'}), 404
            user_id = user_result[0]
        elif telegram_id:
            # Старый способ: по telegram_id (для обратной совместимости)
            cursor.execute('SELECT id FROM users WHERE telegram_id = ?', (telegram_id,))
            user_result = cursor.fetchone()
            if not user_result:
                conn.close()
                return jsonify({'error': 'Пользователь не найден'}), 404
            user_id = user_result[0]
        else:
            conn.close()
            return jsonify({'error': 'Требуется либо логин+телефон, либо telegram_id'}), 400
        
        conn.close()
        
        print("=" * 50)
        print("📅 ЗАПРОС НА БРОНИРОВАНИЕ:")
        print(f"   user_id: {user_id}")
        print(f"   room_id: {room_id}")
        print(f"   date: {date}")
        print(f"   start_time: {start_time}")
        print(f"   end_time: {end_time}")
        print("=" * 50)
        
        if not all([user_id, room_id, date, start_time, end_time]):
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
        
        # user_id уже определен выше
        result = Booking.create(user_id, room_id, date, start_time, end_time)
        
        if 'error' in result:
            print(f"❌ Ошибка создания бронирования: {result['error']}")
            print(f"   Дата: {date}, Время: {start_time}-{end_time}")
            print(f"   Текущая дата: {datetime.now().date()}")
            return jsonify({'error': result['error']}), 400
        
        # Обновляем активность пользователя
        update_user_activity(user_id=user_id)
        
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
        if not data:
            print("❌ /api/my-bookings: Получен пустой запрос")
            return jsonify({'error': 'Требуется JSON тело запроса'}), 400
        
        print(f"📥 /api/my-bookings: Получен запрос: {data}")
        
        # Поддерживаем оба способа: по telegram_id (старый) или по логину+телефону (новый)
        telegram_id = data.get('telegram_id')
        school_login = data.get('school_login')
        phone = data.get('phone')
        
        from database import get_connection
        conn = get_connection()
        cursor = conn.cursor()
        
        # Определяем user_id
        user_id = None
        if school_login and phone:
            # Регистронезависимый поиск логина
            cursor.execute('SELECT id FROM users WHERE LOWER(school_login) = ? AND phone = ?', 
                         (school_login.strip().lower(), phone.strip()))
            user_result = cursor.fetchone()
            if not user_result:
                conn.close()
                return jsonify({'error': 'Пользователь с таким логином и телефоном не найден'}), 404
            user_id = user_result[0]
        elif telegram_id:
            cursor.execute('SELECT id FROM users WHERE telegram_id = ?', (telegram_id,))
            user_result = cursor.fetchone()
            if not user_result:
                conn.close()
                return jsonify({'error': 'Пользователь не найден'}), 404
            user_id = user_result[0]
        else:
            conn.close()
            print(f"❌ /api/my-bookings: Не указаны данные пользователя. Получено: telegram_id={telegram_id}, school_login={school_login}, phone={phone}")
            return jsonify({'error': 'Требуется либо логин+телефон, либо telegram_id'}), 400
        
        print(f"✅ /api/my-bookings: Найден user_id={user_id}")
        
        # Обновляем активность пользователя
        update_user_activity(user_id=user_id)
        
        conn.close()
        
        # Получаем бронирования по user_id
        bookings = Booking.get_user_bookings_by_id(user_id)
        
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
        # Поддерживаем оба способа: по telegram_id (старый) или по логину+телефону (новый)
        telegram_id = data.get('telegram_id')
        school_login = data.get('school_login')
        phone = data.get('phone')
        
        from database import get_connection
        conn = get_connection()
        cursor = conn.cursor()
        
        # Определяем user_id и получаем коины
        coins = None
        if school_login and phone:
            # Регистронезависимый поиск логина
            cursor.execute('SELECT coins FROM users WHERE LOWER(school_login) = ? AND phone = ?', 
                         (school_login.strip().lower(), phone.strip()))
            result = cursor.fetchone()
            if not result:
                conn.close()
                return jsonify({'error': 'Пользователь с таким логином и телефоном не найден'}), 404
            coins = result[0]
        elif telegram_id:
            coins = User.get_coins(telegram_id)
            # Обновляем активность по telegram_id
            update_user_activity(telegram_id=telegram_id)
        else:
            conn.close()
            return jsonify({'error': 'Требуется либо логин+телефон, либо telegram_id'}), 400
        
        # Обновляем активность пользователя
        if school_login and phone:
            update_user_activity(school_login=school_login, phone=phone)
        
        conn.close()
        
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
        # Поддерживаем оба способа: по telegram_id (старый) или по логину+телефону (новый)
        telegram_id = data.get('telegram_id')
        school_login = data.get('school_login')
        phone = data.get('phone')
        
        from database import get_connection
        conn = get_connection()
        cursor = conn.cursor()
        
        # Определяем user_id
        user_id = None
        if school_login and phone:
            # Регистронезависимый поиск логина
            cursor.execute('SELECT id FROM users WHERE LOWER(school_login) = ? AND phone = ?', 
                         (school_login.strip().lower(), phone.strip()))
            user_result = cursor.fetchone()
            if not user_result:
                conn.close()
                return jsonify({'error': 'Пользователь с таким логином и телефоном не найден'}), 404
            user_id = user_result[0]
        elif telegram_id:
            cursor.execute('SELECT id FROM users WHERE telegram_id = ?', (telegram_id,))
            user_result = cursor.fetchone()
            if not user_result:
                conn.close()
                return jsonify({'error': 'Пользователь не найден'}), 404
            user_id = user_result[0]
        else:
            conn.close()
            return jsonify({'error': 'Требуется либо логин+телефон, либо telegram_id'}), 400
        
        # Получаем информацию о бронировании
        cursor.execute('''
            SELECT b.id, b.user_id, b.room_id, r.price, b.status
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            WHERE b.id = ? AND b.user_id = ?
        ''', (booking_id, user_id))
        
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

# Функция для обновления активности пользователя
def update_user_activity(user_id=None, telegram_id=None, school_login=None, phone=None):
    """Обновляет время последней активности пользователя"""
    try:
        from database import get_connection
        from datetime import datetime
        conn = get_connection()
        cursor = conn.cursor()
        
        current_time = datetime.now().isoformat()
        
        if user_id:
            # Обновляем по user_id
            cursor.execute('''
                UPDATE users 
                SET last_activity = ?
                WHERE id = ?
            ''', (current_time, user_id))
        elif telegram_id:
            # Обновляем по telegram_id
            cursor.execute('''
                UPDATE users 
                SET last_activity = ?
                WHERE telegram_id = ?
            ''', (current_time, telegram_id))
        elif school_login and phone:
            # Обновляем по логину и телефону
            cursor.execute('''
                UPDATE users 
                SET last_activity = ?
                WHERE LOWER(school_login) = ? AND phone = ?
            ''', (current_time, school_login.lower(), phone))
        
        conn.commit()
        conn.close()
    except Exception as e:
        # Не прерываем выполнение, просто логируем ошибку
        print(f"Ошибка обновления активности пользователя: {e}")

# Получить онлайн пользователей (активны за последние 5 минут)
@app.route('/api/admin/online-users', methods=['GET'])
def get_online_users():
    """Получить список пользователей, которые онлайн (активны за последние 5 минут)"""
    try:
        from database import get_connection
        from datetime import datetime, timedelta
        
        # Получаем время 5 минут назад
        five_minutes_ago = datetime.now() - timedelta(minutes=5)
        five_minutes_ago_str = five_minutes_ago.isoformat()
        
        conn = get_connection()
        cursor = conn.cursor()
        
        # Получаем всех пользователей, активных за последние 5 минут
        cursor.execute('''
            SELECT 
                u.id,
                u.telegram_id,
                COALESCE(u.school_login, 'Не указан') as school_login,
                COALESCE(u.phone, 'Не указан') as phone,
                u.coins,
                u.last_activity,
                u.created_at
            FROM users u
            WHERE u.last_activity IS NOT NULL 
            AND datetime(u.last_activity) >= datetime(?)
            AND NOT (LOWER(COALESCE(u.school_login, '')) = 'admin' AND u.phone = '+998-00-000-00-11')
            ORDER BY u.last_activity DESC
        ''', (five_minutes_ago_str,))
        
        users = cursor.fetchall()
        conn.close()
        
        online_users = []
        for user in users:
            user_id = user[0]
            telegram_id = user[1]
            school_login = user[2]
            phone = user[3]
            coins = user[4]
            last_activity = user[5]
            created_at = user[6]
            
            # Вычисляем время с последней активности
            try:
                if isinstance(last_activity, str):
                    last_activity_dt = datetime.fromisoformat(last_activity.replace('Z', '+00:00'))
                else:
                    last_activity_dt = last_activity
                
                time_diff = datetime.now() - last_activity_dt
                minutes_ago = int(time_diff.total_seconds() / 60)
                
                if minutes_ago < 1:
                    time_ago_str = "только что"
                elif minutes_ago == 1:
                    time_ago_str = "1 минуту назад"
                elif minutes_ago < 5:
                    time_ago_str = f"{minutes_ago} минуты назад"
                else:
                    time_ago_str = f"{minutes_ago} минут назад"
            except:
                time_ago_str = "недавно"
            
            online_users.append({
                'telegram_id': telegram_id,
                'school_login': school_login,
                'phone': phone,
                'coins': coins,
                'last_activity': last_activity,
                'time_ago': time_ago_str,
                'created_at': created_at
            })
        
        return jsonify({
            'success': True,
            'online_users': online_users,
            'count': len(online_users),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# Поиск пользователя по telegram_id (для админа)
@app.route('/api/admin/find-user', methods=['GET'])
def find_user_by_telegram_id():
    """Найти пользователя по telegram_id и вернуть всю информацию"""
    try:
        telegram_id = request.args.get('telegram_id', type=int)
        
        if not telegram_id:
            return jsonify({'error': 'Требуется параметр telegram_id'}), 400
        
        from database import get_connection
        conn = get_connection()
        cursor = conn.cursor()
        
        # Ищем пользователя
        cursor.execute('''
            SELECT id, telegram_id, school_login, phone, coins, created_at
            FROM users
            WHERE telegram_id = ?
        ''', (telegram_id,))
        
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({
                'success': False,
                'error': f'Пользователь с telegram_id = {telegram_id} не найден'
            }), 404
        
        # Получаем все бронирования пользователя
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
        
        bookings_list = []
        confirmed_count = 0
        cancelled_count = 0
        total_hours = 0.0
        
        for booking in bookings:
            booking_id, date, start_time, end_time, status, created_at, room_name, room_type, room_floor, price = booking
            
            if status == "confirmed":
                confirmed_count += 1
                # Вычисляем длительность
                start_parts = start_time.split(':')
                end_parts = end_time.split(':')
                start_hour = int(start_parts[0])
                start_minute = int(start_parts[1]) if len(start_parts) > 1 else 0
                end_hour = int(end_parts[0])
                end_minute = int(end_parts[1]) if len(end_parts) > 1 else 0
                
                start_total_minutes = start_hour * 60 + start_minute
                end_total_minutes = end_hour * 60 + end_minute
                
                if end_total_minutes < start_total_minutes:
                    duration_minutes = (24 * 60 - start_total_minutes) + end_total_minutes
                else:
                    duration_minutes = end_total_minutes - start_total_minutes
                
                total_hours += duration_minutes / 60.0
            elif status == "cancelled":
                cancelled_count += 1
            
            bookings_list.append({
                'id': booking_id,
                'date': date,
                'start_time': start_time,
                'end_time': end_time,
                'status': status,
                'created_at': created_at,
                'room_name': room_name,
                'room_type': room_type,
                'room_floor': room_floor,
                'price': price
            })
        
        conn.close()
        
        return jsonify({
            'success': True,
            'user': {
                'id': user[0],
                'telegram_id': user[1],
                'school_login': user[2],
                'phone': user[3],
                'coins': user[4],
                'created_at': user[5]
            },
            'bookings': {
                'total': len(bookings_list),
                'confirmed': confirmed_count,
                'cancelled': cancelled_count,
                'list': bookings_list
            },
            'statistics': {
                'total_hours': round(total_hours, 2)
            }
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

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

# 📊 Админка: Получить статистику пользователей
@app.route('/api/admin/users-stats', methods=['GET'])
def get_users_stats():
    """Получить статистику всех пользователей: логин, телефон, номер (telegram_id), общее время в комнатах за выбранную неделю месяца"""
    try:
        from database import get_connection
        from datetime import datetime, timedelta
        from calendar import monthrange
        
        # Получаем параметры: номер недели (1-4), месяц, год и фильтр
        week_number = request.args.get('week_number', type=int)
        month = request.args.get('month', type=int)
        year = request.args.get('year', type=int)
        filter_type = request.args.get('filter', 'all')  # 'all' или 'with-bookings'
        
        # Если параметры не указаны, используем текущую дату
        today = datetime.now().date()
        if not month:
            month = today.month
        if not year:
            year = today.year
        
        # Определяем номер недели месяца для текущей даты, если не указан
        if not week_number:
            day = today.day
            # Неделя 1: дни 1-7
            # Неделя 2: дни 8-14
            # Неделя 3: дни 15-21
            # Неделя 4: дни 22-конец месяца
            if day <= 7:
                week_number = 1
            elif day <= 14:
                week_number = 2
            elif day <= 21:
                week_number = 3
            else:
                week_number = 4
        
        # Валидация номера недели
        if week_number < 1 or week_number > 4:
            return jsonify({'error': 'Номер недели должен быть от 1 до 4'}), 400
        
        # Валидация месяца и года
        if month < 1 or month > 12:
            return jsonify({'error': 'Месяц должен быть от 1 до 12'}), 400
        if year < 2000 or year > 2100:
            return jsonify({'error': 'Неверный год'}), 400
        
        # Получаем количество дней в месяце
        _, days_in_month = monthrange(year, month)
        
        # Вычисляем диапазон дат для выбранной недели
        if week_number == 1:
            week_start_day = 1
            week_end_day = min(7, days_in_month)
        elif week_number == 2:
            week_start_day = 8
            week_end_day = min(14, days_in_month)
        elif week_number == 3:
            week_start_day = 15
            week_end_day = min(21, days_in_month)
        else:  # week_number == 4
            week_start_day = 22
            week_end_day = days_in_month
        
        # Создаем объекты дат
        week_start_date = datetime(year, month, week_start_day).date()
        week_end_date = datetime(year, month, week_end_day).date()
        
        conn = get_connection()
        cursor = conn.cursor()
        
        # Вычисляем дату 2 недели назад
        two_weeks_ago = datetime.now().date() - timedelta(days=14)
        two_weeks_ago_str = two_weeks_ago.isoformat()
        
        # Получаем всех пользователей, зарегистрированных за последние 2 недели
        # SQLite хранит даты в формате 'YYYY-MM-DD' или 'YYYY-MM-DD HH:MM:SS'
        cursor.execute('''
            SELECT 
                u.id,
                u.telegram_id,
                COALESCE(u.school_login, 'Не указан') as school_login,
                COALESCE(u.phone, 'Не указан') as phone,
                u.coins,
                u.created_at
            FROM users u
            WHERE DATE(u.created_at) >= DATE(?)
            ORDER BY u.created_at DESC
        ''', (two_weeks_ago_str,))
        
        users = cursor.fetchall()
        
        # Для каждого пользователя считаем общее время в комнатах за выбранную неделю
        users_stats = []
        for user in users:
            user_id = user[0]
            telegram_id = user[1]
            school_login = user[2]
            phone = user[3]
            coins = user[4]
            created_at = user[5]
            
            # ИСКЛЮЧАЕМ АДМИНА из статистики
            # Админ определяется по логину "admin" и телефону "+998-00-000-00-11"
            if school_login and school_login.lower() == 'admin' and phone == '+998-00-000-00-11':
                continue  # Пропускаем админа
            
            # Проверяем, был ли пользователь зарегистрирован в выбранную неделю
            # Если да, включаем его в статистику даже если нет бронирований
            try:
                if isinstance(created_at, str):
                    # Парсим строку даты (может быть в формате 'YYYY-MM-DD' или 'YYYY-MM-DD HH:MM:SS')
                    date_part = created_at.split()[0] if ' ' in created_at else created_at
                    user_created_date = datetime.strptime(date_part, '%Y-%m-%d').date()
                elif hasattr(created_at, 'date'):
                    user_created_date = created_at.date()
                else:
                    user_created_date = created_at
                
                user_in_week = week_start_date <= user_created_date <= week_end_date
            except (ValueError, AttributeError, TypeError):
                # Если не удалось распарсить дату, считаем что пользователь не в неделе
                user_in_week = False
            
            # Получаем подтвержденные бронирования пользователя за выбранную неделю
            cursor.execute('''
                SELECT b.date, b.start_time, b.end_time
                FROM bookings b
                WHERE b.user_id = ? 
                AND b.status = 'confirmed'
                AND b.date >= ? 
                AND b.date <= ?
                ORDER BY b.date, b.start_time
            ''', (user_id, week_start_date.isoformat(), week_end_date.isoformat()))
            
            bookings = cursor.fetchall()
            
            # Считаем общее время (в часах) за выбранную неделю
            total_hours = 0.0
            for booking in bookings:
                booking_date = booking[0]
                start_time_str = booking[1]
                end_time_str = booking[2]
                
                # Парсим время
                start_parts = start_time_str.split(':')
                end_parts = end_time_str.split(':')
                
                start_hour = int(start_parts[0])
                start_minute = int(start_parts[1]) if len(start_parts) > 1 else 0
                end_hour = int(end_parts[0])
                end_minute = int(end_parts[1]) if len(end_parts) > 1 else 0
                
                # Вычисляем длительность с учетом перехода через полночь
                start_total_minutes = start_hour * 60 + start_minute
                end_total_minutes = end_hour * 60 + end_minute
                
                if end_total_minutes < start_total_minutes:
                    # Переход через полночь
                    duration_minutes = (24 * 60 - start_total_minutes) + end_total_minutes
                else:
                    # Обычный случай
                    duration_minutes = end_total_minutes - start_total_minutes
                
                total_hours += duration_minutes / 60.0
            
            # Форматируем время: часы и минуты
            total_hours_int = int(total_hours)
            total_minutes_int = int((total_hours - total_hours_int) * 60)
            
            # Форматируем время для отображения
            if total_hours_int == 0 and total_minutes_int == 0:
                time_display = "0 мин"
            elif total_hours_int == 0:
                time_display = f"{total_minutes_int} мин"
            elif total_minutes_int == 0:
                time_display = f"{total_hours_int} ч"
            else:
                time_display = f"{total_hours_int} ч {total_minutes_int} мин"
            
            # Включаем пользователя в статистику в зависимости от фильтра:
            # - 'all': если у него есть бронирования ИЛИ он был зарегистрирован в эту неделю
            # - 'with-bookings': только если у него есть бронирования более 1 часа (total_hours > 1)
            should_include = False
            if filter_type == 'with-bookings':
                # Только пользователи с бронированиями более 1 часа
                should_include = total_hours > 1.0
            else:
                # Все пользователи: с бронированиями или зарегистрированные в неделю
                should_include = total_hours > 0 or user_in_week
            
            if should_include:
                users_stats.append({
                    'telegram_id': telegram_id,
                    'school_login': school_login,
                    'phone': phone,
                    'coins': coins,
                    'total_hours': round(total_hours, 2),
                    'time_display': time_display,
                    'created_at': created_at
                })
        
        conn.close()
        
        # Сортируем сначала по дате регистрации (новые сначала), затем по алфавиту (по логину)
        # Пользователи с "Не указан" идут в конец
        def get_sort_key(user):
            # Преобразуем created_at в datetime для правильной сортировки
            created_at = user['created_at']
            try:
                if isinstance(created_at, str):
                    date_part = created_at.split()[0] if ' ' in created_at else created_at
                    user_date = datetime.strptime(date_part, '%Y-%m-%d')
                elif hasattr(created_at, 'date'):
                    user_date = datetime.combine(created_at.date(), datetime.min.time())
                else:
                    user_date = datetime.now()
            except (ValueError, AttributeError, TypeError):
                user_date = datetime.now()
            
            # Сортируем: сначала по дате регистрации (новые сначала - обратный порядок),
            # затем по логину (алфавитно), пользователи без логина в конец
            return (
                user['school_login'] == 'Не указан',  # Сначала те, у кого логин указан
                -user_date.timestamp(),  # Отрицательное значение для сортировки по убыванию (новые сначала)
                user['school_login'].lower() if user['school_login'] != 'Не указан' else 'zzz'  # Алфавитная сортировка
            )
        
        users_stats.sort(key=get_sort_key)
        
        # Форматируем название месяца
        month_names = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
        month_name = month_names[month]
        
        return jsonify({
            'success': True,
            'users': users_stats,
            'total_users': len(users_stats),
            'week_number': week_number,
            'month': month,
            'year': year,
            'month_name': month_name,
            'week_start': week_start_date.isoformat(),
            'week_end': week_end_date.isoformat(),
            'week_start_day': week_start_day,
            'week_end_day': week_end_day
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# 📊 Страница админки
@app.route('/admin')
def admin_page():
    """Страница админки с таблицей пользователей"""
    return send_from_directory('../frontend', 'admin.html')

# Для любых других файлов (должен быть в конце, чтобы не перехватывать API маршруты)
# Исключаем API маршруты из статического маршрута
@app.route('/<path:path>')
def static_files(path):
    # Не обрабатываем API маршруты через статический маршрут
    if path.startswith('api/'):
        abort(404)
    return send_from_directory('../frontend', path)

if __name__ == '__main__':
    # ИСПРАВЛЕНО: debug=False по умолчанию для безопасности
    # Используйте FLASK_DEBUG=True в .env для разработки
    import os
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    # Порт берется из переменной окружения PORT (по умолчанию 5000)
    port = int(os.getenv('PORT', 5000))
    # Включаем threaded режим для обработки множественных запросов одновременно
    # Для продакшена рекомендуется использовать gunicorn
    app.run(host='0.0.0.0', port=port, debug=debug_mode, threaded=True)