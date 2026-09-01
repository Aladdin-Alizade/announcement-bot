# announcement-bot

Java/Spring layihəsinin Node 22 portu. Mövcud `src/main/java` koduna toxunmur.

Telegram əmlak axtarış botu: bina.az, tap.az, ev10.az, yeniemlak.az, emlak.az.

## Stack

- Node 22 + native `fetch` (`undici`)
- `cheerio` — HTML parse
- `better-sqlite3` — tək fayl DB
- Railway Volume — production-da persist

## Database (lokal və Railway)

**SQLite.** MySQL/Postgres yoxdur.

| Mühit | Fayl |
|---|---|
| Lokal | `./data/announcement.db` (`SQLITE_PATH`) |
| Railway | Volume mount `/data` → `SQLITE_PATH=/data/announcement.db` |

Railway-də Volume olmasa konteyner restart-da abunəliklər silinir. Dashboard-da Volume əlavə et, mount path: `/data`.

## Lokal işə salma

```bash
cd node-bot
cp .env.example .env
# .env-də TELEGRAM_BOT_TOKEN yaz
npm install
npm test
npm start
```

Health: http://localhost:3000/health

FlareSolverr (Cloudflare üçün, optional):

```bash
docker compose up -d flaresolverr
# .env: SCRAPER_FLARESOLVERR_URL=http://localhost:8191
```

və ya bütün stack: `docker compose up --build`

## Railway deploy

1. Yeni service, **Root Directory:** `node-bot`
2. Volume: mount `/data`
3. Variables:
   - `SQLITE_PATH=/data/announcement.db`
   - `TELEGRAM_BOT_TOKEN=...`
   - `PORT` Railway özü verir
   - Cloudflare bloklayırsa ayrıca FlareSolverr service + `SCRAPER_FLARESOLVERR_URL=http://flaresolverr.railway.internal:8191`

Hobby + SQLite (FlareSolverr-siz) adətən **$5/ay** credit içinə sığır.
