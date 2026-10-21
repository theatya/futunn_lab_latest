# 资源位自动延展平台

内容 + 画幅 → 求解版式 → 写进 Figma。

核心逻辑在 `packages/`，不依赖 Next.js。Web 只是第一层壳，以后迁桌面端换 `apps/` 即可。

## 本地运行

```bash
cd platform
pnpm install
pnpm --filter @futu/web dev
```

浏览器打开 http://localhost:3210

## 写回 Figma（连接器）

Figma REST API 不支持直接修改画布，因此写入通过本仓库内的开发插件完成：

1. 当前开发阶段，在 Figma Desktop 打开包含主视觉组件的文件，并依次选择 `Plugins → Development → Import plugin from manifest…`，选择 `figma-plugin/manifest.json`。正式发布时将连接器发布为团队内部插件，用户只需安装、授权一次。
2. 在平台第一步「识别画板」分别识别母版画板和主视觉 `Component / Instance` 链接。
3. 到第四步复制 5 位连接码，打开「延展连接器（ExtendLink）」并输入连接码。
4. 保持插件窗口开启，在平台点击生成。插件会创建画板并放入主视觉组件的实例。

首个版本仅支持在包含该组件的同一 Figma 文件中运行插件；跨文件团队库组件导入尚未接入。

平台始终是主操作界面，Figma 连接器只负责读取当前文件环境、轮询写入任务和修改画布。开发阶段需同时运行本地平台与开发插件；部署平台并发布团队插件后，用户不再需要 PowerShell。

## 包怎么分

| 包 | 干什么 |
| --- | --- |
| `@futu/domain` | 类型和常量，零运行时依赖 |
| `@futu/solver` | 版面求解器，纯函数 |
| `@futu/specs` | 尺寸清单 + 站内规范 |
| `@futu/ports` | 端口接口，没有实现 |
| `@futu/adapters-web` | 浏览器实现（localStorage / fetch） |
| `@futu/orchestrator` | 把 Project 展开成一批画板并交给写入端口 |
| `@futu/web` | Next.js 界面 |

Figma 写入链路已经接通：平台提交任务，延展连接器按 5 位连接码领取任务，并在当前 Figma 文件中创建画板、图层和主视觉组件实例。

## 设计与前端实施

所有界面设计、交互调整和视觉验收统一遵循 [DESIGN_IMPLEMENTATION.md](./DESIGN_IMPLEMENTATION.md)。项目级 Cursor Rule 会自动要求按任务调用 `frontend-design`、`ui-ux-pro-max` 和 `awesome-design-md` 中适用的能力，并在交付时记录实际调用情况。
