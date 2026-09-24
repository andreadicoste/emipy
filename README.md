# Emipy

Un piccolo ambiente Python: programmi privati, editor Monaco, esecuzione Pyodide nel browser e gestione utenti amministrativa. Il codice viene salvato sul server, ma eseguito nel browser.

## Sviluppo

Richiede Bun 1.4.2+.

```sh
bun install --frozen-lockfile
cp .env.example .env
bun run db:generate
# Prisma 7 richiede che il file SQLite esista già prima di migrate deploy.
mkdir -p data && touch data/emipy.db
bun run db:deploy
bun run dev
```

Impostare in `.env` almeno `DATABASE_URL`, `BETTER_AUTH_SECRET` (casuale, lungo almeno 32 caratteri), `BETTER_AUTH_URL` e `APP_ORIGIN`. Non pubblicare `.env`. Per creare il primo admin:

```sh
bun run admin:create
```

Lo script chiede email, nome e password interattivamente; non accetta password da env o argomenti. Nessun signup pubblico.

## Test

```sh
bun run typecheck
bun run build
E2E_EMAIL=admin@example.com E2E_PASSWORD='...' bunx playwright test
```

Playwright richiede Chromium installato (`bunx playwright install chromium`) e server locale avviato. I test modificano il database configurato: usare un DB di test.

## Coolify

- Applicazione Git con build Dockerfile, porta container `3000`, una replica.
- Dominio `https://emipy.andreadicoste.site` tramite il tunnel Cloudflare esistente `nextcloud` (`cc1060e8-ac9d-4bbc-9e3e-27b4ddf71d95`). DNS proxied CNAME `emipy` verso `cc1060e8-ac9d-4bbc-9e3e-27b4ddf71d95.cfargotunnel.com`; ingress locale del tunnel verso Traefik su `http://localhost:80`, che instrada l'hostname alla porta container `3000`. Non modificare il tunnel separato di `drive.andreadicoste.site` e non creare record A diretti al server.
- Bind mount `/home/andreadicoste/data/emipy` → `/app/data`. Creare la directory sull'host con UID/GID `1000:1000` prima del deploy. Il Dockerfile crea automaticamente `emipy.db` e applica le migrazioni a ogni avvio.
- Variabili: `DATABASE_URL=file:/app/data/emipy.db`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://emipy.andreadicoste.site`, `APP_ORIGIN=https://emipy.andreadicoste.site`, `HOST=0.0.0.0`, `PORT=3000`, `NODE_ENV=production`.
- Produzione servita direttamente da Bun con `server.ts`: asset statici da `dist/client`, richieste dinamiche inoltrate all'handler TanStack Start in `dist/server/server.js`. Nitro non è usato.
- Healthcheck: `/api/health`; verifica una query SQLite. COOP/COEP sono inviati dall'app anche sugli asset.
- Dopo il primo deploy, aprire un terminale nel container e lanciare `bun run admin:create`.

Il database SQLite deve restare sul volume tra rebuild/redeploy. Fare backup del file `emipy.db` con l'app fermata o con il comando SQLite `VACUUM INTO`; non copiare solo il file mentre esiste un WAL attivo.

## Limiti v1

Ogni programma parte da `main.py` e può aggiungere file Python importabili. Nessun pip, cartelle, signup pubblico, email, OAuth o servizi esterni. Pyodide è servito same-origin; `input()` usa `SharedArrayBuffer`, quindi servono HTTPS e isolamento cross-origin.
