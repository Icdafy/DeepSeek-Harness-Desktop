[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$runtimeDirectory = Join-Path $repositoryRoot '.runtime'
$nodeExecutable = Join-Path $runtimeDirectory 'node.exe'
$buildDirectory = Join-Path $repositoryRoot 'build'
$cacheDirectory = Join-Path $buildDirectory 'cache'
$deployDirectory = Join-Path $buildDirectory 'runtime'
$nodeVersion = '24.14.0'
$nodeArchive = "node-v$nodeVersion-win-x64.zip"
$nodeBaseUrl = "https://nodejs.org/dist/v$nodeVersion"

function Assert-ChildPath {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Candidate,
        [Parameter(Mandatory = $true)]
        [string] $Parent
    )

    $resolvedCandidate = [IO.Path]::GetFullPath($Candidate)
    $resolvedParent = [IO.Path]::GetFullPath($Parent).TrimEnd([IO.Path]::DirectorySeparatorChar)
    if (-not $resolvedCandidate.StartsWith("$resolvedParent$([IO.Path]::DirectorySeparatorChar)", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to modify a path outside $resolvedParent`: $resolvedCandidate"
    }
    return $resolvedCandidate
}

function Remove-SafeTree {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Candidate,
        [Parameter(Mandatory = $true)]
        [string] $Parent
    )

    $validatedPath = Assert-ChildPath -Candidate $Candidate -Parent $Parent
    if (Test-Path -LiteralPath $validatedPath) {
        $extendedPath = if ($validatedPath.StartsWith('\\?\')) { $validatedPath } else { "\\?\$validatedPath" }
        Remove-Item -LiteralPath $extendedPath -Recurse -Force
    }
}

function Get-Sha256 {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    $stream = [IO.File]::OpenRead($Path)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = $algorithm.ComputeHash($stream)
        return ([BitConverter]::ToString($bytes) -replace '-', '')
    }
    finally {
        $algorithm.Dispose()
        $stream.Dispose()
    }
}

New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $cacheDirectory -Force | Out-Null

if (-not (Test-Path -LiteralPath $nodeExecutable -PathType Leaf)) {
    $archivePath = Join-Path $cacheDirectory $nodeArchive
    $checksumsPath = Join-Path $cacheDirectory 'SHASUMS256.txt'
    Write-Host "Downloading Node.js v$nodeVersion runtime..."
    Invoke-WebRequest -Uri "$nodeBaseUrl/$nodeArchive" -OutFile $archivePath
    Invoke-WebRequest -Uri "$nodeBaseUrl/SHASUMS256.txt" -OutFile $checksumsPath

    $checksumLine = Get-Content -LiteralPath $checksumsPath | Where-Object { $_ -match "\s+$([regex]::Escape($nodeArchive))$" } | Select-Object -First 1
    if (-not $checksumLine) {
        throw "Node.js checksum entry was not found for $nodeArchive"
    }

    $expectedHash = ($checksumLine -split '\s+')[0].ToUpperInvariant()
    $actualHash = (Get-Sha256 -Path $archivePath).ToUpperInvariant()
    if ($actualHash -ne $expectedHash) {
        throw "Node.js archive checksum mismatch. Expected $expectedHash, received $actualHash"
    }

    $extractDirectory = Assert-ChildPath -Candidate (Join-Path $cacheDirectory 'node-extracted') -Parent $buildDirectory
    Remove-SafeTree -Candidate $extractDirectory -Parent $buildDirectory
    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractDirectory -Force
    $downloadedNode = Join-Path $extractDirectory "node-v$nodeVersion-win-x64\node.exe"
    if (-not (Test-Path -LiteralPath $downloadedNode -PathType Leaf)) {
        throw "Downloaded Node.js archive did not contain node.exe"
    }
    Copy-Item -LiteralPath $downloadedNode -Destination $nodeExecutable -Force
}

$nodeReportedVersion = (& $nodeExecutable --version).Trim()
if ($nodeReportedVersion -ne "v$nodeVersion") {
    throw "Expected Node.js v$nodeVersion, found $nodeReportedVersion at $nodeExecutable"
}

$deployDirectory = Assert-ChildPath -Candidate $deployDirectory -Parent $buildDirectory
Remove-SafeTree -Candidate $deployDirectory -Parent $buildDirectory

$pnpmCommand = Join-Path $repositoryRoot 'node_modules\.bin\pnpm.CMD'
if (-not (Test-Path -LiteralPath $pnpmCommand -PathType Leaf)) {
    throw 'pnpm is not installed. Run pnpm install before preparing the runtime.'
}

$env:Path = "$runtimeDirectory;$(Join-Path $repositoryRoot 'node_modules\.bin');$env:Path"
Push-Location -LiteralPath $repositoryRoot
try {
    & $pnpmCommand --filter '@deepseek-harness/desktop-runtime' deploy --prod $deployDirectory
    if ($LASTEXITCODE -ne 0) {
        throw "pnpm deploy failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}

$deployedDsh = Join-Path $deployDirectory 'node_modules\@deepseek-ai\dsh\lib\bin.js'
$deployedPnpm = Join-Path $deployDirectory 'node_modules\.bin\pnpm.CMD'
if (-not (Test-Path -LiteralPath $deployedDsh -PathType Leaf)) {
    throw "The deployed runtime is missing DeepSeek Harness: $deployedDsh"
}
if (-not (Test-Path -LiteralPath $deployedPnpm -PathType Leaf)) {
    throw "The deployed runtime is missing pnpm: $deployedPnpm"
}

$runtimeLinks = @(Get-ChildItem -LiteralPath $deployDirectory -Recurse -Force -Attributes ReparsePoint -ErrorAction SilentlyContinue)
if ($runtimeLinks.Count -ne 0) {
    $examples = ($runtimeLinks | Select-Object -First 3 -ExpandProperty FullName) -join ', '
    throw "The deployed runtime contains non-portable filesystem links: $examples"
}

Write-Host "Runtime ready: Node.js $nodeReportedVersion, DeepSeek Harness 0.1.0-rc.6"
