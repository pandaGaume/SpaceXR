$ErrorActionPreference = 'Stop'
$manifestPath = Join-Path $PSScriptRoot 'decision-deploy.json'
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
foreach ($entry in $manifest.files) {
    $destinationPath = [System.IO.Path]::GetFullPath($entry.destination)
    $withinRoot = $false
    foreach ($rootPath in $manifest.roots) {
        $rootPrefix = [System.IO.Path]::GetFullPath($rootPath).TrimEnd('\') + '\'
        if ($destinationPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) { $withinRoot = $true }
    }
    if (-not $withinRoot) { throw "Destination outside authorized repositories: $destinationPath" }
    $currentHash = if (Test-Path -LiteralPath $destinationPath) { (Get-FileHash -Algorithm SHA256 -LiteralPath $destinationPath).Hash.ToLowerInvariant() } else { $null }
    if ($currentHash -ne $entry.before) { throw "Destination changed since preparation: $destinationPath" }
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $entry.source).Hash.ToLowerInvariant() -ne $entry.after) { throw "Prepared source changed: $($entry.source)" }
}
foreach ($entry in $manifest.files) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $entry.destination) -Force | Out-Null
    Copy-Item -LiteralPath $entry.source -Destination $entry.destination
}
Write-Output "Applied $($manifest.files.Count) reviewed files to the harness and Core repositories."
