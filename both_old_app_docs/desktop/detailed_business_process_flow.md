# CCTS – Detailed Business Process Flow

This document explains the **complete real-world operational process** of the Cheque Truncation System from the perspective of the business and bank operators — what happens, why it happens, what is checked, and what decisions are made at each step. It is grounded in actual code behavior.

---

## Phase 1: System Setup & Master Configuration (Admin — Done Before Day-1 Operations)

Before any cheque can ever be processed, the system must be configured. This is done by **System Administrators**.

### 1.1 Bank & Branch Mapping
The system must know the routing codes of every participating clearing bank and branch nationwide. For each bank: RBI code, MICR sort code characters. For each branch: IFSC code, MICR sort code (characters 4-6 are the "bank code" used to validate cheques during reject repair).

> **Why it matters from the code:** During Reject Repair, `MICR.Substring(3, 3)` is extracted and checked against the bank master via `CheckBankIsAvailable1()`. If the bank code is not registered → cheque cannot be saved. Also, if `MICR.Substring(3,3) = "036"`, the ISNo field in the SDEA clearing file is overridden to `"SCB TRANSFER"`.

### 1.2 Location & Scanner Registration
Every physical counter where scanning happens must be registered as a **Location** with a valid **ScannerID** (not `"000"`).

> **Why it matters from the code:** `frmBatchMaster` validates the pickup location via `USP_SEL_CMS_Location()`. If `ScannerID = "000"` or is blank → batch creation is blocked: *"ScannerId not found for Location."*

### 1.3 Holiday Calendar
Non-clearing days are entered here. The system uses this to calculate valid presentation dates.

### 1.4 Return Reason Codes
NPCI/RBI-mandated codes for why a cheque bounces (e.g., Insufficient Funds, Signature Mismatch, Stale Cheque). Used when generating return XML files.

### 1.5 User & Role Provisioning
Each operator is created in `frmUserMaster` with a username and password. Specific menu rights are assigned via `frmUserMenuRights`:

| Typical Role | Key Rights Assigned |
|---|---|
| Scanner Operator | `"Outward Batch Master"` Add |
| Maker / Data Entry | `"Outward Slip Entry"` Add, `"Outward Cheque Entry"` Access |
| Checker / Authorizer | `"Outward Authorization"` |
| Reject Repair Clerk | `"Reject Repair Scanned Documents"` |
| QC Supervisor | `"QC Pending"` Access |
| Admin / IT | All rights + `"Batch Delete Rights"` |

> **The system enforces segregation of duties:** The maker who enters Level 1 **cannot** be the same person who enters Level 2 — this is checked via `FIBy` and `DEBy` fields in the batch record. Violation shows: *"Level 1 - 2 entry must be done by two different users."*

### 1.6 Client Configuration
Corporate clients (e.g., insurance companies that deposit hundreds of cheques daily) are registered with pickup points. A special `SP_CLIENT_FLAG` can be set which triggers a **side-by-side comparison mode** for the maker screen — where both L1 and L2 values are shown simultaneously with mismatches highlighted in red.

---

## Phase 2: Morning Setup — Batch Creation

Each morning, the scanner operator creates a **Batch** — a logical container for a group of physical cheques.

### What the operator does:
1. Selects **Clearing Type**: CTS (regular clearing) or Non-CTS.
2. Enters **Pickup Location** — the physical counter where cheques arrived.
3. Enters **Summary Reference Number** and **PIF** (Processing Instruction Form number) — these **must be identical**.
4. Enters **Total Slips** and **Total Amount** expected in this batch.

### What the system checks:
- All fields must be filled.
- SummRefNo must equal PIF (if they differ → error, cannot proceed).
- Pickup Location must exist in the location master AND must have a registered scanner.
- Total Amount must be > 0 (disabled in Branch mode — amount comes from scanning).
- Scanner must not be `"000"`.

