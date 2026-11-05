# Deploying the bot and Mini App

The bot and web application are separate processes. Run one polling bot instance per Telegram token. Flask serves both the frontend and same-origin API; a permissive CORS extension is unnecessary.

## Web process

Install the runtime dependencies and start from the repository root on a Unix-like host:

```bash
python -m pip install -r requirements.txt
gunicorn -c backend/gunicorn_config.py backend.app:app
```

Configure the host's secrets/environment panel rather than committing an `.env` file:

- `TELEGRAM_BOT_TOKEN`: the same private BotFather token used by the polling process.
- `BACKEND_URL`: the public HTTPS web address.
- `DEMO_MODE=false`, `FLASK_DEBUG=false`.
- `ADMIN_TELEGRAM_IDS`: optional comma-separated administrator IDs; leave empty to disable admin access.
- `DATABASE_PATH`: a SQLite file on a persistent writable volume, e.g. `/var/data/school21.db`.
- `TZ=Asia/Tashkent`: change to the campus timezone if needed.
- `PORT`: supplied by the hosting platform.
- `WEB_CONCURRENCY=2`: conservative default; measure load before increasing it.

The application initializes tables, adds a missing `last_activity` column for older databases, and seeds 12 example rooms when the room table is empty. Back up an existing database before upgrading. Replace example room settings through an authorized operator workflow before campus use. No student accounts are seeded.

`GET /api/ping` is a public health check. Private APIs require the signed `X-Telegram-Init-Data` header, attached automatically by the Mini App frontend. An expired session requires reopening the app. `/admin` is an HTML shell; its data APIs still require an authenticated, allowlisted administrator. Open the admin panel from the Telegram Mini App to carry the signed identity.

The Flask development server binds only to `127.0.0.1`; use Gunicorn behind an HTTPS reverse proxy for hosting. Configure rate limits and request-size limits at the proxy, monitor failures, and keep Flask debug mode off. Never publish `DEMO_MODE=true`: a proxy can make external traffic appear to come from loopback.

## Telegram process

Run a second long-lived process with the same environment:

```bash
python bot.py
```

It polls Telegram, registers `/start`, and attempts to set the Mini App menu button. If menu registration fails, set the menu URL through BotFather. Do not run a second poller for the same token during a deployment transition.

## Render

The root `render.yaml` defines the **web process only**. Connect the repository, provide the required token in Render's secret panel, and set `BACKEND_URL` to the resulting HTTPS URL. The blueprint requests a persistent disk for SQLite; select a plan that supports persistent disks and verify the current platform pricing before provisioning. Run `python bot.py` separately as a worker or on another reliable host.

Do not use an ephemeral filesystem for real reservations. This SQLite design expects one host and a shared local database file; independent replicas with separate database files will diverge. Use a server database before scaling across hosts.

## Operations and privacy

Back up SQLite using its backup API or SQLite's `.backup` command, not an uncoordinated copy of the database while WAL writes are active. Test restoration. Limit access to profiles, phone numbers, reservations and backups; establish retention and deletion procedures before campus rollout. Booking credits are internal demo allocations, not official evaluation balances.

Historical accounts associated with synthetic Telegram IDs are not automatically reassigned. After verifying identity outside the app, an authorized operator should back up the database and migrate the account association; login/phone submission cannot reassign an account.
