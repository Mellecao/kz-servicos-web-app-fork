param(
  [string]$ProjectRef = "mtsqeomctrqfyekyzapc",
  [string]$ServiceAccountPath = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$secretsDir = Join-Path $PSScriptRoot "secrets"

if ([string]::IsNullOrWhiteSpace($ServiceAccountPath)) {
  $candidate = Get-ChildItem -Path $secretsDir -Filter "*-firebase-adminsdk-*.json" -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $candidate) {
    throw "Nenhum arquivo *-firebase-adminsdk-*.json encontrado em $secretsDir"
  }

  $ServiceAccountPath = $candidate.FullName
}

if (-not (Test-Path -LiteralPath $ServiceAccountPath)) {
  throw "Arquivo de service account não encontrado: $ServiceAccountPath"
}

$serviceAccount = Get-Content -Raw -LiteralPath $ServiceAccountPath | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($serviceAccount.project_id) -or
    [string]::IsNullOrWhiteSpace($serviceAccount.client_email) -or
    [string]::IsNullOrWhiteSpace($serviceAccount.private_key)) {
  throw "JSON de service account inválido: project_id/client_email/private_key ausentes"
}

$privateKeySingleLine = ($serviceAccount.private_key -replace "`r", "") -replace "`n", "\n"

Write-Host "Aplicando FIREBASE_* no projeto $ProjectRef"
Write-Host "Arquivo:" $ServiceAccountPath
Write-Host "FIREBASE_PROJECT_ID:" $serviceAccount.project_id
Write-Host "FIREBASE_CLIENT_EMAIL:" $serviceAccount.client_email

supabase secrets set `
  FIREBASE_PROJECT_ID="$($serviceAccount.project_id)" `
  FIREBASE_CLIENT_EMAIL="$($serviceAccount.client_email)" `
  FIREBASE_PRIVATE_KEY="$privateKeySingleLine" `
  --project-ref $ProjectRef

Write-Host ""
Write-Host "Secrets FIREBASE_* atualizados."
Write-Host "Próximo passo: alinhar PUSH_WEBHOOK_SECRET com o valor salvo no vault.push_webhook_secret."
