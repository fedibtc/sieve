#!/bin/sh

set -eu

repository="${SIEVE_GITHUB_REPOSITORY:-fedibtc/sieve}"
install_dir="${SIEVE_INSTALL_DIR:-$HOME/.local/bin}"
version=""

usage() {
  cat <<'EOF'
Install Sieve from a private GitHub release.

Usage: install-sieve.sh [--version TAG] [--install-dir DIRECTORY]

Options:
  --version TAG           Install a specific release tag (for example v0.1.0).
  --install-dir DIRECTORY Install into DIRECTORY instead of ~/.local/bin.
  -h, --help              Show this help.

Environment:
  SIEVE_GITHUB_REPOSITORY Override the GitHub repository (default: fedibtc/sieve).
  SIEVE_INSTALL_DIR       Override the installation directory.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version)
      [ "$#" -ge 2 ] || { echo "--version requires a value" >&2; exit 2; }
      version="$2"
      shift 2
      ;;
    --install-dir)
      [ "$#" -ge 2 ] || { echo "--install-dir requires a value" >&2; exit 2; }
      install_dir="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

command -v gh >/dev/null 2>&1 || {
  echo "gh is required to download private Sieve releases" >&2
  exit 1
}

gh auth status >/dev/null 2>&1 || {
  echo "authenticate GitHub CLI first: gh auth login" >&2
  exit 1
}

case "$(uname -s)" in
  Darwin) os="apple-darwin" ;;
  Linux) os="unknown-linux-gnu" ;;
  *)
    echo "unsupported operating system: $(uname -s)" >&2
    exit 1
    ;;
esac

case "$(uname -m)" in
  arm64|aarch64) arch="aarch64" ;;
  x86_64|amd64) arch="x86_64" ;;
  *)
    echo "unsupported CPU architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

target="${arch}-${os}"
if [ "$target" = "aarch64-unknown-linux-gnu" ]; then
  echo "no Sieve release is currently built for ARM64 Linux" >&2
  exit 1
fi

if [ -n "$version" ]; then
  tag="$version"
  gh release view "$tag" --repo "$repository" >/dev/null
else
  tag="$(gh release view --repo "$repository" --json tagName --jq .tagName)"
fi

asset="sieve-${target}.tar.gz"
tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/sieve-install.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT HUP INT TERM

echo "Downloading Sieve ${tag} for ${target}..."
gh release download "$tag" \
  --repo "$repository" \
  --pattern "$asset" \
  --pattern sha256.sum \
  --dir "$tmp_dir"

awk -v asset="$asset" '
  {
    filename = $2
    sub(/^\*/, "", filename)
    if (filename == asset) print
  }
' "$tmp_dir/sha256.sum" > "$tmp_dir/asset.sha256"
[ -s "$tmp_dir/asset.sha256" ] || {
  echo "release checksum file did not contain ${asset}" >&2
  exit 1
}
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$tmp_dir" && sha256sum --check asset.sha256)
else
  (cd "$tmp_dir" && shasum -a 256 --check asset.sha256)
fi

tar -xzf "$tmp_dir/$asset" -C "$tmp_dir"
binary="$tmp_dir/sieve-${target}/sieve"
[ -f "$binary" ] || {
  echo "release archive did not contain the expected sieve binary" >&2
  exit 1
}

mkdir -p "$install_dir"
install -m 0755 "$binary" "$install_dir/sieve"

echo "Installed Sieve ${tag} to ${install_dir}/sieve"
case ":$PATH:" in
  *":$install_dir:"*) ;;
  *) echo "Add ${install_dir} to PATH before running sieve." ;;
esac
