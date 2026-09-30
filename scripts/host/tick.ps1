# The desk's clock on this PC: one scan cycle.
#
# Run every 5 minutes by the "Desk scan" scheduled task (see install.ps1),
# replacing cron-job.org. Calls /api/tick on the local server with the secret
# from desk.env and waits for the cycle to finish (?wait=1), so tick.log
# shows how each cycle went.

$live = Split-Path $PSScriptRoot -Parent
$log = Join-Path $live 'logs\tick.log'
if ((Test-Path $log) -and (Get-Item $log).Length -gt 5MB) { Move-Item $log "$log.old" -Force }

$secret = (Get-Content (Join-Path $live 'desk.env') | Where-Object { $_ -match '^DESK_TICK_SECRET=' }) -replace '^DESK_TICK_SECRET=', ''
$out = & curl.exe -s -m 580 -w " [HTTP %{http_code}]" -H "Authorization: Bearer $secret" "http://127.0.0.1:3000/api/tick?wait=1" 2>&1
$line = (($out | Out-String) -replace '\s+', ' ').Trim()
Add-Content $log "$(Get-Date -Format s) $($line.Substring(0, [Math]::Min(400, $line.Length)))"
