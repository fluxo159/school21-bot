"""Flask API and static frontend for School 21 campus room bookings."""

from datetime import datetime, timedelta
from typing import Optional, Union

from flask import Flask, Response, abort, g, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException

from . import config
from .config import campus_now
from .database import get_db_connection, init_db
from .models import Booking, Room, User
from .security import validate_init_data

ResponseValue = Union[Response, tuple[Response, int]]
app = Flask(__name__, static_folder="../frontend", static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024
init_db()


@app.before_request
def authenticate_request() -> Optional[ResponseValue]:
    """Bind private requests to signed identity and enforce admin privileges."""
    if not request.path.startswith("/api/") or request.path == "/api/ping":
        return None
    init_data = request.headers.get("X-Telegram-Init-Data", "")
    if config.DEMO_MODE:
        # Demo mode uses an isolated database, a fixed identity, and loopback only.
        if request.remote_addr not in {"127.0.0.1", "::1"}:
            return jsonify({"error": "Demo mode is available on localhost only."}), 403
        g.telegram_id = config.DEMO_USER_ID
        g.is_admin = False
    else:
        try:
            g.telegram_id = validate_init_data(
                init_data, config.BOT_TOKEN, config.INIT_DATA_MAX_AGE
            )
        except ValueError:
            return jsonify(
                {"error": "Invalid or expired Telegram session. Reopen the Mini App."}
            ), 401
        g.is_admin = g.telegram_id in config.ADMIN_TELEGRAM_IDS
    if request.path.startswith("/api/admin/") and not g.is_admin:
        return jsonify({"error": "Administrator access required."}), 403
    if request.method == "POST":
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"error": "A JSON object is required."}), 400
        supplied_id = data.get("telegram_id")
        if supplied_id is not None and supplied_id != g.telegram_id:
            return jsonify({"error": "Telegram identity mismatch."}), 403
        data["telegram_id"] = g.telegram_id
        # Legacy clients send login/phone on each request; these are profile
        # fields, never credentials for reading or mutating another account.
        if request.path not in {"/api/login", "/api/profile/update"}:
            data.pop("school_login", None)
            data.pop("phone", None)
        if request.path in {"/api/login", "/api/profile/update"}:
            if not all(isinstance(data.get(key), str) for key in ("school_login", "phone")):
                return jsonify({"error": "Login and phone must be strings."}), 400
        if request.path == "/api/bookings/create":
            if type(data.get("room_id")) is not int or not all(
                isinstance(data.get(key), str) for key in ("date", "start_time", "end_time")
            ):
                return jsonify({"error": "Room ID, date and times are required."}), 400
    return None


@app.after_request
def secure_response(response: Response) -> Response:
    """Prevent API caching and browser content sniffing."""
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


def server_error() -> tuple[Response, int]:
    """Return a generic error without disclosing database or personal data."""
    app.logger.error("Request failed in endpoint %s", request.endpoint)
    return jsonify({"error": "Internal server error."}), 500


@app.errorhandler(Exception)
def handle_error(error: Exception) -> ResponseValue:
    """Preserve HTTP status codes and hide unexpected error details."""
    if isinstance(error, HTTPException):
        return jsonify({"error": error.name}), error.code or 500
    return server_error()


# Главная страница Web App
@app.route("/")
def index() -> ResponseValue:
    """Serve the room-booking Mini App."""
    return send_from_directory("../frontend", "index.html")


# 🔐 Аутентификация пользователя по telegram_id (для первой инициализации)
@app.route("/api/auth", methods=["POST"])
def auth() -> ResponseValue:
    """Get or create the authenticated Telegram peer."""
    try:
        data = request.json
        telegram_id = data.get("telegram_id")

        if not telegram_id:
            return jsonify({"error": "No telegram_id provided"}), 400

        # Проверяем и создаем пользователя если нужно
        user = User.get_or_create(telegram_id)

        # Обновляем активность пользователя
        update_user_activity(telegram_id=telegram_id)

        return jsonify(
            {
                "success": True,
                "user": {
                    "id": user["id"],
                    "telegram_id": user["telegram_id"],
                    "is_admin": g.is_admin,
                    "school_login": user["school_login"],
                    "phone": user["phone"],
                    "coins": user["coins"],
                    "is_new": user["is_new"],
                },
            }
        )

    except Exception:
        return server_error()


