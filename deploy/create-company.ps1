# Creates a company and its owner login on the live server (no SSH needed).
# Reads DEPLOY_TOKEN and APP_URL from deploy/production.env.
#
#   powershell -ExecutionPolicy Bypass -File deploy/create-company.ps1
#
# The password is generated on the server and shown here once. It never
# appears in GitHub Actions logs.
$ErrorActionPreference = 'Stop'
$envFile = Join-Path $PSScriptRoot 'production.env'
if (-not (Test-Path $envFile)) { throw "Missing $envFile" }

$vars = @{}
Get-Content $envFile | Where-Object { $_ -match '^([A-Z0-9_]+)=(.*)$' } | ForEach-Object { $vars[$Matches[1]] = $Matches[2] }
$url = $vars['APP_URL'].TrimEnd('/')
$token = $vars['DEPLOY_TOKEN']

$body = [ordered]@{
    code       = Read-Host 'Company code (staff type this in the app, e.g. rahimtraders)'
    name       = Read-Host 'Company name'
    owner_name = Read-Host "Owner's full name"
    email      = Read-Host "Owner's login email"
    phone      = Read-Host "Owner's mobile (optional, Enter to skip)"
}
if (-not $body.phone) { $body.Remove('phone') }

try {
    $r = Invoke-RestMethod -Method Post -Uri "$url/api/_deploy/create-company" `
        -Headers @{ 'X-Deploy-Token' = $token; Accept = 'application/json' } `
        -ContentType 'application/json; charset=utf-8' `
        -Body ([Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json)))
}
catch {
    $detail = $_.ErrorDetails.Message
    throw "Failed: $($_.Exception.Message) $detail"
}

Write-Host ''
Write-Host "Created. Company code: $($r.company_code)" -ForegroundColor Green
Write-Host "Admin panel: $url/login"
Write-Host "Email:       $($r.email)"
Write-Host "Password:    $($r.password)   (shown once - change it under Settings > Password)"
