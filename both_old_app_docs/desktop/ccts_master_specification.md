# CCTS – Master System Specification (Code-Verified)

> **This document is the single source of truth for the CCTS system.**  
> Every fact, rule, file name, and constant is verified directly from source code files. This consolidates all other documentation and adds coverage of previously undocumented areas.

---

## 1. Project Overview

**CCTS (Cheque Truncation System)** is an enterprise-grade, multi-tier Windows desktop + web application for banks and clearing management companies (CMC). It digitizes and processes physical cheques end-to-end per India's **CTS 2010 standard** and **RBI/NPCI clearing house** requirements.

The complete lifecycle: physical scanning → MICR capture → image quality checks → multi-level data enrichment → authorization → RCMS data entry → CHI XML/IMG file generation → PGP encryption → FTP upload → SDEA file generation.

### 1.1 Deployment Modes (from `CCTSvb.vb`)
- **HUB (`APPTYPE = "HUB"`)**: Full-featured. Amounts manually entered. Main use case.
- **BRANCH (`APPTYPE = "BRANCH"`)**: Lightweight terminal. Totals derived automatically. Routes all dashboard clicks to `frmBatchMaster` edit mode instead of workflow screens.

### 1.2 Technology Stack
| Layer | Language | Framework |
|---|---|---|
| Desktop Client | VB.NET | .NET Framework 4.8, WinForms |
| Web Portal | C# | ASP.NET Web Forms |
| Data Layer | VB.NET | LINQ-to-SQL (DBML) |
| Database | T-SQL | Microsoft SQL Server |

### 1.3 External Libraries (verified from project references)
| Library | Purpose |
|---|---|
| `AxInterop.RANGERLib` | Silver Bullet Ranger scanner API — transport states, MICR, IQA, endorsement |
| `Crystal Reports (CrystalDecisions.*)` | PDF generation for Slip Summaries, EOD reports |
| `Ionic.Zip` | ZIP creation for batch export packages |
| `System.Security.Cryptography.RijndaelManaged` | AES encryption of batch ZIP (key: `"QuickCTS"`) |
| `Emgu.CV` / `AForge.Imaging` | Computer vision for MICR band/image alignment |
| `ClosedXML` / `EPPlus` | Excel import/export for master data and EOD reports |
| `SocialExplorer.FastDBF` | Legacy `.dbf` return file import from some CBS |
| `RSAendn` (sub-project) | RSA-SHA256 signing of CHI digital signature |

---

## 2. Solution Structure

### 2.1 CCTS (Desktop — `CCTS.vbproj`)
The primary WinForms application all operators use.

### 2.2 CCTSClass (Data Layer — `CCTSClass.vbproj`)
- `CCTSData.dbml` — LINQ-to-SQL ORM for operational tables (batches, cheques, slips, scans)
- `DataClassesM.dbml` — ORM for master tables (banks, branches, users, locations)
- All SP calls from desktop and web pass through this layer

### 2.3 CCTS_Web (Web Portal — `CCTS_Web.csproj`)
- `authorizescheques.aspx` — Browser-based authorization for branch managers
- `Default.aspx` / `UserMaster.Master` — Session scaffolding

### 2.4 Supporting Projects
| Project | Purpose |
|---|---|
| `RSAendn` | PKI/RSA-SHA256 envelope signing for NPCI |
| `cctsImageConverter` | Converts TIFFs/JPGs to CTS 2010-compliant formats |
| `AutoUpdater` | Silent hot-patch: runs `.sql` patches; swaps `.rpt` Crystal Reports |

### 2.5 Database Scripts
| File | Content |
|---|---|
| `NACH_Tables.sql` | DDL — all operational + master tables |
| `NACH_SP.sql` | All stored procedures (`USP_Validate_Login`, `USP_UPD_AmtEntry_new`, `USP_UPD_BatchStatus`, `USP_RPT_SDEA_*`, etc.) |
| `NACH_FUN.sql` | Scalar functions (date math, MICR parsing, amount formatting) |
| `NACH_Client.sql` | Seed data — baseline clients and banks |

---

## 3. Complete Operational Workflow (Code-Verified, Phase by Phase)

---

### PHASE 1: Login & Auto-Patch (`LoginPage.vb`)

#### 1.1 Version Gate
```vb
Dim appVer = GetSettings("CHIVersion")
If appVer <> gstrCHIVersion Then
    MsgBox("Application Version Not Matched. Please get Latest Application Version from Server.")
    Exit Sub
End If
```
Any version mismatch → hard block before any login is attempted.

#### 1.2 Credential Encryption
```vb
Dim passEncrypted As String = EncryptString(txtPassword.Text.Trim(), "QuickCTS")
```
Password is AES-encrypted with key `"QuickCTS"` before being passed to the SP.

#### 1.3 SP: `USP_Validate_Login` (Output Parameters)
Called via direct `SqlCommand` with output params `@ResultCode` (Int) and `@UID` (BigInt).

| ResultCode | Meaning | Action |
|---|---|---|
| 0 | Success | `LoadUserDetails()` → show `frmSelectPresentingBrach` → `processUpdate()` |
| 1 | Wrong password | Shows remaining attempts (`5 - FailedAttempts` from `USP_SEL_UserMaster_new`) |
| 2 | Account inactive | Hard block message |
| 3 | Password expired (90 days) | Opens `frmchangepassword` |
| 4 | Reset required | Opens `frmchangepassword` |
| 5 | Account locked | Hard block message |

#### 1.4 Session Variables Loaded (`LoadUserDetails` → `USP_SEL_UserMaster`)
```vb
gstrUserName = dr.UserName
glngUserID = dr.UID
gintScan = dr.IsScan
gintFI = dr.IsFI
gintSI = dr.IsSI
gintCHI = dr.IsCHI
gstrPickupLocation = dr.PickupLocation
```