# 🔐 Вход по логину и телефону (переключение профилей)
def validate_uzbek_operator(phone: str) -> tuple[bool, str]:
    """Validate a supported Uzbekistan phone prefix."""
    import re

    # Убираем все пробелы и дефисы для проверки
    phone_clean = phone.replace(" ", "").replace("-", "")

    # Проверяем формат +998XXXXXXXXX
    if not re.match(r"^\+998[0-9]{9}$", phone_clean):
        return False, "Неверный формат телефона"

    # Извлекаем первые две цифры после +998
    prefix = phone_clean[4:6]  # После +998 берем 2 цифры

    # Список валидных операторов
    valid_operators = {
        "90": "Beeline (Unitel)",
        "91": "Beeline (Unitel)",
        "93": "Ucell",
        "94": "Ucell",
        "95": "Uzmobile",
        "99": "Uzmobile",
        "97": "Mobiuz",
        "88": "Uzmobile",
        "50": "Uzmobile",
        "77": "Uzmobile",
        "98": "Uzmobile",
        "33": "Humans (бывший Ucell)",
    }

    if prefix in valid_operators:
        return True, valid_operators[prefix]
    else:
        return False, f"Неизвестный оператор. Префикс {prefix} не поддерживается"


@app.route("/api/login", methods=["POST"])
def login() -> ResponseValue:
    """Resolve only the signed caller's existing profile; never switch identity."""
    data = request.get_json()
    school_login = data["school_login"].strip().lower()
    phone = data["phone"].strip()
    with get_db_connection() as conn:
        user = conn.execute(
            "SELECT id, telegram_id, school_login, phone, coins, created_at FROM users WHERE telegram_id = ?",
            (g.telegram_id,),
        ).fetchone()
    if not user or not user[2] or user[2].lower() != school_login or user[3] != phone:
        return jsonify({"error": "Profile not found for your Telegram account."}), 403
    update_user_activity(user_id=user[0])
    return jsonify(
        {
            "success": True,
            "user": {
                "id": user[0],
                "telegram_id": user[1],
                "school_login": user[2],
                "phone": user[3],
                "coins": user[4],
                "created_at": user[5],
                "is_admin": g.is_admin,
            },
        }
    )


# 📝 Обновление профиля (логин + телефон) - ДОБАВЛЕНА ВАЛИДАЦИЯ
@app.route("/api/profile/update", methods=["POST"])
def update_profile() -> ResponseValue:
    """Validate and update the authenticated peer profile."""
    try:
        data = request.json
        telegram_id = data.get("telegram_id")
        school_login = data.get("school_login")
        phone = data.get("phone")

        if not telegram_id:
            return jsonify({"error": "Требуется telegram_id"}), 400

        if not school_login:
            return jsonify({"error": "Требуется школьный логин"}), 400

        # Проверяем что логин не пустой
        school_login = school_login.strip()
        if not school_login:
            return jsonify({"error": "Школьный логин не может быть пустым"}), 400

        # Валидация логина через login_validator (строгие правила для новых пиров)
        from .login_validator import validate_login

        is_valid, error_msg = validate_login(school_login)
        if not is_valid:
            return jsonify({"error": error_msg}), 400

        # ОБЯЗАТЕЛЬНАЯ валидация телефона (узбекский формат: +998-00-000-00-00)
        if not phone:
            return jsonify({"error": "Требуется номер телефона"}), 400

        phone = phone.strip()
        # Валидация узбекского формата телефона: +998-XX-XXX-XX-XX (2-3-2-2 цифры)
        import re

        # Убираем все пробелы и дефисы для проверки количества цифр
        phone_clean = phone.replace(" ", "").replace("-", "")
        if not re.match(r"^\+998[0-9]{9}$", phone_clean):
            return jsonify(
                {
                    "error": "Неверный формат телефона. Используйте формат: +998-XX-XXX-XX-XX (например: +998-XX-XXX-XX-XX)"
                }
            ), 400

        # Проверяем что телефон в правильном формате с дефисами: +998-XX-XXX-XX-XX
        if not re.match(r"^\+998-[0-9]{2}-[0-9]{3}-[0-9]{2}-[0-9]{2}$", phone):
            return jsonify(
                {
                    "error": "Неверный формат телефона. Используйте формат: +998-XX-XXX-XX-XX (например: +998-XX-XXX-XX-XX)"
                }
            ), 400

        # Валидация оператора
        is_valid_operator, operator_info = validate_uzbek_operator(phone)
        if not is_valid_operator:
            return jsonify({"error": operator_info}), 400

        result = User.update_profile(telegram_id, school_login, phone)

        if not result.get("success"):
            error_msg = result.get("error", "Неизвестная ошибка")
            return jsonify({"error": error_msg}), 400

        return jsonify({"success": True, "message": "Профиль обновлен", "is_admin": g.is_admin})

    except Exception:
        return server_error()


