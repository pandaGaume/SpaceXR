param(
    [string]$MarkerPath = "F:\LunarData\work\shackleton-job.lock",
    [string]$LogPath = "F:\LunarData\reports\shackleton-awake.log"
)

Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class LunarPowerState {
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern uint SetThreadExecutionState(uint flags);
}
'@

$until = (Get-Date).AddHours(12)
while (-not (Test-Path -LiteralPath $MarkerPath) -and (Get-Date) -lt $until) {
    Start-Sleep -Seconds 2
}
if (-not (Test-Path -LiteralPath $MarkerPath)) { exit 2 }

$continuous = [Convert]::ToUInt32("2147483648")
$systemRequired = [Convert]::ToUInt32("2147483649")
$active = [LunarPowerState]::SetThreadExecutionState($systemRequired)
if ($active -eq 0) {
    Add-Content -LiteralPath $LogPath -Value "$(Get-Date -Format o) failed to prevent system sleep"
    exit 1
}
Add-Content -LiteralPath $LogPath -Value "$(Get-Date -Format o) system sleep prevention active"
try {
    while (Test-Path -LiteralPath $MarkerPath) {
        Start-Sleep -Seconds 5
    }
} finally {
    $cleared = [LunarPowerState]::SetThreadExecutionState($continuous)
    Add-Content -LiteralPath $LogPath -Value "$(Get-Date -Format o) system sleep prevention cleared ($cleared)"
}
