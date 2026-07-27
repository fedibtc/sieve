#!/usr/bin/env bash
#
# Installs the sieve release binary and puts it on PATH for later steps.
# Wraps scripts/install-sieve.sh so the reusable workflow keeps one run line.
#
# Env:
#   SIEVE_VERSION       release tag to install (e.g. v0.4.1)
#   GH_TOKEN            token install-sieve.sh uses to fetch the release
#   SIEVE_INSTALL_DIR   optional install dir (default: $RUNNER_TEMP/sieve-bin)

set -euo pipefail

dir="${SIEVE_INSTALL_DIR:-${RUNNER_TEMP:-/tmp}/sieve-bin}"
here="$(cd "$(dirname "$0")" && pwd)"

SIEVE_INSTALL_DIR="$dir" "$here/../install-sieve.sh" --version "$SIEVE_VERSION"
echo "$dir" >>"${GITHUB_PATH:-/dev/stdout}"
