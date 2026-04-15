# CCTS – Modules & User Flows Documentation

This document describes each distinct operational module of the CCTS system, the user roles involved, the exact forms used, and the specific business rules enforced at each stage. All details are derived directly from the source code.

---

## Module 1: Login & Session Management (`LoginPage.vb`)

**Who:** Every user (Scanner operators, Makers, Checkers, Admins)

**What happens:**
1. App checks `CHIVersion` setting vs compiled version constant — mismatch = hard block.
2. Password encrypted with key `"QuickCTS"` before DB comparison.
3. `USP_Validate_Login` SP validates credentials → returns a result code:
   - `0` = Success → session loaded
   - `1` = Wrong Password (5 attempts max before lockout)
   - `2` = Account Inactive
   - `3` = Password Expired (90 days)
   - `4` = Password Reset Required
   - `5` = Account Locked
4. On success, sets global session variables: `gstrUserName`, `glngUserID`, `gintScan`, `gintFI`, `gintSI`, `gintCHI`, `gstrPickupLocation`.
5. Silent auto-patch: scans `\SQL\` folder for `.sql` patches to run, `\NewReports\` for updated Crystal Report files.

**Rights required:** None (public entry point)

---

## Module 2: Master Data Setup (Admin)

**Who:** Administrators / IT Supervisors (before day-to-day operations)

**Forms & their purpose:**

| Form | What It Does |
|---|---|
| `BankMaster.vb` / `BankSearch.vb` | Add/edit participating clearing banks and their RBI codes |
| `BranchDetails.vb` / `BranchSearch.vb` | Define branches, IFSC/MICR codes per bank |
| `frmUserMaster.vb` | Create operator accounts, set roles |
| `frmUserMenuRights.vb` | Assign per-user menu access rights (Add/Edit/Access per module) |
| `frmClientAdd.vb` / `frmImportClientMaster.vb` | Register corporate clients on whose behalf cheques are collected |
| `frmClientPoints.vb` / `frmClientEnrichmentSettings.vb` | Map client pickup points and custom data capture rules |
| `frmReturnReasonMaster.vb` | Maintain RBI/NPCI standard return reason codes |
| `frmHolidayManage.vb` | Define clearing holidays for valid date calculations |
| `frmLocationMaster.vb` / `frmZoneMaster.vb` | Register physical scanner counter locations (must have a valid `ScannerID`, not `"000"`) |

**Key rules from code:**
- A batch cannot be created for a location unless it has a non-`"000"` `ScannerID` set.
- Menu rights are checked with `CheckUserMenuRights()` or `NEWCheckUserMenuRights()` before every sensitive action.

---

## Module 3: Batch Creation (`frmBatchMaster.vb`)

**Who:** Scanner Operator (requires `"Outward Batch Master"` → Add right)

**Flow:**
1. Select **Clearing Type**: CTS (code from `CLEARINGTYPE` setting) or Non-CTS (`"11"`).
2. Enter **Pickup Location** → validated against `USP_SEL_CMS_Location()`. Must exist and have a valid ScannerID.
3. Enter **Summary Ref No** and **PIF** → must be identical.
4. Enter **Total Slips** (> 0) and **Total Amount** (> 0; disabled in BRANCH mode).
5. Click **Create** → `CreateNewBatch()` stores the record → network folder created at `gstrSharedPath\YYYY\MMM\dd-MM-yyyy\BatchNo\`.
6. After creation, **Scan button** opens `frmScanCheque` directly.

**Edit mode:** Operator enters batch number to look up an existing unlocked batch for re-scanning or to view scanned items. Press **D** key on the cheque grid to delete a cheque from the batch.

**Delete Batch:** Requires `"Batch Delete Rights"` Access right → calls `USP_DEL_BatchMaster_new(batchID)`.

**Export (for branch → hub transfer):**
- Generates `BatchMaster.txt`, `BatchDetails.txt`, `SlipEntry.txt` (all pipe-delimited).
- ZIPs the folder with `Ionic.Zip`.
- Encrypts the ZIP with **Rijndael AES** using key `"QuickCTS"` → saves to `gstrEncryptFilePath`.

---

## Module 4: Scanning (`frmScanCheque.vb`)

**Who:** Scanner Operator (requires `"Outward Batch Master"` Add right to reach this form)

**Scanner hardware supported:** Silver Bullet Ranger (models CR120, CR135, CR190)

**Flow:**
1. Click **Start Ranger** → `AxRanger1.StartUp()` → scanner initializes.
2. IQA explicitly disabled via `SetGenericOption("OptionalDevices", "NeedIQA", "False")`.
3. `AxRanger1.EnableOptions()` → scanner enters Ready state.
4. Before feeding: system checks if current slip is full. If so, opens `frmDepositSlipEntry` to capture new slip details.
5. Click **Start Feeding** → `AxRanger1.StartFeeding(FEEDSOURCEMAINHOPPER, FEEDCONTINUOUSLY)`.
6. **Per cheque (TransportSetItemOutput event):**
   - MICR text read: `AxRanger1.GetMicrText(1)` → spaces replaced with `_`.
   - Endorsement text printed on cheque back (if enabled):
     - CR120: `GetBatchEndorsementText_NEWN(batchID, scannerID, counter)`
     - CR190/others: `GetBatchEndorsementText_NEW(batchID, scannerID, counter)`
     - CR135: No endorsement printed.
7. **Per cheque (TransportItemInPocket event):**
   - 3 images captured from scanner memory and saved to disk:
     - `{date}{batchNo}_Front_{SeqNo}.tif` — Front B/W (CCITT4 compressed TIFF)
     - `{date}{batchNo}_FrontG_{SeqNo}.jpg` — Front Grayscale (JPEG)
     - `{date}{batchNo}_Back_{SeqNo}.tif` — Back B/W (CCITT4 compressed TIFF)
   - Scan limit enforced: if `intTotalChqScans = OutwardChqCount` setting → stop.
   - `CreateNewBatchDetails(...)` saves DB record with MICR, image paths, endorsement text, SeqNo.
8. Click **Stop Feeding** → `AxRanger1.StopFeeding()`.
9. Click **Shut Down** → `AxRanger1.ShutDown()` → `UpdateNoOfCheques(batchID, totalScanned)` syncs count. **Form cannot be closed while scanner is running.**

**IQA Tests run per item (14 defined, active ones):**

| Test | Status |
|---|---|
| Undersize Image | ✅ Active |
| Oversize Image | ✅ Active |
| Below Min Compressed Size | ✅ Active |
| Above Max Compressed Size | ✅ Active |
| Front/Rear Dimension Mismatch | ✅ Active |
| Image Too Light | ✅ Active |
| Image Too Dark | ✅ Active |
| Carbon Strip | ✅ Active |
| Framing Error | ✅ Active |
| Horizontal Streaks | ❌ Commented out |
| Excessive Skew | ❌ Commented out |
| Torn Edges | ❌ Commented out |
| Torn Corners | ❌ Commented out |
| Spot Noise | ❌ Commented out |

IQA failures → item added to `lstIQFailedCheques` for re-scan via **Rescan IQA Failed** button.

---

## Module 5: Batch Dashboard & Status Routing (`frmStartBatchEntry.vb`)

**Who:** All operators (each sees/acts on the screens their role allows)

**Features:**
- **6-second auto-refresh timer** polls for batch status changes.
- **CTS Grid** and **Location** filters (location must have valid ScannerID).
- **Status label** shows count of `BatchStatus = 6` (RCMS Completed) batches.

**Routing table (exact from code):**

| Batch Status Label | Opens | Role Needed |
|---|---|---|
| `"RR Pending"` | `frmRejectRepair` | "Reject Repair Scanned Documents" |
| `"Chq. Entry Pending"` | `frmSlipMaster` | "Outward Slip Entry" |
| `"OCR Mistmatch"` *(typo in code)* | `Frmqcamt` (Level 2) | "Outward Cheque Entry" |
| `"QC Pending"` | `FrmqcAmtq` (Level 3) | "QC Pending" |
| `"3 Level Max Amount/RBI"` | `FRM_VALIDATE3` (Level 4) | "Outward Cheque Entry" |
| `"CHI XML Generated"` | FTP upload flow | "Outward Cheque Entry" |
| `"RCMS Pending"` | `FrmRcmsEntry` | "Outward Cheque Entry" |
| `"RCMS Completed"` | SDEA file writer (inline) | (No separate right checked) |

**OCR Mismatch user-lock:** Checks `FIBy` (L1 user) and `DEBy` (L2 user) from batch details. Same user cannot do both L1 and L2. If L2 is already started by a different operator, current user is blocked.

---

## Module 6: Slip Entry (`frmSlipMaster.vb`)

**Who:** Maker / Data Entry Operator (requires `"Outward Slip Entry"` right)

**Prerequisite:** Batch must be locked (`IsBatchLocked()` checked first).

**Per slip save — validation chain:**
1. Pickup Point must exist in client master for that location.
2. Slip No not blank.
3. Account No not blank (numeric only).
4. Branch selected.
5. Amount > 0.
6. Account No must equal Account No confirm field.
7. Slip No must be unique in the batch.
8. Total cheques on this slip must not exceed available scanned (unassigned) cheques.

**After save:** `ChequeDetails` form opens automatically for entering individual cheque data for the slip. Next slip number auto-set to `LastSlipNo + 1` (starts at 101 if none exist).

---

## Module 7: Reject Repair (`frmRejectRepair.vb`)

**Who:** Reject Repair Clerk (requires `"Reject Repair Scanned Documents"` right)

**Triggered when:** Batch status = `"RR Pending"` — indicates MICR or cheque data failed automated validation after scanning.

**Validation chain run on every scanned item:**
1. ChequeNo numeric check
2. ChequeNo length = 6 digits
3. MICR numeric check
4. MICR length = 9 digits
5. MICR bank code (`Substring(3,3)`) lookup — must be a participating bank
6. MICR block list check — if found in blocked list, MICR is cleared
7. MICR translation check — `GetTransactionRule(MICR) <> 0` = needs canonical translation
8. TransCode (Account Type) numeric, exactly 2 digits, in valid code list
9. Account No: if present — must be numeric and 6 digits

**Repair save validations:**
- MICR = 9 chars, bank code valid, ChequeNo = 6 digits and not `"000000"`.
- **Image size validation** (all 3 images checked against 6 DB settings):
  - Front B/W: `FBWMinHeight/MaxHeight/MinWidth/MaxWidth`
  - Back B/W: `BBWMinHeight/MaxHeight/MinWidth/MaxWidth`
  - Front Grayscale: `FGMinHeight/MaxHeight/MinWidth/MaxWidth`

**After all items repaired:** Lock Batch button appears → `LockBatch(batchID)` advances the batch.

---

## Module 8: Amount Entry / Maker (`frmAmtEntry.vb`)

**Who:** Maker (Level 1), Second Maker (Level 2), QC Supervisor (Level 3), Senior Override (Level 4)

**4 Entry Levels:**
- **L1** (OCR-assisted): System pre-fills from OCR; operator confirms or corrects.
- **L2** (Second Maker): Different user from L1. Queue = items where `ChqAmount_1 = 0`.
- **L3** (QC): Queue = items with mismatches or `AuthStatus <> 1` between L1 and L2.
- **L4** (RBI/High-Value): Routes to `FRM_VALIDATE3`.

**SP_CLIENT_FLAG mode (corporate clients):** L1 and L2 values shown side-by-side with mismatches highlighted **red**. Only mismatched fields are editable.

**11-step save validation:** No blanks on ChequeNo/MICR/TransCode; exact lengths (9/2/6); numeric; amount > 0; OCR override confirmation dialog; TransCode validity; same-user L1/L2 block.

**Drawer Verification:** There is no distinct screen for checking drawer name; instead, it is enforced directly alongside the amount entry workflow. The process dynamically enforces length minimums and checks client rules configured in `frmMngClient.vb`. Data is strictly truncated to 40 characters limit during e-file generation.

**Technical Rejection:** Operator selects rejection reason → `USP_UPD_TechnicalReturn()` → cheque excluded from CHI upload entirely.

---

## Module 9: Checker / Authorization (`frmChequeAuthorization.vb` / `authorizescheques.aspx`)

**Who:** Supervisor/Checker (requires `"Outward Authorization"` right)

**Keyboard-driven:**
- **`Y`** key → Approval panel; `btnApprove` focused; PTF flag option available.
- **`R`** key → Rejection panel; mandatory `txtRejectRemarks`; empty = blocked.

**Result stored via `AuthenticateCheque()` SP:**
- `AuthStatus = 1` = Approved
- `AuthStatus = 2` = Rejected

**Hidden bulk approve:** `Ctrl+Shift+F10` → password `"ACPL123"` → `btnApproveAll` revealed → bulk-approves all rows.

**Web version:** `authorizescheques.aspx` in `CCTS_Web` project for branch managers without the desktop app.

---

## Module 10: RCMS Entry (`FrmRcmsEntry.vb`)

**Who:** Authorized operator (requires `"Outward Cheque Entry"` right)

**Triggered when:** Batch status = `"RCMS Pending"`.

**Operator lock:** Checks `sel_pending_CHEQUEENTRY_RCMS(BatchID, 1)`. If `RCMSBY` is a different user → block: *"RCMS Already in progress. You can not start this Batch."*

---

## Module 11: SDEA File Generation (inline in `frmStartBatchEntry.vb`)

**Who:** Authorized operator (triggered by selecting "RCMS Completed" batch)

**Prerequisite:** `GetBatchReportStatus()` must return `True` (banking file already generated).

**Output — Two fixed-length text files (200 chars/line):**

**Part A** (client deposits): `ddMMyy_LC_{Location}_{PIF}_A.{BatchNo}`
**Part C** (rep-location deposits): `ddMMyy_LC_{Location}_{PIF}_C.{BatchNo}`

**Record types:**
- `#` – Comment header line
- `H` – Batch header (date, PIF, source, location, product, PDC flag)
- `D` – Deposit slip record (CustCode, PickupPoint, CustRefNo, SlipNo, date, cheque count, amount×100)
- `C` – Cheque record (ChequeNo, BankCode, BranchCode, amount×100, date, DrawerName max 40 chars, ISNo)
- `T` – Trailer (total deposits 5 digits, total amount×100 left-padded 15 chars)

