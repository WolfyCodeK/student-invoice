param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Student Invoice - Automated Signed Release" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Creating release version $Version" -ForegroundColor Yellow
Write-Host ""

# Change to student-invoice-tauri directory
Set-Location "$PSScriptRoot\student-invoice-tauri"

# Update version numbers
Write-Host "Updating version numbers..." -ForegroundColor Yellow
$packageJson = Get-Content 'package.json' | ConvertFrom-Json
$packageJson.version = $Version
$packageJson | ConvertTo-Json -Depth 10 | Set-Content 'package.json'

# Update Cargo.toml (only the first version line - the package version)
$cargoContent = Get-Content 'src-tauri\Cargo.toml'
$updated = $false
$cargoContent = $cargoContent | ForEach-Object {
    if (-not $updated -and $_ -match '^\s*version\s*=\s*"[^"]+"') {
        $updated = $true
        "version = `"$Version`""
    } else {
        $_
    }
}
$cargoContent | Set-Content 'src-tauri\Cargo.toml'

# Update tauri.conf.json
$tauriConf = Get-Content 'src-tauri\tauri.conf.json' | ConvertFrom-Json
$tauriConf.version = $Version
$tauriConf | ConvertTo-Json -Depth 10 | Set-Content 'src-tauri\tauri.conf.json'

Write-Host ""
Write-Host "Setting up signing..." -ForegroundColor Yellow
$keyContent = Get-Content 'myapp.key' -Raw
$env:TAURI_SIGNING_PRIVATE_KEY = $keyContent.Trim()
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "tauri"

Write-Host "Building application..." -ForegroundColor Yellow
Write-Host ""

pnpm tauri build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "Build complete! Now signing the MSI..." -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

$msiPath = "src-tauri\target\release\bundle\msi\Student Invoice_${Version}_x64_en-US.msi"
$sigPath = "$msiPath.sig"

# Check if MSI exists
if (-not (Test-Path $msiPath)) {
    Write-Host "ERROR: MSI file not found at $msiPath" -ForegroundColor Red
    exit 1
}

# Sign the MSI manually
Write-Host "Signing MSI file..." -ForegroundColor Yellow
$keyContent = Get-Content 'myapp.key' -Raw
pnpm tauri signer sign $msiPath --private-key "$keyContent" --password "tauri"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Signing failed!" -ForegroundColor Red
    exit 1
}

$signature = Get-Content $sigPath
Write-Host "Signature found:" -ForegroundColor Green
Write-Host $signature -ForegroundColor White
Write-Host ""

# Update latest.json with real signature
Write-Host "Updating latest.json with signature..." -ForegroundColor Yellow
try {
    Write-Host "Creating JSON manually..." -ForegroundColor Gray
    
    # Create JSON manually to avoid ConvertTo-Json hanging on large strings
    $jsonContent = @"
{
  "version": "$Version",
  "notes": "Student Invoice $Version",
  "pub_date": "$(Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")",
  "platforms": {
    "windows-x86_64": {
      "signature": "$signature",
      "url": "https://github.com/WolfyCodeK/student-invoice/releases/download/v$Version/Student.Invoice_${Version}_x64_en-US.msi"
    }
  }
}
"@
    
    Write-Host "Writing to file..." -ForegroundColor Gray
    # Write without BOM to avoid JSON parsing issues
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) 'latest.json'), $jsonContent, [System.Text.UTF8Encoding]::new($false))
    
    Write-Host "latest.json updated successfully!" -ForegroundColor Green
} catch {
    Write-Host "Error updating latest.json: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Return to root directory
Set-Location $PSScriptRoot

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Running git commands..." -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "git add ." -ForegroundColor Gray
git add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Git add failed!" -ForegroundColor Red
    exit 1
}

Write-Host "git commit -m 'Bump version to $Version'" -ForegroundColor Gray
git commit -m "Bump version to $Version"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Git commit failed!" -ForegroundColor Red
    exit 1
}

Write-Host "git tag v$Version" -ForegroundColor Gray
git tag "v$Version"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Git tag failed!" -ForegroundColor Red
    exit 1
}

Write-Host "git push origin main" -ForegroundColor Gray
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Git push origin main failed!" -ForegroundColor Red
    exit 1
}

Write-Host "git push origin v$Version" -ForegroundColor Gray
git push origin "v$Version"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Git push tag failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "Creating GitHub Release..." -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

# Check if gh CLI is available
$ghAvailable = Get-Command gh -ErrorAction SilentlyContinue

if ($ghAvailable) {
    Write-Host "GitHub CLI found! Creating release automatically..." -ForegroundColor Yellow
    
    $msiFile = "student-invoice-tauri\src-tauri\target\release\bundle\msi\Student Invoice_${Version}_x64_en-US.msi"
    $sigFile = "$msiFile.sig"
    $latestFile = "student-invoice-tauri\latest.json"
    
    gh release create "v$Version" `
        --title "Student Invoice v$Version" `
        --notes "Automated signed release v$Version" `
        "$msiFile" `
        "$sigFile" `
        "$latestFile"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "================================================" -ForegroundColor Green
        Write-Host "RELEASE COMPLETED SUCCESSFULLY!" -ForegroundColor Green
        Write-Host "================================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Version $Version has been:" -ForegroundColor White
        Write-Host "  ✓ Built and signed" -ForegroundColor Green
        Write-Host "  ✓ Committed to git" -ForegroundColor Green
        Write-Host "  ✓ Tagged and pushed" -ForegroundColor Green
        Write-Host "  ✓ Released on GitHub with signed MSI" -ForegroundColor Green
        Write-Host ""
        Write-Host "Users can now update via 'Check for Updates' button!" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "View release: https://github.com/WolfyCodeK/student-invoice/releases/tag/v$Version" -ForegroundColor Blue
    } else {
        Write-Host "GitHub release creation failed!" -ForegroundColor Red
        Write-Host "You may need to create it manually." -ForegroundColor Yellow
    }
} else {
    Write-Host "GitHub CLI (gh) not found." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "MANUAL STEPS REQUIRED:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://github.com/WolfyCodeK/student-invoice/releases" -ForegroundColor White
    Write-Host "2. Click 'Create a new release'" -ForegroundColor White
    Write-Host "3. Choose tag: v$Version" -ForegroundColor White
    Write-Host "4. Title: Student Invoice v$Version" -ForegroundColor White
    Write-Host "5. Upload these files:" -ForegroundColor White
    Write-Host "   - student-invoice-tauri\src-tauri\target\release\bundle\msi\Student Invoice_${Version}_x64_en-US.msi" -ForegroundColor Gray
    Write-Host "   - student-invoice-tauri\src-tauri\target\release\bundle\msi\Student Invoice_${Version}_x64_en-US.msi.sig" -ForegroundColor Gray
    Write-Host "   - student-invoice-tauri\latest.json" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To install GitHub CLI and automate this: https://cli.github.com/" -ForegroundColor Blue
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan

