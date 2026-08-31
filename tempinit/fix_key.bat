@echo off
setlocal
"C:\Windows\System32\icacls.exe" "D:\Luna_homework\luna_using.pem" /inheritance:r
"C:\Windows\System32\icacls.exe" "D:\Luna_homework\luna_using.pem" /grant "%USERNAME%:R"
"C:\Windows\System32\icacls.exe" "D:\Luna_homework\luna_using.pem" /grant "SYSTEM:R"
echo KEY_PERM_FIXED