#### 1.5 Auto-Patch (`processUpdate()` — after successful login)
```vb
' SQL patches
Dim _fl As New DirectoryInfo(Application.StartupPath + "\\SQL")
_flList = _fl.GetFiles(".sql")
' Execute each → Delete file

' Crystal Report updates
_fl = New DirectoryInfo(Application.StartupPath + "\\NewReports")
_flList = _fl.GetFiles(".rpt")
' Copy to \\Reports\\ → Delete original
```

---

### PHASE 2: Branch Selection (`frmSelectPresentingBrach.vb`)
Post-login: operator selects their presenting branch. Sets `glngPresentBranchID`, `gstrCMSLocation`, `gintPresentBankRoutingNo`.

---

### PHASE 3: Batch Creation (`frmBatchMaster.vb`)

**Right required:** `"Outward Batch Master"` → Add

#### 3.1 Eight-Field Validation Chain
1. Clearing Type selected (CTS = `CLEARINGTYPE` setting e.g. `"01"`; Non-CTS = `"11"`)
2. Pickup Location not blank
3. SummRefNo not blank
4. PIF not blank
5. **SummRefNo must equal PIF** → error if different
6. Total Slips > 0
7. Total Amount > 0 (disabled in BRANCH mode)
8. `USP_SEL_CMS_Location()` → location must exist AND `ScannerID <> "000"` AND `ScannerID <> Nothing`

#### 3.2 On Success
- `CreateNewBatch(...)` → 6-digit zero-padded BatchNo
- Network folder created: `gstrSharedPath\{YYYY}\{MMM}\{dd-MM-yyyy}\{BatchNo}\`

#### 3.3 Batch Export (Branch→Hub Transfer)
Three pipe-delimited files → ZIP (Ionic.Zip) → AES-encrypt (Rijndael, key `"QuickCTS"`) → `gstrEncryptFilePath`
- `BatchMaster.txt`: `BatchID|BatchNo|BatchDate|BatchAmount|TotalSlips|TotalChqs|BatchStatus|ClearingType|...|PickupLocation|SummRefNo|PIF`
- `BatchDetails.txt`: `BDID|BatchID|MICRText|NoOfChqs|ImgFileName1|ImgFileName2|ImgFileName3|Status|Reason|ItemSeqNo|EndorseText|ChNo|MICR|AcNo|AcType|IsCheque`
- `SlipEntry.txt`: `SlipID|SlipNo|SlipDate|CustCode|AC_Name|AC_No|PickupPoint|DepositSlipNo|TotalChqs|SlipAmount|CustRefNo|ProductCode|Remarks`

#### 3.4 Delete Batch
Requires `"Batch Delete Rights"` Access → `USP_DEL_BatchMaster_new(batchID)`.  
Press **D** on a cheque grid row to remove that cheque from an unlocked batch.

---

### PHASE 4: Scanning (`frmScanCheque.vb`)

**Scanner API:** Silver Bullet Ranger (`AxRanger1` ActiveX). Supported models: CR120, CR135, CR190.

#### 4.1 Startup Sequence
1. `AxRanger1.StartUp()` → state: `TransportStartingUp`
2. `TransportChangeOptionsState` fires → IQA disabled:
   - `SetGenericOption("OptionalDevices", "NeedIQA", "False")`
   - `SetGenericOption("OptionalDevices", "NeedIQAUpstream", "False")`
3. `AxRanger1.EnableOptions()` → state: `TransportReadyToFeed`

**Transport States (XportStates enum):**
0=ShutDown, 1=StartingUp, 2=ChangeOptions, 3=EnablingOptions, 4=ReadyToFeed, 5=Feeding, 6=ExceptionInProgress, 7=ShuttingDown

#### 4.2 Deposit Slip Pre-Check (Before Each Feed)
If `gintSlipTotalChq = 0` OR `intTotalSlipChqScans = 0` OR `intTotalSlipChqScans >= gintSlipTotalChq` → opens `frmDepositSlipEntry` (SlipNo + TotalInstruments).

#### 4.3 Per-Item: `TransportSetItemOutput` Event (MICR + Endorsement)
```vb
AxRanger1.GetMicrText(1)  ' spaces replaced with "_"
```
Endorsement (if `gintEnableEndorse = 1`):
- CR120: `GetBatchEndorsementText_NEWN(batchID, scannerID, counter)` → prints at line `gintEndorseLine`
- CR190/others: `GetBatchEndorsementText_NEW(batchID, scannerID, counter)`
- **CR135: Skip — no endorsement printed**

#### 4.4 Per-Item: IQA Testing (14 tests, 9 active)
| ID | Test | Status |
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

IQA failure → item added to `lstIQFailedCheques` for re-scan.

#### 4.5 Per-Item: `TransportItemInPocket` Event (Image Save)
Scan limit: if `intTotalChqScans = OutwardChqCount` setting → stop silently.

Three images saved per cheque:
- `{yyyyMMdd}{BatchNo}_Front_{SeqNo}.tif` — Front B/W, CCITT4 compressed TIFF
- `{yyyyMMdd}{BatchNo}_Back_{SeqNo}.tif` — Back B/W
- `{yyyyMMdd}{BatchNo}_FrontG_{SeqNo}.jpg` — Front Grayscale JPEG

`CreateNewBatchDetails(lngBatchDID, lngBatchID, MICRText, 0, ImgFileName1, ImgFileName2, ImgFileName3, 1, UserID, intStatus, "", SeqNo, EndorseText)`

#### 4.6 Shutdown
`AxRanger1.ShutDown()` → `UpdateNoOfCheques(lngBatchID, intTotalChqScans)`.  
**Form cannot be closed while scanner is running** (`Form1_FormClosing` cancels if state ≠ `TransportShutDown`).

---

### PHASE 5: Batch Dashboard & Status Routing (`frmStartBatchEntry.vb`)

#### 5.1 Auto-Refresh
`Timer1.Interval = 6000` (6 seconds) → calls `btnGet_Click()`. `mblnIsLoading` flag prevents re-entrant refresh.

#### 5.2 Data Load & Filter
`GetBatchDetailsnew2(...)` fetches all batches for date/grid. Then `ComboStatus` dropdown applies client-side LINQ filter:

| ComboStatus Index | Filter | Notes |
|---|---|---|
| 0 | All batches | No filter |
| 1 | `BatchStatus = 0 Or 1` | Scanning/Entry pending |
| 2 | `BatchStatus = 2 And QCPending = "2"` | QC Pending |
| 3 | `BatchStatus = 4 And QCPending in ("0","3")` | RCMS Pending |
| 4 | `BatchStatus = 5 And QCPending in ("0","3")` | CHI XML Generated |
| 5 | `BatchStatus = 6 And QCPending in ("0","3")` | RCMS Completed |
| 6 | `BatchStatus = 2 And QCPending = "0"` | CHI Pending |
| 7 | `BatchStatus = 2 And QCPending = "1"` | OCR Mismatch |
| 8 | `BatchStatus = 1` | Chq. Entry Pending |
| 9 | `BatchStatus = 3` | CHI XML Generated |

#### 5.3 Status Labels (computed per row in grid, directly from code lines 1098–1145)
```vb
If dr.BatchStatus = 0 → "RR Pending"
ElseIf dr.BatchStatus = 1 And TotalCheques > TotalChqEntryDone → "Chq. Entry Pending"
ElseIf (dr.BatchStatus = 2 And TotalCheques = TotalChqEntryDone And TotalChqEntryDone > TotalChqL2EntryDone And SlipEntryAmount = SlipTotalAmount) Or QCPending = "1" → "OCR Mistmatch"  ' typo in code
ElseIf QCPending = "2" → "QC Pending"
ElseIf dr.BatchStatus = 2:
    If IsXMLGenInProgess = True → "CHI In Progress"
    ElseIf sel_rbi_maxamt() > 0 → "3 Level Max Amount/RBI"
    Else → "CHI Pending"
