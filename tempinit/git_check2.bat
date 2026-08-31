@echo off
cd /d d:\Luna
echo === SHOW_3COMMITS === > d:\Luna\tempinit\git_check2.txt
git show --stat --oneline 8be8f33 >> d:\Luna\tempinit\git_check2.txt 2>&1
echo ==== >> d:\Luna\tempinit\git_check2.txt
git show --stat --oneline ba4913c >> d:\Luna\tempinit\git_check2.txt 2>&1
echo ==== >> d:\Luna\tempinit\git_check2.txt
git show --stat --oneline ff56ad8 >> d:\Luna\tempinit\git_check2.txt 2>&1
echo === TRACKED_DOCS === >> d:\Luna\tempinit\git_check2.txt
git ls-files docs >> d:\Luna\tempinit\git_check2.txt 2>&1
echo === TRACKED_WORKLOG === >> d:\Luna\tempinit\git_check2.txt
git ls-files 工作日志.md >> d:\Luna\tempinit\git_check2.txt 2>&1
echo === CHECK_MAIN_FILES_TRACKED === >> d:\Luna\tempinit\git_check2.txt
git ls-files server/index.js server/db.js src/services/api.js android/app/src/main/AndroidManifest.xml >> d:\Luna\tempinit\git_check2.txt 2>&1
echo === DONE === >> d:\Luna\tempinit\git_check2.txt
