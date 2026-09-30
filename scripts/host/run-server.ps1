# Keeps the live desk server running on this PC.
#
# Started at boot by the "Desk server" scheduled task (see install.ps1). Runs
# the release named in current.txt and starts it again 5 seconds after it
# stops, so `npm run deploy` switches releases just by stopping the process.

$live = Split-Path $PSScriptRoot -Parent
$logs = Join-Path $live 'logs'
New-Item -ItemType Directory -Force $logs | Out-Null
$node = (Get-Content (Join-Path $live 'node-path.txt') -Raw).Trim()
$log = Join-Path $logs 'server.log'

while ($true) {
  $release = (Get-Content (Join-Path $live 'current.txt') -Raw).Trim()
  foreach ($f in @($log, "$logs\server.out.log", "$logs\server.err.log")) {
    if ((Test-Path $f) -and (Get-Item $f).Length -gt 10MB) { Move-Item $f "$f.old" -Force }
  }
  Add-Content $log "$(Get-Date -Format s) starting $release"
  $p = Start-Process -FilePath $node `
    -ArgumentList @("--env-file=`"$live\desk.env`"", "`"$release\server\index.mjs`"") `
    -WorkingDirectory $release -NoNewWindow -PassThru `
    -RedirectStandardOutput "$logs\server.out.log" -RedirectStandardError "$logs\server.err.log"
  Set-Content (Join-Path $live 'server.pid') $p.Id
  $p.WaitForExit()
  Add-Content $log "$(Get-Date -Format s) stopped (exit $($p.ExitCode)); starting again in 5 s"
  Start-Sleep -Seconds 5
}