ElseIf dr.BatchStatus = 3 → "CHI XML Generated"
ElseIf dr.BatchStatus = 4 → "RCMS Pending"
ElseIf dr.BatchStatus = 5 → "RCMS Completed"
ElseIf dr.BatchStatus = 6 → "Completed"
```

#### 5.4 Routing on Row Click (`btnStartBatchEntry_Click`)
| Status Label | Opens | Access Check |
|---|---|---|
| `"RR Pending"` | `frmRejectRepair` | — |
| `"Chq. Entry Pending"` | `frmSlipMaster` | — |
| `"OCR Mistmatch"` | `Frmqcamt` (mintEntryLevel=2) | `"Outward Cheque Entry"` + FIBy/DEBy user-lock |
| `"QC Pending"` | `FrmqcAmtq` (mintEntryLevel=3) | `"QC Pending"` |
| `"3 Level Max Amount/RBI"` | `FRM_VALIDATE3` (mintEntryLevel=4) | `"Outward Cheque Entry"` |
| `"CHI XML Generated"` | Inline FTP upload | `"Outward Cheque Entry"` |
| `"RCMS Pending"` | `FrmRcmsEntry` | `"Outward Cheque Entry"` + RCMSBY lock |
| `"RCMS Completed"` | Inline SDEA writer | `GetBatchReportStatus()` pre-check |

**BRANCH mode** bypasses all routing → always opens `frmBatchMaster` in Edit mode.

#### 5.5 Admin-Only Controls (hardcoded usernames in code)
- **Button2** visible only for: `shivam, ROSHNIPARMAR, admin, narendra parmar, SAFREEN SHAIKH, UTTAM VAISHYA, SMITESH RATHOD, UNNATI BAROT, ANIL SHINDE, SHIVAM SHAH`
- **Label4/ComboBox1/Button3/Button4** visible only for: `shivam, admin, SHIVAM SHAH`
- **Btn_RCMS** controlled by `NEWCheckUserMenuRights("BULK XML/RCMS GENERATE", "Access")`

#### 5.6 OCR Mismatch User-Lock (lines 140–160)
```vb
l1User = _batchdetails(0).FIBy    ' Level 1 user
l2User = _batchdetails(0).DEBy    ' Level 2 user
curUser = gstrUserName

