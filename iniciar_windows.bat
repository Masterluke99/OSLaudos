@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if not errorlevel 1 (
    py -3 --version >nul 2>nul
    if not errorlevel 1 goto use_py
)

where python >nul 2>nul
if errorlevel 1 goto no_python
python --version >nul 2>nul
if errorlevel 1 goto no_python
python backend\app.py
goto finished

:use_py
py -3 backend\app.py
goto finished

:no_python
echo Python 3 nao foi encontrado. Instale o Python 3 e tente novamente.
pause
exit /b 1

:finished
if errorlevel 1 (
    echo O sistema foi encerrado com erro. Confira a mensagem acima.
    pause
    exit /b 1
)
