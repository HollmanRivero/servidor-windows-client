# Lager en snarvei til Servidor på skrivebordet.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$target = Join-Path $desktop 'Servidor.lnk'

$lnk = $ws.CreateShortcut($target)
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$launcher = Join-Path $here 'launch.ps1'
$lnk.TargetPath = $powershell
$lnk.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $launcher + '"'
$lnk.WorkingDirectory = $here
$lnk.IconLocation = Join-Path $here 'ui\servidor.ico'
$lnk.Description = 'Servidor Desktop - prosjekter, chat og terminal'
$lnk.Save()

Write-Host ""
Write-Host "  Snarvei laget: $target" -ForegroundColor Green
Write-Host "  Dobbeltklikk den for å starte Servidor." -ForegroundColor Gray
Write-Host ""
