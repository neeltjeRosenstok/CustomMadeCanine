@echo off
title Custom Made Canine v21.7
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo ERROR: Dependency installation failed.
    pause
    exit /b 1
  )
)
if not exist .env (
  copy .env.example .env >nul
  echo.
  echo Created .env from .env.example.
  echo.
)
echo Starting Custom Made Canine v21.7...
call npm start
pause