# 🏠 Получить все комнаты
@app.route("/api/rooms")
def get_rooms() -> ResponseValue:
    """Return active campus rooms."""
    try:
        rooms = Room.get_all()
        return jsonify({"success": True, "rooms": rooms})
    except Exception:
        return server_error()


# 🏢 Получить комнаты по этажу
@app.route("/api/rooms/floor/<int:floor_number>")
def get_rooms_by_floor(floor_number: int) -> ResponseValue:
    """Return active rooms on the requested floor."""
    try:
        rooms = Room.get_by_floor(floor_number)
        return jsonify({"success": True, "floor": floor_number, "rooms": rooms})
    except Exception:
        return server_error()


# 📅 Создать бронирование - ДОБАВЛЕНА ВАЛИДАЦИЯ
@app.route("/api/bookings/create", methods=["POST"])
def create_booking() -> ResponseValue:
    """Validate and reserve a room for the authenticated peer."""
    try:
        data = request.json
        room_id = data["room_id"]
        date = data["date"]
        start_time = data["start_time"]
        end_time = data["end_time"]
        with get_db_connection() as conn:
            user = conn.execute(
                "SELECT id FROM users WHERE telegram_id = ?", (g.telegram_id,)
            ).fetchone()
        if not user:
            return jsonify({"error": "User not found."}), 404
        user_id = user[0]

        if not all([user_id, room_id, date, start_time, end_time]):
            return jsonify({"error": "Все поля обязательны"}), 400

        try:
            booking_date = datetime.strptime(date, "%Y-%m-%d").date()
            start_dt = datetime.strptime(start_time, "%H:%M")
            end_dt = datetime.strptime(end_time, "%H:%M")
        except ValueError:
            return jsonify({"error": "Use YYYY-MM-DD dates and HH:MM times."}), 400
        if datetime.combine(booking_date, start_dt.time()) <= campus_now():
            return jsonify({"error": "Bookings must start in the future."}), 400

        # Обработка перехода через полночь
        # Если end_time < start_time, это означает переход через полночь
        crosses_midnight = end_dt.time() < start_dt.time()

        if crosses_midnight:
            # Вычисляем длительность с учетом перехода через полночь
            # Например: 22:00 до 02:00 = 4 часа
            from datetime import timedelta

            end_time_next_day = datetime.combine(campus_now().date(), end_dt.time()) + timedelta(
                days=1
            )
            start_time_today = datetime.combine(campus_now().date(), start_dt.time())
            duration = (end_time_next_day - start_time_today).total_seconds() / 3600
        else:
            # Обычный случай без перехода через полночь
            if start_time >= end_time:
                return jsonify({"error": "Конец времени должен быть позже начала"}), 400
            duration = (end_dt - start_dt).total_seconds() / 3600

        # ДОБАВЛЕНО: Проверка максимальной длительности (например, не более 24 часов для 24-часового режима)
        if duration > 24:
            return jsonify({"error": "Максимальная длительность бронирования - 24 часа"}), 400

        if duration <= 0:
            return jsonify({"error": "Длительность бронирования должна быть больше 0"}), 400

        # Проверка минимальной длительности (минимум 1 час)
        if duration < 1:
            return jsonify({"error": "Минимальная длительность бронирования - 1 час"}), 400

        # user_id уже определен выше
        result = Booking.create(user_id, room_id, date, start_time, end_time)

        if "error" in result:
            return jsonify({"error": result["error"]}), 400

        # Обновляем активность пользователя
        update_user_activity(user_id=user_id)

        return jsonify(
            {
                "success": True,
                "booking_id": result["booking_id"],
                "message": "Бронирование создано!",
            }
        )

    except Exception:
        return server_error()


