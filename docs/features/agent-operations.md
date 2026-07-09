# 代理操作 (Agent Operations)

來源：`packages/core/src/agent/tools/*.ts`、`packages/core/src/orchestrator/agent-mode.ts`

工具由 Agent Mode Orchestrator 透過資源預設組分配至代理（`agent-mode.ts` 中的 READ_WRITE_TOOLS、READ_ONLY_TOOLS、VERIFY_TOOLS），並透過 VS Code 聊天面板觸發。

## 檔案讀取 (Read)

- **Given** 代理需要讀取特定檔案內容
- **When** 代理執行讀取操作，可指定行偏移（offset）與行數限制（limit）
- **Then** 回傳帶有行號的檔案內容（cat -n 格式），預設上限 2000 行，超出部分顯示剩餘行數提示

## 檔案寫入 (Write)

- **Given** 代理需要建立或覆寫檔案
- **When** 代理執行寫入操作，指定檔案路徑與內容
- **Then** 檔案被寫入，目錄不存在時自動建立上層目錄，回傳寫入位元組數

## 檔案編輯 (Edit)

- **Given** 代理需要修改現有檔案的特定片段
- **When** 代理執行編輯操作，提供舊字串（oldString）與新字串（newString）
- **Then** 若 oldString 在檔案中恰好出現一次則進行替換；若出現多次且未啟用 replaceAll 則回報 ambiguous 錯誤；若啟用 replaceAll 則全部替換

## 命令執行 (Bash)

- **Given** 代理需要在終端環境中執行命令
- **When** 代理執行 bash 操作，提供命令字串與可選的逾時時間
- **Then** 命令透過 `/bin/bash -c` 執行，回傳合併的 stdout/stderr 輸出（上限 50KB），逾時或非零退出碼均反映在結果中