If l2User = gstrUserName → BLOCK "Level 1 - 2 entry must be done by two different users."
If l1User <> "OCR" And l1User = gstrUserName → BLOCK "Level 2 Entry is already started by Other User."
```

---

### PHASE 6: Reject Repair (`frmRejectRepair.vb`)

**Right required:** `"Reject Repair Scanned Documents"` | **Trigger:** `BatchStatus = 0` ("RR Pending")

#### 6.1 Nine-Check Auto-Validation per Item
1. ChequeNo is numeric
2. ChequeNo length = 6 digits
3. MICR is numeric
4. MICR length = 9 digits
5. `MICR.Substring(3,3)` in bank master (`CheckBankIsAvailable1()`) — 0 = not participating
6. `GetBlockMicr()` — if on blocked list, MICR cleared
7. `GetTransactionRule(MICR) <> 0` — if CHM translation needed
8. TransCode: numeric, exactly 2 digits, in `ValidateTransactionCode()` list
9. Account Number (if present): numeric, 6 digits

#### 6.2 Image Viewer
3 modes: Front B/W (bitonal TIFF), Front Grayscale (JPEG), Back B/W (bitonal TIFF). Live pixel dimensions shown in `lblWidth`/`lblHeight`.

#### 6.3 Save Validation
1. MICR exactly 9 chars
2. `MICR.Substring(3,3)` in bank master
3. ChequeNo = 6 digits, not `"000000"`
4. **`ValidateImageSize()`** — all 3 images validated against 6 DB settings:
   - Front B/W: `FBWMinHeight`, `FBWMMaxHeight`, `FBWMinWidth`, `FBWMaxWidth`
   - Back B/W: `BBWMinHeight`, `BBWMMaxHeight`, `BBWMinWidth`, `BBWMaxWidth`
   - Front Gray: `FGMinHeight`, `FGMMaxHeight`, `FGMinWidth`, `FGMaxWidth`

#### 6.4 Lock Batch
After all repairs done → `LockBatch(mlngBatchID)` → batch advances to "Chq. Entry Pending".

---

### PHASE 7: Slip Entry (`frmSlipMaster.vb`)

**Right required:** `"Outward Slip Entry"` → Add/Edit | **Prerequisite:** `IsBatchLocked(BatchNo) = True`

#### 7.1 Eight-Step Save Validation
1. Pickup Point exists in `USP_SEL_ClientPickupPoints` matching `Mid(LocationCode,1,5)` AND `LocCode`
2. Slip No not blank
3. Account No not blank (numeric-only keypresses)
4. Branch selected
5. Amount > 0
6. Account No equals Account No confirm field (dual-entry)
7. Duplicate slip check via `GetSlipDetails(batchID, slipNo)` → block if duplicate
8. `CalculateBatchCheques()`: `intscannedcheques = count of BatchDetails where Status >= 1`. If `intscannedcheques < txtTotalChqs` → block

#### 7.2 Auto Slip Number
`GetAutoSlipNumber(mlngBatchID)` → `LastSlipNo + 1`. Defaults to `101` if no slips yet.

#### 7.3 Post-Save
`ManageSlipsWithSoftSlip(...)` → `ChequeDetails.vb` opens automatically (Tag="Add", mstrEntryType="Single").

---

### PHASE 8: Cheque Data Entry — ChequeDetails.vb

Opens per slip to enter individual cheque data: Bank Name, Cheque Amount, Cheque Date, Drawer Name, CustRefNo, Remarks.

**Drawer Validation (inline — no separate screen):**
- Client configuration in `frmMngClient.vb` sets `IsDrawerCodeRequired` — controls whether field is mandatory.
- Minimum drawer name length: `If txtDrawerName.Text.Trim().Length < 2 Then MessageBox.Show("Drawer Name Length must Require 2 digits !!")`.
- At SDEA file generation time: `Microsoft.VisualBasic.Left(DrawerName.ToString(), 40)` — hard 40-char cap applied automatically in both `Generatesdea.vb` (lines 129–133) and `frmStartBatchEntry.vb` (lines 615–619, 731–735).

Grid in `ChequeDetails` shows: ChqNo, ChqDate, Amount, BankCode, BankName, DrawerName, CustRefNo, Remarks (from `GetBatchCheques()` using `GetChequeDetailsNEW()`).

---

### PHASE 9: Amount Entry / Maker (`frmAmtEntry.vb`)

#### 9.1 Multi-Level Entry
| Level | Form | Queue Rule |
|---|---|---|
| L1 | `frmAmtEntry` (entryLevel=1) | OCR pre-fills; operator confirms/corrects |
| L2 | `Frmqcamt` (entryLevel=2) | Items where `ChqAmount_1 = 0`; different user from L1 mandatory |
| L3 | `FrmqcAmtq` (entryLevel=3) | Items with mismatches, `AuthStatus <> 1`, or amount/MICR/ChequeNo discrepancies |
| L4 | `FRM_VALIDATE3` (entryLevel=4) | High-value / RBI threshold override |

If L3+ queue empty → auto: `USP_UPD_BatchStatus(batchID, "2", mCLEARINGTYPE)`

#### 9.2 SP_CLIENT_FLAG Corporate Mode
When `SP_CLIENT_FLAG = True`: Both L1 and L2 values shown side-by-side. Mismatches highlighted **RED** and editable. Matches locked.

#### 9.3 Eleven-Step Save Validation
1. ChequeNo not blank
2. MICR not blank
3. TransCode not blank
4. MICR length = 9
5. TransCode length = 2
6. ChequeNo is numeric
7. MICR is numeric
8. Amount ≠ OCR amount → YES/NO dialog (No = clear; Yes = accept override)
9. Amount > 0
10. TransCode in `ValidateTransactionCode()` list
11. L1/L2 same-user block

`CCTS.USP_UPD_AmtEntry_new(chequeID, amount, userID, entryLevel, ChequeNo, MICR, MICR1, AcType, SP_CLIENT_FLAG)`

#### 9.4 Technical Rejection
Select reason from `cboReason` → confirm dialog → Yes: `USP_UPD_TechnicalReturn(mlngChequeID, True, reasonText)` → permanently excluded from CHI.

---

### PHASE 10: Checker / Authorization (`frmChequeAuthorization.vb` + `authorizescheques.aspx`)

**Right required:** `"Outward Authorization"`

#### 10.1 Keyboard-Driven Review
- **`Y`** key → `grp_approve` panel opens; `btnApprove` focused; PTF flag option available
- **`R`** key → `grp_reject` panel opens; `txtRejectRemarks` focused; blank = blocked

`AuthenticateCheque(chequeID, userID, status, remarks, isPTF)`:
- Approve → `AuthStatus = 1`
- Reject → `AuthStatus = 2` (blank remarks = blocked)

Grid auto-advances to next row after each action. Running totals: `Total Authorized (X)` and `Total Rejected (Y)`.

#### 10.2 Hidden Bulk Approve
**Ctrl+Shift+F10** → password panel. Password: `"ACPL123"` → `btnApproveAll` appears → loops all rows calling `AuthenticateCheque(status=1)`.

#### 10.3 Web Authorization
`authorizescheques.aspx` in `CCTS_Web` project for branch managers without the desktop app.

---

### PHASE 11: CHI XML Generation (`NEWRptCreateXML.vb`)

Triggered from `Btn_RCMS` (requires `"BULK XML/RCMS GENERATE"` right) or from `frmOut1gen.vb`.

#### 11.1 Pre-flight Checks (from code line 659–718)
```vb
' Check for blank deposit slips
For Each dr In dtSlip
    If dtchq.Count() = 0 → "BLANK DEPOSIT SLIP - Please first Remove Blank Slip & Regenerate RCMS"
    Exit Sub
