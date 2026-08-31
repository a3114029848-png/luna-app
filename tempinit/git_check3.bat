@echo off
cd /d d:\Luna
echo === SHOW_FF56AD8 === > d:\Luna\tempinit\git_check3.txt
git show --stat --oneline ff56ad8 >> d:\Luna\tempinit\git_check3.txt 2>&1
echo === NSEC_TRACKED === >> d:\Luna\tempinit\git_check3.txt
git ls-files android/app/src/main/res/xml/network_security_config.xml >> d:\Luna\tempinit\git_check3.txt 2>&1
echo === MANIFEST_LAST_COMMIT === >> d:\Luna\tempinit\git_check3.txt
git log --oneline -2 -- android/app/src/main/AndroidManifest.xml >> d:\Luna\tempinit\git_check3.txt 2>&1
echo === DOCS_TRACKED === >> d:\Luna\tempinit\git_check3.txt
git ls-files docs >> d:\Luna\tempinit\git_check3.txt 2>&1
echo === DONE === >> d:\Luna\tempinit\git_check3.txt
