$ErrorActionPreference = 'Stop'

$Repo = if ($env:PR_REVIEW_AGENT_REPO) { $env:PR_REVIEW_AGENT_REPO } else { 'tiagovicente2/pr-review-agent' }
$InstallDir = if ($env:PR_REVIEW_AGENT_INSTALL_DIR) { $env:PR_REVIEW_AGENT_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'PR Review Agent' }
$Artifact = 'pr-review-agent-windows-x64.zip'
$Url = "https://github.com/$Repo/releases/latest/download/$Artifact"
$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
$ZipPath = Join-Path $TempDir $Artifact

function Log($Message) { Write-Host "[pr-review-agent] $Message" }

New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
try {
  Log "downloading $Url"
  Invoke-WebRequest -Uri $Url -OutFile $ZipPath

  if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  Expand-Archive -Path $ZipPath -DestinationPath $InstallDir -Force

  $Nested = Get-ChildItem -Path $InstallDir -Directory | Select-Object -First 1
  if ($Nested -and -not (Get-ChildItem -Path $InstallDir -File | Select-Object -First 1)) {
    Get-ChildItem -Path $Nested.FullName -Force | Move-Item -Destination $InstallDir -Force
    Remove-Item -Recurse -Force $Nested.FullName
  }

  $Launcher = Get-ChildItem -Path $InstallDir -Recurse -File -Filter 'pr-review-agent.exe' | Select-Object -First 1
  if (-not $Launcher) { $Launcher = Get-ChildItem -Path $InstallDir -Recurse -File -Filter 'PR Review Agent.exe' | Select-Object -First 1 }
  if (-not $Launcher) { throw 'app executable not found in release artifact' }

  $StartMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
  $ShortcutPath = Join-Path $StartMenu 'PR Review Agent.lnk'
  $Shell = New-Object -ComObject WScript.Shell
  $Shortcut = $Shell.CreateShortcut($ShortcutPath)
  $Shortcut.TargetPath = $Launcher.FullName
  $Shortcut.WorkingDirectory = Split-Path $Launcher.FullName
  $Shortcut.Description = 'AI-assisted GitHub pull request review drafts'
  $Icon = Get-ChildItem -Path $InstallDir -Recurse -File -Filter 'appIcon.ico' | Select-Object -First 1
  if (-not $Icon) { $Icon = Get-ChildItem -Path $InstallDir -Recurse -File -Filter 'icon.ico' | Select-Object -First 1 }
  if ($Icon) { $Shortcut.IconLocation = $Icon.FullName }
  $Shortcut.Save()

  Log "installed to $InstallDir"
  Log "created Start Menu shortcut: $ShortcutPath"
  Log 'done'
}
finally {
  if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }
}
