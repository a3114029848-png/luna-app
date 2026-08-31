@echo off
echo === DISK_SPACE === > d:\Luna\tempinit\disk_check.txt
wmic logicaldisk get caption,freespace,size 2>nul >> d:\Luna\tempinit\disk_check.txt
echo === GRADLE_HOME_ENV === >> d:\Luna\tempinit\disk_check.txt
echo GRADLE_USER_HOME=%GRADLE_USER_HOME% >> d:\Luna\tempinit\disk_check.txt
echo === C_USER_GRADLE === >> d:\Luna\tempinit\disk_check.txt
if exist "%USERPROFILE%\.gradle" (dir /s /b "%USERPROFILE%\.gradle" 2>nul | find /c /v "" >> d:\Luna\tempinit\disk_check.txt) else (echo NO_USER_GRADLE >> d:\Luna\tempinit\disk_check.txt)
echo === E_GRADLE_SIZE === >> d:\Luna\tempinit\disk_check.txt
if exist "E:\gradle-home" (dir /s /b "E:\gradle-home" 2>nul | find /c /v "" >> d:\Luna\tempinit\disk_check.txt) else (echo NO_E_GRADLE >> d:\Luna\tempinit\disk_check.txt)
echo === NDK_LOCATIONS === >> d:\Luna\tempinit\disk_check.txt
if exist "%LOCALAPPDATA%\Android\Sdk\ndk" (echo NDK_IN_LOCALAPPDATA >> d:\Luna\tempinit\disk_check.txt) else (echo NO_NDK_LOCALAPP >> d:\Luna\tempinit\disk_check.txt)
echo === GRADLE_PROPS === >> d:\Luna\tempinit\disk_check.txt
if exist "d:\Luna\android\gradle.properties" (findstr /i "gradle" "d:\Luna\android\gradle.properties" >> d:\Luna\tempinit\disk_check.txt) else (echo NO_GRADLE_PROPS >> d:\Luna\tempinit\disk_check.txt)
echo === DONE === >> d:\Luna\tempinit\disk_check.txt
