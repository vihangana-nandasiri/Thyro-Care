# Interactive privileged production E2E runner (PowerShell only).
#
# Usage (interactive PowerShell — not Cursor agent shells):
#   .\scripts\run_privileged_e2e.ps1
#
# Prompts for temporary ADMIN and MEDICAL_EXPERT credentials via Read-Host,
# exports them only for the child Python process, then clears process env.
# Never commit credentials. Never print passwords or tokens.
# Companion: scripts/privileged_production_e2e.py

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$env:THYRO_TEST_ADMIN_EMAIL = Read-Host "Temporary ADMIN email"
$adminPassword = Read-Host "Temporary ADMIN password" -AsSecureString
$env:THYRO_TEST_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new(
    "",
    $adminPassword
).Password

$env:THYRO_TEST_EXPERT_EMAIL = Read-Host "Temporary MEDICAL_EXPERT email"
$expertPassword = Read-Host "Temporary MEDICAL_EXPERT password" -AsSecureString
$env:THYRO_TEST_EXPERT_PASSWORD = [System.Net.NetworkCredential]::new(
    "",
    $expertPassword
).Password

$requiredVariables = @(
    "THYRO_TEST_ADMIN_EMAIL",
    "THYRO_TEST_ADMIN_PASSWORD",
    "THYRO_TEST_EXPERT_EMAIL",
    "THYRO_TEST_EXPERT_PASSWORD"
)

foreach ($name in $requiredVariables) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name, "Process"))) {
        Write-Host "$name MISSING"
    }
    else {
        Write-Host "$name PRESENT"
    }
}

python .\scripts\privileged_production_e2e.py
$e2eExitCode = $LASTEXITCODE

Remove-Item Env:THYRO_TEST_ADMIN_EMAIL -ErrorAction SilentlyContinue
Remove-Item Env:THYRO_TEST_ADMIN_PASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:THYRO_TEST_EXPERT_EMAIL -ErrorAction SilentlyContinue
Remove-Item Env:THYRO_TEST_EXPERT_PASSWORD -ErrorAction SilentlyContinue

Remove-Variable adminPassword -ErrorAction SilentlyContinue
Remove-Variable expertPassword -ErrorAction SilentlyContinue

Write-Host "E2E exit code: $e2eExitCode"
exit $e2eExitCode
