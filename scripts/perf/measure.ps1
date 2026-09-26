# Measures time-to-usable-UI, memory and idle CPU of a built app.
# See docs/performance.md. Build the test copy first (it uses its own
# identifier, so it never reads or upgrades real user data):
#   cd app; pnpm tauri build --no-bundle --config ../scripts/perf/perftest.conf.json
# Then:
#   powershell -File scripts/perf/measure.ps1 [-Runs 3]
param(
  [string]$Exe = (Join-Path $PSScriptRoot '..\..\app\src-tauri\target\release\student-invoice-tauri.exe'),
  [int]$Runs = 3
)
$ErrorActionPreference = 'Stop'

function Get-ProcessTree([int]$rootId) {
  $all = Get-CimInstance Win32_Process
  $ids = @($rootId); $frontier = @($rootId)
  while ($frontier.Count) {
    $next = @($all | Where-Object { $frontier -contains $_.ParentProcessId } | ForEach-Object { $_.ProcessId })
    $ids += $next; $frontier = $next
  }
  $ids | Select-Object -Unique
}

$results = @()
for ($i = 1; $i -le $Runs; $i++) {
  $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9229'
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $p = Start-Process -FilePath $Exe -PassThru
  $usable = $null
  # "Usable" = the register is on screen: its grid, or the empty state when
  # there are no families yet (read via DevTools, no injection).
  while ($sw.Elapsed.TotalSeconds -lt 30 -and -not $usable) {
    try {
      $pages = Invoke-RestMethod http://127.0.0.1:9229/json -TimeoutSec 1 | Where-Object { $_.type -eq 'page' -and $_.url -like 'http://tauri.localhost*' }
      if ($pages) {
        $ws = New-Object System.Net.WebSockets.ClientWebSocket
        $ws.ConnectAsync([Uri]$pages[0].webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
        $msg = [Text.Encoding]::UTF8.GetBytes('{"id":1,"method":"Runtime.evaluate","params":{"expression":"document.querySelector(''section[aria-label=Register] :is([role=table], h2)'') !== null","returnByValue":true}}')
        $ws.SendAsync([ArraySegment[byte]]$msg, 'Text', $true, [Threading.CancellationToken]::None).Wait()
        $buf = New-Object byte[] 4096
        $r = $ws.ReceiveAsync([ArraySegment[byte]]$buf, [Threading.CancellationToken]::None).Result
        if ([Text.Encoding]::UTF8.GetString($buf, 0, $r.Count) -match '"value":true') { $usable = $sw.ElapsedMilliseconds }
        $ws.Dispose()
      }
    } catch { }
    if (-not $usable) { Start-Sleep -Milliseconds 50 }
  }
  Start-Sleep -Seconds 5
  $tree = Get-ProcessTree $p.Id
  $procs = Get-Process -Id $tree -ErrorAction SilentlyContinue
  $cpu1 = ($procs | Measure-Object -Property CPU -Sum).Sum
  Start-Sleep -Seconds 10
  $procs = Get-Process -Id $tree -ErrorAction SilentlyContinue
  $cpu2 = ($procs | Measure-Object -Property CPU -Sum).Sum
  $results += [pscustomobject]@{
    Run = $i
    UsableMs = $usable
    Processes = $procs.Count
    PrivateMB = [math]::Round(($procs | Measure-Object PrivateMemorySize64 -Sum).Sum / 1MB, 1)
    IdleCpuSecPer10s = [math]::Round($cpu2 - $cpu1, 3)
  }
  $procs | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}
Remove-Item Env:\WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS -ErrorAction SilentlyContinue
$results | Format-Table -AutoSize
