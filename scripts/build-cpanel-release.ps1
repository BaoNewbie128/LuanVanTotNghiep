param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\release-cpanel'),
    [switch]$SkipFrontendBuild
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outputPath = [IO.Path]::GetFullPath($OutputDirectory)

if (-not $outputPath.StartsWith($projectRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'OutputDirectory must stay inside the project workspace.'
}

if (Test-Path -LiteralPath $outputPath) {
    Remove-Item -LiteralPath $outputPath -Recurse -Force
}

if (-not $SkipFrontendBuild) {
    Push-Location (Join-Path $projectRoot 'frontend')
    try {
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) {
            throw 'Frontend build failed.'
        }
    }
    finally {
        Pop-Location
    }
}

$distSource = Join-Path $projectRoot 'frontend\dist'
if (-not (Test-Path -LiteralPath (Join-Path $distSource 'index.html'))) {
    throw 'frontend/dist is missing. Run npm run build first.'
}

[IO.Directory]::CreateDirectory($outputPath) | Out-Null
Copy-Item -LiteralPath $distSource -Destination (Join-Path $outputPath 'dist') -Recurse

$backendSource = Join-Path $projectRoot 'backend'
$backendTarget = Join-Path $outputPath 'backend'
$excludedBackendDirectories = @(
    (Join-Path $backendSource 'vendor'),
    (Join-Path $backendSource 'node_modules'),
    (Join-Path $backendSource '.git'),
    (Join-Path $backendSource 'tests'),
    (Join-Path $backendSource 'public\storage'),
    (Join-Path $backendSource 'public\uploads'),
    (Join-Path $backendSource 'public\images'),
    (Join-Path $backendSource 'storage\logs'),
    (Join-Path $backendSource 'storage\app\public'),
    (Join-Path $backendSource 'storage\framework\cache\data'),
    (Join-Path $backendSource 'storage\framework\sessions'),
    (Join-Path $backendSource 'storage\framework\testing'),
    (Join-Path $backendSource 'storage\framework\views'),
    (Join-Path $backendSource 'bootstrap\cache')
)
$robocopyResult = & robocopy $backendSource $backendTarget /E /XJ /NFL /NDL /NJH /NJS /NP `
    /XD $excludedBackendDirectories `
    /XF .env .phpunit.result.cache temp_fix_faq_support.php 'toJson()'
if ($LASTEXITCODE -gt 7) {
    throw "Backend copy failed with robocopy exit code $LASTEXITCODE."
}

$descriptionsTarget = Join-Path $backendTarget 'resources\ai-descriptions'
Copy-Item -LiteralPath (Join-Path $projectRoot 'DoAnAI\descriptions') -Destination $descriptionsTarget -Recurse

Copy-Item -LiteralPath (Join-Path $projectRoot 'deploy\cpanel\public-root\index.php') -Destination $outputPath
Copy-Item -LiteralPath (Join-Path $projectRoot 'deploy\cpanel\public-root\.htaccess') -Destination $outputPath
Copy-Item -LiteralPath (Join-Path $projectRoot 'deploy\cpanel\HUONG_DAN.txt') -Destination $outputPath
Copy-Item -LiteralPath (Join-Path $projectRoot 'deploy\cpanel\backend.env.example') -Destination (Join-Path $backendTarget '.env.cpanel.example')
[IO.Directory]::CreateDirectory((Join-Path $backendTarget 'storage\app\public')) | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'deploy\cpanel\storage.htaccess') -Destination (Join-Path $backendTarget 'storage\app\public\.htaccess')

foreach ($runtimeDirectory in @(
    'storage\logs',
    'storage\framework\cache\data',
    'storage\framework\sessions',
    'storage\framework\testing',
    'storage\framework\views',
    'bootstrap\cache'
)) {
    [IO.Directory]::CreateDirectory((Join-Path $backendTarget $runtimeDirectory)) | Out-Null
}

Write-Host "cPanel release created at: $outputPath"
Write-Host 'Upload all files inside that directory to /lvtnthanhbao.cnttstu.online.'

$archivePath = "$outputPath.zip"
if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
}

Push-Location $outputPath
try {
    & tar.exe -a -c -f $archivePath .
    if ($LASTEXITCODE -ne 0) {
        throw "Archive creation failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}
Write-Host "Upload archive created at: $archivePath"