### What happens on success:
A batch record is created in the database with a **6-digit Batch Number** (e.g., `000047`). A corresponding **folder is automatically created** on the shared network drive at: `SharedPath\YYYY\MMM\dd-MM-yyyy\BatchNo\` — this folder will hold all scanned images.

---

## Phase 3: Physical Cheque Scanning

The batch dashboard shows the newly created batch. The operator opens it and arrives at the scanner interface (`frmScanCheque`).

### What the operator does:
1. Clicks **Start Ranger** — the scanner hardware powers up.
2. Before feeding, the system asks for the **Deposit Slip details** (Slip number, total instruments in this slip). This is because cheques are fed slip by slip.
3. Clicks **Start Feeding** — cheques are drawn from the hopper one by one.
4. Clicks **Stop Feeding** when the slip is done, then repeats for the next slip.
5. Clicks **Shut Down** when the entire batch is done.

### What the scanner does per cheque (automatically):
1. **Reads MICR** (Magnetic Ink Character Recognition) from the bottom of the cheque — extracts Cheque Number, Sort Code (MICR), Account Number, Transaction Code.
2. **Prints endorsement** on the back of the cheque — a unique stamp identifying the bank, batch, and sequence number. (Not printed on CR135 scanners.)
3. **Captures 3 images**:
   - **Front B/W TIFF** — `{date}{BatchNo}_Front_{SeqNo}.tif` — Standard CTS-compliant bitonal image, CCITT-4 compressed.
   - **Back B/W TIFF** — `{date}{BatchNo}_Back_{SeqNo}.tif` — Endorsement side.
   - **Front Grayscale JPG** — `{date}{BatchNo}_FrontG_{SeqNo}.jpg` — Easier for human review.
4. **Runs image quality checks (IQA)**: Checks for undersize/oversize images, compressed size limits, front/rear dimension mismatch, image too light/dark, carbon strip, framing errors. Items failing IQA go to a **re-scan list**.
5. **Saves to DB**: MICR text, image file paths, endorsement text, sequence number.

### Scan limit:
The `OutwardChqCount` setting defines the maximum cheques per batch. Once reached, scanning stops silently.

### After all cheques scanned:
Operator shuts down Ranger → cheque count is synced to the batch header → batch becomes ready for data entry.

**If MICR/ChequeNo data is invalid** (failed automated checks) → Batch moves to **Reject Repair** queue.
**If all data looks clean** → Batch moves to **Cheque Entry Pending** queue.

---

## Phase 4: Reject Repair (If Batch = "RR Pending")

If the scanner couldn't read some MICR lines cleanly, or the data fails automated rules, the batch sits here for a **Reject Repair Clerk**.

### What the clerk does:
- Views each flagged item in a repair grid.
- Views the front B/W, front grayscale, or back image of the cheque.
- Manually corrects the **MICR line**, **Cheque Number**, and **Account Type** by reading the image.

### What the system checks on each save:
1. MICR must be exactly 9 digits.
2. MICR characters 4-6 (bank code) must belong to a participating bank in the master.
3. MICR must not be on the blocked MICR list.
4. ChequeNo must be exactly 6 digits and not `"000000"`.
5. **All 3 image pixel dimensions** validated against 6 database-configured min/max bounds (Front B/W width/height, Back B/W width/height, Front Grayscale width/height). If any image is out of bounds → save is blocked with the exact measurement shown.

### After all repairs done:
Lock Batch button appears. Operator locks the batch → moves to Cheque Entry Pending.

---

## Phase 5: Slip Entry & Cheque Data Entry (Maker Level 1)

The batch is now **locked** (scanning/repairs complete). A **Maker (Data Entry Operator)** takes over.

### What the Maker does — Slip level:
For each deposit slip in the batch:
1. Selects the client (corporate depositor).
2. Selects the pickup point (where the slip came from).
3. Enters Deposit Slip Number, Account Number (must match confirm field), Total Cheques, and Amount.
4. The system validates the pickup point belongs to the client and location, checks for duplicate slip numbers, and ensures the cheques count doesn't exceed what was scanned.

### What the Maker does — Cheque level:
After each slip is saved, the individual cheque entry screen opens:
- Operator views the scanned image and enters cheque amount, date, payee name, drawer name, etc.

### Multi-level entry system:
| Level | Who | What changes |
|---|---|---|
| Drawer Check | Maker / System | Checks client configuration `IsDrawerCodeRequired`. Validates minimum character length of the drawer. During SDEA generation, truncates drawer names to a maximum of 40 characters automatically. |
| L1 (OCR) | First Maker | System pre-fills from OCR/MICR; operator confirms or corrects amount, cheque number, MICR, account type |
| L2 (Second Maker) | Different operator from L1 | Blind second entry to detect typos; only items where L1 amount = 0 are shown |
| L3 (QC Supervisor) | QC role | Reviews all items where L1 and L2 data mismatches |
| L4 (Senior Override) | High-value override | For amounts above RBI threshold |

**11 validation steps on every save** (from code): blank checks, length checks (MICR=9, TransCode=2, ChequeNo=6), numeric checks, OCR override confirmation, amount>0, TransCode validity, same-user block for L1/L2.

### Technical Rejection:
At any entry level, if the operator determines the cheque is physically invalid (torn, altered, wrong payee), they can select a rejection reason → system marks the cheque as a **Technical Return** — it permanently exits the clearing cycle.

---

## Phase 6: Authorization / Checking

Once all makers are done, a **Checker (Supervisor)** reviews and approves each cheque.

### What the Checker does:
1. Loads the batch by number.
2. Views the cheque image for each item in the grid.
3. Presses **Y** to approve or **R** to reject (keyboard-driven for speed).
4. For rejected items, must type a **mandatory rejection reason** (blank = blocked from saving).
5. Can mark a cheque as **PTF (Post-Dated Transaction)** for future-dated instruments.

### What gets recorded:
- `AuthStatus = 1` (Approved) → cheque will go to the clearing file.
- `AuthStatus = 2` (Rejected) → cheque is excluded from clearing.

### Running totals:
The screen shows a live count of `Total Authorized (X)` and `Total Rejected (Y)` as the checker works.

### Web channel:
Branch managers without the desktop app can authorize via the web portal (`authorizescheques.aspx`) using a browser.

---

## Phase 7: CHI XML Generation & FTP Upload (Clearing File Preparation)

Once all cheques are authorized, the system generates the **CHI (Cheque Image)** files:
- A structured XML file containing all cheque data.
- A ZIP of all scanned images.

These are then **PGP-encrypted** (external process, resulting in two `.pgp` files: one `.XML.pgp` and one `.IMG.pgp`).

### Upload sequence:
1. System validates exactly 2 PGP files exist in the batch export folder.
2. Creates date and batch folders on the FTP server (`ftp://scbftp.airanlimited.com/quickcts/chi%20upload`).
3. Registers the upload with the central server via HTTPS (must return `"Success"` or upload is aborted).
4. Uploads the XML PGP file.
5. Uploads the IMG PGP file.
6. Local outward folder is archived to `\done\` subdirectory.

**Batch status after upload:**
- If no RCMS pending records → **Finalized** (status 5)
- If RCMS records pending → **RCMS Pending** (status 4)

---

## Phase 8: RCMS Data Entry (If RCMS Pending)

For certain client types, an additional RCMS (Reconciliation & Collection Management System) data entry step is required.

- Only one operator can work on a batch at a time (operator lock via `RCMSBY` field).
- If another operator has already started → current user is blocked.

---

## Phase 9: SDEA File Generation (End of RCMS)

After RCMS entry is complete, the batch status shows **"RCMS Completed"**. The operator clicks to generate the **SDEA (Standard Data Exchange Agreement) transmission file** — a fixed-width, 200-chars-per-line text file sent to the clearing house.

### File structure:
```
# [Comment line — RCMSG_SDEATXN]
H [Header: Batch date, PIF, source, location, product code, PDC flag]
D [Deposit slip record: client code, pickup point, reference, slip no, date, cheque count, amount in paise]
C [Cheque record: cheque no, bank code, branch code, amount in paise, date, drawer name (max 40 chars), instrument no]
T [Trailer: total deposits, total amount in paise]
```

**Two files are generated:**
- **Part A** — for standard client deposits.
- **Part C** — for representative-location deposits (if applicable).

**After each file:** The slip summary Crystal Report PDF is auto-exported. Batch status updated to 6 ("RCMS Completed" / SDEA done).

**Special rules in the clearing file:**
- All amounts are in **paise** (×100, no decimal point).
- Drawer name truncated to **40 characters** maximum.
- If MICR sort code characters 4-6 = `"036"` → Instrument Number is replaced with `"SCB TRANSFER"`.

---

## Phase 10: Next Day — Inward Returns Processing

The clearing house processes the presented cheques overnight. The next morning:

1. **Return files are downloaded** from the clearing house (XML or DBF format).
2. The system reads these files and **matches** the cheque identifiers back to yesterday's outward batches.
3. **Bounced cheques** are marked in the system → return reason recorded.
4. **Return XML** is generated for NPCI to formally acknowledge the bounce.
5. Physical cheques are retrieved from the filing cabinet and returned to the depositing customer with a rejection memo.

---

## Summary: Batch Status Journey

```
Batch Created
     ↓
Scanning Complete → [MICR errors?] → "RR Pending" → Reject Repair → Lock
     ↓
"Chq. Entry Pending" → Slip Entry → Cheque L1 Entry
     ↓
"OCR Mismatch" → L2 Entry (different user)
     ↓
"QC Pending" → L3 QC Supervisor
     ↓ (if high value)
"3 Level Max Amount/RBI" → L4 Override
     ↓
[Authorization / Checker]
     ↓
CHI XML + Images Generated & PGP Encrypted
     ↓
"CHI XML Generated" → FTP Upload → Register on server → Upload XML+IMG PGP
     ↓
[No RCMS] → Status 5 (Finalized)
[RCMS needed] → Status 4 → "RCMS Pending" → FrmRcmsEntry
     ↓
"RCMS Completed" → SDEA Part A + Part C files generated → PDF reports
     ↓
Status 6 (Done)
```
