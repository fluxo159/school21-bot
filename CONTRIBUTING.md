# Contributing to school21-bot

Welcome, School 21 peers and community contributors! Small fixes, translations, bug reports and documentation improvements are all useful.

## Report a bug or suggest a feature

Search [existing issues](https://github.com/fluxo159/school21-bot/issues) first. For a bug, include reproduction steps, expected and actual behavior, Python version and relevant redacted logs. For a feature, describe the student workflow it would improve. Discuss substantial changes before implementing them.

Never include bot tokens, phone numbers, student lists, Telegram initData or a real SQLite database in an issue. Use the [security policy](SECURITY.md) for vulnerabilities.

## Submit a pull request

1. Fork the repository and clone your fork.
2. Follow the [README setup instructions](README.md#quick-start), using `DEMO_MODE=true` and synthetic profile data for local development.
3. Create a branch: `git switch -c fix/short-description`.
4. Make a focused change. Keep async Telegram handlers nonblocking, use parameterized SQL, and preserve server-side authorization. Add concise English docstrings and type hints for new Python functions. Keep user-facing translations consistent.
5. Run `python -m unittest discover -s tests -v` and `python -m compileall -q backend bot.py`. For JavaScript changes, also run `node --check` against the changed files and check the browser flow.
6. Commit and push your branch, then open a pull request against `main`. Explain the problem, resulting behavior, verification and any database/configuration changes. Link the relevant issue when there is one.

Use synthetic fixtures for tests. A bug fix should include a regression test when practical; a documentation-only change does not need a new test. Never commit local environments, generated databases or secrets.

Review may request adjustments. Please keep discussion respectful and help other peers reproduce your findings. Contributions are distributed under the project's [MIT License](LICENSE).
