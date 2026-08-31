@echo off
if exist "C:\Program Files\nodejs\node.exe" echo NODE_PF=OK
if exist "C:\nodejs\node.exe" echo NODE_C=OK
where node 2>nul