Next

' Check all cheques are authorized
For Each dr In _ChequeDet
    If dr.AuthStatus <> 1 → "Authorisation is pending. Please complete Batch First."
    Exit Sub
Next

' Check if XML generation is already in progress
If IsXMLGenInProgress = True → "XML Generation in progress"
CCTS.USP_UPD_BatchXMLGenInProgress(batchID, True)   ' Lock to prevent concurrent generation
```

#### 11.2 XML Filename Convention
Two variants depending on `ScannerID` length:
- **Short ScannerID (≤3 chars):** `CXF_{PresentBankRoutNo}_{ddMMyyyy}_{HHmmss}_{ClearingType}_{CycleNo(10 digits)}.XML`
- **Long ScannerID (>3, 6 chars):** Uses ScannerID as prefix: `CXF_{PresentBankRoutNo}_{ddMMyyyy}_{HHmmss}_{ClearingType}_{CycleNo(10 digits)}.XML` (FileID = ScannerID + CycleNo paddded to 6)

IMG file: `CIBF_{PresentBankRoutNo}_{ddMMyyyy}_{HHmmss}_{ClearingType}_{CycleNo}_01.IMG`

Export path: `gstrExportOutwardFilePath/{GRID}/{BatchNo}/`

#### 11.3 XML Structure (per cheque, from code lines 216–235)
- Cheques with `MICR1.Substring(3,3) = "036"` are **skipped** from XML (SCB Transfer — only SDEA).
- `<FileHeader>` namespace: `urn:schemas-ncr-com:ECPIX:CXF:FileStructure:010001`, VersionNumber=`010001`, TestFileIndicator=`P`
- Per item `<Item>`: ItemSeqNo, PayorBankRoutNo, Amount (×100 paise), AccountNo, SerialNo, TransCode, PresentingBankRoutNo, PresentmentDate, CycleNo, NumOfImageViews=`3`, ClearingType, DocType (`B`=regular, `C`=PTF), MICRRepairFlags=`000011`
- `<AddendA>`: BOFDRoutNo, IFSC code, DepositorAcct (if exists)
- `<MICRDS>`: RSA-SHA256 digital signature over MICRFingerPrint (`SerialNo;PayorBankRoutNo;TransCode;Amount`)
- `<ImageViewDetail>` × 3: Front BW (TIFF/G4), Back BW (TIFF/G4), Front Gray (JFIF/JPEG) — each with `<ImageViewData>`, `<ImageDS>`, `<ImageViewAnalysis>`
- `<FileSummary>`: TotalItemCount, TotalAmount (×100)

#### 11.4 IMG Binary File
Per cheque: 256-byte random `R` array written → `B` (Front BW bytes) → 256-byte random → `B1` (Front Gray bytes) → 256-byte random → `B2` (Back BW bytes). File opened in `FileMode.Append` or `FileMode.Create`.

Byte sequence: `img1 = ChqImgName1 (Front BW)`, `img2 = ChqImgName3 (Front Gray)`, `img3 = ChqImgName2 (Back BW)` — note the name-index swap.

#### 11.5 ItemSeqNo Logic
- Looked up from `GetItemSeqDetails("", StrDate, "", lngBatchID, "")`.
- If not found → `{yyyyMMdd}000001`.
- If found → `Val(max_ISNo) + 1` formatted as 6 digits.
- CycleNo: `GetCycleDetails("", StrDate)` count + 1. Formatted as `"0000"` (short ScannerID) or `"000"` (long).

---

### PHASE 12: FTP Upload (Inline in `frmStartBatchEntry.vb`)

**Trigger:** Row with status `"CHI XML Generated"` clicked | **Right:** `"Outward Cheque Entry"`

#### 12.1 PGP File Validation
```vb
Dim pgpFiles = Directory.GetFiles(InitialDirectory, "*.pgp")
If pgpFiles.Length = 2 Then
    pgpFiles = pgpFiles.Take(2).ToArray()
Else
    MsgBox("PGP Not available.") : Exit Sub
```
`InitialDirectory = gstrExportOutwardFilePath \ {GRID} \ {BatchNo}`

Files are identified by `.XML` or `.IMG` in their names.

#### 12.2 Hardcoded FTP Credentials
```vb
gstrFTPUserName = "AIRANFTP"
gstrFTPPassword = "Airan@123"
gstrFTPURL = "ftp://scbftp.airanlimited.com/quickcts/chi%20upload"
```

#### 12.3 Upload Sequence
1. `CreateFTPFolder(yyyyMMdd)` — date folder on FTP
2. `CreateFTPFolder(yyyyMMdd/BatchNo)` — batch subfolder
3. HTTP register: `https://scbftp.airanlimited.com/addbatch.aspx?b={BatchNo}&bd={Date}&bx={XMLFile}&bi={IMGFile}&loc={Location}&bid={BankID}&grid={Grid}`  
   → `FireURL(strURL)` must return `"Success"` — else abort
4. `UploadFile(txtXML, ftpXMLPath, user, pass)` — 2KB buffer streaming upload with progress bar
5. `UploadFile(txtIMG, ftpIMGPath, user, pass)` — same

