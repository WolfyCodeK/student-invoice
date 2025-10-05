# Find certificate thumbprint for code signing
# Run this after installing your code signing certificate

Write-Host "Finding code signing certificates..."
Get-ChildItem -Path Cert:\CurrentUser\My -CodeSigningCert | Format-Table Subject, Thumbprint, NotAfter

Write-Host "`nCopy the thumbprint (without spaces) and update tauri.conf.json:"
Write-Host '"certificateThumbprint": "YOUR_THUMBPRINT_HERE"'
