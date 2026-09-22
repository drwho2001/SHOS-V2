$taskName = "OpenCode Server"

$battery = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue
$onAC = $battery.PowerOnline -contains $true

if ($onAC) {
    # Back on mains: immediately ensure OpenCode Server is running.
    Start-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    exit
}

# On battery: wait 10 minutes before shutting OpenCode down.
Start-Sleep -Seconds 600

# Check power again after the grace period.
$battery = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue
$onAC = $battery.PowerOnline -contains $true

if (-not $onAC) {
    # Stop the scheduled task first so its restart policy cannot
    # immediately bring OpenCode back.
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    Get-Process opencode -ErrorAction SilentlyContinue |
        Stop-Process -Force -ErrorAction SilentlyContinue
}
