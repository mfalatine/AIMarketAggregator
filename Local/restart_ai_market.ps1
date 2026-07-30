# AI Market Aggregator pre-launch helper, following DAI's focus_dai.ps1 pattern.
# Free port 4173 by killing the old server and its entire child process tree so
# a second BAT launch always replaces the first server with the current code.
$listeners = @(Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue)
foreach ($listener in $listeners) {
    try {
        & "$env:SystemRoot\System32\taskkill.exe" /PID $listener.OwningProcess /T /F 2>$null | Out-Null
    } catch {}
}

# Do not start the replacement until Windows confirms that the old listener is gone.
foreach ($attempt in 1..20) {
    if (-not (Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue)) {
        exit 0
    }
    Start-Sleep -Milliseconds 250
}

exit 1
