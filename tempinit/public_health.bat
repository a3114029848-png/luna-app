@echo off
"C:\Program Files\nodejs\node.exe" -e "fetch('http://49.232.49.16:3000/health').then(r=>r.text()).then(t=>console.log('PUBLIC_HEALTH:'+t)).catch(e=>console.log('PUBLIC_ERR:'+e.message))"
