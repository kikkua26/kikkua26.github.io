# kikkua · 知识卡片

Anki 卡片在线预览工具，支持多牌组切换、目录导航、键盘操作。

## 功能

- **牌组列表** — 首页展示所有可用牌组，显示卡片数量和上次学习时间
- **卡片学习** — 点击牌组进入学习页，iframe 内渲染 Anki 模板
- **目录导航** — 侧边栏按章节组织，支持折叠/展开
- **键盘快捷键** — `Space` 翻转，`←/↑` 上一张，`→/↓` 下一张
- **进度记忆** — localStorage 保存学习进度，下次打开自动恢复
- **购买链接** — 支持为每个牌组配置购买链接

## 技术栈

- 纯 Vanilla JS，无框架依赖
- 渐进式 Web 应用，无需构建步骤
- 数据存储于 CSV + JSON 配置文件
- Anki 模板在 iframe 内通过 `srcdoc` 渲染

## 项目结构

```
.
├── index.html              # 入口页面
├── js/app.js               # 应用主逻辑
├── src/assets/css/
│   ├── variables.css       # 配色变量与 Reset
│   ├── base.css            # 基础样式与布局
│   └── components.css      # 组件样式
├── data/                   # 牌组数据（注意：存在私有仓库）
│   ├── index.json          # 牌组名称列表
│   └── <牌组名>/
│       ├── config.json     # 牌组配置（含 purchaseUrl）
│       └── data.csv        # 卡片数据
├── templates/
│   └── <模板名>/
│       ├── 正面模板.html
│       ├── 背面模板.html
│       └── 样式.css
└── .github/workflows/
    └── deploy.yml          # GitHub Actions 部署配置
```

## 牌组数据格式

### config.json

```json
{
  "name": "牌组名",
  "template": "模板目录名",
  "chapterField": "章节",
  "purchaseUrl": "https://..."
}
```

| 字段 | 说明 |
|------|------|
| `template` | 使用的模板目录名称（在 `templates/` 下） |
| `chapterField` | CSV 中用于分章的字段名 |
| `purchaseUrl` | 购买链接（留空则不显示） |

### data.csv

CSV 文件首行为字段名，后续行为卡片数据。字段名需与模板中的 `{{字段}}` 占位符对应。

## 本地开发

```bash
python -m http.server 3000
```

浏览器打开 `http://localhost:3000` 即可预览。

## 许可

UNLICENSED — 仅个人学习使用
