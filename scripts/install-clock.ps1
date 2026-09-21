# Install the desk's local clock: a Windows scheduled task that runs
# scripts/tick.mjs every five minutes, hidden, whether or not a browser, a dev
# server or a Claude session is open.
#
# It runs while you are signed in to Windows (a locked screen is fine). Running
# with nobody signed in would need your Windows password stored in the task,
# which this script deliberately does not ask for.
#
# Remove it with:  schtasks /Delete /TN "Yemen War Desk tick" /F
# Once the desk is deployed, the GitHub Action is the clock and this can go.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node).Source
$tick = Join-Path $root 'scripts\tick.mjs'
$launcher = Join-Path $root 'scripts\tick-hidden.vbs'

# wscript runs node with no console window, so nothing flashes every 5 minutes.
@"
CreateObject("WScript.Shell").Run """$node"" ""$tick""", 0, False
"@ | Set-Content -Path $launcher -Encoding ASCII

$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$launcher`"" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries `
  -AllowStartIfOnBatteries -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

Register-ScheduledTask -TaskName 'Yemen War Desk tick' -Action $action -Trigger $trigger `
  -Settings $settings -Description 'Runs one Yemen War Desk scan cycle (scripts/tick.mjs).' -Force | Out-Null

Get-ScheduledTask -TaskName 'Yemen War Desk tick' | Select-Object TaskName, State
