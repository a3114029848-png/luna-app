@echo off
cd /d d:\Luna\android
call gradlew.bat assembleRelease > d:\Luna\tempinit\build_release_log.txt 2>&1
echo BUILD_EXIT=%ERRORLEVEL% >> d:\Luna\tempinit\build_release_log.txt
