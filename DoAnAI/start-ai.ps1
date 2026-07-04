param(
    [int]$Port = 5000
)

$env:AI_PORT = $Port
$python = Join-Path $PSScriptRoot 'venv\Scripts\python.exe'
$application = Join-Path $PSScriptRoot 'app.py'

if (-not (Test-Path -LiteralPath $python)) {
    throw "Không tìm thấy Python virtual environment tại: $python"
}

Write-Host "Đang khởi động JDM AI tại http://127.0.0.1:$Port ..."
& $python $application
