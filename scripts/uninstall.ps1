$ErrorActionPreference = 'Stop'
$InstallDir = if ($env:REVIEWER_AGENT_INSTALL_DIR) { $env:REVIEWER_AGENT_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'Reviewer Agent' }
$ShortcutPath = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Reviewer Agent.lnk'
if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
if (Test-Path $ShortcutPath) { Remove-Item -Force $ShortcutPath }
Write-Host '[reviewer-agent] uninstalled'