**Special rules:**
- `MICR1.Substring(3,3) = "036"` → `ISNo = "SCB TRANSFER"` instead of normal.
- All amounts ×100 (paise), no decimal.
- DrawerName truncated to 40 characters.

After each file: `UpdateBatchStatuso(batchID, 6)` and a PDF Slip Summary Crystal Report is auto-exported.

---

## Module 12: CHI FTP Upload (inline in `frmStartBatchEntry.vb`)

**Who:** Authorized operator (triggered by selecting "CHI XML Generated" batch)

**FTP credentials (hardcoded):**
- URL: `ftp://scbftp.airanlimited.com/quickcts/chi%20upload`
- User: `AIRANFTP` / Pass: `Airan@123`

**Sequence:**
1. Find exactly 2 `.pgp` files in batch export folder (one `.XML.pgp`, one `.IMG.pgp`).
2. Create FTP date folder + batch subfolder.
3. HTTP register: `https://scbftp.airanlimited.com/addbatch.aspx?b=...` → must return `"Success"`.
4. Upload XML PGP file.
5. Upload IMG PGP file.
6. Check pending RCMS: if 0 → `UpdateBatchStatuso(5)` (Finalized); if > 0 → `UpdateBatchStatuso(4)` (RCMS In Progress).
7. Move local outward folder to `\done\` archive.

---

## Batch Status State Machine

| Status | Dashboard Label | Set By |
|---|---|---|
| (initial/locked) | `"Chq. Entry Pending"` | `LockBatch()` after scanning |
| 3 | `"RR Pending"` | Reject repair detection |
| 4 | `"RCMS Pending"` | After FTP upload, RCMS records still pending |
| 5 | `"CHI XML Generated"` (Finalized) | After FTP upload, no RCMS pending |
| 6 | `"RCMS Completed"` | After SDEA file written |

---

## User Access Rights Matrix

| Menu Right | Modules It Guards |
|---|---|
| `"Outward Batch Master"` Add | Batch creation, scanning start |
| `"Batch Delete Rights"` Access | Batch deletion |
| `"Outward Slip Entry"` Add/Edit | Slip creation and editing |
| `"Reject Repair Scanned Documents"` | Reject Repair screen |
| `"Outward Cheque Entry"` Access | L2 entry, L4, FTP upload, RCMS routing |
| `"QC Pending"` Access | Level 3 QC entry |
| `"Outward Authorization"` | Checker/Authorization screen |
| `"BULK XML/RCMS GENERATE"` Access | Btn_RCMS on dashboard |
