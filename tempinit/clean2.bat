@echo off
echo === CLEAN2_START === > d:\Luna\tempinit\clean2_log.txt
echo --- stop gradle daemon --- >> d:\Luna\tempinit\clean2_log.txt
cd /d d:\Luna\android
call gradlew.bat --stop >> d:\Luna\tempinit\clean2_log.txt 2>&1
echo --- rmdir old .gradle --- >> d:\Luna\tempinit\clean2_log.txt
rmdir /s /q "C:\Users\vincent\.gradle" >> d:\Luna\tempinit\clean2_log.txt 2>&1
echo --- verify .gradle --- >> d:\Luna\tempinit\clean2_log.txt
if exist "C:\Users\vincent\.gradle" (echo GRADLE_STILL_EXISTS >> d:\Luna\tempinit\clean2_log.txt) else (echo GRADLE_GONE >> d:\Luna\tempinit\clean2_log.txt)
echo --- npm cache -> E --- >> d:\Luna\tempinit\clean2_log.txt
if not exist "E:\npm-cache" mkdir "E:\npm-cache"
call npm config set cache "E:\npm-cache" >> d:\Luna\tempinit\clean2_log.txt 2>&1
echo new_cache: >> d:\Luna\tempinit\clean2_log.txt
call npm config get cache >> d:\Luna\tempinit\clean2_log.txt
echo --- rmdir old npm cache --- >> d:\Luna\tempinit\clean2_log.txt
rmdir /s /q "C:\Users\vincent\AppData\Local\npm-cache" >> d:\Luna\tempinit\clean2_log.txt 2>&1
echo --- verify npm cache dir --- >> d:\Luna\tempinit\clean2_log.txt
if exist "C:\Users\vincent\AppData\Local\npm-cache" (echo NPMCACHE_STILL_EXISTS >> d:\Luna\tempinit\clean2_log.txt) else (echo NPMCACHE_GONE >> d:\Luna\tempinit\clean2_log.txt)
echo === CLEAN2_DONE === >> d:\Luna\tempinit\clean2_log.txt
