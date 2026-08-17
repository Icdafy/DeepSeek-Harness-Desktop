[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$distDirectory = Join-Path $repositoryRoot 'dist'
$setup = @(Get-ChildItem -LiteralPath $distDirectory -Filter 'DeepSeek-Harness-Desktop-Setup-*.exe' -File)
$portable = @(Get-ChildItem -LiteralPath $distDirectory -Filter 'DeepSeek-Harness-Desktop-Portable-*.exe' -File)

if ($setup.Count -ne 1) {
    throw "Expected exactly one NSIS installer, found $($setup.Count)"
}
if ($portable.Count -ne 1) {
    throw "Expected exactly one portable executable, found $($portable.Count)"
}

foreach ($artifact in @($setup[0], $portable[0])) {
    if ($artifact.Length -lt 50MB) {
        throw "$($artifact.Name) is unexpectedly small: $($artifact.Length) bytes"
    }
    $stream = [IO.File]::OpenRead($artifact.FullName)
    try {
        if ($stream.ReadByte() -ne 0x4D -or $stream.ReadByte() -ne 0x5A) {
            throw "$($artifact.Name) is not a Windows PE executable"
        }
    }
    finally {
        $stream.Dispose()
    }
}

$stdoutPath = Join-Path $distDirectory 'portable-smoke.stdout.log'
$stderrPath = Join-Path $distDirectory 'portable-smoke.stderr.log'
$resultPath = Join-Path $distDirectory 'portable-smoke.result.txt'
Remove-Item -LiteralPath $stdoutPath, $stderrPath, $resultPath -Force -ErrorAction SilentlyContinue

$env:DSH_DESKTOP_SMOKE_TEST = '1'
$env:DSH_DESKTOP_SMOKE_RESULT = $resultPath
try {
    $process = Start-Process -FilePath $portable[0].FullName -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
    $deadline = [DateTime]::UtcNow.AddSeconds(180)
    while (-not (Test-Path -LiteralPath $resultPath) -and [DateTime]::UtcNow -lt $deadline) {
        Start-Sleep -Milliseconds 250
    }
}
finally {
    Remove-Item Env:DSH_DESKTOP_SMOKE_TEST -ErrorAction SilentlyContinue
    Remove-Item Env:DSH_DESKTOP_SMOKE_RESULT -ErrorAction SilentlyContinue
}

$process.WaitForExit(10000) | Out-Null
$process.Refresh()
$stdout = Get-Content -LiteralPath $stdoutPath -Raw -ErrorAction SilentlyContinue
$stderr = Get-Content -LiteralPath $stderrPath -Raw -ErrorAction SilentlyContinue
$result = Get-Content -LiteralPath $resultPath -Raw -ErrorAction SilentlyContinue

if ($result -notmatch '^OK 0\.0\.1 http://127\.0\.0\.1:\d+') {
    throw "Portable smoke test failed.`nRESULT:`n$result`nSTDOUT:`n$stdout`nSTDERR:`n$stderr"
}

Remove-Item -LiteralPath $stdoutPath, $stderrPath, $resultPath -Force -ErrorAction SilentlyContinue
Write-Host "Verified installer and portable executable; portable smoke test passed."
