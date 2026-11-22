#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PYTHON_BIN="${PYTHON_BIN:-python3}"

VENV_DIR=".venv-build"
"$PYTHON_BIN" -m venv "$VENV_DIR"
"$VENV_DIR/bin/python" -m pip install --upgrade pip pyinstaller
"$VENV_DIR/bin/python" -m pip install -r requirements-sign.txt

"$VENV_DIR/bin/python" -m PyInstaller \
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

DESKTOP_DIR=""
if command -v xdg-user-dir >/dev/null 2>&1; then
  DESKTOP_DIR="$(xdg-user-dir DESKTOP)"
fi
if [ -z "${DESKTOP_DIR}" ] || [ "${DESKTOP_DIR}" = "$HOME" ]; then
  DESKTOP_DIR="$HOME/Desktop"
fi

mkdir -p "$DESKTOP_DIR"
DESKTOP_APP_DIR="$DESKTOP_DIR/AcquaTEC"
mkdir -p "$DESKTOP_APP_DIR"
cp -a dist/AcquaTEC/. "$DESKTOP_APP_DIR/"
cp -f logo.png "$DESKTOP_APP_DIR/logo.png"
chmod +x "$DESKTOP_APP_DIR/AcquaTEC"

cat > "$DESKTOP_APP_DIR/abrir_acquatec.sh" <<'EOF'
#!/usr/bin/env bash
set -u

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
URL="http://127.0.0.1:8765"

if curl --fail --silent --max-time 2 "$URL/" >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 &
  exit 0
fi

"$APP_DIR/AcquaTEC" >> "$APP_DIR/AcquaTEC.log" 2>&1 &
APP_PID=$!

for _ in $(seq 1 30); do
  if curl --fail --silent --max-time 1 "$URL/" >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
    exit 0
  fi
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    break
  fi
  sleep 0.2
done

if command -v zenity >/dev/null 2>&1; then
  zenity --error --title="AcquaTEC" --text="Nao foi possivel iniciar o AcquaTEC. Consulte o arquivo AcquaTEC.log na pasta do programa."
fi
EOF
chmod +x "$DESKTOP_APP_DIR/abrir_acquatec.sh"

cat > "$DESKTOP_DIR/AcquaTEC.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=AcquaTEC
Comment=Sistema de laudos AcquaTEC
Exec=$DESKTOP_APP_DIR/abrir_acquatec.sh
Path=$DESKTOP_APP_DIR
Icon=$DESKTOP_APP_DIR/logo.png
Terminal=false
Categories=Office;
EOF
chmod +x "$DESKTOP_DIR/AcquaTEC.desktop"

if command -v gio >/dev/null 2>&1; then
  gio set "$DESKTOP_DIR/AcquaTEC.desktop" metadata::trusted true 2>/dev/null || true
fi

echo "Pacote instalado em: $DESKTOP_APP_DIR"
echo "Atalho criado em: $DESKTOP_DIR/AcquaTEC.desktop"
