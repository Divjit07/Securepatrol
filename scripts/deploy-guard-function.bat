@echo off
REM Add Node.js from D drive to PATH for this session
set "PATH=D:\nodejs;%PATH%"

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: node.exe not found. Expected at D:\nodejs\node.exe
  echo Install Node or update the PATH line in this script.
  pause
  exit /b 1
)

echo SecurePatrol - Deploy guard Edge Functions
echo Node: 
node --version
echo.

echo Step 1: Login to Supabase (browser will open)
call npx supabase login
if errorlevel 1 goto :failed

echo.
echo Step 2: Link your project
call npx supabase link --project-ref vktxadadhnrcuxtubzxr
if errorlevel 1 goto :failed

echo.
echo Step 3: Deploy functions
call npx supabase functions deploy create-guard
call npx supabase functions deploy delete-guard

echo.
echo Done! Guard Manager add/remove should now work.
pause
exit /b 0

:failed
echo.
echo Something failed. Check the error above.
pause
exit /b 1
