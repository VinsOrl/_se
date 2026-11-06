# Quote & Invoice Generator｜報價單／請款單產生器

[English](#english) · [繁體中文](#繁體中文)

---

<a id="english"></a>

# English

## What is this?

If you do side jobs or freelance work, you know the routine: a client asks "how much would that cost?", and you open an old Word file, change the names and numbers, fix the formatting you broke, and export a PDF. A month later you do it again for the invoice.

This tool replaces that routine. You fill in a form on the left, and a clean, print-ready quote (報價單) or invoice (請款單) builds itself on the right as you type. When it looks right, press **Print / Save PDF** and choose "Save as PDF" in your browser. That's it.

It has no accounts, no server and no install. Everything runs in your browser, and what you type is saved only on your own computer.

## Quick start

1. Open `index.html` in any modern browser (double-click it).
2. Fill in the seller, the client and at least one item.
3. Click **Print / Save PDF**, then pick "Save as PDF" as the destination.

If your browser refuses to open the file directly, serve the folder instead:

```
cd week3
python3 -m http.server 8000
# then visit http://127.0.0.1:8000
```

## How to use it

| Field | What to put there |
|---|---|
| **Type** | Quote (報價單) when you are proposing a price, Invoice (請款單) when you are asking to be paid. |
| **Date** | Defaults to today's date on your computer. You can change it. |
| **Seller** | Your name or business name, tax ID (統編, optional), and contact details. |
| **Client** | Who you are billing, and how to reach them. |
| **Items** | One row per line: item name, quantity, unit price. Use **+ Add item** for more rows and **×** to remove one. |
| **Tax** | *None* (no tax), *+5% exclusive* (tax is added on top of your prices), or *5% included* (your prices already contain tax). |
| **Discount** | A flat amount taken off before tax is calculated. |
| **Note** | Payment details, validity period, anything else. Line breaks are kept. |

**Clear** wipes the form and starts fresh.

### Your work is saved automatically

Every keystroke is saved in your browser's local storage, so closing the tab by accident does not lose anything. Reopen the page and the form is exactly as you left it. Nothing is ever uploaded. If your browser blocks storage (for example in a private window), the tool still works, it just won't remember anything.

### Document numbers

Each document gets a number like `QT-20261107-001` (quote) or `INV-20261107-001` (invoice): prefix, date, then a three-digit sequence. The sequence counts documents you have **already printed that day, of that type**, so your second invoice on the same day becomes `INV-20261107-002`. The number is recorded when you click Print.

### How the money is calculated

- Quantity × unit price gives each line amount (kept to 2 decimals). Invalid or empty numbers count as 0, and negatives are treated as 0.
- The discount is limited to between 0 and the sum of the lines, and it is subtracted **before** tax.
- The amount after discount is rounded to a whole dollar. Then:
  - **None:** total = that amount.
  - **+5% exclusive:** tax = amount × 5% (rounded), total = amount + tax.
  - **5% included:** the pre-tax amount = amount ÷ 1.05 (rounded), tax = the difference, total = the amount itself.

Example: 2 × NT$ 5,000, discount 500, +5% exclusive → 9,500 + 475 tax = **NT$ 9,975**, shown as 玖仟玖佰柒拾伍元整.

### Chinese capital amount (大寫金額)

Taiwanese quotes and invoices often write the total in formal capital numerals so it cannot be altered easily. The tool does this for you, including the tricky zeros: `1050` → 壹仟零伍拾元整, `10005` → 壹萬零伍元整, `100200` → 壹拾萬零貳佰元整.

### Validation

When you press Print, the tool checks that you filled in the seller, the client, and at least one item with a name, a quantity above 0 and a price of 0 or more. If something is missing you get a red message and the empty fields are outlined in red; nothing is printed or numbered until it's fixed.

### Safe by design

Everything you type is escaped before it is shown in the preview, so pasting something like `<b>text</b>` just shows that text; it cannot inject HTML or scripts. The default date uses your **local** date, not UTC, so a quote written at 00:30 in Taipei is not dated yesterday.

### Printing

The page has print styles: when you print, the form disappears and only the document is output. Use "Save as PDF" as the destination to get a file you can email.

## Run the tests

```
node --test week3/test.js        # from the repo root
node --test test.js              # from inside week3/
```

Needs Node 18 or newer. The tests cover the pure logic in `lib.js`: all three tax modes, discount clamping and order, bad numbers, every Chinese-capital example above, document numbers, validation, local dates and HTML escaping. They do not cover the UI; that was checked by hand in a browser.

## Files

| File | Purpose |
|---|---|
| `index.html` | Layout and print CSS: form on the left, document preview on the right. |
| `app.js` | UI only: form, live preview, autosave, print button. |
| `lib.js` | Pure logic. Works in the browser (`window.QI`) and in Node (`module.exports`). |
| `test.js` | Unit tests using `node:test`. |
| `REPORT.md` | What was done, test results, review notes, open questions. |

No dependencies, no build step, no backend.

## Known limits

- The document number is used up when you click Print, even if you then cancel the browser's print dialog. Browsers give no reliable way to tell.
- Totals are whole dollars. Fine for NT$; not meant for currencies with cents.
- Only the 5% Taiwan business tax is built in.
- History and numbering live in one browser on one computer. Clearing browser data resets the numbering.

## Why this project

**Practical value**

- **I am the user.** Side jobs and freelance work need quotes and invoices, and today I hand-edit Word files.
- **Many people want it.** Freelancers, designers, tutors, photographers and small shops all need the same thing, and most have no accounting software.

**Commercial value**

- **Freemium SaaS.** Free: this tool. Paid (about NT$ 99 per month): logo and branding, a client address book, document history, cloud sync, sending by e-mail, and payment reminders.
- **Commissionable.** Small businesses can pay for a custom version (their own template, item catalog and company stamp): a one-off fee plus hosting.
- **Expansion.** E-invoice (電子發票) integration, CSV export for the accountant, LINE notifications.

---

<a id="繁體中文"></a>

# 繁體中文

## 這是什麼？

如果你接案或打工，一定很熟悉這個流程：客戶問「這樣大概多少錢？」，你就打開舊的 Word 檔，改名字、改數字、修被你弄亂的排版，再匯出 PDF。一個月後收款時，又再來一次。

這個工具就是用來取代這套流程。左邊填表單，右邊會在你輸入的同時即時產生乾淨、可直接列印的報價單或請款單。確認沒問題後，按下 **Print / Save PDF**，在瀏覽器的列印視窗選擇「另存為 PDF」就完成了。

不用註冊、不用伺服器、不用安裝。所有東西都在你的瀏覽器裡執行，你輸入的內容只會存在你自己的電腦上。

## 快速開始

1. 用任何現代瀏覽器開啟 `index.html`（直接點兩下即可）。
2. 填寫賣方、客戶，以及至少一個項目。
3. 按 **Print / Save PDF**，目的地選擇「另存為 PDF」。

如果瀏覽器不讓你直接開啟檔案，可以改用簡單的本機伺服器：

```
cd week3
python3 -m http.server 8000
# 然後開啟 http://127.0.0.1:8000
```

## 使用方式

| 欄位 | 填什麼 |
|---|---|
| **類型** | 報價單：提出價格時使用；請款單：請對方付款時使用。 |
| **日期** | 預設為你電腦上今天的日期，可自行修改。 |
| **賣方** | 你的姓名或公司名稱、統一編號（選填）、聯絡方式。 |
| **客戶** | 要向誰收費，以及如何聯絡對方。 |
| **項目** | 每一列一個項目：品名、數量、單價。按 **+ Add item** 新增，按 **×** 刪除。 |
| **稅別** | *免稅*；*外加 5%*（稅額加在你的報價之外）；*內含 5%*（你的報價已含稅）。 |
| **折扣** | 在計算稅金之前先扣掉的固定金額。 |
| **備註** | 付款方式、報價有效期限等，換行會被保留。 |

按 **Clear** 會清空表單，重新開始。

### 自動儲存

你每輸入一個字，內容就會存進瀏覽器的本機儲存空間，不小心關掉分頁也不會遺失。重新開啟頁面，表單會和你離開時一模一樣。資料不會上傳到任何地方。如果瀏覽器封鎖儲存功能（例如無痕視窗），工具仍可正常使用，只是不會記住內容。

### 文件編號

每份文件都會有像 `QT-20261107-001`（報價單）或 `INV-20261107-001`（請款單）的編號：前綴、日期、三位數流水號。流水號計算的是**當天、同類型、已列印**的文件數量，所以同一天的第二張請款單會是 `INV-20261107-002`。編號會在你按下列印時被記錄。

### 金額如何計算

- 數量 × 單價得到每列金額（保留到小數點後 2 位）。空白或無效的數字視為 0，負數也視為 0。
- 折扣會被限制在 0 到所有項目合計之間，而且在計算稅金**之前**先扣除。
- 折扣後的金額會四捨五入到整數元，接著：
  - **免稅：** 總計 = 該金額。
  - **外加 5%：** 稅額 = 金額 × 5%（四捨五入），總計 = 金額 + 稅額。
  - **內含 5%：** 未稅金額 = 金額 ÷ 1.05（四捨五入），稅額 = 兩者之差，總計 = 該金額本身。

範例：2 × NT$ 5,000，折扣 500，外加 5% → 9,500 + 稅額 475 = **NT$ 9,975**，大寫為 玖仟玖佰柒拾伍元整。

### 大寫金額

台灣的報價單與請款單常以正式的大寫數字書寫總額，避免被輕易塗改。工具會自動幫你轉換，連容易出錯的「零」也處理好了：`1050` → 壹仟零伍拾元整、`10005` → 壹萬零伍元整、`100200` → 壹拾萬零貳佰元整。

### 輸入檢查

按下列印時，工具會檢查是否填了賣方、客戶，以及至少一個「有品名、數量大於 0、單價大於或等於 0」的項目。若有缺漏，會出現紅色提示並以紅框標出空白欄位；在補齊之前不會列印，也不會佔用編號。

### 安全性

你輸入的所有內容在顯示於預覽前都會先跳脫處理，所以貼上 `<b>文字</b>` 只會原樣顯示，不會被當成 HTML 或程式碼執行。預設日期使用的是**本地**日期而非 UTC，因此在台北凌晨 00:30 製作的報價單，不會被標成前一天。

### 列印

頁面內建列印樣式：列印時表單會隱藏，只輸出文件本身。目的地選擇「另存為 PDF」即可得到可以寄給客戶的檔案。

## 執行測試

```
node --test week3/test.js        # 在專案根目錄
node --test test.js              # 在 week3/ 資料夾內
```

需要 Node 18 或更新版本。測試涵蓋 `lib.js` 中的純邏輯：三種稅別、折扣的限制與順序、無效數字、上述所有大寫金額範例、文件編號、輸入檢查、本地日期與 HTML 跳脫。介面部分未納入自動測試，是在瀏覽器中手動檢查的。

## 檔案說明

| 檔案 | 用途 |
|---|---|
| `index.html` | 版面與列印樣式：左邊表單、右邊文件預覽。 |
| `app.js` | 只負責介面：表單、即時預覽、自動儲存、列印按鈕。 |
| `lib.js` | 純邏輯，瀏覽器（`window.QI`）與 Node（`module.exports`）皆可使用。 |
| `test.js` | 使用 `node:test` 的單元測試。 |
| `REPORT.md` | 完成內容、測試結果、審查紀錄與待確認問題。 |

沒有任何套件相依、不需建置、沒有後端。

## 已知限制

- 按下列印就會用掉一個編號，即使之後在瀏覽器的列印視窗按了取消。瀏覽器沒有可靠的方式能得知這件事。
- 總額以整數元計算，適用於新台幣；不適合有小數幣別的場景。
- 目前只內建台灣 5% 營業稅。
- 歷史紀錄與編號只存在某一台電腦的某一個瀏覽器裡，清除瀏覽器資料後編號會重新計算。

## 為什麼做這個專案

**實用價值**

- **我自己就是使用者。** 接案與打工都需要報價單和請款單，目前我都是手動修改 Word 檔。
- **很多人都需要。** 接案者、設計師、家教、攝影師和小店家都有同樣的需求，而且大多沒有會計軟體。

**商業價值**

- **免費增值（Freemium）SaaS。** 免費：就是這個工具；付費（約每月 NT$ 99）：Logo 與品牌設定、客戶通訊錄、文件歷史、雲端同步、電子郵件寄送、付款提醒。
- **客製接案。** 小型企業可以付費訂製專屬版本（自己的範本、品項目錄、公司印章）：一次性費用加主機費用。
- **延伸方向。** 串接電子發票、匯出 CSV 給會計師、LINE 通知。
