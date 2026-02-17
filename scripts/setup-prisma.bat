@echo off
REM Fluydo.IA - Instala e gera o cliente Prisma para corrigir "Can't resolve '@prisma/client'"
cd /d "%~dp0.."
echo Instalando @prisma/client...
call npm install @prisma/client
if errorlevel 1 ( echo Erro no npm install. Verifique se o Node e npm estao instalados. & exit /b 1 )
echo.
echo Gerando cliente Prisma a partir do schema...
call npx prisma generate
if errorlevel 1 ( echo Erro no prisma generate. Verifique se o arquivo prisma/schema.prisma existe. & exit /b 1 )
echo.
echo Concluido. Reinicie o servidor com: npm run dev
exit /b 0
