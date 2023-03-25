
---
TEWA-1000E 破解超级管理员密码 
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
---
计算红米AX6s ssh密码  
calculate redmi ax6s/ax3200 ssh password  

打开默认的`192.168.31.1`并且登录,能看到SN码  
go to `192.168.31.1`(default) and logo in to check SN  

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
---
