# 部署与推送指南

## 架构说明

本项目采用双仓库部署策略：

| 仓库 | 可见性 | 用途 |
|------|--------|------|
| `kikkua/kikkua.github.io` | 🔓 公开 | 网站代码（HTML/CSS/JS/模板） |
| `kikkua/kikkua_ankideck` | 🔒 私有 | 牌组数据（CSV/JSON） |

部署流程：GitHub Actions 从公开仓库拉取代码 + 从私有仓库拉取数据 → 合并打包 → 部署到 GitHub Pages。

---

## 日常推送

### 修改网站代码（JS/CSS/模板）

```bash
git add <文件>
git commit -m "说明"
git push origin main
```

Actions 自动触发部署，约 1 分钟后生效。

### 修改牌组数据（data 目录）

```bash
cd data
git init
git add -A
git commit -m "说明"
git remote add origin https://github.com/kikkua/kikkua_ankideck.git
git push --force -u origin master
rm -rf .git
cd ..
```

推送后需触发一次公开仓库的 Actions 部署：

```bash
git commit --allow-empty -m "Trigger deploy"
git push origin main
```

### 同时修改数据和代码

```bash
# 1. 先推送公开仓库的代码改动
git add <文件>
git commit -m "说明"
git push origin main

# 2. 再推送私有仓库的数据改动
cd data
git init && git add -A && git commit -m "说明"
git remote add origin https://github.com/kikkua/kikkua_ankideck.git
git push --force -u origin master
rm -rf .git
cd ..
```

公开仓库的推送会自动触发 Actions 部署（包含最新的私有数据）。

---

## 添加新牌组

1. 在 `data/` 下创建牌组文件夹
2. 添加 `config.json` 和 `data.csv`
3. 在 `data/index.json` 中注册牌组名
4. 按上面步骤推送 data

## 添加新模板

1. 在 `templates/` 下创建模板文件夹
2. 放入 `正面模板.html`、`背面模板.html`、`样式.css`
3. 在牌组的 `config.json` 中指定 `template` 字段

## One-liner 推送 data

```bash
cd data && git init && git add -A && git commit -m "update" && git remote add origin https://github.com/kikkua/kikkua_ankideck.git && git push --force -u origin master && rm -rf .git && cd ..
```

## 首次部署

见 GitHub Actions 配置文件 `.github/workflows/deploy.yml`。需要配置：

1. 私有仓库 `kikkua/kikkua_ankideck`（已创建）
2. `DATA_REPO_TOKEN` 密钥（已配置）
3. Pages 源设置为 `GitHub Actions`（已设置）
