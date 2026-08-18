@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================
REM Deploy Firebase Child Project (Wrapper)
REM Usage:
REM     deploy-child.bat <ten_project> <folder> <service_account_json>
REM Example:
REM     deploy-child.bat Amenosa amenosa
REM ============================================================

if "%~1"=="" (
    echo ERROR: Missing ten_project parameter.
    echo Usage: deploy-child.bat ^<ten_project^> ^<folder^>
    exit /b 1
)

if "%~2"=="" (
    echo ERROR: Missing folder parameter.
    echo Usage: deploy-child.bat ^<ten_project^> ^<folder^>
    exit /b 1
)

if "%~3"=="" (
    echo ERROR: Missing service_account_json parameter.
    echo Usage: deploy-child.bat ^<ten_project^> ^<folder^> ^<service_account_json^>
    exit /b 1
)


set "TEN_PROJECT=%~1"
if not "%TEN_PROJECT%"=="%TEN_PROJECT: =%" (
    echo ERROR: ten_project must not contain spaces.
    exit /b 1
)

REM Switch to Node 22 (required by Firebase CLI)
call fnm use 22
if errorlevel 1 (
    echo ERROR: Failed to switch to Node.js 22 via fnm.
    exit /b 1
)

REM Run Node.js deploy script
node "%~dp0deploy-child.js" "%~1" "%~2" "%~3"

exit /b %errorlevel%
