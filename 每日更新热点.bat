@echo off
title 每日更新热点 - 全球黄页
cd /d "%~dp0"

echo.
echo   ============================================
echo    每日更新热点 - 全球黄页站点
echo    抓取榜单 - 生成数据 - 提交 - 部署 - 验证
echo   ============================================
echo.

rem ---- 找 Python：系统 Python 3.12 -> py -3 -> PATH ----
set "PYCMD="
for %%P in ("C:/Python/Python312/python.exe" "py -3" "python" "python3") do (
    if not defined PYCMD (
        %%~P --version >nul 2>nul
        if not errorlevel 1 set "PYCMD=%%~P"
    )
)
if not defined PYCMD (
    echo   [失败] 没找到 Python，无法更新。请安装 Python 3 或把
    echo   C:/Python/Python312/python.exe 加入 PATH。
    echo.
    pause
    exit /b 1
)

rem ---- 找 git：PortableGit 1.3.0 -> PATH ----
set "GITCMD="
for %%G in ("C:/Users/heini/.workbuddy/binaries/PortableGit/versions/1.3.0/cmd/git.exe" "git") do (
    if not defined GITCMD (
        %%~G --version >nul 2>nul
        if not errorlevel 1 set "GITCMD=%%~G"
    )
)

echo   [1/8] 抓取当日热点站点（HN / GitHub / InfoQ / RSS）...
%PYCMD% tools\fetch-trending.py
if errorlevel 1 (
    echo   [警告] 采集器报错，继续用现有数据走后续流程。
)

echo.
echo   [2/8] 翻译热点条目为四国语言（失败自动回退英文原文）...
%PYCMD% tools\translate-trending.py

echo.
echo   [3/8] 补抓缺失的站点截图（每日 20 个，滚动补齐 + 新热点站点）...
%PYCMD% tools\gen-shots.py --trending --limit 20

echo.
echo   [4/8] 补中文站名拼音索引（仅 data.js 中文站名有变化时才写）...
%PYCMD% tools\gen-pinyin.py

echo.
echo   [5/8] 刷新资源版本号与 sitemap（顺带重新生成主题合辑页）...
%PYCMD% tools\gen-seo.py

rem V2 皮肤由 app.js 生成，改了 app.js 必须同步，否则两版行为会分叉
%PYCMD% tools\sync-app-v2.py

echo.
echo   [6/8] 本地提交...
if defined GITCMD (
    %GITCMD% add assets\js\trending.js assets\js\data.js assets\img\shots index.html index-v2.html sitemap.xml sites.html robots.txt
    %GITCMD% commit -m "chore(trending): 每日热点更新"
) else (
    echo   [跳过] 没找到 git，只生成本地文件。
)

echo.
echo   [7/8] 推送到 GitHub（Cloudflare 约 30 秒自动部署）...
set "PUSHED=0"
if defined GITCMD (
    %GITCMD% push origin main >nul 2>nul
    if not errorlevel 1 set "PUSHED=1"
)
if "%PUSHED%"=="0" (
    echo   git push 不可用（常见于代理环境），改用 GitHub API 提交...
    for /f "delims=" %%F in ('dir /b assets\img\shots 2^>nul') do git add "assets\img\shots\%%F" >nul 2>nul
    %PYCMD% tools\gh-api-commit.py assets\js\trending.js assets\js\data.js index.html index-v2.html sitemap.xml sites.html robots.txt -m "chore(trending): 每日热点更新"
)

echo.
echo   [8/8] 等待部署并线上验证...
timeout /t 40 /nobreak >nul
curl -s https://ypage.ccwu.cc/assets/js/trending.js -o "%TEMP%\gyp-trend.js"
findstr /c:"siteTitle" "%TEMP%\gyp-trend.js" >nul
if errorlevel 1 (
    echo   [失败] 线上 trending.js 取不到数据，请到 Cloudflare 后台看部署日志。
) else (
    echo   [OK] 线上热点数据已更新。
)
curl -s https://ypage.ccwu.cc/robots.txt | findstr /c:"User-agent" >nul
if errorlevel 1 (
    echo   [失败] robots.txt 异常（可能被 SPA 回退），需检查托管设置。
) else (
    echo   [OK] robots.txt 正常。
)

echo.
echo   ============================================
echo    完成。站点：https://ypage.ccwu.cc/
echo   ============================================
echo.
pause
