# enter-session.ps1 — start a SHOS session: isolated worktree, heartbeat, and the pool list.
# Keeps SHOS_SESSION_ID in your shell when dot-sourced:
#   . .\scripts\enter-session.ps1 <name>
#
# The session gets its own git worktree under ~/.shos-session-bus/<name>/work so
# two sessions never edit the same checkout. The pool list is printed from the
# worktree, so the work you see is the work actually available.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$')]
    [string]$SessionName,

    # Skip the worktree and work in the shared checkout (not recommended).
    [switch]$NoWorktree
)

$ErrorActionPreference = 'Stop'

if (-not $env:SHOS_WORKSPACE) { $env:SHOS_WORKSPACE = 'C:\Users\kanem\SHOS-V2' }
Set-Location $env:SHOS_WORKSPACE
if (-not (Test-Path '.git')) { throw "Not a git repository at $PWD" }

# 1. Set the session identifier in the environment.
$env:SHOS_SESSION_ID = $SessionName

# 2. Build the session directories.
$busRoot  = Join-Path $env:USERPROFILE '.shos-session-bus'
$stateDir = Join-Path (Join-Path $busRoot $SessionName) 'state'
$workDir  = Join-Path (Join-Path $busRoot $SessionName) 'work'
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null

# 3. Create an isolated git worktree. git creates the path itself, so we do not
#    pre-create it. An existing valid worktree is reused rather than rebuilt.
if (-not $NoWorktree -and -not (Test-Path $workDir)) {
    # git writes "Preparing worktree" to stderr even on success; temporarily
    # relax the strict error action so that stderr does not abort the script.
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    git worktree add --detach $workDir HEAD 2>&1 | Out-Null
    $gitExit = $LASTEXITCODE
    $ErrorActionPreference = $prevEAP
    if ($gitExit -ne 0) { throw "git worktree add failed (exit $gitExit)" }
}

# 4. Write a heartbeat file so CI can tell a live session from an abandoned one.
$heartbeatPath = Join-Path $stateDir 'heartbeat.json'
$heartbeat = [ordered]@{
    sessionId = $SessionName
    timestamp = (Get-Date).ToString('o')
}
Set-Content -LiteralPath $heartbeatPath -Value ($heartbeat | ConvertTo-Json -Compress) -Encoding utf8

Write-Host "session '$SessionName' is ready"
Write-Host "  SHOS_SESSION_ID = $SessionName"
Write-Host "  state           = $stateDir"
if ($NoWorktree) { Write-Host "  worktree        = (shared checkout)" } else { Write-Host "  worktree        = $workDir" }
Write-Host "  heartbeat       = $heartbeatPath"

# 5. Enter the worktree and show the approved work pool.
if (-not $NoWorktree) { Set-Location $workDir }
Write-Host "--- pool list ---"
node scripts\session-bridge.mjs pool list
