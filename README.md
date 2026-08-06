# 寶螺盃 · 瑞士制管理系統

現場用單一頁面 Web App，專為 **寶螺盃**（九龍城基督徒會 × 宣道會基蔭堂）設計。

## 線上網址

| 用途 | 連結 |
|------|------|
| **正式使用（GitHub Pages）** | **https://takjai18.github.io/baoluo-cup/** |
| 原始碼倉庫 | https://github.com/Takjai18/baoluo-cup |

推送至 `main` 後，Pages 通常約 1–2 分鐘更新完成。

---

## 快速開始

### 線上（推薦現場用）

直接開啟：https://takjai18.github.io/baoluo-cup/

### 本機

```bash
cd ~/Desktop/baoluo-cup
python3 -m http.server 8765
```

然後開啟 http://localhost:8765

**建議現場用法：** 用**同一部**平板或手提電腦開著此頁計分。資料存在瀏覽器 `localStorage`（本機），重整不會丟；換機請用 JSON 備份帶走。

---

## 比賽設定（可調）

| 項目 | 說明 |
|------|------|
| 人數 | 8／16／32／64／自訂（須雙數，最多 128） |
| 教會 | 九龍城基督徒會（城基）／宣道會基蔭堂（基蔭） |
| 瑞士制 | 輪數可調；設定頁有**輪數計算器**與警告（可無視） |
| 淘汰賽 | **4／8／16 強**；種子 1vsN、2vsN−1… |
| Match | 先到 4 分（Extreme 3／Over·Burst 2／Spin 1） |
| 瑞士積分 | 勝 1、負 0 |

### 建議瑞士輪數（計算器）

| 人數 | 建議輪數 |
|------|----------|
| 8 | 3 |
| 16 | 4 |
| 32 | 5 |
| 64 | 6 |

經驗法則 ≈ `ceil(log₂ N)`。輪太少排名嘈；輪太多必重賽。

### 淘汰賽種子

- **4 強**：1v4、2v3  
- **8 強**：1v8、4v5、2v7、3v6  
- **16 強**：1v16、8v9…（標準 bracket）  
準決賽（剩 2 場）完場後產生決賽 + 季軍賽。

---

## 備份

- **自動備份**：開始比賽、鎖定輪次、產生淘汰賽、淘汰結果 → 本機滾動保存（最多 8 份）
- **立即本機備份**／**完整 JSON**／**安全匯出（隱藏出場次序）**
- 匯出頁可一鍵還原本機備份

---

## 配對與排名

- 瑞士制：同分優先、不同教會、避開重賽（先硬避再軟罰）
- **32／64 人**用 greedy 配對，避免搜尋卡死 UI
- 排名：瑞士分 →（剛好 2 人且有對賽）H2H → BP → 姓名；**多角同分不用 pairwise H2H**

---

## 測試

```bash
cd ~/Desktop/baoluo-cup
node tests/logic.test.js
```

---

## 更新 GitHub Pages

```bash
cd ~/Desktop/baoluo-cup
git add -A
git commit -m "說明改動"
git push origin main
```

`index.html` 內 `?v=` cache-bust 有改才會強制瀏覽器拉新 JS／CSS。

---

## 檔案

| 檔案 | 用途 |
|------|------|
| `index.html` | 介面結構 |
| `styles.css` | 樣式／投影 |
| `app.js` | 狀態、配對、計分、淘汰賽 |
| `parts.js` | 陀螺零件庫 |
| `tests/logic.test.js` | 純邏輯單元測試 |
