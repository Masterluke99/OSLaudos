#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

python3 -m pip install --user --upgrade pyinstaller
python3 -m pip install --user -r requirements-sign.txt

python3 -m PyInstaller \
  --noconfirm \
  --clean \
  --onedir \
  --name AcquaTEC \
  --paths backend \
  --add-data "Acquatec_laudos_sqlite.html:." \
  --add-data "script.js:." \
  --add-data "contracts.js:." \
  --add-data "logo.png:." \
  --add-data "css:css" \
  backend/app.py

mkdir -p dist/AcquaTEC/dados
if [ -f dados/acquatec.db ]; then
  cp -f dados/acquatec.db dist/AcquaTEC/dados/acquatec.db
fi
if [ -d dados/certificados ]; then
  cp -a dados/certificados dist/AcquaTEC/dados/
fi

chmod +x dist/AcquaTEC/AcquaTEC
echo "Executável criado em: $(pwd)/dist/AcquaTEC/AcquaTEC"
