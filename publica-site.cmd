@echo off
setlocal
cd /d "%~dp0"

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo Publicarea nu este conectata inca la un repository GitHub.
  echo Urmeaza pasii din PUBLICARE.md.
  pause
  exit /b 1
)

git add --all
git diff --cached --quiet
if not errorlevel 1 (
  echo Nu exista modificari noi de publicat.
  pause
  exit /b 0
)

git commit -m "Actualizare site"
if errorlevel 1 (
  echo Nu am putut crea actualizarea Git.
  pause
  exit /b 1
)

git push origin main
if errorlevel 1 (
  echo Trimiterea catre GitHub a esuat. Verifica autentificarea si conexiunea.
  pause
  exit /b 1
)

echo.
echo Actualizarea a fost trimisa. GitHub Actions o publica automat.
echo Poti urmari progresul in fila Actions a repository-ului GitHub.
pause
