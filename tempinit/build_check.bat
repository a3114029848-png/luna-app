@echo off
echo === JAVA_PROC === > d:\Luna\tempinit\build_check.txt
tasklist /FI "IMAGENAME eq java.exe" 2>nul | findstr /i "java" >> d:\Luna\tempinit\build_check.txt
tasklist /FI "IMAGENAME eq java.exe" 2>nul | findstr /i "java" | find /c "java" >> d:\Luna\tempinit\build_check.txt
echo === APK === >> d:\Luna\tempinit\build_check.txt
dir /s /b d:\Luna\android\app\build\outputs\apk\*.apk 2>nul >> d:\Luna\tempinit\build_check.txt
echo === GRADLE_LOG_TAIL === >> d:\Luna\tempinit\build_check.txt
if exist d:\Luna\tempinit\build_release_log.txt (powershell -NoProfile -Command "Get-Content 'd:\Luna\tempinit\build_release_log.txt' -Tail 20") >> d:\Luna\tempinit\build_check.txt
echo === CHECK_DONE === >> d:\Luna\tempinit\build_check.txt
