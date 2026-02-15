@echo off
cd /d "%~dp0"
echo.
echo Fluydo.AI - Iniciando o servidor do chat...
echo.

if not exist "node_modules" (
    echo [1/2] Instalando dependencias... Aguarde.
    call npm install
    if errorlevel 1 (
        echo Erro ao instalar. Verifique se o Node esta instalado: node -v
        pause
        exit /b 1
    )
    echo.
) else (
    echo Dependencias ja instaladas.
    echo.
)

echo [2/2] Subindo o servidor em http://localhost:3000
echo.
echo Quando aparecer "Ready", abra no navegador: http://localhost:3000
echo Para parar o servidor: feche esta janela ou pressione Ctrl+C
echo.
call npx next dev
pause
