# CCTS – Complete Operational Process Flow (Code-Accurate, All Phases)

This document is derived **directly from the source code** and describes every decision, validation, status transition, and user action in the system with maximum fidelity. Every fact here is traceable to a specific line of code.

---

## PHASE 1: Login & Session Initialization (`LoginPage.vb`)

### Step 1.1 – Application Version Check
Before any login attempt is processed, the application checks if `CHIVersion` (DB settings table) matches the compiled version constant `gstrCHIVersion`.
- **If mismatch:** Blocked immediately: *"Application Version Not Matched. Please get Latest Application Version from Server."*

### Step 1.2 – Credential Encryption
Password encrypted using `EncryptString()` with fixed key `"QuickCTS"` before any DB call.

### Step 1.3 – SP: `USP_Validate_Login`

| ResultCode | Meaning | Action Taken |
|---|---|---|
| 0 | Login Success | Session initialized |
| 1 | Wrong Password | Shows remaining attempts (5 max before lockout) |
| 2 | Account Inactive | Hard block: "Contact Administrator" |
| 3 | Password Expired (90 days) | Forced redirect to `frmchangepassword` |
| 4 | Password Reset Required | Forced redirect to `frmchangepassword` |
| 5 | Account Locked | Block: "Locked after multiple failed attempts" |

### Step 1.4 – Session Variables Set (SP: `USP_SEL_UserMaster`)
- `gstrUserName` – Display name
- `glngUserID` – Numeric user ID
- `gintScan` – Scan rights
- `gintFI` – First Instance entry rights
- `gintSI` – Second Instance entry rights
- `gintCHI` – CHI upload rights
- `gstrPickupLocation` – Default counter (pre-fills `frmBatchMaster`; if set, `txtPickupLocation` is disabled)