# 📋 Получить мои бронирования (изменил на POST для консистентности)
@app.route("/api/my-bookings", methods=["POST"])
def my_bookings() -> ResponseValue:
    """Return the authenticated peer's confirmed bookings."""
    update_user_activity(telegram_id=g.telegram_id)
    return jsonify({"success": True, "bookings": Booking.get_user_bookings(g.telegram_id)})


# 💰 Получить баланс коинов (изменил на POST)
@app.route("/api/coins", methods=["POST"])
def get_coins() -> ResponseValue:
    """Return the caller's internal booking-credit balance."""
    update_user_activity(telegram_id=g.telegram_id)
    return jsonify({"success": True, "coins": User.get_coins(g.telegram_id)})


# 🔍 Проверить текущую занятость комнат на этаже (в реальном времени)
@app.route("/api/rooms/floor/<int:floor_number>/current-status", methods=["GET"])
def get_rooms_current_status(floor_number: int) -> ResponseValue:
    """Return current room occupancy for a campus floor."""
    try:
        from .database import get_connection

        conn = get_connection()
        cursor = conn.cursor()

        # Получаем текущую дату и время
        now = campus_now()
        current_date = now.date().isoformat()
        current_time = now.time().strftime("%H:%M:%S")

        # Получаем все комнаты на этаже
        cursor.execute(
            """
            SELECT id FROM rooms WHERE floor = ? AND is_active = 1
        """,
            (floor_number,),
        )
        room_ids = [row[0] for row in cursor.fetchall()]

        # Проверяем занятость каждой комнаты
        busy_rooms = {}
        for room_id in room_ids:
            # Проверяем активные бронирования, которые пересекаются с текущим временем
            # Учитываем переход через полночь
            cursor.execute(
                """
                SELECT id FROM bookings
                WHERE room_id = ? AND status = 'confirmed' AND (
                    (date = ? AND (
                        (start_time <= end_time AND start_time <= ? AND end_time > ?)
                        OR (start_time > end_time AND start_time <= ?)
                    ))
                    OR (date = ? AND start_time > end_time AND end_time > ?)
                )
            """,
                (
                    room_id,
                    current_date,
                    current_time,
                    current_time,
                    current_time,
                    (now.date() - timedelta(days=1)).isoformat(),
                    current_time,
                ),
            )

            active_booking = cursor.fetchone()
            busy_rooms[room_id] = active_booking is not None

        conn.close()

        return jsonify(
            {
                "success": True,
                "busy_rooms": busy_rooms,
                "current_time": current_time,
                "current_date": current_date,
            }
        )

    except Exception:
        return server_error()


# 🔍 Проверить доступность комнаты (ИСПРАВЛЕНО)
@app.route("/api/rooms/<int:room_id>/availability", methods=["GET"])
def check_availability(room_id: int) -> ResponseValue:
    """Check whether a room slot has conflicting reservations."""
    try:
        date = request.args.get("date")
        start_time = request.args.get("start_time")
        end_time = request.args.get("end_time")

        if not all([date, start_time, end_time]):
            return jsonify({"error": "Все параметры обязательны"}), 400

        if start_time >= end_time:
            return jsonify({"error": "Конец времени должен быть позже начала"}), 400

        from .database import get_connection

        conn = get_connection()
        cursor = conn.cursor()

        # ИСПРАВЛЕННАЯ логика проверки пересечений
        cursor.execute(
            """
            SELECT id FROM bookings 
            WHERE room_id = ? AND date = ? AND status = 'confirmed'
            AND NOT (end_time <= ? OR start_time >= ?)
        """,
            (room_id, date, start_time, end_time),
        )

        conflicting = cursor.fetchall()
        conn.close()

        return jsonify(
            {
                "success": True,
                "available": len(conflicting) == 0,
                "conflicting_bookings": len(conflicting),
            }
        )

    except Exception:
        return server_error()


