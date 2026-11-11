# Deploying to cPanel

Every push to `main` deploys automatically through GitHub Actions
(`.github/workflows/deploy.yml`):

1. Builds the admin panel (`npm run build`) on GitHub's machine.
2. Checks that the `vendor/` folder on the server matches `composer.lock`.
   If not, it stops **before** uploading anything.
3. Puts the site in maintenance mode. Phones that sync during the upload get
   "try again later" and retry by themselves.
4. Uploads changed files over FTPS. Only changed files are sent; a state file on
   the server remembers what is already there.
5. Calls the server to run migrations and clear and rebuild Laravel's caches, then
   brings the site back online.

Files are copied into `release/` first; these are **never** uploaded: `vendor/`, `android_app/`, `storage/`, `.env`,
`node_modules/`, tests, docs and frontend sources (`resources/js`, `resources/css`).
The compiled frontend (`public/build`) is uploaded.

## Server (onukrom.com on the bdgigs.com cPanel)

| What | Value |
|---|---|
| Project folder | `/home/bdgigsco/onukrom.com` |
| Document root | `/home/bdgigsco/onukrom.com/public` (already set) |
| PHP | 8.4 |
| Database / user | `bdgigsco_onukrom` / `bdgigsco_onukrom` (MySQL, `localhost`) |
| FTP account | `deploy@onukrom.com`, home = the project folder, host `bdgigs.com`, FTPS |

The server address, FTP user and site URL are written in `deploy.yml`. Only
three values are GitHub secrets (repository → Settings → Secrets and variables → Actions):

| Secret | |
|---|---|
| `FTP_PASSWORD` | password of `deploy@onukrom.com` |
| `DEPLOY_TOKEN` | same value as `DEPLOY_TOKEN` in the server's `.env` |
| `VITE_MAPBOX_TOKEN` | the public `pk.` Mapbox token |

Optional repository variable `FTP_PROTOCOL`: `ftps` (default), or `ftp` if FTPS fails.

## One-time setup

1. cPanel → FTP Accounts: create `deploy@onukrom.com` with directory `onukrom.com`.
2. cPanel → Manage My Databases: create user `bdgigsco_onukrom` and add it to
   `bdgigsco_onukrom` with ALL PRIVILEGES.
3. Upload `deploy/production.env` to `/home/bdgigsco/onukrom.com` and rename it to `.env`.
   It holds `APP_KEY`, the DB password and `DEPLOY_TOKEN`; it is gitignored and never uploaded by CI.
4. Upload `deploy/vendor-production.zip` to the same folder and **Extract** it,
   so `vendor/` sits next to `.env`.
5. Add the three GitHub secrets above.
6. Push to `main`. The first run uploads everything and runs the migrations; the
   vendor check and maintenance mode are skipped with a warning because the app
   isn't on the server yet.

`deploy/production.env` and `deploy/SECRETS.txt` are created locally once
(gitignored). Delete `SECRETS.txt` after entering the passwords.
## Everyday use

- **Code change:** push to `main`. Nothing else to do.
- **Database change (new migration):** just push; every push runs `migrate --force`.
  (A manual run from Actions → Deploy lets you untick migrations.)
- **New or updated Composer package:** the deploy stops with
  "composer.lock changed…". Then:
  1. Build a new zip, either on your PC
     (`powershell -ExecutionPolicy Bypass -File deploy/build-vendor.ps1` → `deploy/vendor-production.zip`)
     or on GitHub (Actions → Build vendor zip → download the artifact).
  2. On the server, delete the old `vendor` folder, then upload and extract the new zip.
  3. Re-run the failed deploy.

## If a deploy fails half-way

The site stays in maintenance mode on purpose, because half-uploaded code is
worse than a short outage. Fix the cause and re-run the workflow; the last step
brings the site back online.

To bring it back by hand without deploying:

```
curl -X POST -H "X-Deploy-Token: YOUR_TOKEN" https://onukrom.com/api/_deploy/refresh
```

## The deploy hooks

`app/Http/Controllers/DeployController.php`, under `/api/_deploy/*`:

| Call | Does |
|---|---|
| `GET status` | which vendor build is on the server (`vendor/.lock-hash`), PHP version |
| `POST down` | maintenance mode (the hooks themselves stay reachable) |
| `POST refresh[?migrate=1]` | creates missing `storage/` folders, `optimize:clear`, `migrate --force`, `optimize`, resets OPcache, `up` |

Without the right `X-Deploy-Token` header (or with `DEPLOY_TOKEN` empty) they
answer 404, as if they did not exist.
