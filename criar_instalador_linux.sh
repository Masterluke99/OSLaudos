#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PYTHON_BIN="${PYTHON_BIN:-python3}"
BUILD_ENV=".venv-build"
APP_NAME="AcquaTEC"
PACKAGE_ROOT="build/linux-package"
OUTPUT_DIR="dist/instaladores"
VERSION="${ACQUATEC_VERSION:-1.0.0}"

if command -v dpkg-deb >/dev/null 2>&1; then
  ARCH="$(dpkg --print-architecture)"
  USE_DPKG_DEB=1
else
  case "$(uname -m)" in
    x86_64) ARCH="amd64" ;;
    aarch64) ARCH="arm64" ;;
    armv7l) ARCH="armhf" ;;
    *)
      echo "Erro: não foi possível determinar uma arquitetura Debian suportada." >&2
      exit 1
      ;;
  esac
  if ! command -v ar >/dev/null 2>&1; then
    echo "Erro: dpkg-deb ou ar não encontrado para criar o pacote Debian." >&2
    exit 1
  fi
  USE_DPKG_DEB=0
fi

"$PYTHON_BIN" -m venv "$BUILD_ENV"
"$BUILD_ENV/bin/python" -m pip install --upgrade pip pyinstaller
"$BUILD_ENV/bin/python" -m pip install -r requirements-sign.txt

"$BUILD_ENV/bin/python" -m PyInstaller \
  --noconfirm \
  --clean \
  --onedir \
  --name "$APP_NAME" \
  --paths backend \
  --add-data "Acquatec_laudos_sqlite.html:." \
  --add-data "script.js:." \
  --add-data "contracts.js:." \
  --add-data "logo.png:." \
  --add-data "css:css" \
  backend/app.py

rm -rf build/linux-package
mkdir -p "$PACKAGE_ROOT/DEBIAN" \
  "$PACKAGE_ROOT/opt/acquatec" \
  "$PACKAGE_ROOT/usr/bin" \
  "$PACKAGE_ROOT/usr/share/applications" \
  "$PACKAGE_ROOT/usr/share/pixmaps" \
  "$OUTPUT_DIR"

tar -C "dist/$APP_NAME" --exclude='./dados' -cf - . |
  tar -C "$PACKAGE_ROOT/opt/acquatec" -xf -
install -m 755 logo.png "$PACKAGE_ROOT/usr/share/pixmaps/acquatec.png"

cat > "$PACKAGE_ROOT/usr/bin/acquatec" <<'EOF'
#!/bin/sh
exec /opt/acquatec/AcquaTEC "$@"
EOF
chmod 755 "$PACKAGE_ROOT/usr/bin/acquatec"

cat > "$PACKAGE_ROOT/usr/share/applications/acquatec.desktop" <<'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=AcquaTEC
Comment=Sistema de laudos AcquaTEC
Exec=/usr/bin/acquatec
Icon=acquatec
Terminal=false
Categories=Office;
EOF

cat > "$PACKAGE_ROOT/DEBIAN/control" <<EOF
Package: acquatec
Version: $VERSION
Section: office
Priority: optional
Architecture: $ARCH
Depends: libc6, libstdc++6
Maintainer: AcquaTEC
Description: Sistema local de laudos AcquaTEC
 Aplicativo local para cadastro de clientes, medições e geração de laudos.
EOF

DEB_PATH="$(pwd)/$OUTPUT_DIR/acquatec_${VERSION}_${ARCH}.deb"
if [ "$USE_DPKG_DEB" -eq 1 ]; then
  dpkg-deb --build --root-owner-group "$PACKAGE_ROOT" "$DEB_PATH"
else
  ARCHIVE_ROOT="build/deb-archive"
  rm -rf "$ARCHIVE_ROOT"
  mkdir -p "$ARCHIVE_ROOT/control"
  cp "$PACKAGE_ROOT/DEBIAN/control" "$ARCHIVE_ROOT/control/control"
  printf '2.0\n' > "$ARCHIVE_ROOT/debian-binary"
  tar --numeric-owner --owner=0 --group=0 -C "$ARCHIVE_ROOT/control" -czf "$ARCHIVE_ROOT/control.tar.gz" .
  tar --numeric-owner --owner=0 --group=0 -C "$PACKAGE_ROOT" --exclude='./DEBIAN' -czf "$ARCHIVE_ROOT/data.tar.gz" .
  (cd "$ARCHIVE_ROOT" && ar cr "$DEB_PATH" debian-binary control.tar.gz data.tar.gz)
fi
echo "Instalador Linux criado em: $DEB_PATH"
