@echo off
cd /d d:\Luna\server
taskkill /f /fi "imagename eq node.exe" >nul 2>&1
start "luna" /b "C:\Program Files\nodejs\node.exe" index.js > server_out.txt 2>&1
timeout /t 4 /nobreak >nul
echo ==== server_out.txt ====
type server_out.txt
"C:\Program Files\nodejs\node.exe" -e "fetch('http://127.0.0.1:3000/health').then(r=>r.text()).then(t=>console.log('HEALTH:'+t)).catch(e=>console.log('HEALTH_ERR:'+e.message))"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /f /pid %%p >nul 2>&1
echo LOCAL_TEST_DONE
