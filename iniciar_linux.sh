#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PYTHON_BIN=""
for candidate in "$SCRIPT_DIR/venv/bin/python" "$SCRIPT_DIR/.venv/bin/python" python3 python; do
    if [[ "$candidate" == */* ]]; then
        [ -x "$candidate" ] || continue
    else
        command -v "$candidate" >/dev/null 2>&1 || continue
    fi

    if "$candidate" -c 'import sys; sys.exit(0 if sys.version_info.major == 3 else 1)' >/dev/null 2>&1; then
        PYTHON_BIN="$candidate"
        break
    fi
done

if [ -z "$PYTHON_BIN" ]; then
    echo "Python 3 nao foi encontrado. Instale o Python 3 e tente novamente." >&2
    exit 1
fi

exec "$PYTHON_BIN" "$SCRIPT_DIR/backend/app.py"
