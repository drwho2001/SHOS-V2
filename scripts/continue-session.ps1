# continue-session.ps1 — reattach to an existing session.
# Keeps SHOS_SESSION_ID in your shell when dot-sourced:
#   . .\scripts\continue-session.ps1 <name>
#
# The worktree created by enter-session.ps1 is what you resume; this script does
# NOT move, recreate or validate the checkout beyond checking it exists. The
# heartbeat freshness check is a warning only — the enforcement is
# scripts/check-heartbeat.js, which is what CI runs.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$')]
    [string]$SessionName
)

$ErrorActionPreference = 'Stop'
if (-not $env:SHOS_WORKSPACE) { $env:SHOS_WORKSPACE = 'C:\Users\kanem\SHOS-V2' }
Set-Location $env:SHOS_WORKSPACE

$busRoot  = Join-Path $env:USERPROFILE '.shos-session-bus'
$stateDir = Join-Path (Join-Path $busRoot $SessionName) 'state'
$workDir  = Join-Path (Join-Path $busRoot $SessionName) 'work'

if (-not (Test-Path $workDir)) {
    Write-Error "No session '$SessionName'. Run `. .\scripts\enter-session.ps1 $SessionName` first."
    exit 1
}

$env:SHOS_SESSION_ID = $SessionName
Set-Location $workDir

# Heartbeat freshness for the per-session heartbeat file.
$heartbeatPath = Join-Path $stateDir 'heartbeat.json'
if (Test-Path $heartbeatPath) {
    try {
        $hbRaw = Get-Content -LiteralPath $heartbeatPath -Raw
        $hb = $hbRaw | ConvertFrom-Json
        $hbTime = [datetime]::Parse($hb.timestamp, [cultureinfo]::InvariantCulture)
        $hbAgeSec = [math]::Round(((Get-Date) - $hbTime).TotalSeconds)
        if ($hbAgeSec -gt 300) {
            Write-Warning "Heartbeat for '$SessionName' is stale (${hbAgeSec}s). Re-enter with enter-session.ps1 to refresh it."
        }
        else {
            Write-Host "heartbeat fresh (${hbAgeSec}s ago)."
        }
    }
    catch {
        Write-Warning "Could not parse heartbeat.json: $($_.Exception.Message)"
    }
}
else {
    Write-Warning "No heartbeat.json for '$SessionName' in $stateDir."
}

Write-Host "Continuing session '$SessionName' in $PWD"
Write-Host "Run the pool list to see the live state: node scripts\session-bridge.mjs pool list"
