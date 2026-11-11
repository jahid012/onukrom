# Builds deploy/vendor-production.zip: vendor/ without dev packages, for manual
# upload to the server. Runs in deploy/vendor-build so your local vendor/
# (with test tools) is not touched.
#
#   powershell -ExecutionPolicy Bypass -File deploy/build-vendor.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$work = Join-Path $PSScriptRoot 'vendor-build'
$zip = Join-Path $PSScriptRoot 'vendor-production.zip'

if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory $work | Out-Null
Copy-Item (Join-Path $root 'composer.json'), (Join-Path $root 'composer.lock') $work

Push-Location $work
try {
    composer install --no-dev --no-scripts --no-interaction --prefer-dist --no-progress --optimize-autoloader
    if ($LASTEXITCODE -ne 0) { throw 'composer install failed' }

    # Which composer.lock this vendor/ was built from (checked by the deploy pipeline).
    $hash = php (Join-Path $PSScriptRoot 'lock-hash.php') (Join-Path $root 'composer.lock')
    Set-Content -Path 'vendor/.lock-hash' -Value $hash -NoNewline -Encoding ascii

    if (Test-Path $zip) { Remove-Item $zip -Force }
    # bsdtar (built into Windows 10+) writes a zip with -a; much faster than Compress-Archive.
    tar -a -c -f $zip vendor
    if ($LASTEXITCODE -ne 0) { throw 'zip failed' }
}
finally {
    Pop-Location
}

Remove-Item $work -Recurse -Force
$size = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "Done: $zip ($size MB, lock $hash)"
