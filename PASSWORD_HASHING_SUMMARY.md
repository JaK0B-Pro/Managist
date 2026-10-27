# Password Hashing

User passwords are now stored as Argon2id hashes (PHC string format, salt included) instead of plain text.

## What changed (`src-tauri/src/lib.rs`)

- `hash_password` / `verify_password` helpers, plus `authenticate_user`, which looks up the user by name and checks the password in Rust (no longer `WHERE password = $2` in SQL).
- `login` and `update_user_password` use `authenticate_user`.
- `signup_proccess`, `update_user_password` (new password) and `create_default_admin_user` store hashes.
- New dependency: `argon2 = "0.5"` in `src-tauri/Cargo.toml`.

## Existing accounts

Accounts created before this change still hold plain-text passwords. They keep working: on the first successful
login (or password change) the plain-text value is accepted once and replaced with a hash. No migration script is needed.

The `password VARCHAR(255)` column is wide enough for the ~97-character hash.

## Testing

1. `cd src-tauri && cargo test --lib` — unit tests for hashing and the legacy path.
2. `npm run tauri dev`, log in with an existing account, then check the DB:
   `SELECT name, password FROM users;` — the password should now start with `$argon2id$`.
3. Log out and back in to confirm the hashed password verifies. Create a new user via signup and change a password in settings.

Note: hashing is noticeably slower in debug builds (~1s per login); release builds are fast.

## Still open

The default `admin` / `admin123` account is still created on an empty database — change that password after first login.
