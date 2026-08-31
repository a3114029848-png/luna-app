@echo off
echo === CHECK === > d:\Luna\tempinit\check2_log.txt
echo --- npm cache now --- >> d:\Luna\tempinit\check2_log.txt
call npm config get cache >> d:\Luna\tempinit\check2_log.txt
echo --- C old npm-cache --- >> d:\Luna\tempinit\check2_log.txt
if exist "C:\Users\vincent\AppData\Local\npm-cache" (echo C_NPMCACHE_EXISTS >> d:\Luna\tempinit\check2_log.txt) else (echo C_NPMCACHE_GONE >> d:\Luna\tempinit\check2_log.txt)
echo --- E npm-cache --- >> d:\Luna\tempinit\check2_log.txt
if exist "E:\npm-cache" (echo E_NPMCACHE_EXISTS >> d:\Luna\tempinit\check2_log.txt) else (echo E_NPMCACHE_MISSING >> d:\Luna\tempinit\check2_log.txt)
echo --- C .gradle --- >> d:\Luna\tempinit\check2_log.txt
if exist "C:\Users\vincent\.gradle" (echo C_GRADLE_EXISTS >> d:\Luna\tempinit\check2_log.txt) else (echo C_GRADLE_GONE >> d:\Luna\tempinit\check2_log.txt)
echo --- npmrc user --- >> d:\Luna\tempinit\check2_log.txt
if exist "%USERPROFILE%\.npmrc" (type "%USERPROFILE%\.npmrc" >> d:\Luna\tempinit\check2_log.txt) else (echo NO_NPMRC >> d:\Luna\tempinit\check2_log.txt)
echo === CHECK_DONE === >> d:\Luna\tempinit\check2_log.txt
