@echo off
cd /d d:\Luna
echo === TRACKED_MD === > d:\Luna\tempinit\md_list.txt
git ls-files *.md >> d:\Luna\tempinit\md_list.txt 2>&1
echo === TRACKED_MD_ALL_DIRS === >> d:\Luna\tempinit\md_list.txt
git ls-files "*.md" | findstr /v "^tempinit/" >> d:\Luna\tempinit\md_list.txt 2>&1
echo === DONE === >> d:\Luna\tempinit\md_list.txt
