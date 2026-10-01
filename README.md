# Emipy

Un piccolo ambiente Python e C: programmi privati, editor Monaco, esecuzione WebAssembly nel browser e gestione utenti amministrativa. Il codice viene salvato sul server, ma compilato ed eseguito nel browser.

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

`dev` e `build` preparano automaticamente gli asset C. Il primo avvio richiede rete per scaricare circa 58 MiB da una revisione fissa di `binji/wasm-clang`, con verifica SHA-256. Gli avvii successivi riutilizzano i file validati in `public/c-runtime/<revision>/`. Per prepararli separatamente: `bun run runtime:prepare`. In produzione il browser scarica gli asset dal dominio di Emipy solo quando apre un programma C.

Impostare in `.env` almeno `DATABASE_URL`, `BETTER_AUTH_SECRET` (casuale, lungo almeno 32 caratteri), `BETTER_AUTH_URL` e `APP_ORIGIN`. Non pubblicare `.env`. Per creare il primo admin:

```sh
bun run admin:create
```

Lo script chiede email, nome e password interattivamente; non accetta password da env o argomenti. Nessun signup pubblico.

## Test

```sh
bun run typecheck
bun run build
bun test src/lib/c-runtime/compiler.test.ts
E2E_EMAIL=admin@example.com E2E_PASSWORD='...' bunx playwright test
```

Playwright richiede Chromium installato (`bunx playwright install chromium`) e server locale avviato. I test modificano il database configurato: usare un DB di test.

Il percorso Python/C aggiornato si verifica con `bunx playwright test tests/c-runtime.spec.ts`. L'ultimo test del worker usa gli URL di sviluppo Vite, quindi richiede `bun run dev`.

## Coolify

- Applicazione Git con build Dockerfile, porta container `3000`, una replica.
- Dominio `https://emipy.andreadicoste.site` tramite il tunnel Cloudflare esistente `nextcloud` (`cc1060e8-ac9d-4bbc-9e3e-27b4ddf71d95`). DNS proxied CNAME `emipy` verso `cc1060e8-ac9d-4bbc-9e3e-27b4ddf71d95.cfargotunnel.com`; ingress locale del tunnel verso Traefik su `http://localhost:80`, che instrada l'hostname alla porta container `3000`. Non modificare il tunnel separato di `drive.andreadicoste.site` e non creare record A diretti al server.
- Bind mount `/home/andreadicoste/data/emipy` → `/app/data`. Creare la directory sull'host con UID/GID `1000:1000` prima del deploy. Il Dockerfile crea automaticamente `emipy.db` e applica le migrazioni a ogni avvio.
- Variabili: `DATABASE_URL=file:/app/data/emipy.db`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://emipy.andreadicoste.site`, `APP_ORIGIN=https://emipy.andreadicoste.site`, `HOST=0.0.0.0`, `PORT=3000`, `NODE_ENV=production`.
- Produzione servita direttamente da Bun con `server.ts`: asset statici da `dist/client`, richieste dinamiche inoltrate all'handler TanStack Start in `dist/server/server.js`. Nitro non è usato.
- Healthcheck: `/api/health`; verifica una query SQLite. COOP/COEP sono inviati dall'app anche sugli asset.
- Dopo il primo deploy, aprire un terminale nel container e lanciare `bun run admin:create`.

Il database SQLite deve restare sul volume tra rebuild/redeploy. Fare backup del file `emipy.db` con l'app fermata o con il comando SQLite `VACUUM INTO`; non copiare solo il file mentre esiste un WAL attivo.

## Runtime C

Dal menu Playground scegliere **Nuovo programma C**. Il file principale è `main.c`; si possono aggiungere fino a 24 sorgenti `.c` e header `.h` nella stessa directory. Tutti i sorgenti vengono compilati e collegati insieme. Sono supportati programmi da console C11, `printf`, `fprintf`, `scanf`, `getchar` e file nel filesystem temporaneo del runtime. I prompt vengono emessi immediatamente; ogni input inviato dalla console termina con un newline.

Clang e LLD 8.0.1 sono eseguiti in un Web Worker tramite WASM/WASI. Questa prima toolchain è sperimentale e datata: non offre compilatori recenti, librerie native aggiuntive, processi, rete o thread. I limiti sono 60 secondi per compilazione/linking, 30 secondi per esecuzione interattiva (attesa input esclusa), 1 MiB di output e 64 MiB di memoria per il programma compilato, con stack da 1 MiB. Il compilatore stesso può richiedere più memoria. STOP termina il Worker anche durante compilazione o attesa input.

Il filesystem e l'istanza del programma vengono ricreati a ogni START. I file generati durante l'esecuzione non vengono salvati nel progetto. Anche ogni valutazione ha un Worker indipendente, con limite di esecuzione di 10 secondi dopo la compilazione. Il runtime restituisce diagnostica, codice di uscita e stato di compilazione al tutor/grader. TinaCMS e gli schemi degli esercizi accettano `language: "c"`; non sono aggiunti nuovi corsi in questa modifica.

Gli asset sono fissati alla revisione `648c4a89997a351eef75cdaec3ef5b89d4937dec` di [binji/wasm-clang](https://github.com/binji/wasm-clang). Lo shim console deriva dal progetto e conserva le licenze Apache-2.0 e LLVM in `src/lib/c-runtime/vendor/`. Gli asset binari vengono preparati durante la build e inclusi nell'immagine Docker, senza gonfiare la cronologia Git.

## Limiti

I programmi Python partono da `main.py` e possono aggiungere file Python importabili. Nessun pip, cartelle, signup pubblico, email o OAuth. Pyodide e il runtime C sono serviti same-origin; l'input interattivo usa `SharedArrayBuffer`, quindi servono HTTPS e isolamento cross-origin. La migrazione assegna `python` a tutti i programmi e alle consegne preesistenti.