`UploadFile` uses `FtpWebRequest` (Binary, KeepAlive=False, Timeout=Integer.MaxValue, Proxy=Nothing).

#### 12.4 Post-Upload Status Decision
```vb
Dim _CTSRCMS = CCTS.sel_pending_CHEQUEENTRY_RCMS(Val(lngBatchID), 0).ToList()
If _CTSRCMS.Count = 0 Then
    UpdateBatchStatuso(Val(lngBatchID), 5)  ' Finalized
    RCOM = True : Exit Sub
End If
UpdateBatchStatuso(lngBatchID, 4)  ' RCMS Pending
Directory.Move(InitialDirectory, dInitialDirectory)  ' Archive to \done\
```

---

### PHASE 13: RCMS Entry (`FrmRcmsEntry.vb`)

**Trigger:** `"RCMS Pending"` (BatchStatus=4) | **Right:** `"Outward Cheque Entry"`

**Operator lock mechanism:**
```vb
Dim _rcms = CCTS.sel_pending_CHEQUEENTRY_RCMS(Val(batchID), 1).ToList()
For Each DR In _rcms
    If DR.RCMSBY <> glngUserID Then
        MsgBox("RCMS Already in progress. You can not start this Batch.")
        Exit Sub
    End If
    ' Open FrmRcmsEntry
    Exit Sub
Next
```
Also checks `CCTS.USP_SEL_rcmsLGenInProgess(batchID)`.

---

### PHASE 14: SDEA File Generation

Two entry points exist:
1. **Inline in `frmStartBatchEntry.vb`** — triggered by clicking "RCMS Completed" batch row
2. **Standalone `Generatesdea.vb`** — standalone SDEA form accessed via menu

**Trigger:** BatchStatus=5 ("RCMS Completed") | **Pre-check:** `CCTS.GetBatchReportStatus(lngBatchID, r)` — if `r = False` → "First generating the banking file."

#### 14.1 Part A File (Standard Client Deposits)
**SP:** `USP_RPT_SDEA_HEADER_File(batchID)` + `USP_RPT_SDEA_Deposit_File_NEW0(batchID)` + `USP_RPT_SDEA_CHEQUE_File(batchID)`
**Path:** `RCMSFILEPATHNEW\{yyyy}\{yyyy-MM-dd}\{PickupLocation}\`
**Filename:** `{ddMMyy}_LC_{PickupLocation}_{PIF}_A.{BatchNo:00000}`

**Record layout (each line 200 chars padded):**
```
#  RCMSG_SDEATXN{pad to 20}SDEA Transaction Upload to RCMS{pad to 50}{pad 129}
H  {ddMMyy}A{BatchNo(5)}{pad12} CHE{pad10} {ddMMyyyy}{PIF}{10}  {SourceOfUpload(10)}{PICKUPLOCATION(10)}{ProductCode(10)}{PDCFlag}{pad126}
D  {CustCode(10)}{PickupPoint(10)}{CustRefNo(18)}{DepositSlipNo(10)}{ddMMyyyy}{TotalChqs(5)}{SlipAmount*100(15)}{ProductCode(10)}{PickupLocation(10)}{DepositSlipNo(103)}
C  {ChequeNo(10)}{BankCodeC(10)}{BranchCodeC(10)}{Amount*100(12)}{ddMMyyyy}{DrawerName(40)}{PickupLocation(10)}{Remarks(71)}{ISNo(20)}{pad8}
T  {totDepo:00000}{totAmount*100 padLeft 15}{pad179}
```

**Drawer Name cap:** `If drC.DrawerName.ToString().Length > 40 Then _drawerName = Microsoft.VisualBasic.Left(drC.DrawerName.ToString(), 40)`

**ISNo rule:** `If Mid(drC.MICR1.ToString(), 4, 3) = "036" Then _ISNo = "SCB TRANSFER"`

**Blank slip guard:** `If dtchq.count() = 0 Then MessageBox.Show("BLANK DEPOSIT SLIP...")` → halts.

After Part A: `btnSlipSummaryPDF_Click()` auto-runs → `UpdateBatchStatuso(lngBatchID, 6)`.

#### 14.2 Part C File (Rep-Location Deposits)
Generated only if `RPTSDEA_Deposit_File_NEW1(batchID)` returns rows.
**SP:** `USP_RPT_SDEA_HEADER_FileA` (header uses `RepLocName` instead of `PICKUPLOCATION`), `USP_RPT_SDEA_Deposit_File_NEW1`, `USP_RPT_SDEA_CHEQUE_File`
**Filename:** `{ddMMyy}_LC_{PickupLocation}_{PIF}_C.{BatchNo:00000}`

Additional trailer guard (Part C only):
```vb
If totDepo > 0 And totAmount > 0 Then
    _fo.WriteLine("T" & ...)
Else
    MessageBox.Show("No valid deposits or amounts found. Please check batch ID: " & lngBatchID)
