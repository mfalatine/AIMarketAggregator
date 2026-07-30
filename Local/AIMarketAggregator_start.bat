@echo off
setlocal
cd /d "%~dp0"
set "POWERSHELL_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
set "APP_URL=http://127.0.0.1:4173/#briefing"

rem Use the same restart lifecycle as DAI_start.bat: close the prior titled
rem console, then kill the process tree that still owns the server port.
taskkill /F /T /FI "WINDOWTITLE eq AI Market Aggregator Server*" >nul 2>&1
"%POWERSHELL_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0restart_ai_market.ps1"
if errorlevel 1 (
  echo ERROR: The existing AI Market Aggregator server could not be stopped.
  echo.
  pause
  exit /b 1
)

title AI Market Aggregator Server
echo.
echo  AI Market Aggregator
echo  Starting Local subscription mode...
echo  The application will open at %APP_URL%
echo.

rem Explorer does not inherit the same PATH as a developer terminal. Resolve
rem Node explicitly and run the committed server bundle without pnpm.
set "NODE_EXE="
if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE for /f "delims=" %%I in ('where node.exe 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%I"

if not defined NODE_EXE (
  echo ERROR: The Node.js runtime could not be found.
  echo Checked the standard Windows installation folders and PATH.
  echo.
  pause
  exit /b 1
)

if not exist "app.bundle.js" (
  echo ERROR: app.bundle.js is missing from this project folder.
  echo.
  pause
  exit /b 1
)

rem Wait for the server to answer, then open it in the Windows default browser.
rem AMA_SKIP_BROWSER is used only by the automated launcher integration test.
if not defined AMA_SKIP_BROWSER start "" /b "%POWERSHELL_EXE%" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$ProgressPreference='SilentlyContinue'; $url='%APP_URL%'; foreach($attempt in 1..60) { try { $response=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:4173/' -TimeoutSec 1; if ($response.StatusCode -eq 200) { Start-Process $url; exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }"

"%NODE_EXE%" scripts\dev-server.mjs
set "SERVER_EXIT=%ERRORLEVEL%"
if not "%SERVER_EXIT%"=="0" (
  echo.
  echo The AI Market Aggregator server stopped with exit code %SERVER_EXIT%.
  timeout /t 3 /nobreak >nul
)
exit /b %SERVER_EXIT%
