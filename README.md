# 寶螺盃 · 瑞士制管理系統

現場用單一頁面 Web App，專為 **2026-08-22 寶螺盃**（九龍城基督徒會 × 宣道會基蔭堂）設計。

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

1. 用瀏覽器開啟 `index.html`（Chrome / Safari / Edge 皆可）
2. 或：

```bash
cd ~/Desktop/baoluo-cup
python3 -m http.server 8765
```

然後開啟 http://localhost:8765

**建議現場用法：** 用**同一部**平板或手提電腦開著此頁計分。資料存在瀏覽器 `localStorage`（本機），重整不會丟；換機不會自動同步。

---

## 之後如何更新（保持 GitHub 最新）

本機專案路徑：`~/Desktop/baoluo-cup`  
遠端：`origin` → `https://github.com/Takjai18/baoluo-cup.git`  
分支：`main`（GitHub Pages 從此 branch 發佈）

在專案資料夾執行：

```bash
cd ~/Desktop/baoluo-cup

# 1. 看改了什麼
git status

# 2. 加入變更
git add -A

# 3. 提交
git commit -m "說明今次改了什麼"

# 4. 推上 GitHub（Pages 會自動更新）
git push origin main
```

一行版（有改動時）：

```bash
cd ~/Desktop/baoluo-cup && git add -A && git commit -m "更新" && git push origin main
```

若 Grok / 其他工具幫你改咗檔案，請在同一資料夾再跑上面的 `git add` → `commit` → `push`，GitHub 同線上版就會一齊更新。

---

## 比賽設定

| 項目 | 內容 |
|------|------|
| 人數 | 固定 16 人 |
| 教會 | 九龍城基督徒會 / 宣道會基蔭堂 |
| 瑞士制 | 4 輪，每輪 8 場 |
| Match | 先到 4 分（Extreme 3 / Over·Burst 2 / Spin 1） |
| 瑞士積分 | 勝 1、負 0 |
| 晉級 | 前 4 名入淘汰賽（準決賽 → 季軍賽 / 決賽） |

## 操作流程（當日）

1. **選手** — 匯入或逐一輸入 16 人 →「開始比賽 · 產生第 1 輪」
2. **對戰表** — 公佈 8 場 → 每場完結按「輸入結果」（選勝方 + 雙方 Battle Points）
3. 8 場齊 →「鎖定本輪 · 進入下一輪」（自動按規則配對）
4. 第 4 輪鎖定後 → **排名** 看前 4 → **淘汰賽** 產生準決賽
5. 賽後用 **匯出** 下載 CSV / 文字報告 / JSON 備份

## 配對原則（嚴格優先序）

1. 同分組優先互打  
2. 同分時優先 **不同教會**  
3. 盡量避免重複對手（尤其連續兩輪同一對手）

支援「重新配對」與「手動調整」。

## 同分處理

瑞士積分相同時，系統在「同分」分頁顯示：

1. 是否曾對賽及勝負（Head-to-Head）  
2. 比賽總分（Total Battle Points）  
3. 仍相同 → 提示需要加賽  

排名排序：勝場 → 對賽成績 → 比賽總分。

## 檔案

- `index.html` — 介面
- `styles.css` — 大按鈕、平板友善樣式
- `app.js` — 全部邏輯與 localStorage
- `README.md` — 本說明

## 注意

- 資料只在**本機該瀏覽器**；換機前請先「備份 JSON」
- 清除瀏覽器資料會刪除紀錄；重要節點請匯出
- 「填入示範資料」僅供彩排，正式賽請清空後輸入真名單
