# Plugin 安裝與設定

## 安裝 Plugin

- **Given** 用戶尚未安裝 Jovaltus plugin
- **When** 執行 `hermes plugins install LaiTszKin/jovaltus --enable`
- **Then** plugin 原始碼被下載至 `~/.hermes/plugins/jovaltus/`
- **And** plugin 被標記為啟用狀態

*來源：README.md:132-135（安裝說明）*

## 一鍵設定

- **Given** plugin 已安裝
- **When** 執行 `hermes jovaltus setup`
- **Then** CLI command handler 檢查 `jovaltus-agent` profile 是否已存在
- **And** 若不存在，呼叫 `hermes profile create jovaltus-agent` 建立
- **And** 輸出 profile 名稱與啟用方式

*來源：__init__.py:19-52（_setup_command 實作）*

## 啟動 Session

- **Given** plugin 已安裝且 profile 已建立
- **When** 執行 `hermes -p jovaltus-agent`
- **Then** Hermes 啟動帶有 jovaltus 工具集的 session
- **And** 三個工具可用：`jovaltus_implement`、`jovaltus_verify`、`jovaltus_simplify`
- **And** 用戶可跨專案目錄使用同一 profile

*來源：__init__.py:70-87（register tools）、plugin.yaml（provides_tools）、README.md:140-152*

## 日常使用

- **Given** 用戶正在 `jovaltus-agent` profile session 中
- **When** 用戶提出開發需求（如「新增登入頁面」）
- **Then** main agent 進入 Phase 0 規劃 → 依序調用三個工具
- **And** 用戶只參與需求釐清，實作/驗證/簡化全部自動化

*來源：skills/jovaltus-agent/SKILL.md*
