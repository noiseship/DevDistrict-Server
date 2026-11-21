@echo off
setlocal
pushd "%~dp0"
if errorlevel 1 exit /b 1
where node.exe >nul 2>&1
if errorlevel 1 (
 echo Install Node.js 22 or newer, then run this file again.
 pause
 popd
 exit /b 1
)
echo Open http://localhost:3000 in your browser. Keep this window open.
node server.mjs
popd
pause
