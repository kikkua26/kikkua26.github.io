# kikkua 工具箱 — 插件开发规范

## 概述

每个工具是一个独立插件，运行在 iframe 中，通过共享的 CSS 基础样式和 JS SDK 保持一致的架构风格。

## 目录结构

```
tools/
├── shared/                 # 共享资源（不要修改）
│   ├── base.css            # 设计令牌 + 通用组件样式
│   └── sdk.js              # 插件 SDK
├── <plugin-id>/            # 插件目录
│   ├── index.html          # 入口
│   ├── style.css           # 业务样式
│   ├── main.js             # ES module 入口
│   └── modules/            # 功能模块
│       ├── constants.js    # 常量定义
│       ├── utils.js        # 业务工具函数
│       ├── core.js         # 核心数据操作
│       ├── ui.js           # UI 交互
│       ├── events.js       # 事件绑定
│       └── ...
└── PLUGIN.md               # 本文件
```

## 入口模板

### index.html

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>插件名</title>
  <link rel="stylesheet" href="../shared/base.css">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="tool-app">
    <div class="tool-toolbar">
      <!-- 工具栏 -->
    </div>
    <div class="tool-body" style="flex:1;overflow:auto">
      <!-- 主体内容 -->
    </div>
    <div class="tool-status">
      <!-- 状态栏 -->
    </div>
  </div>
  <div class="tool-signature">kikkua</div>
  <script type="module" src="main.js"></script>
</body>
</html>
```

### main.js

```js
import { registerPlugin } from '../shared/sdk.js';
import { bindEvents } from './modules/events.js';
import { init } from './modules/core.js';

registerPlugin({
  id: 'my-plugin',
  name: '插件名',
  icon: '📋',
  desc: '一句话描述功能',
  version: '1.0.0'
});

init();
bindEvents();
```

## 编码规则

### JavaScript

| 规则 | 说明 |
|------|------|
| ES Modules | 必须用 `<script type="module">`，禁止全局脚本 |
| 单模块 ≤ 300 行 | 超出则按职责拆分 |
| 状态内聚 | 模块级变量，不挂 `window` |
| 事件集中绑定 | 统一在 `events.js` 中，用 `addEventListener` |
| 无内联事件 | 禁止 `onclick="..."` 等 HTML 属性 |
| 懒加载 | 重型库用 `loadScript()` 按需加载 |
| 导入顺序 | SDK → 共享模块 → 业务模块 |

### CSS

| 规则 | 说明 |
|------|------|
| 用 `--tool-*` 令牌 | 颜色、间距、圆角、阴影都用变量 |
| 个性化覆盖 | `:root { --tool-accent: #6c5ce7; }` 即可换主题 |
| 组件前缀 | 业务样式用插件 ID 前缀，如 `.qb-table`, `.oc-canvas` |
| 不重复定义 | base.css 已有的组件样式直接用 `.tool-btn` 等 |

### 模块职责划分

```
constants.js  — 常量、枚举、配置映射
utils.js      — 纯函数工具（格式化、验证、转换）
core.js       — 数据模型、CRUD、状态管理
ui.js         — DOM 渲染、模态框、Toast
events.js     — 所有 addEventListener 绑定
```

不是每个插件都需要全部模块，按需创建。简单插件可以只有 `main.js` + `events.js`。

## SDK API

```js
import { esc, sanitizeHtml, download, debounce, loadScript,
         saveCache, loadCache, clearCache,
         registerPlugin, notifyParent } from '../shared/sdk.js';
```

| 函数 | 用途 |
|------|------|
| `esc(s)` | HTML 转义 |
| `sanitizeHtml(html)` | XSS 清理，递归移除危险标签/属性 |
| `download(name, content, type)` | 触发浏览器下载 |
| `debounce(fn, ms)` | 防抖 |
| `loadScript(src)` | 懒加载外部脚本，自动去重 |
| `saveCache(key, data)` | localStorage 序列化存储 |
| `loadCache(key)` | localStorage 反序列化读取 |
| `clearCache(key)` | 删除缓存项 |
| `registerPlugin(manifest)` | 注册插件元数据 |
| `notifyParent(type, data)` | postMessage 通知父框架 |

## 注册新插件

1. 在 `tools/<plugin-id>/` 下按模板创建文件
2. 编辑 `js/views/tools.js` 的 `TOOLS` 数组，添加一行：

```js
{ id: 'my-plugin', name: '插件名', icon: '📋', desc: '描述', url: '/tools/my-plugin/index.html' }
```

3. 完成。

## 参考实现

- **简单插件**：`tools/occlusion/` — 单文件，300 行，无依赖
- **复杂插件**：`tools/question-bank/` — 14 模块，ES Modules，外部依赖懒加载
