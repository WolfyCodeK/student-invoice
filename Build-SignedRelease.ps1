param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Building SIGNED version $Version" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "$PSScriptRoot\student-invoice-tauri"

# Update version numbers
Write-Host "Updating version numbers..." -ForegroundColor Yellow
$packageJson = Get-Content 'package.json' | ConvertFrom-Json
$packageJson.version = $Version
$packageJson | ConvertTo-Json -Depth 10 | Set-Content 'package.json'

$cargoToml = Get-Content 'src-tauri\Cargo.toml' -Raw
$cargoToml = $cargoToml -replace '(?m)^\s*version\s*=\s*"[^"]+"', "version = `"$Version`"", 1
$cargoToml | Set-Content 'src-tauri\Cargo.toml'

$tauriConf = Get-Content 'src-tauri\tauri.conf.json' | ConvertFrom-Json
$tauriConf.version = $Version
$tauriConf | ConvertTo-Json -Depth 10 | Set-Content 'src-tauri\tauri.conf.json'

Write-Host ""
Write-Host "Reading signing key..." -ForegroundColor Yellow
$keyContent = Get-Content 'myapp.key' -Raw
$env:TAURI_SIGNING_PRIVATE_KEY = $keyContent.Trim()
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "tauri"

Write-Host "Building with signing enabled..." -ForegroundColor Yellow
Write-Host "Key loaded: $($env:TAURI_SIGNING_PRIVATE_KEY.Substring(0,50))..." -ForegroundColor Gray
Write-Host ""

pnpm tauri build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "Build complete! Checking for signature files..." -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

Set-Location "src-tauri\target\release\bundle\msi"

$sigFiles = Get-ChildItem "*.sig"
if ($sigFiles.Count -eq 0) {
    Write-Host "WARNING: No .sig files found! Signing may have failed." -ForegroundColor Red
    Write-Host "Key was: $env:TAURI_SIGNING_PRIVATE_KEY" -ForegroundColor Yellow
} else {
    foreach ($sigFile in $sigFiles) {
        Write-Host "Signature file found: $($sigFile.Name)" -ForegroundColor Green
        Write-Host ""
        Write-Host "Signature content:" -ForegroundColor Cyan
        Write-Host "================================================" -ForegroundColor Cyan
        $signature = Get-Content $sigFile.FullName
        Write-Host $signature -ForegroundColor White
        Write-Host "================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Copy the signature above and paste it into latest.json" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Files to upload to GitHub:" -ForegroundColor Yellow
Get-ChildItem "student-invoice-tauri_${Version}_x64_en-US.msi*" | Format-Table Name, Length

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Copy the signature from above" -ForegroundColor White
Write-Host "2. Update latest.json with the signature" -ForegroundColor White
Write-Host "3. Upload MSI, SIG, and latest.json to GitHub release v$Version" -ForegroundColor White
Write-Host ""

