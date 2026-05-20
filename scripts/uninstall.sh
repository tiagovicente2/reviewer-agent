#!/usr/bin/env bash
set -euo pipefail
APP_NAME="reviewer-agent"
INSTALL_DIR="${REVIEWER_AGENT_INSTALL_DIR:-$HOME/.local/share/reviewer-agent}"
BIN_DIR="${REVIEWER_AGENT_BIN_DIR:-$HOME/.local/bin}"
DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
rm -rf "$INSTALL_DIR"
rm -f "$BIN_DIR/$APP_NAME"
rm -f "$DESKTOP_DIR/reviewer-agent.desktop"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true
printf '[reviewer-agent] uninstalled\n'
