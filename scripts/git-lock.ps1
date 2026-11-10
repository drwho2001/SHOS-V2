# git-lock.ps1 — wrap git commit with a short mutex so two sessions cannot commit at the same instant.
#
# This is NOT a fair lock, just a mutual-exclusion flag. It does not guarantee order between
# sessions; git's own locking covers the merge. The purpose is only to stop the two sessions
# pushing overlapping-index work at the exact same moment.
#
# Usage:  powershell -File git-lock.ps1 commit [git args...]

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Command,

    [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$ErrorActionPreference = 'Stop'
if (-not $env:SHOS_WORKSPACE) { $env:SHOS_WORKSPACE = 'C:\Users\kanem\SHOS-V2' }
Set-Location $env:SHOS_WORKSPACE

$LockFile = Join-Path $env:TEMP 'shos-commit.lock'

# Obtain exclusive lock or bail quickly. Leave the lock file in place if someone else holds it.
$lockFd = $null
try {
    $lockFd = [System.IO.File]::Open($LockFile, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
} catch [System.IO.IOException] {
    $ageSec = [math]::Round(((Get-Date) - [System.IO.File]::GetLastWriteTime($LockFile)).TotalSeconds)
    if ($ageSec -gt 120) {
        # A session whose process died >2 minutes ago holding this file can no longer be doing anything.
        try { [System.IO.File]::Delete($LockFile) } catch {}
        try { $lockFd = [System.IO.File]::Open($LockFile, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None) } catch {}
    }
    if ($null -eq $lockFd) {
        Write-Host "another session is already committing; exiting."
        exit 9000
    }
}

try {
    if ($Command -eq 'commit') {
        if ($Args) { git commit @Args | Out-Null } else { Write-Host "nothing to commit (no arguments given)" }
        exit $LASTEXITCODE
    } elseif ($Command -eq 'status') {
        git status --short
        exit 0
    } else {
        Write-Host "usage: git-lock.ps1 commit [git args...] | git-lock.ps1 status"
        exit 2
    }
} finally {
    try { $lockFd.Dispose() } catch {}
    try { [System.IO.File]::Delete($LockFile) } catch {}
}
