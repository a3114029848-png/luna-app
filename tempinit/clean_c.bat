@echo off
echo === CLEAN_START === > d:\Luna\tempinit\clean_log.txt
echo --- DEL OLD .gradle (C) --- >> d:\Luna\tempinit\clean_log.txt
if exist "C:\Users\vincent\.gradle" (rmdir /s /q "C:\Users\vincent\.gradle" && echo GRADLE_DELETED >> d:\Luna\tempinit\clean_log.txt) else (echo GRADLE_MISSING >> d:\Luna\tempinit\clean_log.txt)
echo --- NPM CACHE -> E --- >> d:\Luna\tempinit\clean_log.txt
if not exist "E:\npm-cache" mkdir "E:\npm-cache"
call npm config set cache "E:\npm-cache"
echo new_cache=>> d:\Luna\tempinit\clean_log.txt
call npm config get cache >> d:\Luna\tempinit\clean_log.txt
echo --- DEL OLD NPM CACHE (C) --- >> d:\Luna\tempinit\clean_log.txt
if exist "C:\Users\vincent\AppData\Local\npm-cache" (rmdir /s /q "C:\Users\vincent\AppData\Local\npm-cache" && echo NPM_CACHE_DELETED >> d:\Luna\tempinit\clean_log.txt) else (echo NPM_CACHE_MISSING >> d:\Luna\tempinit\clean_log.txt)
echo --- VERIFY --- >> d:\Luna\tempinit\clean_log.txt
if exist "C:\Users\vincent\.gradle" (echo GRADLE_STILL_EXISTS >> d:\Luna\tempinit\clean_log.txt) else (echo GRADLE_GONE_OK >> d:\Luna\tempinit\clean_log.txt)
if exist "E:\gradle-home" (echo E_GRADLE_HOME_OK >> d:\Luna\tempinit\clean_log.txt)
if exist "E:\npm-cache" (echo E_NPM_CACHE_OK >> d:\Luna\tempinit\clean_log.txt)
echo === CLEAN_DONE === >> d:\Luna\tempinit\clean_log.txt
