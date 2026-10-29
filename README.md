# Servidor UI — Windows-klient for Ubuntu

Servidor UI er en Windows-klient til Servidor-backenden som kjører på Ubuntu. UI-et åpnes lokalt på Windows; prosjekter, filer, terminalkommandoer, registrering og AI-arbeid håndteres av Ubuntu-serveren.

Dette repoet inneholder bare klient/UI-filer. Serverkoden og serverens `.env` skal ikke kopieres inn eller publiseres her.

## Funksjoner

| Område | Hvor arbeidet skjer |
|---|---|
| Prosjekter, filer og editor | Ubuntu-serveren |
| Terminal og agent | Ubuntu-serveren |
| Chat og AI-nøkler | Ubuntu-serveren |
| UI, tema og vindu | Denne Windows-PC-en |

## Krav

- Windows 10 eller 11
- Microsoft Edge
- Tailscale installert og innlogget på samme tailnet som Ubuntu-serveren
- En Servidor-backend som kjører på Ubuntu, lytter på port `8000` via Tailscale og har API-tokenbeskyttelse konfigurert

UI-et trenger ikke Python eller Node.js for vanlig bruk. Node.js kreves bare hvis du endrer UI-kildekoden og bygger den på nytt.

## Installer og koble til

1. Last ned repoet fra GitHub med **Code → Download ZIP**, pakk det ut til en fast mappe, for eksempel `D:\Apps\servidor-ui`. Du kan også klone repoet med Git.
2. Installer Tailscale på Windows og logg inn på samme tailnet som Ubuntu-serveren. Ubuntu-serverens Tailscale-IP finner du på Ubuntu med `tailscale ip -4`.
3. Kontroller at Windows-PC-en bruker **Ubuntu-serverens** Tailscale-IP i appen. Ikke bruk Windows-PC-ens egen Tailscale-IP.
4. På Ubuntu kontroller at Servidor kjører og lytter på port 8000. Serveren må tillate porten fra `tailscale0`.
5. Dobbeltklikk `Start-Servidor.cmd`.
6. Skriv serveradressen, for eksempel `http://100.x.y.z:8000`, og serverens API-token i tilkoblingsbildet. Finn tokenet i `backend/.env` på din Ubuntu-server. Trykk **Koble til**.

Tokenet lagres i Edge-profilen på Windows-PC-en. Ikke del det, legg det i GitHub, eller send det i feilmeldinger.

## Sett opp egne nøkler på Ubuntu

API-nøklene til AI-tjenester legges på Ubuntu-serveren, aldri i Windows-klienten eller dette repoet:

1. På Ubuntu, gå til Servidor-mappen og lag serverens lokale konfigurasjon fra malen hvis du ikke allerede har den:

   ```bash
   cd ~/servidor
   cp backend/.env.example backend/.env
   ```

2. Lag en unik `API_TOKEN` for din server. Du kan generere en slik på Ubuntu:

   ```bash
   openssl rand -hex 32
   ```

   Lim resultatet inn som `API_TOKEN=...` i `backend/.env`. Hold `.env` privat; den skal være ignorert av Git.

3. Opprett API-nøkler hos leverandørene du vil bruke, og legg dem i Ubuntu-serverens `backend/.env` under de tilhørende navnene:

   - `GEMINI_API_KEY`
   - `DEEPSEEK_API_KEY`
   - `TECH_AI_API_KEY`
   - `GITHUB_TOKEN` (valgfritt, hvis serveren skal hente private GitHub-repoer)

   Du trenger bare nøklene til tjenestene du bruker. Disse nøklene blir værende på Ubuntu.

4. Start Servidor-tjenesten på nytt etter endring i `.env`:

   ```bash
   sudo systemctl restart servidor-super
   sudo systemctl status servidor-super --no-pager
   ```

### SQLite og `schema.sql`

Hvis `DATABASE_URL` er tom eller kommentert ut, bruker serveren lokal SQLite i `backend/data/memory.db` og oppretter tabellene ved oppstart. Vercel/PostgreSQL er valgfritt. Ikke kjør `backend/schema.sql` mot SQLite; den filen er for PostgreSQL.

## Oppdater klienten

For å hente siste UI-oppdatering i en Git-klone, åpne PowerShell i repo-mappen og kjør:

```powershell
git pull --ff-only
```

Start deretter klienten på nytt med `Start-Servidor.cmd`. Hvis du installerte fra en ZIP, last ned siste ZIP fra GitHub, pakk ut den nye versjonen og behold serverens `.env` på Ubuntu.

UI-endringer vedlikeholdes i GitHub-repoet. Vanlige brukere trenger ikke bygge UI-et; den ferdige `ui/app.bundle.js` følger med.

## Bygg UI-et fra kildekode

Installer Node.js, åpne PowerShell i repo-mappen og kjør:

```powershell
npm install
npm run build:ui
```

Kildekoden ligger i `ui/js/`. Bygget UI ligger i `ui/app.bundle.js`.

## Feilsøking

| Feil | Sjekk |
|---|---|
| Får ikke kontakt | Tailscale må være tilkoblet på begge maskiner; bruk Ubuntu-serverens Tailscale-IP og kontroller port 8000. |
| Feil eller manglende API-token | Bruk `API_TOKEN` fra `backend/.env` på Ubuntu-serveren. |
| Serveradresse svarer ikke | På Ubuntu kjør `sudo ss -ltnp | grep 8000` og `sudo ufw status`; brannmurregelen må gjelde `8000 on tailscale0`. |
| Nøkler mangler i AI-status | Legg leverandørnøkkelen i Ubuntu-serverens `.env` og start `servidor-super` på nytt. |
| UI-endringer vises ikke | Kjør `npm run build:ui`, og start klienten på nytt. |

## Lisens

Distribuert under MIT-lisensen. Se [`LICENSE`](LICENSE).
