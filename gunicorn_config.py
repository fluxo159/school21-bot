# gunicorn_config.py
# Конфигурация Gunicorn для продакшена
# Использование: gunicorn -c gunicorn_config.py app:app

import multiprocessing
import os

# Количество воркеров (рекомендуется: CPU cores * 2 + 1)
workers = int(os.getenv('WEB_CONCURRENCY', multiprocessing.cpu_count() * 2 + 1))

# Количество потоков на воркер
threads = 4

# Порт
bind = f"0.0.0.0:{os.getenv('PORT', 5000)}"

# Таймауты
timeout = 120
keepalive = 5

# Логирование
accesslog = '-'
errorlog = '-'
loglevel = 'info'

# Имя приложения
proc_name = 'school21_bot'

# Перезапуск воркеров после N запросов (предотвращает утечки памяти)
max_requests = 1000
max_requests_jitter = 50

