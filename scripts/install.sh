#!/bin/sh
set -eu

PYTHON_VERSION="${CODEALMANAC_PYTHON_VERSION:-3.12}"
PACKAGE_SPEC="${CODEALMANAC_PACKAGE:-codealmanac}"
UV_INSTALL_URL="${CODEALMANAC_UV_INSTALL_URL:-https://astral.sh/uv/install.sh}"
ORIGINAL_PATH="$PATH"
ORIGINAL_CODEALMANAC="$(command -v codealmanac 2>/dev/null || true)"

say() {
  printf '%s\n' "$*"
}

fail() {
  say "codealmanac install: $*" >&2
  exit 1
}

prepend_path_if_present() {
  dir="$1"
  if [ -d "$dir" ]; then
    case ":$PATH:" in
      *":$dir:"*) ;;
      *) PATH="$dir:$PATH" ;;
    esac
  fi
}

path_has_dir() {
  dir="$1"
  path_value="$2"
  case ":$path_value:" in
    *":$dir:"*) return 0 ;;
    *) return 1 ;;
  esac
}

install_uv_if_missing() {
  if command -v uv >/dev/null 2>&1; then
    return
  fi

  say "Installing uv..."
  if command -v curl >/dev/null 2>&1; then
    curl -LsSf "$UV_INSTALL_URL" | sh
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "$UV_INSTALL_URL" | sh
  else
    fail "curl or wget is required to install uv"
  fi

  prepend_path_if_present "$HOME/.local/bin"
  prepend_path_if_present "$HOME/.cargo/bin"

  if ! command -v uv >/dev/null 2>&1; then
    fail "uv installed, but uv is not on PATH; open a new shell and retry"
  fi
}

install_uv_if_missing

say "Installing CodeAlmanac..."
uv tool install --python "$PYTHON_VERSION" --upgrade --force "$PACKAGE_SPEC"

tool_bin_dir="$(uv tool dir --bin)"
installed_bin="$tool_bin_dir/codealmanac"

if [ -x "$installed_bin" ]; then
  "$installed_bin" --version >/dev/null
else
  fail "uv finished, but $installed_bin was not created"
fi

if [ -n "$ORIGINAL_CODEALMANAC" ] && [ "$ORIGINAL_CODEALMANAC" != "$installed_bin" ]; then
  say ""
  say "CodeAlmanac installed at:"
  say "  $installed_bin"
  say ""
  say "Your shell currently resolves codealmanac to:"
  say "  $ORIGINAL_CODEALMANAC"
  say ""
  say "Put this directory earlier on PATH before running codealmanac:"
  say "  $tool_bin_dir"
  exit 0
fi

if ! path_has_dir "$tool_bin_dir" "$ORIGINAL_PATH"; then
  say ""
  say "CodeAlmanac installed at:"
  say "  $installed_bin"
  say ""
  say "Put this directory on PATH before running codealmanac:"
  say "  $tool_bin_dir"
  exit 0
fi

say "CodeAlmanac installed:"
say "  $installed_bin"
say ""
say "Next:"
say "  codealmanac setup"
