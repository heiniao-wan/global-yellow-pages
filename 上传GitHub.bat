@echo off
title GitHub 上传向导 - 全球黄页
cd /d "%~dp0"

echo.
echo   ============================================
echo    GitHub 上传向导 - 全球黄页站点
echo    双击即可运行，跟着弹窗一步步填就行
echo   ============================================
echo.

rem ---- 自动找 Python：系统 Python 3.12 -> py -3 启动器 -> PATH 里的 python ----
set "PYCMD="
for %%P in ("C:\Python\Python312\python.exe" "py -3" "python" "python3") do (
    if not defined PYCMD (
        %%~P --version >nul 2>nul
        if not errorlevel 1 set "PYCMD=%%~P"
    )
)

if not defined PYCMD (
    echo   [错误] 没找到 Python，无法运行上传向导。
    echo.
    echo   解决办法二选一：
    echo     1^) 安装 Python 3（安装时记得勾选 Add Python to PATH）
    echo     2^) 用记事本打开本文件，把 C:\Python\Python312\python.exe 改成你的 python.exe 路径
    echo.
    pause
    exit /b 1
)

echo   使用解释器：%PYCMD%
echo.
echo   向导窗口马上弹出；如果没看到，请看下任务栏。
echo.

%PYCMD% "%~dp0github-uploader.py" %*

if errorlevel 1 (
    echo.
    echo   [异常结束] 上面是详细日志，可截图反馈。
    echo.
    pause
)

echo.
echo   已退出。