# ❌ Отменить бронирование
@app.route("/api/bookings/<int:booking_id>/cancel", methods=["POST"])
def cancel_booking(booking_id: int) -> ResponseValue:
    """Cancel the caller's booking once and refund credits atomically."""
    with get_db_connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        booking = conn.execute(
            """SELECT b.user_id, r.price, b.status, b.date, b.start_time
               FROM bookings b JOIN rooms r ON r.id = b.room_id
               JOIN users u ON u.id = b.user_id
               WHERE b.id = ? AND u.telegram_id = ?""",
            (booking_id, g.telegram_id),
        ).fetchone()
        if not booking:
            return jsonify({"error": "Booking not found."}), 404
        if booking[2] != "confirmed":
            return jsonify({"error": "Booking has already been cancelled."}), 400
        starts_at = datetime.fromisoformat(f"{booking[3]}T{booking[4]}")
        if starts_at - campus_now() <= timedelta(hours=1):
            return jsonify({"error": "Cancel more than one hour before the booking starts."}), 400
        conn.execute("UPDATE bookings SET status = 'cancelled' WHERE id = ?", (booking_id,))
        conn.execute("UPDATE users SET coins = coins + ? WHERE id = ?", (booking[1], booking[0]))
        balance = conn.execute("SELECT coins FROM users WHERE id = ?", (booking[0],)).fetchone()[0]
    return jsonify({"success": True, "refunded_coins": booking[1], "new_balance": balance})


# УДАЛЕНЫ небезопасные debug endpoints
# Используйте прямой доступ к БД через SQLite CLI для отладки


# Тестовый API
@app.route("/api/ping")
def ping() -> ResponseValue:
    """Return a lightweight service health response."""
    return jsonify({"status": "ok", "message": "Backend живой!"})


# Функция для обновления активности пользователя
def update_user_activity(
    user_id: Optional[int] = None,
    telegram_id: Optional[int] = None,
) -> None:
    """Record campus-local activity time without logging personal data."""
    try:
        with get_db_connection() as conn:
            if user_id is not None:
                conn.execute(
                    "UPDATE users SET last_activity = ? WHERE id = ?",
                    (campus_now().isoformat(), user_id),
                )
            elif telegram_id is not None:
                conn.execute(
                    "UPDATE users SET last_activity = ? WHERE telegram_id = ?",
                    (campus_now().isoformat(), telegram_id),
                )
    except Exception:
        app.logger.warning("Could not update user activity.")


# Получить онлайн пользователей (активны за последние 5 минут)
@app.route("/api/admin/online-users", methods=["GET"])
def get_online_users() -> ResponseValue:
    """Return recent peer activity for authenticated administrators."""
    try:
        from datetime import datetime, timedelta

        from .database import get_connection

        # Получаем время 5 минут назад
        five_minutes_ago = campus_now() - timedelta(minutes=5)
        five_minutes_ago_str = five_minutes_ago.isoformat()

        conn = get_connection()
        cursor = conn.cursor()

        # Получаем всех пользователей, активных за последние 5 минут
        cursor.execute(
            """
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
            ORDER BY u.last_activity DESC
        """,
            (five_minutes_ago_str,),
        )

        users = cursor.fetchall()
        conn.close()

        online_users = []
        for user in users:
            if user[1] in config.ADMIN_TELEGRAM_IDS:
                continue
            telegram_id = user[1]
            school_login = user[2]
            phone = user[3]
            coins = user[4]
            last_activity = user[5]
            created_at = user[6]

            # Вычисляем время с последней активности
            try:
                if isinstance(last_activity, str):
                    last_activity_dt = datetime.fromisoformat(last_activity.replace("Z", "+00:00"))
                else:
                    last_activity_dt = last_activity

                time_diff = campus_now() - last_activity_dt
                minutes_ago = int(time_diff.total_seconds() / 60)

                if minutes_ago < 1:
                    time_ago_str = "только что"
                elif minutes_ago == 1:
                    time_ago_str = "1 минуту назад"
                elif minutes_ago < 5:
                    time_ago_str = f"{minutes_ago} минуты назад"
                else:
                    time_ago_str = f"{minutes_ago} минут назад"
            except (ValueError, TypeError, AttributeError):
                time_ago_str = "недавно"

            online_users.append(
                {
                    "telegram_id": telegram_id,
                    "school_login": school_login,
                    "phone": phone,
                    "coins": coins,
                    "last_activity": last_activity,
                    "time_ago": time_ago_str,
                    "created_at": created_at,
                }
            )

        return jsonify(
            {
                "success": True,
                "online_users": online_users,
                "count": len(online_users),
                "timestamp": campus_now().isoformat(),
            }
        )

    except Exception:
        return server_error()


