# Start the dev server loop hidden in background
# Creates a scheduled task that runs at startup/user logon and restarts on failure

$taskName = "SHOS-DevServer"
$scriptPath = "C:\Users\kanem\SHOS-V2\dev-server-loop.ps1"

# Delete existing task if it exists
try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
    Write-Host "Removed existing scheduled task" -ForegroundColor Yellow
} catch { }

# Create new task that runs at user logon and restarts on failure
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force

Write-Host "Created scheduled task: $taskName" -ForegroundColor Green
Write-Host "It will start automatically at logon and restart on failure." -ForegroundColor Cyan

# Also start it now in background
Start-Process powershell.exe -ArgumentList "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`"" -NoNewWindow

Write-Host "Started dev server now in background." -ForegroundColor Green