@echo off
cd /d C:\proyectos\github\pmatriz-planner

echo ==========================
echo Subiendo cambios a GitHub [%date% %time%]
echo ==========================

set /p mensaje=Escribe el mensaje del commit: 

git add .
git commit -m "%mensaje%"
git push origin main

echo ==========================
echo DONE
pause