# Поиск пользователя по telegram_id (для админа)
@app.route("/api/admin/find-user", methods=["GET"])
def find_user_by_telegram_id() -> ResponseValue:
    """Return a peer and booking statistics for administrators."""
    try:
        telegram_id = request.args.get("telegram_id", type=int)

        if not telegram_id:
            return jsonify({"error": "Требуется параметр telegram_id"}), 400

        from .database import get_connection

        conn = get_connection()
        cursor = conn.cursor()

        # Ищем пользователя
        cursor.execute(
            """
            SELECT id, telegram_id, school_login, phone, coins, created_at
            FROM users
            WHERE telegram_id = ?
        """,
            (telegram_id,),
        )

        user = cursor.fetchone()

        if not user:
            conn.close()
            return jsonify(
                {"success": False, "error": f"Пользователь с telegram_id = {telegram_id} не найден"}
            ), 404

        # Получаем все бронирования пользователя
        cursor.execute(
            """
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
        """,
            (user[0],),
        )

        bookings = cursor.fetchall()

        bookings_list = []
        confirmed_count = 0
        cancelled_count = 0
        total_hours = 0.0

        for booking in bookings:
            (
                booking_id,
                date,
                start_time,
                end_time,
                status,
                created_at,
                room_name,
                room_type,
                room_floor,
                price,
            ) = booking

            if status == "confirmed":
                confirmed_count += 1
                # Вычисляем длительность
                start_parts = start_time.split(":")
                end_parts = end_time.split(":")
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

            bookings_list.append(
                {
                    "id": booking_id,
                    "date": date,
                    "start_time": start_time,
                    "end_time": end_time,
                    "status": status,
                    "created_at": created_at,
                    "room_name": room_name,
                    "room_type": room_type,
                    "room_floor": room_floor,
                    "price": price,
                }
            )

        conn.close()

        return jsonify(
            {
                "success": True,
                "user": {
                    "id": user[0],
                    "telegram_id": user[1],
                    "is_admin": g.is_admin,
                    "school_login": user[2],
                    "phone": user[3],
                    "coins": user[4],
                    "created_at": user[5],
                },
                "bookings": {
                    "total": len(bookings_list),
                    "confirmed": confirmed_count,
                    "cancelled": cancelled_count,
                    "list": bookings_list,
                },
                "statistics": {"total_hours": round(total_hours, 2)},
            }
        )

    except Exception:
        return server_error()


# УДАЛЕН небезопасный admin endpoint
# Для обновления коинов используйте прямые SQL команды или создайте защищенный API с аутентификацией

# backend/app.py - добавьте этот эндпоинт


