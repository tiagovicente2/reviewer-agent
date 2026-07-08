#!/usr/bin/env bash
set -euo pipefail

REPO="${REVIEWER_AGENT_REPO:-tiagovicente2/reviewer-agent}"
APP_NAME="reviewer-agent"
INSTALL_DIR="${REVIEWER_AGENT_INSTALL_DIR:-$HOME/.local/share/reviewer-agent}"
BIN_DIR="${REVIEWER_AGENT_BIN_DIR:-$HOME/.local/bin}"
DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"

log() { printf '[reviewer-agent] %s\n' "$*"; }
fail() { printf '[reviewer-agent] error: %s\n' "$*" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v tar >/dev/null 2>&1 || fail "tar is required"

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"
case "$os" in
  linux) platform="linux" ;;
  darwin) platform="macos" ;;
  *) fail "unsupported OS: $os" ;;
esac
case "$arch" in
  x86_64|amd64) arch="x64" ;;
  arm64|aarch64) arch="arm64" ;;
  *) fail "unsupported architecture: $arch" ;;
esac

artifact="reviewer-agent-${platform}-${arch}.tar.gz"
url="https://github.com/${REPO}/releases/latest/download/${artifact}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

checksum_url="https://github.com/${REPO}/releases/latest/download/SHA256SUMS"

log "downloading ${url}"
curl -fL "$url" -o "$tmp_dir/$artifact"
if curl -fsL "$checksum_url" -o "$tmp_dir/SHA256SUMS"; then
  expected_checksum="$(awk -v artifact="$artifact" '$2 == artifact { print $1 }' "$tmp_dir/SHA256SUMS")"
  if [[ -n "$expected_checksum" ]]; then
    if command -v sha256sum >/dev/null 2>&1; then
      actual_checksum="$(sha256sum "$tmp_dir/$artifact" | awk '{ print $1 }')"
    else
      actual_checksum="$(shasum -a 256 "$tmp_dir/$artifact" | awk '{ print $1 }')"
    fi
    [[ "$actual_checksum" == "$expected_checksum" ]] || fail "checksum verification failed for $artifact"
    log "verified checksum for $artifact"
  else
    log "checksum file did not include $artifact; skipping verification"
  fi
else
  log "checksums unavailable; skipping verification"
fi

rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
tar -xzf "$tmp_dir/$artifact" -C "$INSTALL_DIR" --strip-components=1

configure_linux_sandbox() {
  local sandbox="$INSTALL_DIR/chrome-sandbox"
  [[ -f "$sandbox" ]] || return 0

  local uid mode
  uid="$(stat -c '%u' "$sandbox")"
  mode="$(stat -c '%a' "$sandbox")"
  if [[ "$uid" == "0" && "$mode" == "4755" ]]; then
    return 0
  fi

  log "configuring Chromium SUID sandbox helper"
  if [[ "$(id -u)" == "0" ]]; then
    chown root:root "$sandbox"
    chmod 4755 "$sandbox"
  elif command -v sudo >/dev/null 2>&1; then
    sudo chown root:root "$sandbox"
    sudo chmod 4755 "$sandbox"
  else
    fail "sudo is required to configure $sandbox. Run: chown root:root '$sandbox' && chmod 4755 '$sandbox'"
  fi

  uid="$(stat -c '%u' "$sandbox")"
  mode="$(stat -c '%a' "$sandbox")"
  [[ "$uid" == "0" && "$mode" == "4755" ]] || fail "failed to configure $sandbox; expected owner root and mode 4755"
}

if [[ "$platform" == "linux" ]]; then
  configure_linux_sandbox

  launcher="$INSTALL_DIR/$APP_NAME"
  if [[ ! -x "$launcher" ]]; then
    launcher="$(find "$INSTALL_DIR" -maxdepth 2 -type f -perm -111 \( -name "$APP_NAME" -o -name 'Reviewer Agent' \) | head -n 1 || true)"
  fi
  [[ -n "$launcher" && -x "$launcher" ]] || fail "app executable not found under $INSTALL_DIR"
  mkdir -p "$BIN_DIR"
  ln -sfn "$launcher" "$BIN_DIR/$APP_NAME"

  mkdir -p "$DESKTOP_DIR"
  icon_path="$INSTALL_DIR/resources/assets/icon.png"
  if [[ ! -f "$icon_path" ]]; then
    icon_path="$INSTALL_DIR/resources/app/icon.png"
  fi
  if [[ ! -f "$icon_path" ]]; then
    icon_path="$INSTALL_DIR/Resources/app/icon.png"
  fi
  if [[ ! -f "$icon_path" ]]; then
    icon_path="$APP_NAME"
  fi
  cat > "$DESKTOP_DIR/reviewer-agent.desktop" <<EOF
[Desktop Entry]
Name=Reviewer Agent
Comment=AI-assisted GitHub pull request review drafts
Exec=$launcher
Icon=$icon_path
Terminal=false
Type=Application
Categories=Development;
StartupWMClass=Reviewer Agent
EOF
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true
  log "installed launcher: $BIN_DIR/$APP_NAME"
  log "installed desktop entry: $DESKTOP_DIR/reviewer-agent.desktop"
else
  apps_dir="${REVIEWER_AGENT_APPS_DIR:-$HOME/Applications}"
  mkdir -p "$apps_dir"
  app_bundle="$(find "$INSTALL_DIR" -maxdepth 1 -name '*.app' -type d | head -n 1 || true)"
  if [[ -n "$app_bundle" ]]; then
    rm -rf "$apps_dir/$(basename "$app_bundle")"
    cp -R "$app_bundle" "$apps_dir/"
    log "installed app bundle: $apps_dir/$(basename "$app_bundle")"
  else
    log "installed files: $INSTALL_DIR"
  fi
fi

log "done"