### Step 1.5 – Silent Auto-Patch (`processUpdate()`)
1. Scans `\SQL\` folder → executes each `.sql` file against DB → deletes file.
2. Scans `\NewReports\` folder → copies updated `.rpt` files to `\Reports\`.

---

## PHASE 2: Batch Creation (`frmBatchMaster.vb`)

**Right required:** `"Outward Batch Master"` → Add

### Step 2.1 – 8-Field Validation Chain (in order)
1. Clearing Type selected (CTS = `CLEARINGTYPE` setting e.g. `"01"`; Non-CTS = `"11"`)
2. Pickup Location not blank
3. Summary Ref No (SummRefNo) not blank
4. PIF not blank
5. **SummRefNo must equal PIF** → error: *"Summary Ref No and PIF must be same."*
6. Total Slip > 0
7. Total Amount > 0
8. Location lookup via `USP_SEL_CMS_Location()`:
   - Not found → *"Pickup Location Not Found."*
   - Found but `ScannerID = "000"` or empty → *"ScannerId not found for Location."*

### Step 2.2 – Batch Creation
`CreateNewBatch(0, 0, BatchDate, TotalAmount, TotalSlip, 0, 0, UserID, ClearingType, PickupLocation, SummRefNo, PIF, 0)`
- Returns BatchID; batch number = 6-digit zero-padded string
- Network folder created: `gstrSharedPath\YYYY\MMM\dd-MM-yyyy\BatchNo\`

### Step 2.3 – BRANCH vs HUB Mode
- `APPTYPE = "BRANCH"`: `txtTotalAmount` disabled; PDC dropdown hidden
- `APPTYPE = "HUB"`: All fields active; PIF can differ from SummRefNo

### Step 2.4 – Delete Batch
`Button3` → `USP_DEL_BatchMaster_new(mlngBatchID)`. Requires `"Batch Delete Rights"` Access.

### Step 2.5 – Batch Export (Hub→Branch transfer)
Generates 3 pipe-delimited text files:
- `BatchMaster.txt`: `BatchID|BatchNo|BatchDate|BatchAmount|TotalSlips|TotalChqs|BatchStatus|ClearingType|...|PickupLocation|SummRefNo|PIF`
- `BatchDetails.txt`: `BDID|BatchID|MICRText|NoOfChqs|ImgFileName1|ImgFileName2|ImgFileName3|Status|Reason|ItemSeqNo|EndorseText|ChNo|MICR|AcNo|AcType|IsCheque`
- `SlipEntry.txt`: `SlipID|SlipNo|SlipDate|CustCode|AC_Name|AC_No|PickupPoint|DepositSlipNo|TotalChqs|SlipAmount|CustRefNo|ProductCode|Remarks`

ZIP → Rijndael AES encrypt (key: `"QuickCTS"`) → saved to `gstrEncryptFilePath`.

Delete cheque from batch: Press **D** key on grid row → `DeleteChqFromBatch(BDID)`.

---

## PHASE 3: Scanning (`frmScanCheque.vb`)

**Scanner API:** Silver Bullet Ranger (`AxRanger1` ActiveX). Supported: CR120, CR135, CR190.

### Step 3.1 – Startup Sequence
1. `AxRanger1.StartUp()` → state: `TransportStartingUp`
2. `TransportChangeOptionsState` event fires → IQA disabled:
   - `AxRanger1.SetGenericOption("OptionalDevices", "NeedIQA", "False")`
   - `AxRanger1.SetGenericOption("OptionalDevices", "NeedIQAUpstream", "False")`
3. `AxRanger1.EnableOptions()` → state: `TransportReadyToFeed`
4. Start Feeding button enabled.

**Transport states (XportStates enum):**
0=ShutDown, 1=StartingUp, 2=ChangeOptions, 3=EnablingOptions, 4=ReadyToFeed, 5=Feeding, 6=ExceptionInProgress, 7=ShuttingDown

### Step 3.2 – Deposit Slip Pre-check
Before each feed: if `gintSlipTotalChq = 0` OR `intTotalSlipChqScans = 0` OR `intTotalSlipChqScans >= gintSlipTotalChq` → opens `frmDepositSlipEntry` for new slip header (SlipNo + TotalInstruments).

### Step 3.3 – Per-Item: `TransportSetItemOutput` Event
1. `AxRanger1.GetMicrText(1)` → spaces replaced with `_` → displayed in `txtMICRText`.
2. **Endorsement** (if `gintEnableEndorse = 1`):
   - CR120: `GetBatchEndorsementText_NEWN(lngBatchID, ScannerID, IntEndorsCounter)`
   - Others (CR190): `GetBatchEndorsementText_NEW(lngBatchID, ScannerID, IntEndorsCounter)`
   - CR135: **No endorsement** (block skipped entirely)
   - Line position: `gintEndorseLine` (1–3)
   - Printed via: `AxRanger1.SetFixedEndorseText(1, intLineno, mstrEndorseText)`
3. Pocket destination: `AxRanger1.SetTargetLogicalPocket(1)` (always pocket 1)

### Step 3.4 – Per-Item: IQA Testing
If `gIQATest = True` → `DoIQATesting()` loops test IDs 1–14:

| Test ID | Name | Status |
|---|---|---|
| 1 | UndersizeImage | ✅ Active |
| 2 | OversizeImage | ✅ Active |
| 3 | BelowMinCompressedSize | ✅ Active |
| 4 | AboveMaxCompressedSize | ✅ Active |
| 5 | FrontRearDimensionMismatch | ✅ Active |
| 6 | HorizontalStreaks | ❌ Commented out |
| 7 | ImageTooLight | ✅ Active |
| 8 | ImageTooDark | ✅ Active |
| 9 | CarbonStrip | ✅ Active |
| 10 | FramingError | ✅ Active |
| 11 | ExcessiveSkew | ❌ Commented out |
| 12 | TornEdges | ❌ Commented out |
| 13 | TornCorners | ❌ Commented out |
| 14 | SpotNoise | ❌ Commented out |

Failure → `mblnIQAPassed = False` → item added to `lstIQFailedCheques` for re-scan.

### Step 3.5 – Per-Item: `TransportItemInPocket` Event (Image Capture)
**Scan limit check:** if `intTotalChqScans = intTotalAllowedScans` (`OutwardChqCount` setting) → exit sub (stop saving).

Three images retrieved from Ranger memory and saved:
- **Front B/W TIFF:** `AxRanger1.GetImageAddress(Front, Bitonal)` saved via `AxRanger1.SaveImageToFile()`
  - Path: `gstrSharedPathnew\{BatchNo}\{yyyyMMdd}{BatchNo}_Front_{SeqNo}.tif`
  - Encoding: CCITT4 compression
- **Back B/W TIFF:** `AxRanger1.GetImageAddress(Rear, Bitonal)`
  - Path: `gstrSharedPathnew\{BatchNo}\{yyyyMMdd}{BatchNo}_Back_{SeqNo}.tif`
- **Front Grayscale JPG:** `AxRanger1.GetImageAddress(Front, Grayscale)` saved via `AxRanger1.SaveImageToFile()`
  - Path: `gstrSharedPathnew\{BatchNo}\{yyyyMMdd}{BatchNo}_FrontG_{SeqNo}.jpg`

**DB record:** `CreateNewBatchDetails(lngBatchDID, lngBatchID, MICRText, 0, ImgFileName1, ImgFileName2, ImgFileName3, 1, UserID, intStatus, "", SeqNo, EndorseText)`

### Step 3.6 – Shutdown
- Stop Feeding → `AxRanger1.StopFeeding()`
- Shut Down → `AxRanger1.ShutDown()` → `UpdateNoOfCheques(lngBatchID, intTotalChqScans)`
- **Form close blocked** if scanner not shut down: `Form1_FormClosing` cancels close if `GetTransportState() <> TransportShutDown`

---

## PHASE 4: Batch Dashboard & Routing (`frmStartBatchEntry.vb`)

### Step 4.1 – Auto-Refresh
`Timer1.Interval = 6000` (6 seconds) → calls `btnGet_Click()`. `mblnIsLoading` flag prevents re-entrant refresh.

### Step 4.2 – Filters
- CTS Grid: `USP_SEL_CTS_GRID_MASTER()`
- Location: `USP_SEL_CMS_Location(gridValue)` filtered by `ScannerID <> Nothing And ScannerID <> "000"`
- Counter label: `"RCMS Completed ( {count} )"` = `(From d Where d.BatchStatus = 6 Select d).Count`

### Step 4.3 – Hard-Coded Admin Username Controls
- **Button2:** Visible only if username is one of: `shivam, ROSHNIPARMAR, admin, narendra parmar, SAFREEN SHAIKH, UTTAM VAISHYA, SMITESH RATHOD, UNNATI BAROT, ANIL SHINDE, SHIVAM SHAH`
- **Label4/ComboBox1/Button3/Button4:** Only: `shivam, admin, SHIVAM SHAH`
- **Btn_RCMS:** Controlled by `NEWCheckUserMenuRights("BULK XML/RCMS GENERATE", "Access")`

### Step 4.4 – Status Routing Table (Exact from Code lines 1098–1145)

Statuses are **computed per row** in `btnGet_Click` from `BatchStatus` + `QCPending` + `TotalCheques` vs `TotalChqEntryDone` fields:

| Dashboard Status Label | Computed When | Destination | Notes |
|---|---|---|---|
| `"RR Pending"` | `BatchStatus = 0` | `frmRejectRepair` | Post-scan MICR repair |
| `"Chq. Entry Pending"` | `BatchStatus = 1 And TotalCheques > TotalChqEntryDone` | `frmSlipMaster` | Also passes `PDCBATCH` flag |
| `"OCR Mistmatch"` *(typo in code)* | `BatchStatus=2`, all data entered, L2 pending OR `QCPending="1"` | `Frmqcamt` (`mintEntryLevel=2`) | User-lock enforced (FIBy/DEBy check) |
| `"QC Pending"` | `QCPending = "2"` | `FrmqcAmtq` (`mintEntryLevel=3`) | Requires `"QC Pending"` Access right |
| `"3 Level Max Amount/RBI"` | `BatchStatus=2`, `sel_rbi_maxamt()` > 0 | `FRM_VALIDATE3` (`mintEntryLevel=4`) | High-value / RBI threshold |
| `"CHI In Progress"` | `BatchStatus=2`, `IsXMLGenInProgess=True` | No routing (wait) | Locked while XML gen runs |
| `"CHI Pending"` | `BatchStatus=2`, data clean, no high-value | `Btn_RCMS` (XML generation) | Requires `"BULK XML/RCMS GENERATE"` |
| `"CHI XML Generated"` | `BatchStatus = 3` | Inline FTP upload logic | Requires `"Outward Cheque Entry"` Access |
| `"RCMS Pending"` | `BatchStatus = 4` | `FrmRcmsEntry` | Operator-lock via `RCMSBY` field |
| `"RCMS Completed"` | `BatchStatus = 5` | Inline SDEA writer | Calls `GetBatchReportStatus()` first |
| `"Completed"` | `BatchStatus = 6` | No routing | Final state |

**BRANCH mode:** All statuses route to `frmBatchMaster` (Edit mode) instead.

### Step 4.5 – OCR Mismatch User-Lock (from code lines 140-160)
```
l1User = _batchdetails(0).FIBy   [Level 1 user]
l2User = _batchdetails(0).DEBy   [Level 2 user]
curUser = gstrUserName

