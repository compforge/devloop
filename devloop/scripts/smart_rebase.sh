#!/usr/bin/env bash
# Safe existing-branch rebase. Thin wrapper over rebase.py policy and RepoCLI operations.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$DIR/python" "$DIR/rebase.py" "$@"
