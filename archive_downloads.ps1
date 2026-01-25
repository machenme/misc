# 1. 定义变量
$taskName = "DailyArchiveDownloads"
$pythonScript = "C:\Users\chen\archive_downloads.py"
$logFile = "C:\Users\chen\archive_log.txt"

# 2. 定义运行的动作 (使用 uv run)
# -ExecutionPolicy Bypass 确保脚本能顺利执行
$action = New-ScheduledTaskAction -Execute "uv" `
    -Argument "run `"$pythonScript`"" `
    -WorkingDirectory "C:\Users\chen"

# 3. 定义触发器：每天早上 8:00
$trigger = New-ScheduledTaskTrigger -Daily -At 8:00am

# 4. 定义设置（防止错过时间后不再运行，并确保每天最多一次）
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)

# 5. 注册任务
# 如果任务已存在，则重新创建
Register-ScheduledTask -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Force

Write-Host "任务 '$taskName' 已成功创建！脚本将于每天 08:00 运行。" -ForegroundColor Green