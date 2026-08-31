@echo off
cd /d d:\Luna
echo === STATUS === > d:\Luna\tempinit\git_check.txt
git status >> d:\Luna\tempinit\git_check.txt 2>&1
echo === BRANCH_AHEAD === >> d:\Luna\tempinit\git_check.txt
git status -sb >> d:\Luna\tempinit\git_check.txt 2>&1
echo === LOG_15 === >> d:\Luna\tempinit\git_check.txt
git log --oneline -15 >> d:\Luna\tempinit\git_check.txt 2>&1
echo === UNTRACKED_MD === >> d:\Luna\tempinit\git_check.txt
git status --porcelain | findstr /i "md" >> d:\Luna\tempinit\git_check.txt 2>&1
echo === DONE === >> d:\Luna\tempinit\git_check.txt
