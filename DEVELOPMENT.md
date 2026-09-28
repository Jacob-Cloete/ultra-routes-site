# FAST development loop

Repo: `Jacob-Cloete/ultra-routes-site` · Production: https://fast.jacobcloete.pro/

## Edit

The repository root is the editable site. Historical `preview/` boards are ignored.

Run `php -S 127.0.0.1:8778 -t .` and open http://127.0.0.1:8778/. No frontend build step.

On this Mac, system PHP is not installed. A temporary test runtime was installed in `/private/tmp/fast-php-test` from the official WordPress `@php-wasm/cli` npm package. Use:

```sh
/Users/jacobcloete/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /private/tmp/fast-php-test/node_modules/@php-wasm/cli/php-wasm.js -S 127.0.0.1:8778 -t .
```

This temporary runtime is a development dependency only; Hostinger executes native PHP. The test database is outside the checkout, in its parent's `fast-private` folder. Never sync that folder to Git or a public directory.

Edit `data/adventures.json` for the trip calendar. Keep the status `proposed` until actual arrangements have been made; route references do not establish future availability. Every trip has capacity 4 in addition to Jacob. No automated marketing or confirmation emails are sent.

Update version query strings when changing frontend assets or calendar data.

## Verify

- JavaScript syntax check and `git diff --check`.
- `python3 tests/check-signups.py` against the local PHP server. It exercises validation, deduplication, simultaneous duplicate requests, four-guest confirmation capacity, withdrawal and rate limits. Only disposable `example.com` records are created; they are cleaned up. The helper currently points to this Mac's PHP-WASM runtime for CLI checks.
- Browser: all years, map selection, trip expansion, training details, signup success/error, private management page, optional 3D view, phone width and keyboard focus.
- Before production, inspect `git status` for accidental private files.

## Release

Create a `codex/` branch, push a PR, merge the authorized release to `main`, and verify Hostinger deployed it. Check live assets, PHP submission and withdrawal, plus blocked access to `api/storage.php` and `tools/`. No force push.

The earlier private-adventure launch is in merge `4bb4f0b`; the original race viewer is recoverable at `597e59e`.
