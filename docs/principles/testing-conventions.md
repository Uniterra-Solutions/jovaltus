# 測試慣例 (Testing Conventions)

來源：`packages/core/src/__tests__/`、`packages/extension/src/__tests__/`、`packages/extension/src/webview/__tests__/`、`vitest.config.ts`

## 測試框架

使用 **Vitest** 為測試框架，採用 BDD 風格的 `describe`/`it`/`expect` 語法。

**理由**：Vitest 與 Vite 生態系相容，速度快，API 與 Jest 相近，學習成本低。

**配置**（`vitest.config.ts:1-7`）：

```typescript
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts'],
  },
});
```

## 測試檔案位置

測試檔案與原始碼共置（colocated）於 `src/__tests__/` 目錄下，檔案命名為 `{module-name}.test.ts`，對應被測試的模組。webview 測試檔案置於 `src/webview/__tests__/`。

**範例**：

- `config.test.ts` — 對應 `config/manager.ts`
- `tools.test.ts` — 對應 `agent/tools/*.ts`
- `tool-registry.test.ts` — 對應 `agent/tool-registry.ts`
- `secrets.test.ts` — 對應 `secrets.ts`
- `chat-adapter.test.ts` — 對應 `chat-adapter.ts`
- `vscode-bridge.test.ts` — 對應 `vscode-bridge.ts`

## 隔離原則

每個測試建立獨立的暫存目錄進行操作，並在 `finally` 區塊中清理。

**理由**：避免測試間的檔案系統副作用互相干擾，確保測試可獨立執行。

**範例**（`tools.test.ts:16-25`）：

```typescript
it('reads file contents', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'jovaltus-test-'));
  const fp = join(dir, 'test.txt');
  writeFileSync(fp, 'line one\nline two\nline three\n');
  try {
    const r = await readTool.execute('c1', { filePath: fp });
    expect(text(r)).toContain('line one');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

## Mock 策略

偏好真實實作而非 mock。當需要模擬依賴時，使用輕量的內聯工廠函式而非完整的 mock 框架。

**範例**（`config.test.ts:6-12`）：

```typescript
function provider(map: Record<string, string | number>): ConfigProvider {
  return {
    get<T>(key: string, defaultValue: T): T {
      return (map[key] as T) ?? defaultValue;
    },
  };
}
```

僅對網路相依的測試使用 fake/stub，本地可測試的邏輯（檔案系統、配置解析、錯誤分類）使用真實實作。

## Webview 測試環境

Webview 測試使用 `@vitest-environment jsdom` 標記，在測試檔案頂端宣告：

```typescript
/**
 * @vitest-environment jsdom
 */
```

**理由**：Webview 元件（chat-adapter、vscode-bridge）依賴 browser API（`window.addEventListener`、`acquireVsCodeApi`、`postMessage`），需要 DOM 模擬環境。

Webview 測試使用 `vi.stubGlobal()` mock `acquireVsCodeApi`，並透過 `window.postMessage()` 模擬事件流。

## 斷言慣例

- `.toBe()` — 基礎型別比對
- `.toContain()` — 字串包含檢查
- `.toMatchObject()` — 物件部分比對
- `.toHaveLength()` — 陣列長度檢查
- 不使用 snapshot 測試
- 不使用 magic number，偏好描述性的計算值

## 測試結構

每個測試檔案以 `describe` 區塊組織，對應模組或函式。每個 `it` 區塊名稱描述預期行為（而非實作細節）。遵循 arrange-act-assert 模式。
