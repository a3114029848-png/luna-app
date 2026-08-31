@echo off
echo === SING_SYNC_START === > d:\Luna\tempinit\sing_sync.txt
cd /d d:\Luna\tempinit
if not exist sing-resume\.git (
  echo --- CLONE --- >> d:\Luna\tempinit\sing_sync.txt
  git clone https://github.com/a3114029848-png/sing-resume.git sing-resume >> d:\Luna\tempinit\sing_sync.txt 2>&1
) else (
  echo --- ALREADY_CLONED --- >> d:\Luna\tempinit\sing_sync.txt
)
echo --- COPY_MD --- >> d:\Luna\tempinit\sing_sync.txt
copy /y d:\Luna\*.md sing-resume\ >> d:\Luna\tempinit\sing_sync.txt 2>&1
echo --- STATUS --- >> d:\Luna\tempinit\sing_sync.txt
cd /d d:\Luna\tempinit\sing-resume
git status --short >> d:\Luna\tempinit\sing_sync.txt 2>&1
echo --- COMMIT --- >> d:\Luna\tempinit\sing_sync.txt
git add *.md >> d:\Luna\tempinit\sing_sync.txt 2>&1
git commit -m "sync luna md docs 2026-08-31" >> d:\Luna\tempinit\sing_sync.txt 2>&1
echo --- PUSH --- >> d:\Luna\tempinit\sing_sync.txt
git push origin main >> d:\Luna\tempinit\sing_sync.txt 2>&1
echo PUSH_EXIT=%ERRORLEVEL% >> d:\Luna\tempinit\sing_sync.txt
echo === SING_SYNC_DONE === >> d:\Luna\tempinit\sing_sync.txt
