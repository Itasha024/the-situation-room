# One-time setup of the live desk on this PC.
#
# Creates three scheduled tasks for the current Windows user, started when
# that user signs in and run with no window (conhost --headless):
#   Desk server  - keeps the site running          (run-server.ps1)
#   Desk tunnel  - keeps the Cloudflare link up    (run-tunnel.ps1)
#   Desk scan    - every 5 minutes: one scan cycle (tick.ps1)
# "Desk scan" is created DISABLED: the first scan writes to the live
# database, so it is switched on by hand once the site is checked.
#
# Why "at sign-in" and not "at boot": a boot task runs with no one signed in
# (S4U logon), which Windows leaves stuck in "Queued" for a Microsoft-account
# user. So the PC must sign in after a restart — Windows does that on its own
# after updates when "Use my sign-in info to automatically finish setting up"
# is on.
#
# Run it as Administrator only if older Desk tasks from an earlier setup
# exist (removing those needs it); otherwise a normal PowerShell is enough.
# Expects $live (default %USERPROFILE%\desk-live) to hold desk.env, and a
# first release put there by `npm run deploy`.

param([string]$live = (Join-Path $env:USERPROFILE 'desk-live'))

$ErrorActionPreference = 'Stop'
$bin = Join-Path $live 'bin'
if (-not (Test-Path (Join-Path $live 'desk.env'))) { throw "No desk.env in $live" }
if (-not (Test-Path (Join-Path $live 'current.txt'))) { throw "No release yet: run 'npm run deploy' first" }
New-Item -ItemType Directory -Force $bin, (Join-Path $live 'logs') | Out-Null
Copy-Item (Join-Path $PSScriptRoot '*.ps1') $bin -Force
Set-Content (Join-Path $live 'node-path.txt') (Get-Command node).Source

Get-ScheduledTask -TaskName 'Desk *' -ErrorAction SilentlyContinue | ForEach-Object {
  Stop-ScheduledTask -InputObject $_ -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -InputObject $_ -Confirm:$false
}

$user = "$env:USERDOMAIN\$env:USERNAME"
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$forever = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
$short = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew

function Action($script) {
  New-ScheduledTaskAction -Execute 'conhost.exe' `
    -Argument "--headless powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$bin\$script`"" `
    -WorkingDirectory $live
}

$signIn = New-ScheduledTaskTrigger -AtLogOn -User $user
Register-ScheduledTask -TaskName 'Desk server' -Action (Action 'run-server.ps1') -Trigger $signIn `
  -Principal $principal -Settings $forever -Force | Out-Null
Register-ScheduledTask -TaskName 'Desk tunnel' -Action (Action 'run-tunnel.ps1') -Trigger $signIn `
  -Principal $principal -Settings $forever -Force | Out-Null

# On the round five minutes (:00, :05, :10 …).
$now = Get-Date
$next = $now.Date.AddHours($now.Hour).AddMinutes(([Math]::Floor($now.Minute / 5) + 1) * 5)
$every5 = New-ScheduledTaskTrigger -Once -At $next -RepetitionInterval (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName 'Desk scan' -Action (Action 'tick.ps1') -Trigger $every5 `
  -Principal $principal -Settings $short -Force | Out-Null
Disable-ScheduledTask -TaskName 'Desk scan' | Out-Null

Start-ScheduledTask -TaskName 'Desk server'
if (Test-Path (Join-Path $live 'tunnel.yml')) { Start-ScheduledTask -TaskName 'Desk tunnel' }

Get-ScheduledTask -TaskName 'Desk *' | Format-Table TaskName, State -AutoSize
Write-Host "Done. The server runs now and at every sign-in. 'Desk scan' stays off until switched on."
