# Creates the Onukrom super admin on the live server (no SSH needed).
# Reads DEPLOY_TOKEN and APP_URL from deploy/production.env.
#
#   powershell -ExecutionPolicy Bypass -File deploy/create-super-admin.ps1
#
# Sign in at <APP_URL>/login with this email; you land in /platform.
# The password is generated on the server and shown here once.
$ErrorActionPreference = 'Stop'
$envFile = Join-Path $PSScriptRoot 'production.env'
if (-not (Test-Path $envFile)) { throw "Missing $envFile" }

$vars = @{}
Get-Content $envFile | Where-Object { $_ -match '^([A-Z0-9_]+)=(.*)$' } | ForEach-Object { $vars[$Matches[1]] = $Matches[2] }
$url = $vars['APP_URL'].TrimEnd('/')
$token = $vars['DEPLOY_TOKEN']

$body = [ordered]@{
    name  = Read-Host 'Your full name'
    email = Read-Host 'Login email for the platform panel (not a company email)'
}

try {
    $r = Invoke-RestMethod -Method Post -Uri "$url/api/_deploy/create-super-admin" `
        -Headers @{ 'X-Deploy-Token' = $token; Accept = 'application/json' } `
        -ContentType 'application/json; charset=utf-8' `
        -Body ([Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json)))
}
catch {
    $detail = $_.ErrorDetails.Message
    throw "Failed: $($_.Exception.Message) $detail"
}

Write-Host ''
Write-Host 'Super admin ready.' -ForegroundColor Green
Write-Host "Sign in:   $url/login  (you land in $url/platform)"
Write-Host "Email:     $($r.email)"
Write-Host "Password:  $($r.password)   (shown once - change it under Settings > Password)"
