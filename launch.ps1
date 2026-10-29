param(
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$ui = Join-Path $here 'ui\index.html'

function Show-Error([string]$message) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        $message,
        'Servidor',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
}

if (-not (Test-Path -LiteralPath $ui)) {
    Show-Error "Fant ikke UI-filen:`n$ui"
    exit 1
}

if ($NoBrowser) {
    Write-Output $ui
    exit 0
}

$programFilesX86 = [Environment]::GetFolderPath('ProgramFilesX86')
$programFiles = [Environment]::GetFolderPath('ProgramFiles')
$edge = $null
foreach ($candidate in @(
    (Join-Path $programFilesX86 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $programFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe')
)) {
    if (Test-Path -LiteralPath $candidate) {
        $edge = $candidate
        break
    }
}

if (-not $edge) {
    Show-Error 'Fant ikke Microsoft Edge. Edge følger med Windows 11.'
    exit 1
}

try {
    $profile = Join-Path $env:LOCALAPPDATA 'ServidorDesktop\edge-profile'
    New-Item -ItemType Directory -Force -Path $profile | Out-Null

    $url = ([System.Uri]$ui).AbsoluteUri + '?shell=edge'
    $arguments = @(
        "--app=$url",
        '--window-size=1280,680',
        '--no-first-run',
        '--disable-features=msEdgeSidebarV2',
        ("--user-data-dir=" + $profile)
    )

    Start-Process -FilePath $edge -ArgumentList $arguments
} catch {
    Show-Error ("Servidor klarte ikke å starte:`n`n" + $_.Exception.Message)
    exit 1
}
