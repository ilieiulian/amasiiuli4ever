param(
  [string]$Message = "Actualizare site",
  [switch]$NoPause
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

function Finish-Publishing {
  param(
    [string]$Text,
    [int]$Code
  )

  Write-Host ""
  Write-Host $Text
  if (-not $NoPause) {
    Read-Host "Apasa Enter pentru a inchide" | Out-Null
  }
  exit $Code
}

try {
  & git remote get-url origin *> $null
  if ($LASTEXITCODE -ne 0) {
    Finish-Publishing "Publicarea nu este conectata la repository-ul GitHub." 1
  }

  & git add --all
  if ($LASTEXITCODE -ne 0) {
    Finish-Publishing "Nu am putut pregati modificarile." 1
  }

  & git diff --cached --quiet
  $diffExitCode = $LASTEXITCODE
  if ($diffExitCode -eq 0) {
    Finish-Publishing "Nu exista modificari noi de publicat." 0
  }
  if ($diffExitCode -ne 1) {
    Finish-Publishing "Nu am putut verifica modificarile." 1
  }

  & git commit -m $Message
  if ($LASTEXITCODE -ne 0) {
    Finish-Publishing "Nu am putut crea actualizarea Git." 1
  }

  & git push origin main
  if ($LASTEXITCODE -ne 0) {
    Finish-Publishing "Trimiterea catre GitHub a esuat. Verifica autentificarea si conexiunea." 1
  }

  Finish-Publishing "Actualizarea a fost trimisa. GitHub Actions o publica automat." 0
}
catch {
  Finish-Publishing "Publicarea a esuat: $($_.Exception.Message)" 1
}
