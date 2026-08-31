@echo off
chcp 65001 >nul
cd /d d:\Luna
echo === RM_START === > d:\Luna\tempinit\md_rm.txt
git rm "27届秋招目标公司投递追踪表.md" "AI产品经理核心工作流程系列.md" "BookVoice面试模拟-深挖.md" "BookVoice项目-产品视角.md" "个人消费信贷竞品分析.md" "个人消费信贷需求分析.md" "个人消费信贷风险项目-产品视角.md" "信贷项目面试模拟-深挖.md" "自我介绍总览话术.md" "银发PM面试脚本.md" "银发文娱AI竞品分析.md" "陆华东-标准求职简历.md" "项目面试问答知识库.md" >> d:\Luna\tempinit\md_rm.txt 2>&1
echo --- STATUS --- >> d:\Luna\tempinit\md_rm.txt
git status --short >> d:\Luna\tempinit\md_rm.txt 2>&1
echo --- COMMIT --- >> d:\Luna\tempinit\md_rm.txt
git commit -m "remove personal docs from repo" >> d:\Luna\tempinit\md_rm.txt 2>&1
echo --- PUSH --- >> d:\Luna\tempinit\md_rm.txt
git push origin main >> d:\Luna\tempinit\md_rm.txt 2>&1
echo PUSH_EXIT=%ERRORLEVEL% >> d:\Luna\tempinit\md_rm.txt
echo === RM_DONE === >> d:\Luna\tempinit\md_rm.txt
