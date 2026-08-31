@echo off
echo === DIST_START === > d:\Luna\tempinit\dist_log.txt
if not exist "d:\Luna\dist" mkdir "d:\Luna\dist"
echo --- copy apk --- >> d:\Luna\tempinit\dist_log.txt
copy /y "d:\Luna\android\app\build\outputs\apk\release\app-release.apk" "d:\Luna\dist\Luna-v1.0.apk" >> d:\Luna\tempinit\dist_log.txt 2>&1
echo --- write readme --- >> d:\Luna\tempinit\dist_log.txt
(
echo Luna 经期健康管理 App - 安装说明
echo ================================
echo.
echo 1. 把本 zip 解压，得到 Luna-v1.0.apk
echo 2. 把 apk 传到安卓手机（微信文件传输助手 / 数据线）
echo 3. 点击 apk 安装；如提示"未知来源/外部应用"，点"允许/设置"后继续
echo 4. 安装完成打开即可使用（首次启动联网，AI/云同步自动连云端）
echo.
echo 说明：App 联网使用公网服务器（AI 问答 / 云同步 / PDF 报告），
echo       数据按设备隔离，多人互不影响。
) > "d:\Luna\dist\安装说明.txt"
echo --- zip --- >> d:\Luna\tempinit\dist_log.txt
powershell -NoProfile -Command "Compress-Archive -Path 'd:\Luna\dist\Luna-v1.0.apk','d:\Luna\dist\安装说明.txt' -DestinationPath 'd:\Luna\dist\Luna-微信安装包.zip' -Force" >> d:\Luna\tempinit\dist_log.txt 2>&1
echo --- list --- >> d:\Luna\tempinit\dist_log.txt
dir d:\Luna\dist >> d:\Luna\tempinit\dist_log.txt
echo === DIST_DONE === >> d:\Luna\tempinit\dist_log.txt
