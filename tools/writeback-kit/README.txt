素材延展平台 - 延展连接器开发套件

适用范围
--------
仅用于同一 futu-banner-platform-backup 仓库的完整版本。

首次安装
--------
1. 解压本套件。
2. 右键 install.ps1，选择“使用 PowerShell 运行”。
3. 默认安装目录：
   E:\A-富途工作\延展工具平台
4. 如果项目在其他目录，在 PowerShell 中运行：
   .\install.ps1 -Target "你的项目目录"
5. 根据安装完成提示，在 Figma 桌面版通过“插件 → 开发 → 从清单导入插件”选择 manifest.json。

日常使用
--------
1. 双击项目根目录的 start-platform.cmd。
2. 浏览器打开 http://localhost:3210。
3. 在 Figma 中运行「延展连接器（ExtendLink）」。
4. 输入平台显示的连接码并连接。
5. 在平台点击生成。

开发阶段需要保持 start-platform.cmd 和 Figma 调用器开启。
