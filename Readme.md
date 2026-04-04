- [Openclaw wsl显示注入代理启动](#Openclaw-wsl显示注入代理启动)
- [Oracle database 11GR2 11.2.0.4.0 兼容Oracle Linux 7.9](#oracle-database-11gr2-112040-兼容oracle-linux-79)
- [黑域](#黑域)
- [TEWA-1000E 破解超级管理员密码](#tewa-1000e-破解超级管理员密码)
- [计算红米AX6s ssh密码](#计算红米ax6s-ssh密码)
- [LTSC MS GAMING OVERLAY remove](#ltsc-ms-gaming-overlay-remove)
- [uv添加国内源](#uv添加国内源)
- [python 连接sqlServer](#python-连接sqlserver)
- [PLT显示中文和负号](#plt显示中文和负号)
- [LSTM network 多X特征反归一化解决方法](#lstm-network-多x特征反归一化解决方法)
- [Microsoft Visual C++ 14.0 or greater is required. Get it with "Microsoft C++ Build Tools": https://visualstudio.microsoft.com/visual-cpp-build-tools/](#microsoft-visual-c-140-or-greater-is-required-get-it-with-microsoft-c-build-tools-httpsvisualstudiomicrosoftcomvisual-cpp-build-tools)
- [install ohmyzsh in china](#install-ohmyzsh-in-china)
- [修改conda源](#修改conda源)
- [修改pip源](#修改pip源)

## Openclaw wsl显示注入代理启动
```bash
HTTP_PROXY=http://127.0.0.1:7897 HTTPS_PROXY=http://127.0.0.1:7897 NODE_TLS_REJECT_UNAUTHORIZED=0 DEBUG=openclaw:tools:* openclaw gateway run
```

## Oracle database 11GR2 11.2.0.4.0 兼容Oracle Linux 7.9
```
magnet:?xt=urn:btih:4FA33857F956EBCB3FE630753B59DEF49EF76445
```

## 黑域
```cmd
adb -d shell 'output=$(pm path me.piebridge.brevent); export CLASSPATH=${output#*:}; app_process /system/bin me.piebridge.brevent.server.BreventServer bootstrap; /system/bin/sh /data/local/tmp/brevent.sh'
```

## TEWA-1000E 破解超级管理员密码 
下载天邑工具.exe后打开,选择大悦me连接后手动输入相关登录命令.每次输入一次按一下回车  
适用于硬件版本V1.0的  
```
telnetadmin
telnetadmin
su
BwcNuaFS
exit
telecomadmin get
```

## 计算红米AX6s ssh密码  

打开默认的`192.168.31.1`并且登录,能看到SN码   

可以把下面代码另存为calc_passwd.py然后运行`python calc_passwd.py 12345/A1BC23456`(将12345/A1BC23456替换为你的SN码)

```python
import sys
import hashlib

def calc_passwd(sn):
    passwd = sn + '6d2df50a-250f-4a30-a5e6-d44fb0960aa0'
    md5_value = hashlib.md5(passwd.encode())
    return md5_value.hexdigest()[:8]

if __name__ == "__main__":
    if len(sys.argv) > 1:
        serial = sys.argv[1]  # you can input your SN here.
        print(calc_passwd(serial))
    else:
        serial = input('input your SN eg: 12345/A1BC23456 \n')
        print(calc_passwd(serial))
```

## LTSC MS GAMING OVERLAY remove
直接复制粘贴到管理员右键即可
```ps1
# --- 1. 权限检查：确保以管理员身份运行 ---
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "请以管理员身份运行此脚本！" -ForegroundColor Red
    return
}

Write-Host "正在开始清理 Xbox Game Bar 相关组件..." -ForegroundColor Cyan

# --- 2. 卸载 Xbox 相关组件 ---
Write-Host "[1/3] 正在卸载 Appx 软件包..." -ForegroundColor Yellow
$packages = @(
    "Microsoft.XboxGamingOverlay",
    "Microsoft.XboxGameOverlay",
    "Microsoft.XboxSpeechToTextOverlay"
)
foreach ($pkg in $packages) {
    Get-AppxPackage $pkg -AllUsers | Remove-AppxPackage -ErrorAction SilentlyContinue
}

# --- 3. 禁用 GameDVR 注册表配置 ---
Write-Host "[2/3] 正在修改 GameDVR 策略..." -ForegroundColor Yellow
$regConfig = @(
    @{ Path = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR"; Name = "AppCaptureEnabled"; Value = 0 },
    @{ Path = "HKCU:\System\GameConfigStore"; Name = "GameDVR_Enabled"; Value = 0 }
)

foreach ($item in $regConfig) {
    if (-not (Test-Path $item.Path)) { New-Item -Path $item.Path -Force | Out-Null }
    Set-ItemProperty -Path $item.Path -Name $item.Name -Value $item.Value -Type DWord -Force
}

# --- 4. 彻底禁用协议关联 (防止弹出“需要新应用以打开此 ms-gamebar 链接”) ---
Write-Host "[3/3] 正在劫持 ms-gamebar 协议关联..." -ForegroundColor Yellow
$protPaths = @("Registry::HKEY_CLASSES_ROOT\ms-gamebar", "Registry::HKEY_CLASSES_ROOT\ms-gamebarservices")

foreach ($path in $protPaths) {
    # 创建基础路径
    if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
    
    # 设置协议头
    Set-Item -Path $path -Value "URL:ms-gamebar" -Force
    Set-ItemProperty -Path $path -Name "URL Protocol" -Value "" -Force
    Set-ItemProperty -Path $path -Name "NoOpenWith" -Value "" -Force
    
    # 劫持 Open 命令，指向空运行程序
    $cmdPath = "$path\shell\open\command"
    if (-not (Test-Path $cmdPath)) { New-Item -Path $cmdPath -Force | Out-Null }
    Set-Item -Path $cmdPath -Value "$env:SystemRoot\System32\systray.exe" -Force
}

Write-Host "-------------------------------------------"
Write-Host "操作完成！Xbox Game Bar 已被深度禁用。" -ForegroundColor Green
Write-Host "提示：建议重启资源管理器 (explorer.exe) 或重启电脑以生效。" -ForegroundColor Gray
```


## uv添加国内源 
windows powershell
```powershell
$filePath = Join-Path $env:APPDATA 'uv\uv.toml'
$dir = Split-Path $filePath -Parent
New-Item -Path $dir -ItemType Directory -Force | Out-Null
@"
python-install-mirror = "https://registry.npmmirror.com/-/binary/python-build-standalone"
[[index]]
url = "https://mirrors.bfsu.edu.cn/pypi/web/simple"
# url = "https://mirrors.tuna.tsinghua.edu.cn/pypi/web/simple"
# url = "https://mirrors.cernet.edu.cn/pypi/web/simple"
default = true
"@ | Set-Content -Path $filePath
```


## python 连接sqlServer
- 下载`OOBC`驱动 [https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server?view=sql-server-ver16](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server?view=sql-server-ver16)
- Sql Server 配置管理器-SQL SERVER 网络配置-SQLEXPRESS的协议-TCP/IP属性-IP地址-IPALL-TCP动态端口留空 TCP端口对应下面的1433-重启sql服务
```python
import pyodbc
import pandas as pd

# 数据库连接配置
conn_str = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=localhost\\SQLEXPRESS,1433;"
    "DATABASE=BlockchainPolicyDB;"
    "Trusted_Connection=yes;"
    "TrustServerCertificate=yes;"
)
conn = pyodbc.connect(conn_str)
cursor = conn.cursor()
```


## PLT显示中文和负号
```py
import matplotlib.pyplot as plt
plt.rcParams["font.sans-serif"] = ["SimHei"]  # 用来正常显示中文标签
plt.rcParams["axes.unicode_minus"] = False  # 用来正常显示负号
```

## LSTM network 多X特征反归一化解决方法
```py
from sklearn.preprocessing import MinMaxScaler
# 归一化
scaler = MinMaxScaler(feature_range=(0, 1))
data_normalized = scaler.fit_transform(data)
divi = 6
# 反归一化预测结果  6 是X的特征维度
prediction_copies_array = np.repeat(predicted.detach().cpu().numpy(), divi, axis=-1)

predicted_cpu = predicted.detach().cpu().numpy()
predicted_np = scaler.inverse_transform(
    np.reshape(prediction_copies_array, (len(predicted_cpu), divi))
)[:, 0]

y_test_copies_array = np.repeat(y_test_tensor.detach().cpu().numpy(), divi, axis=-1)

y_test_cpu = y_test_tensor.detach().cpu().numpy()
y_test_np = scaler.inverse_transform(
    np.reshape(y_test_copies_array, (len(y_test_cpu), divi))
)[:, 0]
```



## Microsoft Visual C++ 14.0 or greater is required. Get it with "Microsoft C++ Build Tools": https://visualstudio.microsoft.com/visual-cpp-build-tools/
```bash
.\vs_buildtools.exe --norestart --passive --downloadThenInstall --includeRecommended --add Microsoft.VisualStudio.Workload.NativeDesktop --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Workload.MSBuildTools
```

## install ohmyzsh in china
```bash
git clone https://mirrors4.tuna.tsinghua.edu.cn/git/ohmyzsh.git
cd ohmyzsh/tools
REMOTE=https://mirrors4.tuna.tsinghua.edu.cn/git/ohmyzsh.git sh install.sh
```

## 修改conda源
```bash
cd ~
vim .condarc
```

```bash
channels:
  - defaults
show_channel_urls: true
default_channels:
  - http://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/main
  - http://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/r
  - http://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/msys2
custom_channels:
  conda-forge: http://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud
  pytorch: http://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud
```
## 修改pip源
```bash
pip config set global.index-url http://mirrors.tuna.tsinghua.edu.cn/pypi/web/simple
```

