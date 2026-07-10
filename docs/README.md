# 文檔索引

此目錄包含 Jovaltus Hermes Plugin 的標準化專案文檔。
每條文檔記述皆附有可追溯的程式碼來源證據。

## 分類

| 類別 | 路徑 | 說明 |
|------|------|------|
| Features | `docs/features/` | 使用者可見的功能行為（BDD 格式） |
| Architecture | `docs/architecture/` | 模組邊界與設計原則 |
| Principles | `docs/principles/` | 程式碼慣例與開發規範 |
| Overview | `README.md` (根目錄) | 專案設計提案與使用說明 |

## Features

- [agent-mode-pipeline.md](features/agent-mode-pipeline.md) — 四階段自動化開發流程
- [plugin-setup.md](features/plugin-setup.md) — Plugin 安裝與設定

## Architecture

- [plugin-architecture.md](architecture/plugin-architecture.md) — Plugin 三層架構設計
- [subagent-dispatch.md](architecture/subagent-dispatch.md) — Tool Handler 調度 Subagent 機制
- [git-workflow.md](architecture/git-workflow.md) — Git 狀態管理與 Diff 計算

## Principles

- [naming-conventions.md](principles/naming-conventions.md) — 命名慣例
- [error-handling.md](principles/error-handling.md) — 錯誤處理模式
- [testing-conventions.md](principles/testing-conventions.md) — 測試慣例

---

## 維護指引

### 證據追溯

維護文檔時，每條 claim 都必須附上來源檔案與行號區間。
無法從程式碼直接證明的 claim 標記為 `[INFERRED]` 而非偽造。

### 增量更新

當程式碼變更時，只重新產生受影響的文檔區段。
可使用 `git diff` 識別變更範圍，再決定哪些 `.md` 檔案需要更新。

### 定期 drift detection（建議）

定期（每月或每季）比對文檔與實際程式碼，確認無重大偏離。
發現 drift 時只修補受影響章節，不全面重寫。
