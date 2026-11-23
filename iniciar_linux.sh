#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
    echo "Python 3 nao foi encontrado. Instale o Python 3 e tente novamente." >&2
    exit 1
fi

exec python3 backend/app.py
