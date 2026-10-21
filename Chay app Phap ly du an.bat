@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (echo Cai thu vien... & call npm install --no-audit --no-fund)
call node server\init-db.js
call node server\sync.js
echo Mo trinh duyet: http://localhost:3400
start "" http://localhost:3400
node server\server.js
pause
