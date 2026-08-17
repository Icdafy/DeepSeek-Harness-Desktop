[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$distDirectory = Join-Path $repositoryRoot 'dist'
$checksumPath = Join-Path $distDirectory 'SHA256SUMS.txt'

function Get-Sha256 {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    $stream = [IO.File]::OpenRead($Path)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = $algorithm.ComputeHash($stream)
        return (([BitConverter]::ToString($bytes) -replace '-', '').ToLowerInvariant())
    }
    finally {
        $algorithm.Dispose()
        $stream.Dispose()
    }
}

$artifacts = Get-ChildItem -LiteralPath $distDirectory -File | Where-Object {
    $_.Name -match '^DeepSeek-Harness-(Setup|Portable)-.*\.exe$'
} | Sort-Object Name

if ($artifacts.Count -ne 2) {
    throw "Expected exactly two release executables in $distDirectory, found $($artifacts.Count)"
}

$lines = foreach ($artifact in $artifacts) {
    $hash = Get-Sha256 -Path $artifact.FullName
    "$hash *$($artifact.Name)"
}

[IO.File]::WriteAllLines($checksumPath, [string[]] $lines, [Text.UTF8Encoding]::new($false))
Write-Host "Wrote $($artifacts.Count) checksums to $checksumPath"