# 📅 Получить занятые слоты для комнаты на определенную дату
@app.route("/api/rooms/<int:room_id>/busy-slots", methods=["GET"])
def get_room_busy_slots(room_id: int) -> ResponseValue:
    """Return occupied time ranges without exposing peer identity."""
    try:
        date = request.args.get("date")
        if not date:
            return jsonify({"error": "Требуется параметр date"}), 400

        from datetime import datetime, timedelta

        from .database import get_connection

        conn = get_connection()
        cursor = conn.cursor()

        # Получаем бронирования на указанную дату с логином пользователя
        cursor.execute(
            """
            SELECT b.start_time, b.end_time, NULL as user_login
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            WHERE b.room_id = ? AND b.date = ? AND b.status = 'confirmed'
            ORDER BY b.start_time
        """,
            (room_id, date),
        )

        busy_slots = cursor.fetchall()

        # Также проверяем бронирования на предыдущий день, которые могут переходить через полночь
        prev_date = (datetime.strptime(date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
        cursor.execute(
            """
            SELECT b.start_time, b.end_time, NULL as user_login
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            WHERE b.room_id = ? AND b.date = ? AND b.status = 'confirmed'
            AND b.end_time < b.start_time
            ORDER BY b.start_time
        """,
            (room_id, prev_date),
        )

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
                result.append(
                    {
                        "start_time": start_time,
                        "end_time": "23:59:59",  # Обрезаем до конца текущего дня
                        "user_login": user_login,
                    }
                )
            else:
                result.append(
                    {"start_time": start_time, "end_time": end_time, "user_login": user_login}
                )

        # Добавляем бронирования с предыдущего дня, которые переходят через полночь
        # Для них показываем только часть от 00:00:00 до end_time
        for slot in prev_day_slots:
            user_login = slot[2] if len(slot) > 2 else None
            result.append(
                {
                    "start_time": "00:00:00",  # Начинается с начала текущего дня
                    "end_time": slot[1],  # Заканчивается в end_time
                    "user_login": user_login,
                }
            )

        return jsonify({"success": True, "room_id": room_id, "date": date, "busy_slots": result})

    except Exception:
        return server_error()


# 📊 Админка: Получить статистику пользователей
@app.route("/api/admin/users-stats", methods=["GET"])
def get_users_stats() -> ResponseValue:
    """Return weekly room usage for authenticated administrators."""
    try:
        from calendar import monthrange
        from datetime import datetime, timedelta

        from .database import get_connection

        # Получаем параметры: номер недели (1-4), месяц, год и фильтр
        week_number = request.args.get("week_number", type=int)
        month = request.args.get("month", type=int)
        year = request.args.get("year", type=int)
        filter_type = request.args.get("filter", "all")  # 'all' или 'with-bookings'

        # Если параметры не указаны, используем текущую дату
        today = campus_now().date()
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
            return jsonify({"error": "Номер недели должен быть от 1 до 4"}), 400

        # Валидация месяца и года
        if month < 1 or month > 12:
            return jsonify({"error": "Месяц должен быть от 1 до 12"}), 400
        if year < 2000 or year > 2100:
            return jsonify({"error": "Неверный год"}), 400

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
        two_weeks_ago = campus_now().date() - timedelta(days=14)
        two_weeks_ago_str = two_weeks_ago.isoformat()

        # Получаем всех пользователей, зарегистрированных за последние 2 недели
        # SQLite хранит даты в формате 'YYYY-MM-DD' или 'YYYY-MM-DD HH:MM:SS'
        cursor.execute(
            """
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
        """,
            (two_weeks_ago_str,),
        )

        users = cursor.fetchall()

        # Для каждого пользователя считаем общее время в комнатах за выбранную неделю
        users_stats = []
        for user in users:
            user_id = user[0]
            if user[1] in config.ADMIN_TELEGRAM_IDS:
                continue
            telegram_id = user[1]
            school_login = user[2]
            phone = user[3]
            coins = user[4]
            created_at = user[5]

            # Проверяем, был ли пользователь зарегистрирован в выбранную неделю
            # Если да, включаем его в статистику даже если нет бронирований
            try:
                if isinstance(created_at, str):
                    # Парсим строку даты (может быть в формате 'YYYY-MM-DD' или 'YYYY-MM-DD HH:MM:SS')
                    user_created_date = datetime.fromisoformat(
                        created_at.replace("Z", "+00:00")
                    ).date()
                elif hasattr(created_at, "date"):
                    user_created_date = created_at.date()
                else:
                    user_created_date = created_at

                user_in_week = week_start_date <= user_created_date <= week_end_date
            except (ValueError, AttributeError, TypeError):
                # Если не удалось распарсить дату, считаем что пользователь не в неделе
                user_in_week = False

            # Получаем подтвержденные бронирования пользователя за выбранную неделю
            cursor.execute(
                """
                SELECT b.date, b.start_time, b.end_time
                FROM bookings b
                WHERE b.user_id = ? 
                AND b.status = 'confirmed'
                AND b.date >= ? 
                AND b.date <= ?
                ORDER BY b.date, b.start_time
            """,
                (user_id, week_start_date.isoformat(), week_end_date.isoformat()),
            )

            bookings = cursor.fetchall()

            # Считаем общее время (в часах) за выбранную неделю
            total_hours = 0.0
            for booking in bookings:
                start_time_str = booking[1]
                end_time_str = booking[2]

                # Парсим время
                start_parts = start_time_str.split(":")
                end_parts = end_time_str.split(":")

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
            if filter_type == "with-bookings":
                # Только пользователи с бронированиями более 1 часа
                should_include = total_hours > 1.0
            else:
                # Все пользователи: с бронированиями или зарегистрированные в неделю
                should_include = total_hours > 0 or user_in_week

            if should_include:
                users_stats.append(
                    {
                        "telegram_id": telegram_id,
                        "school_login": school_login,
                        "phone": phone,
                        "coins": coins,
                        "total_hours": round(total_hours, 2),
                        "time_display": time_display,
                        "created_at": created_at,
                    }
                )

        conn.close()

        # Сортируем сначала по дате регистрации (новые сначала), затем по алфавиту (по логину)
        # Пользователи с "Не указан" идут в конец
        def get_sort_key(user):
            # Преобразуем created_at в datetime для правильной сортировки
            created_at = user["created_at"]
            try:
                if isinstance(created_at, str):
                    user_date = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                elif hasattr(created_at, "date"):
                    user_date = datetime.combine(created_at.date(), datetime.min.time())
                else:
                    user_date = campus_now()
            except (ValueError, AttributeError, TypeError):
                user_date = campus_now()

            # Сортируем: сначала по дате регистрации (новые сначала - обратный порядок),
            # затем по логину (алфавитно), пользователи без логина в конец
            return (
                user["school_login"] == "Не указан",  # Сначала те, у кого логин указан
                -user_date.timestamp(),  # Отрицательное значение для сортировки по убыванию (новые сначала)
                user["school_login"].lower()
                if user["school_login"] != "Не указан"
                else "zzz",  # Алфавитная сортировка
            )

        users_stats.sort(key=get_sort_key)

        # Форматируем название месяца
        month_names = [
            "",
            "Январь",
            "Февраль",
            "Март",
            "Апрель",
            "Май",
            "Июнь",
            "Июль",
            "Август",
            "Сентябрь",
            "Октябрь",
            "Ноябрь",
            "Декабрь",
        ]
        month_name = month_names[month]

        return jsonify(
            {
                "success": True,
                "users": users_stats,
                "total_users": len(users_stats),
                "week_number": week_number,
                "month": month,
                "year": year,
                "month_name": month_name,
                "week_start": week_start_date.isoformat(),
                "week_end": week_end_date.isoformat(),
                "week_start_day": week_start_day,
                "week_end_day": week_end_day,
            }
        )

    except Exception:
        return server_error()


# 📊 Страница админки
@app.route("/admin")
def admin_page() -> ResponseValue:
    """Serve the admin UI shell; its API requires signed admin identity."""
    return send_from_directory("../frontend", "admin.html")


# Для любых других файлов (должен быть в конце, чтобы не перехватывать API маршруты)
# Исключаем API маршруты из статического маршрута
@app.route("/<path:path>")
def static_files(path: str) -> ResponseValue:
    """Serve a frontend asset while excluding API paths."""
    # Не обрабатываем API маршруты через статический маршрут
    if path.startswith("api/"):
        abort(404)
    return send_from_directory("../frontend", path)


def main() -> None:
    """Run the local development server; use Gunicorn for deployment."""
    import os

    app.run(
        host="127.0.0.1",
        port=int(os.getenv("PORT", "5001")),
        debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
        threaded=True,
    )


if __name__ == "__main__":
    main()
