@echo off
chcp 65001 >nul
cd /d d:\Luna
echo === STATUS === > d:\Luna\tempinit\git_state.txt
git status -sb >> d:\Luna\tempinit\git_state.txt 2>&1
echo === LOG_LOCAL === >> d:\Luna\tempinit\git_state.txt
git log --oneline -4 >> d:\Luna\tempinit\git_state.txt 2>&1
echo === LOG_REMOTE === >> d:\Luna\tempinit\git_state.txt
git log --oneline -2 origin/main >> d:\Luna\tempinit\git_state.txt 2>&1
echo === DONE === >> d:\Luna\tempinit\git_state.txt