If l2User = gstrUserName → BLOCK "Level 1 - 2 entry must be done by two different users."
If l1User <> "OCR" And l1User = gstrUserName → BLOCK "Level 2 Entry is already started by Other User."
```

---

## PHASE 5: Slip Entry (`frmSlipMaster.vb`)

**Right required:** `"Outward Slip Entry"` → Add (new) / Edit (modify)

### Step 5.1 – Batch Lock Gate
`IsBatchLocked(BatchNo)` checked first. If false → *"Batch is not locked. First Lock the batch."* Blocks entry completely.

### Step 5.2 – 8-Step Save Validation
1. Pickup Point selected + exists in `USP_SEL_ClientPickupPoints` for client, matching `Mid(LocationCode, 1, 5)` (first 5 chars) AND `LocCode`
2. Slip No not blank
3. Account No not blank (numeric-only keypress filter)
4. Branch selected
5. Amount not blank AND > 0
6. Account No must equal Account No confirm field (dual-entry)
7. Duplicate slip number check via `GetSlipDetails(batchID, slipNo)` → *"Slip no Is already generated for this batch."*
8. `CalculateBatchCheques()`: `intscannedcheques` = count of BatchDetails where `Status >= 1`. If `intscannedcheques < txtTotalChqs` → block: *"Total Cheques should Not exceed scanned cheques."*

### Step 5.3 – Auto Slip Number
`GetAutoSlipNumber(mlngBatchID)` → next = `LastSlipNo + 1`. If no slips exist → defaults to `101`.

### Step 5.4 – Client & Pickup Point
- `USP_SEL_ClientMaster_NEW("", STRBATCHLOATION)` drives client autocomplete
- `drpPickupPoint` = `USP_SEL_ClientPickupPoints(CustCode)`
- `txtCMSACNO` from `GetSettings("CMSACNO")` auto-fills account field

### Step 5.5 – Post-Save Flow
`ManageSlipsWithSoftSlip(...)` saves. Then `ChequeDetails` form opens automatically (`Tag="Add"`, `mstrEntryType="Single"`) for individual cheque entry.

---

## PHASE 6: Reject Repair (`frmRejectRepair.vb`)

**Right required:** `"Reject Repair Scanned Documents"`

### Step 6.1 – 9-Check Validation Chain per Item

| # | Check | Rule |
|---|---|---|
| 1 | ChequeNo numeric | Non-numeric → flag |
| 2 | ChequeNo length | Must = 6 digits |
| 3 | MICR numeric | Non-numeric → flag |
| 4 | MICR length | Must = 9 digits |
| 5 | MICR bank code lookup | `MICR.Substring(3,3)` via `CheckBankIsAvailable1()` — returns 0 = not participating → flag |
| 6 | MICR block list | `GetBlockMicr()` — if found → flag and clear MICR |
| 7 | MICR translation (CHM) | `GetTransactionRule(MICR) <> 0` → needs translation → flag |
| 8 | TransCode (Account Type) | Numeric, exactly 2 digits, in `ValidateTransactionCode()` list |
| 9 | Account Number | If present: numeric and exactly 6 digits |

### Step 6.2 – Image Viewer
3 modes: Front B/W (bitonal TIFF), Front Grayscale (JPEG), Back B/W (bitonal TIFF).
Live pixel dimensions shown (`lblWidth`/`lblHeight`).

### Step 6.3 – Save Validation
1. MICR = 9 chars
2. `MICR.Substring(3,3)` in bank master
3. ChequeNo = 6 digits, not `"000000"`
4. **`ValidateImageSize()`** — all 3 images vs 6 DB bounds:
   - Front B/W: `FBWMinHeight`, `FBWMaxHeight`, `FBWMinWidth`, `FBWMaxWidth`
   - Back B/W: `BBWMinHeight`, `BBWMaxHeight`, `BBWMinWidth`, `BBWMaxWidth`
   - Grayscale: `FGMinHeight`, `FGMaxHeight`, `FGMinWidth`, `FGMaxWidth`
5. Saves via `RejectRepairBatchDetails()`

### Step 6.4 – Lock Batch
After all repairs → Lock Batch button appears → `LockBatch(mlngBatchID)` called.

---

## PHASE 7: Amount Entry / Maker (`frmAmtEntry.vb`)

### Step 7.1 – Queue Building
`GetRejectedCheques()` per level:
- **L2:** Only items where `ChqAmount_1 = 0`
- **L3+:** Items where `ChqAmount_1 = 0` OR `AuthStatus <> 1` OR mismatches (`Amount1<>Amount2`, `ChqNo<>ChqNo1`, `MICR1<>Micr11`)
- If L3+ queue empty → auto: `USP_UPD_BatchStatus(batchID, "2", mCLEARINGTYPE)`

### Step 7.2 – SP_CLIENT_FLAG Corporate Mode
When `SP_CLIENT_FLAG = True`:
- Both L1 and L2 values shown side-by-side: `TextCHQNO1` vs `TextCHQNO2`, `TextDE1AMT` vs `TextDE2AMT`
- Mismatches → fields highlighted **RED** and enabled
- Matches → fields disabled (operator cannot re-type correct data)

### Step 7.3 – 11-Step Save Validation
1. ChequeNo not blank
2. MICR not blank
3. TransCode not blank
4. MICR length = 9
5. TransCode length = 2
6. ChequeNo is numeric
7. MICR is numeric
8. Amount ≠ OCR amount → YES/NO dialog: No = clear and re-enter; Yes = accept override
9. Amount > 0
10. TransCode in valid list (`ValidateTransactionCode()`)
11. L1/L2 same-user check → block if conflict

### Step 7.4 – Save SP
`CCTS.USP_UPD_AmtEntry_new(chequeID, amount, userID, entryLevel, ChequeNo, MICR, MICR1, AcType, SP_CLIENT_FLAG)`

### Step 7.5 – Drawer Check & Validation
While there is no separate "Drawer Check" dashboard phase, drawer validation happens during inline cheque entry and client configuration:
- **Client Configuration:** Checks `IsDrawerCodeRequired` setting for the active client via `frmMngClient.vb`.
- **Cheque Entry Level:** Enforces length limit (`If txtDrawerName.Text.Trim().Length < 2 Then` block). 
- **File Generation Constraint:** Drawer name is automatically hard-capped to a maximum of 40 characters via `Microsoft.VisualBasic.Left(DrawerName, 40)` during the SDEA/XML file generation.

### Step 7.6 – Technical Rejection
Operator selects reason from `cboReason` → confirm: *"ARE YOU SURE TO REJECT THIS CHEQUE FROM CHI UPLOAD?"*
→ Yes: `USP_UPD_TechnicalReturn(mlngChequeID, True, reasonText)` → cheque permanently excluded from CHI.

---

## PHASE 8: Authorization / Checker (`frmChequeAuthorization.vb`)

**Right required:** `"Outward Authorization"`

### Step 8.1 – Grid Loading
`GetChequeDetails()` → shows: SerialNo, ChequeID, AuthStatus, ChequeNo, MICR fields, Amount, PTF Flag.
Running count: `Total Authorized (X)` and `Total Rejected (Y)`.

### Step 8.2 – Keyboard Controls
- **`Y`** key → `grp_approve` panel opens; cheque details pre-filled; `btnApprove` focused.
- **`R`** key → `grp_reject` panel opens; `txtRejectRemarks` focused.

### Step 8.3 – Approve: `AuthenticateCheque(chequeID, userID, status=1, remarks="", isPTF)`
- PTF checkbox → `IsPTF = 1`
- Grid → "Authorized"; cursor advances to next row.

### Step 8.4 – Reject: `AuthenticateCheque(chequeID, userID, status=2, remarks, isPTF)`
- `txtRejectRemarks` empty → blocked.
- Grid → "Rejected"; cursor advances.

### Step 8.5 – Hidden Bulk Approve
**Ctrl+Shift+F10** → password panel. Password: `"ACPL123"` → `btnApproveAll` visible → loops all rows calling `AuthenticateCheque(status=1)`.

---

## PHASE 9: RCMS Entry (`FrmRcmsEntry`)

Triggered by status `"RCMS Pending"`. Requires `"Outward Cheque Entry"` Access.

**Operator lock:** `sel_pending_CHEQUEENTRY_RCMS(BatchID, 1)` → if `RCMSBY <> glngUserID` → *"RCMS Already in progress. You can not start this Batch."*

---

## PHASE 10: SDEA File Generation (Inline in `frmStartBatchEntry.vb`)

**Triggered by:** Selecting a batch with status `"RCMS Completed"`.

**Pre-check:** `CCTS.GetBatchReportStatus(lngBatchID, r)` — if `r = False` → *"First generating the banking file."*

### Step 10.1 – Part A File
**Path:** `RCMSFILEPATHNEW\{yyyy}\{yyyy-MM-dd}\{PickupLocation}\`
**Filename:** `ddMMyy_LC_{Location}_{PIF}_A.{BatchNo:00000}`

**Record layout (200 chars/line):**
```
# RCMSG_SDEATXN{spaces to 200}
H {RecordId}{ddMMyy}A{BatchNo(5)}{padded 12}CHE{padded 10}{ddMMyyyy}{PIF}{10}{2sp}{SourceOfUpload(10)}{PICKUPLOCATION(10)}{ProductCode(10)}{PDCFlag}{126sp}
D {CustCode(10)}{PickupPoint(10)}{CustRefNo(18)}{DepositSlipNo(10)}{ddMMyyyy}{TotalChqs(5)}{SlipAmount*100(15)}{ProductCode(10)}{PickupLocation(10)}{DepositSlipNo(103)}
C {ChqNo(10)}{BankCode(10)}{BranchCode(10)}{ChqAmount*100(12)}{ddMMyyyy}{DrawerName≤40(40)}{PickupLocation(10)}{Remarks(71)}{ISNo(20)}{8sp}
T {Deposits(00000)}{TotalAmount*100 padLeft 15}{179sp}
```

**ISNo rule:** `Mid(MICR1, 4, 3) = "036"` → `ISNo = "SCB TRANSFER"` else normal `ISNo`.
**DrawerName:** `Microsoft.VisualBasic.Left(DrawerName, 40)` — hard cap 40 chars.
**Amounts:** `Val(amount) * 100`.Replace(".000","") — paise, no decimal.
**Blank slip guard:** If cheque record for slip = 0 → *"BLANK DEPOSIT SLIP Please first Remove Blank Slip & Regenerate RCMS"* → halts.

After Part A written: `UpdateBatchStatuso(lngBatchID, 6)`.

### Step 10.2 – Part C File
Generated only if `RPTSDEA_Deposit_File_NEW1(lngBatchID)` returns rows.
**Filename:** `ddMMyy_LC_{Location}_{PIF}_C.{BatchNo:00000}`
Uses `USP_RPT_SDEA_HEADER_FileA` (header uses `RepLocName` instead of `PICKUPLOCATION`).
Uses `USP_RPT_SDEA_Deposit_File_NEW1` and `USP_RPT_SDEA_CHEQUE_File`.
After Part C written: `UpdateBatchStatuso(lngBatchID, 6)`.

### Step 10.3 – Auto Slip Summary PDFs
`btnSlipSummaryPDF_Click()` auto-runs after each file:
- Report: `\Reports\CTSBatchWiseSummary.rpt`
- Params: BatchID, slip count, total amount
- Two PDFs: `{ddMMyyyy}_{BatchNo}_SLIP_SUMMARY_{Location}1.pdf` (Part A) and `2.pdf` (Part C)
- Written to: `RCMSFILEPATHNEW\{yyyy}\{yyyy-MM-dd}\{LocationName}\`

---

## PHASE 11: FTP Upload (Inline in `frmStartBatchEntry.vb`)

Triggered by status `"CHI XML Generated"`.

### Step 11.1 – PGP File Validation
Scans `gstrExportOutwardFilePath\{GRID}\{BatchNo}\` for `*.pgp`:
- Must find **exactly 2**: one with `.XML` in name (data), one with `.IMG` in name (images).
- If count ≠ 2 → *"PGP Not available."* → halt.

### Step 11.2 – FTP Credentials (Hardcoded)
```
gstrFTPUserName = "AIRANFTP"
gstrFTPPassword = "Airan@123"
gstrFTPURL      = "ftp://scbftp.airanlimited.com/quickcts/chi%20upload"
```

### Step 11.3 – Upload Sequence
1. `CreateFTPFolder(yyyyMMdd)` — date folder on FTP
2. `CreateFTPFolder(yyyyMMdd/BatchNo)` — batch subfolder
3. Build URL: `https://scbftp.airanlimited.com/addbatch.aspx?b={BatchNo}&bd={Date}&bx={XMLFile}&bi={IMGFile}&loc={Location}&bid={BankID}&grid={Grid}`
4. `FireURL(strURL)` must return `"Success"` — else upload aborted
5. `UploadFile(txtXML, ftpXMLPath, user, pass)` — upload XML PGP
6. `UploadFile(txtIMG, ftpIMGPath, user, pass)` — upload IMG PGP

