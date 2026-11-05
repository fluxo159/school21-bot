# Security policy

Security fixes are applied to the current development branch. No older release has a separate support guarantee.

## Reporting a vulnerability

Use GitHub's **Security → Report a vulnerability** option for this repository if it is enabled. If it is unavailable, open an issue asking the maintainer for a private reporting channel, without including exploit details or personal data. Do not post credentials, Telegram initData, student records or database dumps.

Include affected versions, reproduction steps using synthetic accounts, impact and a proposed fix if available. There is currently no guaranteed response time or paid bug bounty.

## Authentication and data

The backend validates Telegram Mini App `initData` with HMAC-SHA256 and a configurable age limit, then binds profile and booking requests to that signed user. Administrator rights require a Telegram ID in `ADMIN_TELEGRAM_IDS`. Login and phone fields are not authentication credentials. Phone numbers are format-checked, not verified by SMS; school logins do not prove campus membership.

Local demo mode deliberately uses a fixed synthetic identity, rejects non-loopback requests and disables admin APIs. It must stay off in hosted environments, including behind a reverse proxy. Demo and campus data must use separate database files.

Student profiles and reservations are personal data. Restrict database and backup access, establish a retention policy with the campus, and avoid collecting unnecessary information. Signed initData acts as a reusable credential until expiry: protect it with HTTPS, avoid logging it, and set an appropriate `INIT_DATA_MAX_AGE`.

Never commit secrets or SQLite files. If a credential is exposed, revoke it first (Telegram tokens through BotFather), update the deployment secret, and then assess history cleanup; deleting a line does not revoke a token. Enabling GitHub secret scanning and private vulnerability reporting is recommended for maintainers.
