@echo off
cd /d C:\proyectos\github\rrfairino

setlocal EnableDelayedExpansion

title Git helper - rrfairino

set fecha=%date:~6,4%-%date:~3,2%-%date:~0,2%
set hora=%time:~0,8%

echo ==========================
echo Subiendo cambios a GitHub [%fecha% %hora%]
echo ==========================
echo.

echo [1/5] Estado actual:
git status --short
echo.

set /p continuar=Hay cambios. Continuar? (S/N): 
if /I not "!continuar!"=="S" (
    echo Cancelado.
    pause
    exit /b
)

echo.
echo Escribe SOLO el detalle.
echo Cuando termines, escribe FIN.
echo.

set titulo=[%fecha% %hora%] feat: actualizacion rrfairino
set mensaje=-m "!titulo!"

:loop
set /p linea=
if /I "!linea!"=="FIN" goto fin
if "!linea!"=="" goto loop
set mensaje=!mensaje! -m "!linea!"
goto loop

:fin

echo.
echo [2/5] git add...
git add .

echo.
echo [3/5] commit...
git commit !mensaje!

echo.
echo [4/5] push...
git push origin main

echo.
echo ==========================
echo DONE
echo ==========================

git log --oneline -3
pause