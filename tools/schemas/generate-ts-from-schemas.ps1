param (
    [string]$SourceDir,
    [string]$OutputDir
)

if (-not $SourceDir -or -not $OutputDir) {
    Write-Host "Usage: .\generate-ts-from-schemas.ps1 <sourceDir> <outputDir>"
    exit 1
}

$schemaFiles = Get-ChildItem -Path $SourceDir -Recurse -Filter *.schema.json

foreach ($file in $schemaFiles) {
    $relativePath = $file.FullName.Substring($SourceDir.Length).TrimStart('\', '/')
    $targetPath = Join-Path $OutputDir ($relativePath -replace '\.schema\.json$', '.ts')
    $targetDir = Split-Path $targetPath

    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }

    Write-Host "Generating: $targetPath"

    Push-Location $file.DirectoryName
    json2ts -i $file.Name -o $targetPath
    Pop-Location
}

Write-Host "`n✅ All done."
