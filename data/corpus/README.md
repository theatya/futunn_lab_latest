# 广告语料数据

这里是平台语料的独立、可版本化备份。运行时方案库位于
`packages/corpus/src/generated.ts`，两者必须由导入器同步更新。

## 分层

- `manifest.json`：稳定来源清单、Figma file key/node id 与排除规则。
- `snapshots/`：按导入时间保存的 Figma REST 原始响应，只新增、不覆盖。
- `normalized/`：清洗后的资源位、排版、CTA、角标数据。
- `reports/`：每次导入的成功、排除、重复和异常记录。

## 更新

```bash
$env:FIGMA_ACCESS_TOKEN="..."
pnpm corpus:import
```

没有 Token 时可运行 `pnpm corpus:validate`，只校验仓库内现有版本。

## 铁律

1. 纯净版负责资源位几何；训练版负责排版与视觉样式。
2. 原始快照不可覆盖，规范化数据必须带来源节点。
3. 标记“🌟特殊，不训练”的页面不进入 Banner 方案库。
4. 主视觉参考不生成 `LayoutPreset`，项目主视觉仍由第一步识别。
