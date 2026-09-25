# Vite dev server auto-restart loop
# Runs on port 4096, accessible via Tailscale at http://100.70.202.12:4096

$port = 4096
$bindHost = "0.0.0.0"

Write-Host "Starting Vite dev server auto-restart loop on port $port..." -ForegroundColor Green

while ($true) {
    Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] Starting Vite dev server..." -ForegroundColor Cyan
    
    $process = Start-Process "npm" -ArgumentList "run dev -- --host $bindHost --port $port" -PassThru -Wait
    
    $exitCode = $process.ExitCode
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Vite process exited with code: $exitCode" -ForegroundColor Yellow
    
    if ($exitCode -eq 0) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Clean exit. Stopping restart loop." -ForegroundColor Green
        break
    }
    
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Restarting in 3 seconds... (Ctrl+C to stop)" -ForegroundColor Red
    Start-Sleep -Seconds 3
}

Write-Host "Dev server loop ended." -ForegroundColor Gray