### Step 11.4 – Post-Upload Status
`sel_pending_CHEQUEENTRY_RCMS(lngBatchID, 0)`:
- Count = 0 → `UpdateBatchStatuso(lngBatchID, 5)` → Finalized → `RCOM = True` → Exit Sub
- Count > 0 → `UpdateBatchStatuso(lngBatchID, 4)` → RCMS Pending

`Directory.Move(InitialDirectory, dInitialDirectory)` → archive outward folder to `\done\{GRID}\{BatchNo}\`

---

## PHASE 12: CHI XML Generation (`NEWRptCreateXML.vb`)

Triggered by `Btn_RCMS` (requires `"BULK XML/RCMS GENERATE"` right) or from `frmOut1gen.vb`.

### Step 12.1 – Pre-flight Checks
- Blank slip guard: `If dtchq.Count() = 0 Then MsgBox("BLANK DEPOSIT SLIP...")`
- All cheques must be authorized: `If dr.AuthStatus <> 1 Then MsgBox("Authorisation is pending.")`
- Concurrency lock: `CCTS.USP_UPD_BatchXMLGenInProgress(batchID, True)` — prevents two users generating simultaneously
- Cheques with `Mid(MICR1, 4, 3) = "036"` (SCB Transfer) are **skipped** from the XML

### Step 12.2 – XML Filename Convention
- Short ScannerID (≤3 chars): `CXF_{PresentBankRoutNo}_{ddMMyyyy}_{HHmmss}_{ClearingType}_{CycleNo(10)}.XML`
- Long ScannerID (6 chars): FileID = `{ScannerID}{CycleNo(6)}`
- IMG: `CIBF_{PresentBankRoutNo}_{ddMMyyyy}_{HHmmss}_{ClearingType}_{CycleNo}_01.IMG`
- Export path: `gstrExportOutwardFilePath/{GRID}/{BatchNo}/`

### Step 12.3 – XML Per-Cheque Elements
`<FileHeader>` namespace: `urn:schemas-ncr-com:ECPIX:CXF:FileStructure:010001`, `TestFileIndicator='P'`  
Per `<Item>`: `ItemSeqNo`, `PayorBankRoutNo`, `Amount` (paise ×100), `AccountNo`, `SerialNo`, `TransCode`, `NumOfImageViews='3'`, `DocType` (`B`=regular, `C`=PTF), `MICRRepairFlags='000011'`  
`<MICRDS>`: RSA-SHA256 7 digital signature, `SecurityKeySize='2048'`, fingerprint=`SerialNo;PayorBankRoutNo;TransCode;Amount`  
`<ImageViewDetail>` × 3: Front BW (TIFF/G4), Back BW (TIFF/G4), Front Gray (JFIF/JPEG)

### Step 12.4 – IMG File
Per cheque: 256-byte random padding → Front BW bytes → 256-byte random → Front Gray bytes → 256-byte random → Back BW bytes. Note: `img1=ChqImgName1`, `img2=ChqImgName3`, `img3=ChqImgName2` (index swap).

---

## PHASE 13: Batch Status State Machine

| DB Status | ComputedLabel | Set By | Next |
|---|---|---|---|
| `0` | `"RR Pending"` | MICR errors on scan | Reject Repair |
| `1` (partial) | `"Chq. Entry Pending"` | `LockBatch()` | Slip + L1 entry |
| `2` + QCPending=`"1"` | `"OCR Mistmatch"` | L1 done, L2 needed | L2 Entry |
| `2` + QCPending=`"2"` | `"QC Pending"` | L2 mismatch | L3 QC |
| `2` + high-value | `"3 Level Max Amount/RBI"` | `sel_rbi_maxamt()>0` | L4 Override |
| `2` + XML running | `"CHI In Progress"` | `IsXMLGenInProgess=True` | Wait |
| `2` (clean) | `"CHI Pending"` | Data entry complete | XML Generation |
| `3` | `"CHI XML Generated"` | XML+IMG generated | FTP Upload |
| `4` | `"RCMS Pending"` | FTP done, RCMS pending | RCMS Entry |
| `5` | `"RCMS Completed"` | FTP done, no RCMS | SDEA Generation |
| `6` | `"Completed"` | SDEA written | Done |

> **Confirmed from code:** `UpdateBatchStatuso()` calls at lines 379 (→5), 385 (→4), 653 (→6), 769 (→6). Status labels computed at lines 1098–1145.

---

## PHASE 13: User Access Rights Matrix

Two checker functions: `CheckUserMenuRights(userID, menuName, rightType)` (legacy) and `NEWCheckUserMenuRights(userID, menuName, rightType)` (new). `rightType` = `"Access"`, `"Add"`, or `"Edit"`.

| Menu Right | What It Protects |
|---|---|
| `"Outward Batch Master"` Add | Batch creation (`frmBatchMaster` Button1) |
| `"Outward Batch Master"` Edit | Batch edit/re-scan (`frmBatchMaster` txtBatchNo_LostFocus) |
| `"Batch Delete Rights"` Access | `USP_DEL_BatchMaster_new()` |
| `"Outward Slip Entry"` Add | Slip creation |
| `"Outward Slip Entry"` Edit | Slip editing |
| `"Reject Repair Scanned Documents"` | `frmRejectRepair` access gate |
| `"Outward Cheque Entry"` Access | L2 entry routing, L4, FTP upload, RCMS Pending |
| `"QC Pending"` Access | L3 QC entry routing (`FrmqcAmtq`) |
| `"Outward Authorization"` | `frmChequeAuthorization` |
| `"BULK XML/RCMS GENERATE"` Access | `Btn_RCMS` on dashboard |
