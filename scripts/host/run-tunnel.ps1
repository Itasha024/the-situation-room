# Keeps the Cloudflare Tunnel up, so the public address reaches this PC.
#
# Started at boot by the "Desk tunnel" scheduled task (see install.ps1). The
# tunnel only dials out to Cloudflare; no port on this PC is opened.

$live = Split-Path $PSScriptRoot -Parent
$logs = Join-Path $live 'logs'
New-Item -ItemType Directory -Force $logs | Out-Null
$cf = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$config = Join-Path $live 'tunnel.yml'
$log = Join-Path $logs 'tunnel.log'

while ($true) {
  if ((Test-Path $log) -and (Get-Item $log).Length -gt 10MB) { Move-Item $log "$log.old" -Force }
  & $cf tunnel --config $config --logfile $log --loglevel warn run
  Start-Sleep -Seconds 10
}
