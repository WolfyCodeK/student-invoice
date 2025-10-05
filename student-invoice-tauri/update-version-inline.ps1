param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

# Update package.json
$json = Get-Content 'package.json' | ConvertFrom-Json
$json.version = $Version
$json | ConvertTo-Json -Depth 10 | Set-Content 'package.json'

# Update Cargo.toml
$lines = Get-Content 'src-tauri\Cargo.toml'
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match '^version = ') {
        $lines[$i] = "version = `"$Version`""
    }
}
$lines | Set-Content 'src-tauri\Cargo.toml'

# Update tauri.conf.json
$content = Get-Content 'src-tauri\tauri.conf.json' -Raw
$content -replace '"version":\s*"[^"]*"', "`"version`": `"$Version`"," | Set-Content 'src-tauri\tauri.conf.json'

Write-Host "Version updated to $Version in all files."
