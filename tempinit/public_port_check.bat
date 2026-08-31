@echo off
"C:\Program Files\nodejs\node.exe" -e "const net=require('net');['22','3000'].forEach(p=>{const s=net.connect({host:'49.232.49.16',port:+p});s.setTimeout(6000);s.on('connect',()=>{console.log('PORT'+p+':OPEN');s.end()});s.on('error',e=>console.log('PORT'+p+':ERR '+e.code));s.on('timeout',()=>{console.log('PORT'+p+':TIMEOUT');s.destroy()});});"
