#!/usr/bin/env bash
set -euo pipefail

REPO="${PR_REVIEW_AGENT_REPO:-tiagovicente2/pr-review-agent}"
APP_NAME="pr-review-agent"
INSTALL_DIR="${PR_REVIEW_AGENT_INSTALL_DIR:-$HOME/.local/share/pr-review-agent}"
BIN_DIR="${PR_REVIEW_AGENT_BIN_DIR:-$HOME/.local/bin}"
DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"

log() { printf '[pr-review-agent] %s\n' "$*"; }
fail() { printf '[pr-review-agent] error: %s\n' "$*" >&2; exit 1; }

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

artifact="pr-review-agent-${platform}-${arch}.tar.gz"
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

if [[ "$platform" == "linux" ]]; then
  launcher="$INSTALL_DIR/$APP_NAME"
  if [[ ! -x "$launcher" ]]; then
    launcher="$(find "$INSTALL_DIR" -maxdepth 2 -type f -perm -111 \( -name "$APP_NAME" -o -name 'PR Review Agent' \) | head -n 1 || true)"
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
  cat > "$DESKTOP_DIR/pr-review-agent.desktop" <<EOF
[Desktop Entry]
Name=PR Review Agent
Comment=AI-assisted GitHub pull request review drafts
Exec=$launcher
Icon=$icon_path
Terminal=false
Type=Application
Categories=Development;
StartupWMClass=PR Review Agent
EOF
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true
  log "installed launcher: $BIN_DIR/$APP_NAME"
  log "installed desktop entry: $DESKTOP_DIR/pr-review-agent.desktop"
else
  apps_dir="${PR_REVIEW_AGENT_APPS_DIR:-$HOME/Applications}"
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