```

After Part C: `btnSlipSummaryPDF_Click()` auto-runs → `UpdateBatchStatuso(lngBatchID, 6)`.

#### 14.3 Auto Slip Summary PDFs (`btnSlipSummaryPDF_Click`)
Report: `\Reports\CTSBatchWiseSummary.rpt` (Crystal Reports)
- PDF 1 (Part A slips, param 6=0): `{ddMMyyyy}_{BatchNo}_SLIP_SUMMARY_{LocationName}1.pdf`
- PDF 2 (Part C slips, param 6=1): `{ddMMyyyy}_{BatchNo}_SLIP_SUMMARY_{LocationName}2.pdf`
Written to: `RCMSFILEPATHNEW\{yyyy}\{yyyy-MM-dd}\{LocationName}\`

---

### PHASE 15: End-of-Day (`frmProcessEOD.vb`)

Supervisor-level reconciliation view. Loads via `USP_SEL_ProcessEOD(yyyyMMdd, GRID)`.

**Grid columns shown:** Grid, Location, BatchAmount (CTSAmount), TotalCheques (CTSChq), RetChqCount, RetChqAmount, UserName.

**Export to Excel:** `btnExport` → `DatatableToExcel()` → saved to `ExportOutwardBankFile` setting folder.
Filename: `{yyyyMMdd}_{GRID}_{yyyy-MMM-dd}_{Location}.xlsx`

**NACH Excel Export (`btnGenNachExcel`):** Per DR in `USP_SEL_NACH_Entry(batchID, 0)` → generates NACH-specific Excel with 22 columns including UtilityCode, IFSC, Amount, Frequency, etc. Also copies `ImgFileName1` (→ `_T.tiff`) and `ImgFileName2` (→ `_J.jpg`).
Filename: `F_{UtilityCode}_1_{ddMMyyyy}_{ScannerID}.xlsx`

---

### PHASE 16: Inward Returns Processing

| Form | Purpose |
|---|---|
| `frmImportOutwardReturn.vb` | Generic return file import |
| `frmImportCTSReturn.vb` | CTS XML return files specifically |
| `frmImportDBF.vb` | Legacy `.dbf` format CBS return files |
| `frmGenerateReturnXML.vb` | Generates NPCI-standard return XML for bounced cheques |

---

## 4. Batch Status State Machine (Complete)

The status transitions are driven by `UpdateBatchStatuso(batchID, status)`.

| DB Value | ComputedStatus Label | Set By | Next Action |
|---|---|---|---|
| `0` | `"RR Pending"` | Scanner MICR errors detected | Reject Repair → `LockBatch()` |
| `1` (partial entry) | `"Chq. Entry Pending"` | `LockBatch()` after scan/repair | Slip Entry → L1 entry |
| `2` + QCPending=`"1"` | `"OCR Mistmatch"` | L1 done, L2 needed | L2 Entry (`Frmqcamt`) |
| `2` + QCPending=`"2"` | `"QC Pending"` | L2 done, mismatch | L3 QC (`FrmqcAmtq`) |
| `2` + high-value | `"3 Level Max Amount/RBI"` | `sel_rbi_maxamt()` returns rows | L4 Override (`FRM_VALIDATE3`) |
| `2` + XML in progress | `"CHI In Progress"` | `USP_UPD_BatchXMLGenInProgress=True` | Wait for XML gen |
| `2` (cleared) | `"CHI Pending"` | Data entry complete, auth done | XML Generation |
| `3` | `"CHI XML Generated"` | XML+IMG generated, PGP encrypted | FTP Upload |
| `4` | `"RCMS Pending"` | FTP upload done, RCMS records pending | RCMS Entry |
| `5` | `"RCMS Completed"` | FTP upload done, no RCMS pending | SDEA Generation |
| `6` | `"Completed"` | SDEA files written | Done |

---

## 5. Key Settings Table

| Setting Key | Usage |
|---|---|
| `APPTYPE` | `"HUB"` or `"BRANCH"` |
| `ScannerCode` | `"CR120"`, `"CR135"`, `"CR190"` — endorsement API selector |
| `ScannerID` | Physical scanner station ID |
| `OutwardChqCount` | Max cheques per batch |
| `CLEARINGTYPE` | CTS clearing type code (e.g., `"01"`) |
| `RCMSFILEPATHNEW` | Local path for SDEA file output |
| `gstrExportOutwardFilePath` | Path for PGP files (FTP source) |
| `ExportOutwardBankFile` | Path for EOD Excel exports |
| `FBWMinHeight/MaxHeight/MinWidth/MaxWidth` | Front B/W image dimension bounds |
| `BBWMinHeight/MaxHeight/MinWidth/MaxWidth` | Back B/W image dimension bounds |
| `FGMinHeight/MaxHeight/MinWidth/MaxWidth` | Front Grayscale image dimension bounds |
| `CHIVersion` | App version — must match DB or login blocked |
| `SecurityOriginatorName` | Embedded in CHI XML `<MICRDS>` |
| `SecurityAuthenticatorName` | Embedded in CHI XML `<MICRDS>` |
| `TrancatingRTNo` | Truncating bank routing number |
| `gstrrcmpath` | Alternate SDEA export path used in `Generatesdea.vb` |

---

## 6. User Access Rights Matrix

Checked via `CheckUserMenuRights(userID, menuName, rightType)` or `NEWCheckUserMenuRights(userID, menuName, rightType)` where `rightType` = `"Access"`, `"Add"`, or `"Edit"`.

| Menu Right | Protects |
|---|---|
| `"Outward Batch Master"` Add | Batch creation, scan start |
| `"Outward Batch Master"` Edit | Batch lookup/edit mode |
| `"Batch Delete Rights"` Access | `USP_DEL_BatchMaster_new()` |
| `"Outward Slip Entry"` Add | Slip creation |
| `"Outward Slip Entry"` Edit | Slip editing |
| `"Reject Repair Scanned Documents"` | `frmRejectRepair` |
| `"Outward Cheque Entry"` Access | L2 entry, L4, FTP upload, RCMS routing |
| `"QC Pending"` Access | L3 QC routing |
| `"Outward Authorization"` | Checker/authorization |
| `"BULK XML/RCMS GENERATE"` Access | `Btn_RCMS` dashboard button |
| `"Outward Generate Bank File"` Access | `frmOut1gen` CHI generation form |

---

## 7. Complete File Inventory

### 7.1 Login & Navigation
| File | Role |
|---|---|
| `LoginPage.vb` | Version check, AES encrypt, SP validation, auto-patch |
| `CCTSMDI.vb` | MDI parent shell with ribbon navigation |
| `CCTSvb.vb` | Global variables and shared utility functions |
| `frmSelectPresentingBrach.vb` | Post-login branch selection |

### 7.2 Batch & Scanning
| File | Role |
|---|---|
| `frmStartBatchEntry.vb` | Central dashboard, SDEA writer, FTP uploader |
| `frmBatchMaster.vb` | Batch creation, export, delete |
| `frmScanCheque.vb` | Ranger API, IQA, image capture, endorsement |
| `frmDepositSlipEntry.vb` | Slip header entry before feeding |
| `frmScanNACH.vb` | NACH batch scanning variant |

### 7.3 Data Entry (Maker)
| File | Role |
|---|---|
| `frmSlipMaster.vb` | Slip entry (8-step validation) |
| `frmSlipMasternew.vb` | Alternate slip master for specific clients |
| `ChequeDetails.vb` | Individual cheque amount/drawer/bank entry |
| `frmAmtEntry.vb` | Level 1–4 dual-entry, SP_CLIENT_FLAG mode |
| `Frmqcamt.vb` | Level 2 OCR mismatch re-entry |
| `FrmqcAmtq.vb` | Level 3 QC supervisor entry |
| `FRM_VALIDATE3.vb` | Level 4 high-value RBI override |
| `frmchequeentry_autoslip.vb` | Auto-slip bulk cheque entry |

### 7.4 Validation & QC
| File | Role |
|---|---|
| `frmRejectRepair.vb` | Post-scan MICR/image repair (9 checks + dim validation) |
| `frmRejectRepairAuto.vb` | Automated bulk MICR correction variant |
| `FrmSlipMismatch.vb` | Reconcile slip totals vs cheque sums |
| `frmChequeAuthorization.vb` | Keyboard-driven checker (Y/R, PTF, bulk approve) |
| `frmTechnucalScrutiny.vb` | Visual scrutiny: stale/post-dated, signature check |
| `frmTechnicalReview.vb` | Supervisor technical review |

### 7.5 CHI File Generation
| File | Role |
|---|---|
| `NEWRptCreateXML.vb` | Main CHI XML + IMG binary generation |
| `frmOut1gen.vb` | CHI generation form (menu access) |
| `frmOutgen.vb` | Legacy CHI generation helper |
| `frmFFileGenerate.vb` | Outward clearing file packaging |

### 7.6 SDEA & RCMS
| File | Role |
|---|---|
| `Generatesdea.vb` | Standalone SDEA form (alternative to inline dashboard) |
| `FrmRcmsEntry.vb` | RCMS data entry (operator-locked) |
| `frmFTPUpload.vb` | Alternative FTP upload form |
| `frmFTPUploadBatchZip.vb` | Batch ZIP FTP upload |

### 7.7 Returns
| File | Role |
|---|---|
| `frmImportOutwardReturn.vb` | Generic return file import |
| `frmImportCTSReturn.vb` | CTS XML return file import |
| `frmImportDBF.vb` | Legacy `.dbf` return file import |
| `frmGenerateReturnXML.vb` | NPCI return XML generation |
| `frmProcessEOD.vb` | End-of-day reconciliation + NACH Excel export |

### 7.8 Master Data
| File | Role |
|---|---|
| `BankMaster.vb` / `BankSearch.vb` | Bank CRUD and search |
| `BranchDetails.vb` / `BranchSearch.vb` | Branch, IFSC, MICR codes |
| `frmUserMaster.vb` | User account management |
| `frmUserMenuRights.vb` | Per-user menu rights |
| `frmMngClient.vb` | Client config (incl. `IsDrawerCodeRequired`, `SP_CLIENT_FLAG`, `chkDrawer`) |
| `frmClientAdd.vb` / `frmImportClientMaster.vb` | Client registration |
| `frmClientPoints.vb` / `frmClientEnrichmentSettings.vb` | Pickup points, enrichment rules |
| `frmReturnReasonMaster.vb` | RBI/NPCI return reason codes |
| `frmHolidayManage.vb` | Clearing holiday calendar |
| `frmLocationMaster.vb` / `frmZoneMaster.vb` | Location and zone hierarchy |

### 7.9 NACH Module
| File | Role |
|---|---|
| `frmNACHBatchMaster.vb` | NACH batch management |
| `frmNACHReport.vb` | NACH reports |
| `frmNachEntry.vb` | NACH data entry |

### 7.10 Web Portal (CCTS_Web)
| File | Role |
|---|---|
| `Default.aspx` | Web login and session routing |
| `UserMaster.Master` | Master page layout |
| `authorizescheques.aspx` | Browser-based cheque authorization |

---

## 8. Deployment Checklist

1. Restore `NACH_Tables.sql`, `NACH_SP.sql`, `NACH_FUN.sql`, `NACH_Client.sql` onto SQL Server.
2. Open `CCTS.sln` in Visual Studio 2015+ (originally VS 2012).
3. Update `CCTS/app.config` (desktop) and `CCTS_Web/Web.config` (web portal) connection strings.
4. Set **CCTS** as startup project (or **CCTS_Web** for web portal only).
5. Install Silver Bullet Ranger scanner driver on scanning workstations.
6. Populate DB settings table: `APPTYPE`, `ScannerCode`, `ScannerID`, `CLEARINGTYPE`, `RCMSFILEPATHNEW`, `gstrExportOutwardFilePath`, all image dimension bounds, `CHIVersion`.
7. Create network shared folder. Set path in `gstrSharedPath`.

---

*This document was compiled by reading source code directly from: `LoginPage.vb`, `frmStartBatchEntry.vb` (2116 lines), `NEWRptCreateXML.vb` (1981 lines), `Generatesdea.vb` (550 lines), `ChequeDetails.vb` (2828 lines), `frmProcessEOD.vb` (388 lines), `frmMngClient.vb`, and all previously documented files.*
