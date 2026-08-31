@echo off
echo === GRADLE_USER_HOME (user level) === > d:\Luna\tempinit\env_check.txt
reg query "HKCU\Environment" /v GRADLE_USER_HOME 2>nul >> d:\Luna\tempinit\env_check.txt
echo === GRADLE_USER_HOME (current proc) === >> d:\Luna\tempinit\env_check.txt
echo %GRADLE_USER_HOME% >> d:\Luna\tempinit\env_check.txt
echo === NPM_CACHE === >> d:\Luna\tempinit\env_check.txt
call npm config get cache >> d:\Luna\tempinit\env_check.txt
echo. >> d:\Luna\tempinit\env_check.txt
echo === NPM_PREFIX === >> d:\Luna\tempinit\env_check.txt
call npm config get prefix >> d:\Luna\tempinit\env_check.txt
echo. >> d:\Luna\tempinit\env_check.txt
echo === E_GRADLE_EXISTS === >> d:\Luna\tempinit\env_check.txt
if exist "E:\gradle-home" (echo YES >> d:\Luna\tempinit\env_check.txt) else (echo NO >> d:\Luna\tempinit\env_check.txt)
echo === DONE === >> d:\Luna\tempinit\env_check.txt
