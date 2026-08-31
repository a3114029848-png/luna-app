@echo off
cd /d d:\Luna\server
call "C:\Program Files\nodejs\npm.cmd" install --no-audit --no-fund
"C:\Program Files\nodejs\node.exe" -e "require('sql.js')().then(()=>console.log('SQLJS_LOCAL_OK')).catch(e=>console.log('SQLJS_ERR',e.message))"
