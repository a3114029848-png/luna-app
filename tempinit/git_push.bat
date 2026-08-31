@echo off
cd /d d:\Luna
git push origin main > d:\Luna\tempinit\git_push.txt 2>&1
echo PUSH_EXIT=%ERRORLEVEL% >> d:\Luna\tempinit\git_push.txt
echo === AFTER === >> d:\Luna\tempinit\git_push.txt
git status -sb >> d:\Luna\tempinit\git_push.txt 2>&1
echo === DONE === >> d:\Luna\tempinit\git_push.txt
