# Publicarea automata a site-ului

Dupa configurarea initiala, fiecare actualizare trimisa pe ramura `main` este
verificata, construita si publicata automat pe Cloudflare Workers.

## Configurare initiala

Acesti pasi se fac o singura data:

1. Creeaza pe GitHub un repository privat numit `amasiiuli4ever`.
2. Conecteaza folderul proiectului la repository:

   ```powershell
   git remote add origin https://github.com/UTILIZATOR/amasiiuli4ever.git
   git push -u origin main
   ```

3. In Cloudflare, creeaza un API token folosind sablonul
   **Edit Cloudflare Workers** si limiteaza-l la contul folosit pentru site.
4. In GitHub deschide **Settings -> Secrets and variables -> Actions** si adauga
   doua repository secrets:

   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

5. Deschide fila **Actions**, alege workflow-ul **Publicare automata** si
   porneste-l cu **Run workflow**.

Nu introduce tokenul Cloudflare in fisierele proiectului.

## Publicarea actualizarilor

1. Modifica texturile sau codul.
2. Da dublu-click pe `publica-site.cmd` din folderul proiectului. Nu folosi
   optiunea **Run with PowerShell** pentru fisierul `.cmd`.
3. Urmareste progresul in fila **Actions** din GitHub.

Fisierul `publica-site.cmd` adauga modificarile, creeaza un commit si il trimite
pe GitHub. Workflow-ul publica automat versiunea noua daca build-ul reuseste.

Dintr-un terminal PowerShell poti folosi:

```powershell
.\publica-site.cmd
```

Alternativ, poti porni direct scriptul PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\publica-site.ps1
```

## Unde se incarca texturile

- Fundal: `public/texturi/fundal/`
- Usi: `public/texturi/usi/`, cu numele lunilor, de exemplu `martie.png`

Prima publicare Cloudflare va crea si o adresa `workers.dev`. Domeniul
`amasiiuli4ever.com` poate fi conectat ulterior din setarile Worker-ului.

## Lucru local

```powershell
npm install
npm run dev
```

Pentru o verificare completa inainte de publicare:

```powershell
npm run build
```
