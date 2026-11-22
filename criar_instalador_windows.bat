@echo off
setlocal
cd /d "%~dp0"

set "BUILD_ENV=.venv-build"
set "PYTHON=py -3"

if not exist "%BUILD_ENV%\Scripts\python.exe" (
  %PYTHON% -m venv "%BUILD_ENV%"
  if errorlevel 1 goto :error
)

"%BUILD_ENV%\Scripts\python.exe" -m pip install --upgrade pip pyinstaller
if errorlevel 1 goto :error
"%BUILD_ENV%\Scripts\python.exe" -m pip install -r requirements-sign.txt
if errorlevel 1 goto :error

"%BUILD_ENV%\Scripts\python.exe" -m PyInstaller ^
  --noconfirm ^
  --clean ^
  --onedir ^
  --name AcquaTEC ^
  --paths backend ^
  --add-data "Acquatec_laudos_sqlite.html;." ^
  --add-data "script.js;." ^
  --add-data "contracts.js;." ^
  --add-data "logo.png;." ^
  --add-data "css;css" ^
  backend\app.py
if errorlevel 1 goto :error

where ISCC.exe >nul 2>nul
if errorlevel 1 (
  echo Erro: Inno Setup 6 nao encontrado. Instale-o e adicione ISCC.exe ao PATH.
  exit /b 1
)

ISCC.exe instalador\AcquaTEC.iss
if errorlevel 1 goto :error
echo Instalador Windows criado em: dist\instaladores\AcquaTEC-Setup.exe
exit /b 0

:error
echo Erro ao preparar o instalador.
exit /b 1
