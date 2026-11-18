# 把 dist/ 复制到 LearnHarness 插件目录
$dst = "$env:APPDATA\LearnHarness\data\plugins\zh-cn-language-pack"
New-Item -ItemType Directory -Force "$dst\dist" | Out-Null
Copy-Item "$PSScriptRoot\dist\*" "$dst\dist" -Force
Write-Host "已安装到 $dst"
Write-Host "打开 设置 → 社区插件，把「简体中文语言包」的开关打开，再重启应用。"
