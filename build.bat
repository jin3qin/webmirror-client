@echo off
setlocal
cd /d "%~dp0"

set "GOOS=windows"
set "GOARCH=amd64"
set "GOPROXY=off"
set "GOFLAGS=-mod=mod"

echo ==========================================================
echo   WebMirror Desktop - Windows build (single-file exe)
echo ==========================================================

rem --- 0. close running instance to avoid file lock ---
tasklist /FI "IMAGENAME eq webmirror-desktop.exe" 2>nul | find "webmirror-desktop.exe" >nul
if not errorlevel 1 (
  echo   [0] closing running instance...
  taskkill /IM webmirror-desktop.exe >nul 2>&1
  timeout /t 2 /nobreak >nul
)

rem --- 1. toolchain check ---
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found
  pause
  exit /b 1
)
where go >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Go not found
  pause
  exit /b 1
)

rem --- 2. generate all icons from root logo.png ---
rem You only keep logo.png at project root. This step auto-generates:/nrem   web/public/logo.png   (web favicon + top bar logo, bundled at npm build)
rem   desktop/icon.ico      (tray icon + exe file icon, multi-resolution)
rem Must run BEFORE frontend build so the web logo gets into dist.
echo   [2] generating icons from root logo.png...
if not exist logo.png (
  echo [ERROR] root logo.png missing - put your logo at project root
  pause
  exit /b 1
)
if not exist web\public mkdir web\public
copy /Y logo.png web\public\logo.png >nul
echo        - web/public/logo.png  (copied from root logo.png)

set "PY="
where python >nul 2>&1 && set "PY=python"
if not defined PY (
  where py >nul 2>&1 && set "PY=py"
)
if defined PY (
  %PY% desktop\gen_icon.py
) else (
  echo [WARN] Python not found - cannot rebuild icon.ico, keep existing
)

rem --- 3. build frontend (web/public/logo.png now bundled into dist) ---
echo   [3] building frontend (web)...
pushd web
if not exist node_modules call npm install
call npm run build
if not exist dist\index.html (
  echo [ERROR] dist missing
  popd
  pause
  exit /b 1
)
popd

rem --- 4. copy dist into embed dir ---
echo   [4] copying dist into desktop embed dir...
if exist desktop\internal\static\dist rmdir /s /q desktop\internal\static\dist
mkdir desktop\internal\static\dist
xcopy /E /I /Y web\dist desktop\internal\static\dist >nul

rem --- 5. ensure icon exists ---
if not exist desktop\icon.ico (
  echo [ERROR] desktop\icon.ico missing
  pause
  exit /b 1
)

rem --- 6. rsrc: embed icon into exe file resource ---
echo   [6] embedding icon via rsrc...
where rsrc >nul 2>&1
if not errorlevel 1 (
  pushd desktop
  rsrc -ico icon.ico -o rsrc.syso
  popd
) else (
  echo [WARN] rsrc not found, exe will use default icon
  echo         install: go install github.com/akavel/rsrc/cmd/rsrc@latest
)

rem --- 7. build the desktop gateway exe ---
echo   [7] building webmirror-desktop.exe...
pushd desktop
go build -ldflags="-H windowsgui -s -w" -o "..\webmirror-desktop.exe" .
if errorlevel 1 (
  echo [ERROR] go build failed
  popd
  pause
  exit /b 1
)
popd

echo.
echo   Build done: webmirror-desktop.exe
echo   Start webmirror backend (chatgpt-forward) on :8080 first.
echo   Optional: set BACKEND_URL=...  set PORT=...
pause
