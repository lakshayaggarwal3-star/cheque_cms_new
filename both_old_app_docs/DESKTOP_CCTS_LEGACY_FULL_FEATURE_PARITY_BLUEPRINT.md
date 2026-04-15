# CCTS Legacy Full Feature Parity Blueprint

This document is a migration-grade specification for rebuilding the old CCTS application in the new platform, with maximum feature parity.

It combines:
- The manager-provided flow in `SCB_CTS_Process_Flow_v1.0.pdf`
- The old documentation set in `both_old_app_docs/desktop`
- Source-level behavior from the legacy codebase at `C:\Users\laksh\Downloads\CCTS - scbftp.airan - CCC\CCTS - scbftp.airan - CCC`

---

## 0) Handoff Readiness (Read First)

If you give this document to another engineer or AI, they should understand:
- what the legacy application does end-to-end
- who performs each step
- what validations run at each stage
- what masters/settings drive decisions
- what files are generated/uploaded
- what DB/SP pathways are involved

### 0.1 What this document currently guarantees

- High-detail end-to-end process flow (scanner -> RR -> maker -> checker -> QC -> CHI -> upload -> RCMS -> SDEA -> returns)
- Frontend-to-backend-to-database traceability matrix
- Master validation mapping (which check depends on which master/table)
- Status/state lifecycle and routing logic
- Scanner behavior and file-generation behavior (source-verified per scanner model)
- NACH, portal, reports, returns, admin utility coverage
- Scanner model-specific endorsement text format (source-verified from `frmScanCheque.vb`)
- All admin/utility forms documented

### 0.2 What is still required for strict 100% completeness

To guarantee that absolutely nothing is missed before development sign-off:
- Export full production DB schema (all tables, columns, constraints, indexes)
- Export full production SP catalog (all params and side-effects)
- Add all SPs/tables to Appendix B with explicit mapping rows
- Mark each mapping as `Implemented` / `Deferred` / `Not Applicable`

Without this final extraction, this doc is implementation-ready but not mathematically exhaustive.

### 0.3 How to use this as the base for the new app

1. Read sections `2`, `5`, `7`, `22`, `23`, `26` in order.
2. Build backend services from section `24`.
3. Implement UI workflows using section `22` screen chains.
4. Validate each feature against section `26` matrix row-by-row.
5. Complete final production schema/SP extraction and append Appendix B.
6. Freeze this document version and use it as UAT parity checklist.

### 0.4 Definition of documentation done (for your project)

This blueprint is considered final only when:
- every screen/form has at least one trace row in Appendix
- every validation has mapped source (`master/table/SP`)
- every status transition has trigger condition + destination
- every output artifact (XML/IMG/SDEA/report) has generating rule
- every known SP/table is mapped to one business purpose
- no row remains `TBD-ProdDB` before build freeze

---

## 1) Scope and Goal

Build the new application so it preserves all legacy operational behavior:
- Same role flow: Scanning -> RR -> Maker -> Checker -> QC -> Supervisor -> Incharge/Admin flows
- Same validation rigor at every stage (batch, scan, MICR, slip, maker, checker, RCMS, SDEA/CHI)
- Same file outputs and naming rules (XML, IMG, SDEA A/C, PDF summaries, EOD exports)
- Same scanner-dependent behavior (endorsement, feed handling, IQA, image creation)
- Same master-data driven operations and status transitions

---

## 2) Master End-to-End Business Flow (Use This As Primary)

Use this flow as the top-level process model (from `SCB_CTS_Process_Flow_v1.0.pdf`):

1. User login and role resolution
2. Batch creation (with or without deposit slip)
3. Scanner capture (MICR + image + endorsement)
4. Reject Repair (all batches enter RR queue; only unread/error items require correction)
5. Maker stage:
   - Deposit slip capture
   - Cheque-level data entry
   - Amount/date/drawer handling
6. Checker stage:
   - Validate maker entry
   - Mismatch handling/escalation
7. QC stage:
   - Validate changed/exception values
8. File stage:
   - XML + IMG generation
   - PGP encryption
   - Secure FTP/SFTP upload
9. RCMS stage:
   - Drawer/enrichment validation
   - RCMS output generation
10. Reporting stage:
    - PDF/Excel/daily status
11. Return stage:
    - Return file import
    - Return status update
12. Admin utility stage:
    - Batch date/status/type/number changes
    - Portal and count operations

---

## 3) Role Model and Responsibility

### 3.1 Roles from manager flow
- Scanning
- Maker
- Checker
- QC
- Supervisor
- Incharge
- Admin

### 3.2 Effective rights matrix from legacy behavior
- `Outward Batch Master` (Add/Edit): batch creation/edit, scanning entry
- `Reject Repair Scanned Documents`: RR screen access
- `Outward Slip Entry` (Add/Edit): slip operations
- `Outward Cheque Entry`: maker/qc routing, FTP path, RCMS routing
- `QC Pending`: QC-level queue access
- `Outward Authorization`: checker actions
- `BULK XML/RCMS GENERATE`: generation trigger access
- `Batch Delete Rights`: destructive batch delete
- `Change Batch Status`: admin-only status override (right name from `frmchangebatchstatus.vb`)
- `Outward Generate Bank File`: CHI generation form access (`frmOut1gen`)

### 3.3 Segregation of duties
- Level 1 and Level 2 entry cannot be by same user (enforced via `FIBy`/`DEBy` fields — exact error: *"Level 1 - 2 entry must be done by two different users."*)
- If L2 already started by a different operator, current user is blocked: *"Level 2 Entry is already started by Other User."*
- RCMS operator lock: only one operator at a time per batch (enforced via `RCMSBY` field — error: *"RCMS Already in progress. You can not start this Batch."*)
- Checker rejects must include remarks (mandatory — blank = blocked)

### 3.4 Admin-only hardcoded username controls (from `frmStartBatchEntry.vb`)

These controls are currently hardcoded in the legacy source. New app must replace with role-based access:

| Control | Visible Only For |
|---|---|
| `Button2` (batch portal/count operation) | `shivam`, `ROSHNIPARMAR`, `admin`, `narendra parmar`, `SAFREEN SHAIKH`, `UTTAM VAISHYA`, `SMITESH RATHOD`, `UNNATI BAROT`, `ANIL SHINDE`, `SHIVAM SHAH` |
| `Label4`, `ComboBox1`, `Button3`, `Button4` (date/grid filters) | `shivam`, `admin`, `SHIVAM SHAH` |
| `Btn_RCMS` (XML/RCMS trigger) | `NEWCheckUserMenuRights("BULK XML/RCMS GENERATE", "Access")` (role-based, not hardcoded) |

---

## 4) Master Data Required (No Skips)

Implement these master domains first:
- Location Master (must include valid scanner station mapping — `ScannerID` not null/`"000"`)
- Client Master (`frmMngClient` — includes `IsDrawerCodeRequired`, `SP_CLIENT_FLAG`, `chkDrawer` config)
- Grid Master (`frmGridMaster`)
- Return Reason Master (`frmReturnReasonMaster`)
- Holiday Master (`frmHolidayManage`)
- Bank Master (`BankMaster.vb` — MICR sort code, RBI routing)
- Branch Master (`BranchDetails.vb` — IFSC, MICR)
- User Master (`frmUserMaster.vb`)
- User Menu Rights (`frmUserMenuRights.vb`)
- Client Pickup Points (`frmClientPoints.vb`)
- Client Enrichment Rules (`frmClientEnrichmentSettings.vb`)
- Zone Master (`frmZoneMaster.vb`)
- NACH Client Master (`frmNACHClient.vb`)
- NACH Rejection Reason (`frmNACHRejectionReason.vb`)
- Return Master (`frmReturnMaster.vb`)
- Blocked MICR list (`FrmBlock_micr.vb`)

Critical master dependencies:
- Batch creation blocked if location has invalid scanner mapping (`ScannerID` missing or `"000"`)
- MICR bank validation depends on bank master (`MICR.Substring(3,3)`)
- Return flows depend on return reason catalog
- Transaction codes validated against `TransactionCodeMaster`

---

## 5) Batch Lifecycle and State Machine

Canonical state progression for parity (DB numeric value → computed label → conditions):

| DB Value | Computed Status Label | Trigger Condition | Next Action |
|---|---|---|---|
| `0` | `"RR Pending"` | MICR/image errors on scan detected | Reject Repair → `LockBatch()` |
| `1` (partial entry) | `"Chq. Entry Pending"` | `BatchStatus=1 AND TotalCheques > TotalChqEntryDone` | Slip Entry → L1 entry |
| `2` + `QCPending="1"` | `"OCR Mistmatch"` *(typo is in code, preserve it)* | L1 done, L2 needed OR `QCPending="1"` | L2 Entry (`Frmqcamt`, level=2) |
| `2` + `QCPending="2"` | `"QC Pending"` | `QCPending="2"` | L3 QC (`FrmqcAmtq`, level=3) |
| `2` + high-value | `"3 Level Max Amount/RBI"` | `sel_rbi_maxamt() > 0` | L4 Override (`FRM_VALIDATE3`, level=4) |
| `2` + XML running | `"CHI In Progress"` | `IsXMLGenInProgess = True` | Wait for generation to complete |
| `2` (clean) | `"CHI Pending"` | Data entry complete, auth done, no high-value | XML Generation (via `Btn_RCMS`) |
| `3` | `"CHI XML Generated"` | XML+IMG files generated, PGP encrypted | FTP Upload |
| `4` | `"RCMS Pending"` | FTP upload done, RCMS records pending | RCMS Entry |
| `5` | `"RCMS Completed"` | FTP upload done, no RCMS pending; OR RCMS entry done | SDEA Generation |
| `6` | `"Completed"` | SDEA files written, batch finalized | Done |

Status labels are **computed per row** from `BatchStatus` + `QCPending` + `TotalCheques` vs `TotalChqEntryDone` fields in `btnGet_Click` (lines 1098–1145 of `frmStartBatchEntry.vb`).

Business requirement: every transition must be auditable with user/time/reason.

---

## 6) Scanner Support and Hardware Behavior

### 6.1 How the scanner connects to the application (the driver layer)

**All scanners in CCTS — Canon CR-50, CR-120, CR-135, CR-150, CR-190 — connect through the same single driver: the Silver Bullet Ranger API.** This is not a direct USB/Canon driver. It is a middleware layer that sits between the application and the physical scanner hardware.

**What this means in practice:**

```text
Physical Scanner (Canon CR-120 / CR-135 / CR-190 etc.)
        ↓  (USB cable to PC)
Silver Bullet Ranger Driver  ← installed on the scanning workstation PC
        ↓  (COM/ActiveX)
AxInterop.RANGERLib.dll      ← .NET wrapper (COM interop)
        ↓  (ActiveX control embedded in WinForms form)
AxRanger1  (ActiveX control on frmScanCheque)
        ↓
Application code (frmScanCheque.vb)
```

**The application does not call Canon APIs directly.** It calls `AxRanger1.StartUp()`, `AxRanger1.GetMicrText()`, `AxRanger1.SaveImageToFile()` etc. — all of which are Ranger API methods. The Ranger driver handles the hardware communication.

**`ScannerCode` setting tells the application which endorsement behavior to use.** The Ranger API works the same way for all models; only endorsement printing differs per model code.

---

### 6.2 What must be installed on the scanning workstation

For any scanner to work with this application, **the following must be installed on the Windows PC connected to the scanner:**

1. **Silver Bullet Ranger scanner driver** — installs the COM/OCX component (`RANGERLib`) that `AxRanger1` wraps. Without this, `AxRanger1.StartUp()` throws an exception and scanning cannot begin.
2. **`AxInterop.RANGERLib.dll`** — the .NET interop wrapper. This is in the application's `bin\Debug\` folder (referenced in `CCTS.vbproj` as `HintPath: ..\..\...\bin\Debug\AxInterop.RANGERLib.dll`). It ships with the application, not the scanner.
3. **USB driver for the specific Canon scanner model** — installed by the scanner's own setup; allows the OS to recognize the device. Ranger then talks to it through this OS driver.
4. The scanning workstation must be **Windows** (the Ranger API is a Windows ActiveX COM component — it cannot run on Linux/Mac).

**There is no license key or dongle required by the application itself.** The application has an internal expiry check (`CheckExpiry()` function reads encrypted DB settings `IsExpired` and `ExpiryDate`) but this is a subscription/deployment gate, not a hardware key. The Ranger driver itself may have its own licensing from Silver Bullet Technology — that is a separate concern from the application code.

---

### 6.3 Scanner models (source-verified from `frmScanCheque.vb`)

All scanners use the **Silver Bullet Ranger ActiveX API** (`AxRanger1`). The `ScannerCode` setting value tells the application which endorsement path to use.

| Scanner Code | Canon Model | Connection | Endorsement Behavior | Special Notes |
|---|---|---|---|---|
| `CR120` | Canon CR-120 | USB → Ranger driver | CSN-based text via `TransportReadyToSetEndorsement` + `GetBatchEndorsementText_NEWN()` | Most common model in codebase |
| `CR50` | Canon CR-50 | USB → Ranger driver | **Same path as CR120** — shares `CR120 Or CR50` branch in `TransportReadyToSetEndorsement` | Older model, same logic |
| `CR135` | Canon CR-135 | USB → Ranger driver | OEM batch mode via `TransportReadyToSetEndorsement` (CR135 Or CR150 branch); **NO endorsement** in `TransportSetItemOutput` event | Different endorsement event used |
| `CR150` | Canon CR-150 | USB → Ranger driver | **Same path as CR135** — shares `CR135 Or CR150` branch | Same endorsement logic as CR135 |
| `CR190` | Canon CR-190 | USB → Ranger driver | DB-derived text via `GetBatchEndorsementText_NEW()` in `TransportSetItemOutput`; CR190-specific branch in `TransportItemInPocket` for DB write | Different SP path from CR120 |
| TS 240 | TS 240 | USB → Ranger driver (assumed) | Not found as an explicit code branch — maps to an existing Ranger model profile | Manager flow doc mention only |

**Key insight:** The application uses one `ScannerCode` setting per workstation. Changing `ScannerCode` in the DB settings table changes which endorsement code path runs — no code change needed to switch scanner models.

---

### 6.5 Scanner API: Ranger Transport States

| Value | State Name |
|---|---|
| `0` | `ShutDown` |
| `1` | `StartingUp` |
| `2` | `ChangeOptions` |
| `3` | `EnablingOptions` |
| `4` | `ReadyToFeed` |
| `5` | `Feeding` |
| `6` | `ExceptionInProgress` |
| `7` | `ShuttingDown` |

**Form-close protection:** `Form1_FormClosing` cancels close if `GetTransportState() <> TransportShutDown` — operator cannot exit while scanner is running.

### 6.6 Scanner startup sequence (from `frmScanCheque.vb`)

1. `AxRanger1.StartUp()` → state: `TransportStartingUp`
2. `TransportChangeOptionsState` event fires:
   - IQA disabled: `SetGenericOption("OptionalDevices", "NeedIQA", "False")`
   - IQA upstream disabled: `SetGenericOption("OptionalDevices", "NeedIQAUpstream", "False")`
3. `AxRanger1.EnableOptions()` → state: `TransportReadyToFeed`
4. Start Feeding button enabled
5. Feed: `AxRanger1.StartFeeding(FEEDSOURCEMAINHOPPER, FEEDCONTINUOUSLY)`

### 6.7 Endorsement behavior by scanner code (source-verified)

**Settings that control endorsement:**
- `EnableEndorse` (DB setting) → loaded into `gintEnableEndorse` — integer 0/1
- `EndorseLine` (DB setting) → loaded into `gintEndorseLine` — line position 1–3
- `ScannerCode` (DB setting) → read at runtime via `GetSettings("ScannerCode")`
- `ScannerID` (DB setting) → physical station ID
- `TrancatingRTNo` (DB setting) → truncating bank routing number — embedded in endorsement text for CR120/CR50

**Event: `TransportSetItemOutput` (endorsement printing during feed)**

```
IF strScannerCode <> "CR135" THEN
    IF gintEnableEndorse = 1 THEN
        intLineno = gintEndorseLine  (must be 1, 2, or 3)
        IF strScannerCode = "CR120" THEN
            strEndorseText = GetBatchEndorsementText_NEWN(batchID, scannerID, IntEndorsCounter)
        ELSE  (CR190 and others)
            strEndorseText = GetBatchEndorsementText_NEW(batchID, scannerID, IntEndorsCounter)
        END IF
        mstrEndorseText = strEndorseText(0).ENDORMENTTEXT1
        AxRanger1.SetFixedEndorseText(1, intLineno, mstrEndorseText)
    END IF
ELSE  (CR135 — NO endorsement via this event)
    [block skipped entirely]
END IF
```

**Event: `TransportReadyToSetEndorsement` (second endorsement path)**

```
IF strScannerCode = "CR120" OR strScannerCode = "CR50" THEN
    [CSN-based endorsement format]
    IF IntEndorsCounter = 0 THEN intCSN = 1 ELSE intCSN = IntEndorsCounter + 1
    mstrEndorseText = Date.Now.ToString("ddMMyyyy") & " " 
                    & Val(BatchNo).ToString("00000") & " "
                    & "<CSN:" & intCSN.ToString("0000") & ">" & " "
                    & GetSettings("TrancatingRTNo") & " "
                    & "SCBL0036001"
    AxRanger1.SetFixedEndorseText(1, intLineno, mstrEndorseText)

ELSE IF strScannerCode = "CR135" OR strScannerCode = "CR150" THEN
    VEndorseDate = Now.ToString("ddMMyyyy")
    VEndorsment_Line_No = GetSettings("EndorseLine")
    
    SELECT CASE endorseMode
        CASE EndorseModeOEM_Batch (=1):
            endorseText = VEndorseDate & " " & StrBatchNo.Substring(10) & " "
                        & IntEndorsCounter.ToString.PadLeft(3,"0") & " "
                        & "400036000 SCBL0036001"
            (if DB has text: endorseText = dr.ENDORMENTTEXT1 & " <CSN:" & IntEndorsCounter.ToString("0000") & ">")
            AxRanger1.SetFixedEndorseText(e.sideNumber, 1, endorseText & " <CSN:" & mendorseintSeqNo & ",1>")
            
        CASE EndorseModeCurrentItem (=2):
            endorseText = VEndorseDate & " " & StrBatchNo.Substring(10) & " "
                        & IntEndorsCounter.ToString.PadLeft(3,"0") & " "
                        & "400036000 SCBL0036001"
END SELECT
END IF
```

**Endorsement mode enum (`RangerEndorseMode`):**
- `EndorseModeOEM_Batch = 1`
- `EndorseModeCurrentItem = 2`
- `EndorseModeNextItem = 3`

**Key observation:** CR120/CR50 use CSN-based fixed text with `TrancatingRTNo` setting. CR135/CR150 use OEM batch mode with a different text format. CR190 uses the DB-derived endorsement text path (`GetBatchEndorsementText_NEW`).

### 6.8 IQA support (14 tests; 9 active, 5 disabled in code)

Run when `gIQATest = True` via `DoIQATesting()`:

| Test ID | Test Name | Status |
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

IQA failure → `mblnIQAPassed = False` → item added to `lstIQFailedCheques` → available for rescan via "Rescan IQA Failed" button.

### 6.9 Image capture per cheque (from `TransportItemInPocket` event)

**Scan limit gate:** If `intTotalChqScans = intTotalAllowedScans` (from `OutwardChqCount` setting) → `Exit Sub` (stop saving silently).

Three images retrieved from Ranger memory and saved:

| Image | Ranger Call | Filename Pattern | Format |
|---|---|---|---|
| Front B/W | `GetImageAddress(Front, Bitonal)` | `{yyyyMMdd}{BatchNo}_Front_{SeqNo}.tif` | CCITT4 compressed TIFF |
| Back B/W | `GetImageAddress(Rear, Bitonal)` | `{yyyyMMdd}{BatchNo}_Back_{SeqNo}.tif` | CCITT4 compressed TIFF |
| Front Grayscale | `GetImageAddress(Front, Grayscale)` | `{yyyyMMdd}{BatchNo}_FrontG_{SeqNo}.jpg` | JPEG |

Path: `gstrSharedPathnew\{BatchNo}\{filename}`

DB write: `CreateNewBatchDetails(lngBatchDID, lngBatchID, MICRText, 0, ImgFileName1, ImgFileName2, ImgFileName3, 1, UserID, intStatus, "", SeqNo, EndorseText)`

**Note on variable naming:** `ImgFileName1` = Front BW, `ImgFileName2` = Front Gray, `ImgFileName3` = Back BW (as named in DB). But in IMG binary file generation, the order written is: Front BW (`img1=ChqImgName1`) → Front Gray (`img2=ChqImgName3`) → Back BW (`img3=ChqImgName2`) — this index swap is intentional.

### 6.10 NACH scanning variant (`frmScanNACH.vb`)

Same Ranger API and scanner model support as outward scanning. CR120/CR50 endorsement path also used for NACH (confirmed from `frmScanNACH.vb` line 1469).

### 6.11 Settings keys required for scanner (source-verified from `CCTSvb.vb`)

All keys are read from the `Settings` DB table via `GetSettings(key)` at session load time.

| Setting Key | Global Variable | Purpose |
|---|---|---|
| `ScannerCode` | *(read at scan time)* | Scanner model selector: `"CR120"`, `"CR50"`, `"CR135"`, `"CR150"`, `"CR190"` — determines endorsement code path |
| `ScannerID` | *(read at scan time)* | Physical station ID string — must not be `"000"` or blank (blocks batch creation); embedded in endorsement text for CR135/CR150 |
| `EnableEndorse` | `gintEnableEndorse` | `1` = endorsement printing on, `0` = off; checked before every endorsement print call |
| `EndorseLine` | `gintEndorseLine` | Endorsement print line position (1, 2, or 3) on the cheque back |
| `OutwardChqCount` | *(read at scan time)* | Max cheques per batch — scanning stops silently when this count is reached |
| `TrancatingRTNo` | `gStrTrancatingRTNo` | Truncating bank routing number — embedded in CR120/CR50 endorsement text; also used in CHI XML generation |
| `IQATest` | `gIQATest` | `"Yes"` = IQA tests run per item; anything else = IQA skipped entirely |
| `SharePath` | `gstrSharedPath` | Base network path for batch image folders (e.g. `Z:\scbdata\`) |
| `SHAREPATHNEW1` | *(in MapDriveToUNC)* | UNC equivalent of `Z:\` drive (e.g. `\\192.168.1.235\scbdata\`) — images saved via UNC path |
| `SHAREPATHNEW2` | *(in MapDriveToUNCnew1)* | UNC for reports share (e.g. `\\192.168.1.235\SCB-Reports`) |
| `SHAREPATHNEW3` | *(in MapDriveToUNCNEW)* | UNC for uploads share (e.g. `\\192.168.1.235\uploads\`) |
| `NACHSharePath` | `gstrNACHSharedPath` | Shared path for NACH batch image files |
| `ExportOutwardFilePath` | `gstrExportOutwardFilePath` | Path for PGP files; converted to UNC via `MapDriveToUNC()` |

**Network path note (source-verified):** Images are **always saved using UNC paths** (`\\server\share\...`), not local drive letters. `MapDriveToUNC()` converts `Z:\` → `SHAREPATHNEW1` setting value. This means the scanning workstation must have the network share accessible and the `SHAREPATHNEW1` setting must hold the correct UNC root. `SaveImageToFile()` is called with the UNC path so the file lands directly on the shared network drive — not the local disk.

---

## 7) Full Validation Matrix (Must Implement)

### 7.1 Login validation
- Version gate: `CHIVersion` setting vs compiled constant — hard block on mismatch: *"Application Version Not Matched. Please get Latest Application Version from Server."*
- Credential AES encryption before DB comparison (key: `"QuickCTS"`)
- 5-attempt lockout behavior (remaining shown: `"5 - FailedAttempts"`)
- Password expiry (90 days) — forced redirect to `frmchangepassword`
- Password reset required — forced redirect to `frmchangepassword`
- Account inactive — hard block
- Account locked — hard block
- Silent auto-patch on success: `.sql` files in `\SQL\` folder executed then deleted; `.rpt` files in `\NewReports\` copied to `\Reports\`

### 7.2 Batch creation validation (8-field chain in order)
1. Clearing type selected (CTS = `CLEARINGTYPE` setting e.g. `"01"`; Non-CTS = `"11"`)
2. Pickup Location not blank
3. Summary Ref No (SummRefNo) not blank
4. PIF not blank
5. **SummRefNo must equal PIF** — error: *"Summary Ref No and PIF must be same."*
6. Total Slips > 0
7. Total Amount > 0 (disabled/derived in BRANCH mode)
8. Location lookup: `USP_SEL_CMS_Location()` — not found → *"Pickup Location Not Found."*; found but `ScannerID = "000"` or blank → *"ScannerId not found for Location."*

### 7.3 Reject Repair validation

**9-check auto-validation per item:**

| # | Check | Rule |
|---|---|---|
| 1 | ChequeNo numeric | Non-numeric → flag |
| 2 | ChequeNo length | Must = 6 digits |
| 3 | MICR numeric | Non-numeric → flag |
| 4 | MICR length | Must = 9 digits |
| 5 | MICR bank code lookup | `MICR.Substring(3,3)` via `CheckBankIsAvailable1()` — 0 = not participating → flag |
| 6 | MICR block list | `GetBlockMicr()` — if on blocked list → flag and clear MICR |
| 7 | MICR translation (CHM) | `GetTransactionRule(MICR) <> 0` → needs canonical translation → flag |
| 8 | TransCode (Account Type) | Numeric, exactly 2 digits, in `ValidateTransactionCode()` approved list |
| 9 | Account Number | If present: numeric and exactly 6 digits |

**Save validation (4 checks):**
1. MICR = exactly 9 chars
2. `MICR.Substring(3,3)` in bank master
3. ChequeNo = 6 digits and not `"000000"`
4. `ValidateImageSize()` — all 3 images validated against 6 DB settings:
   - Front B/W: `FBWMinHeight`, `FBWMaxHeight`, `FBWMinWidth`, `FBWMaxWidth`
   - Back B/W: `BBWMinHeight`, `BBWMaxHeight`, `BBWMinWidth`, `BBWMaxWidth`
   - Front Gray: `FGMinHeight`, `FGMaxHeight`, `FGMinWidth`, `FGMaxWidth`

**Image viewer:** 3 modes (Front B/W bitonal TIFF, Front Grayscale JPEG, Back B/W bitonal TIFF). Live pixel dimensions shown in `lblWidth`/`lblHeight`.

**Lock batch:** After all repairs → `LockBatch(mlngBatchID)` → batch advances to "Chq. Entry Pending".

### 7.4 Slip entry validation (8-step chain in order)
1. Pickup Point selected AND exists in `USP_SEL_ClientPickupPoints` for client, matching `Mid(LocationCode, 1, 5)` AND `LocCode`
2. Slip No not blank
3. Account No not blank (numeric-only keypress filter)
4. Branch selected
5. Amount not blank AND > 0
6. Account No must equal Account No confirm field (dual-entry)
7. Duplicate slip check via `GetSlipDetails(batchID, slipNo)` → *"Slip no Is already generated for this batch."*
8. `CalculateBatchCheques()`: `intscannedcheques` = count of BatchDetails where `Status >= 1`. If `intscannedcheques < txtTotalChqs` → *"Total Cheques should Not exceed scanned cheques."*

**Auto slip number:** `GetAutoSlipNumber(mlngBatchID)` → `LastSlipNo + 1`. Defaults to `101` if no slips yet.

**Batch lock prerequisite:** `IsBatchLocked(BatchNo)` checked first — if false → *"Batch is not locked. First Lock the batch."*

**Post-save:** `ManageSlipsWithSoftSlip(...)` saves slip; then `ChequeDetails` form opens automatically (`Tag="Add"`, `mstrEntryType="Single"`).

**Client field:** `USP_SEL_ClientMaster_NEW("", STRBATCHLOATION)` drives client autocomplete. `txtCMSACNO` auto-fills from `GetSettings("CMSACNO")`.

### 7.5 Maker/QC validation (11-step chain)

**Queue building per level:**
- L2: Only items where `ChqAmount_1 = 0`
- L3+: Items where `ChqAmount_1 = 0` OR `AuthStatus <> 1` OR mismatches (`Amount1<>Amount2`, `ChqNo<>ChqNo1`, `MICR1<>Micr11`)
- If L3+ queue empty → auto: `USP_UPD_BatchStatus(batchID, "2", mCLEARINGTYPE)`

**11-step save validation:**
1. ChequeNo not blank
2. MICR not blank
3. TransCode not blank
4. MICR length = 9
5. TransCode length = 2
6. ChequeNo is numeric
7. MICR is numeric
8. Amount ≠ OCR amount → YES/NO dialog: No = clear and re-enter; Yes = accept override
9. Amount > 0
10. TransCode in `ValidateTransactionCode()` valid list
11. L1/L2 same-user check → block if conflict

**SP_CLIENT_FLAG corporate mode:** Both L1 and L2 values shown side-by-side. Mismatches highlighted **RED** and editable. Matches disabled (operator cannot re-type correct data).

**Drawer validation:**
- Client config (`IsDrawerCodeRequired` in `frmMngClient.vb`) controls if drawer name is mandatory
- Minimum length: `If txtDrawerName.Text.Trim().Length < 2 Then` → blocked
- At SDEA generation: `Microsoft.VisualBasic.Left(DrawerName, 40)` — hard 40-char cap

**Technical rejection:**
- Operator selects reason from `cboReason` → confirm: *"ARE YOU SURE TO REJECT THIS CHEQUE FROM CHI UPLOAD?"*
- Yes: `USP_UPD_TechnicalReturn(mlngChequeID, True, reasonText)` → cheque permanently excluded from CHI

**SP called:** `CCTS.USP_UPD_AmtEntry_new(chequeID, amount, userID, entryLevel, ChequeNo, MICR, MICR1, AcType, SP_CLIENT_FLAG)`

### 7.6 Checker validation
- Approve: **Y** key → `grp_approve` panel; `btnApprove` focused; PTF flag option
- Reject: **R** key → `grp_reject` panel; `txtRejectRemarks` focused; empty = blocked (cannot save)
- `AuthenticateCheque(chequeID, userID, status, remarks, isPTF)`:
  - Approve → `AuthStatus = 1`
  - Reject → `AuthStatus = 2`
- Grid auto-advances to next row after each action
- Running totals: `Total Authorized (X)` and `Total Rejected (Y)`
- PTF tagging: `IsPTF = 1` → `DocType = "C"` in CHI XML (regular = `"B"`)
- **Hidden bulk approve:** `Ctrl+Shift+F10` → password panel. Password: `"ACPL123"` → `btnApproveAll` revealed → loops all rows calling `AuthenticateCheque(status=1)`

### 7.7 File generation validation

**CHI pre-flight checks (in order):**
1. Blank slip guard: `If dtchq.Count() = 0 Then MsgBox("BLANK DEPOSIT SLIP - Please first Remove Blank Slip & Regenerate RCMS")`
2. All cheques authorized: `If dr.AuthStatus <> 1 Then MsgBox("Authorisation is pending. Please complete Batch First.")`
3. Concurrency lock: `If IsXMLGenInProgress = True Then MsgBox("XML Generation in progress")` → `CCTS.USP_UPD_BatchXMLGenInProgress(batchID, True)` (locks batch for concurrent users)
4. Cheques with `Mid(MICR1, 4, 3) = "036"` (SCB Transfer) are **skipped** from XML entirely

**FTP pre-flight:**
- Scan `gstrExportOutwardFilePath\{GRID}\{BatchNo}\` for `*.pgp` files — must be exactly 2
- One must contain `.XML` in name, one must contain `.IMG` in name
- If count ≠ 2 → *"PGP Not available."* → halt

**SDEA pre-flight:**
- `CCTS.GetBatchReportStatus(lngBatchID, r)` — if `r = False` → *"First generating the banking file."*
- Blank slip guard also runs in SDEA: `If dtchq.count() = 0 Then MessageBox.Show("BLANK DEPOSIT SLIP...")`
- Part C trailer guard: `If totDepo > 0 And totAmount > 0 Then` write trailer, else warn

---

## 8) File and Integration Specifications

### 8.1 CHI XML structure (per `NEWRptCreateXML.vb` — 1981 lines)

**XML filename convention:**
- Short ScannerID (≤3 chars): `CXF_{PresentBankRoutNo}_{ddMMyyyy}_{HHmmss}_{ClearingType}_{CycleNo(10 digits)}.XML`
- Long ScannerID (6 chars): FileID = `{ScannerID}{CycleNo padded to 6}` — same naming otherwise
- IMG file: `CIBF_{PresentBankRoutNo}_{ddMMyyyy}_{HHmmss}_{ClearingType}_{CycleNo}_01.IMG`
- Export path: `gstrExportOutwardFilePath/{GRID}/{BatchNo}/`

**XML structure:**
```xml
<FileHeader>
  namespace: urn:schemas-ncr-com:ECPIX:CXF:FileStructure:010001
  VersionNumber: 010001
  TestFileIndicator: P
  <Item>
    ItemSeqNo
    PayorBankRoutNo
    Amount (× 100, in paise)
    AccountNo
    SerialNo
    TransCode
    PresentingBankRoutNo
    PresentmentDate
    CycleNo
    NumOfImageViews: 3
    ClearingType
    DocType: B=regular, C=PTF
    MICRRepairFlags: 000011
    <AddendA>
      BOFDRoutNo
      IFSC code
      DepositorAcct (if exists)
    </AddendA>
    <MICRDS>
      RSA-SHA256 digital signature
      SecurityKeySize: 2048
      MICRFingerPrint: "SerialNo;PayorBankRoutNo;TransCode;Amount"
      SecurityOriginatorName: from Settings
      SecurityAuthenticatorName: from Settings
    </MICRDS>
    <ImageViewDetail> × 3:
      View 1: Front BW (TIFF/G4)
      View 2: Back BW (TIFF/G4)
      View 3: Front Gray (JFIF/JPEG)
      Each has: <ImageViewData>, <ImageDS>, <ImageViewAnalysis>
    </ImageViewDetail>
  </Item>
  <FileSummary>
    TotalItemCount
    TotalAmount (× 100)
  </FileSummary>
</FileHeader>
```

**SCB Transfer rule:** Cheques where `Mid(MICR1, 4, 3) = "036"` → **skipped from XML entirely** (only go in SDEA).

**ItemSeqNo logic:**
- Looked up via `GetItemSeqDetails("", StrDate, "", lngBatchID, "")`.
- If not found → `{yyyyMMdd}000001`
- If found → `Val(max_ISNo) + 1` formatted as 6 digits

**CycleNo logic:**
- `GetCycleDetails("", StrDate)` count + 1
- Short ScannerID: formatted as `"0000"` (4 digits)
- Long ScannerID: formatted as `"000"` (3 digits)

### 8.2 IMG binary file structure

Per cheque, appended to file:
1. 256-byte random padding array
2. Front BW bytes (`img1 = ChqImgName1`)
3. 256-byte random padding array
4. Front Gray bytes (`img2 = ChqImgName3`) ← note: variable index 3 = Front Gray
5. 256-byte random padding array
6. Back BW bytes (`img3 = ChqImgName2`) ← note: variable index 2 = Back BW

File open mode: `FileMode.Append` or `FileMode.Create`.

### 8.3 PGP and FTP transmission

**FTP credentials (hardcoded in legacy — must move to secret store):**
```
gstrFTPUserName = "AIRANFTP"
gstrFTPPassword = "Airan@123"
gstrFTPURL      = "ftp://scbftp.airanlimited.com/quickcts/chi%20upload"
```

**Upload sequence:**
1. `CreateFTPFolder(yyyyMMdd)` — date folder on FTP
2. `CreateFTPFolder(yyyyMMdd/BatchNo)` — batch subfolder
3. HTTP register: `https://scbftp.airanlimited.com/addbatch.aspx?b={BatchNo}&bd={Date}&bx={XMLFile}&bi={IMGFile}&loc={Location}&bid={BankID}&grid={Grid}`
4. `FireURL(strURL)` — `HttpWebRequest`, timeout=300000ms — must return `"Success"` — else upload aborted
5. `UploadFile(txtXML, ftpXMLPath, user, pass)` — `FtpWebRequest`, 2KB buffer, Binary, KeepAlive=False, Timeout=Integer.MaxValue, Proxy=Nothing
6. `UploadFile(txtIMG, ftpIMGPath, user, pass)` — same parameters
7. `sel_pending_CHEQUEENTRY_RCMS(lngBatchID, 0)`:
   - Count = 0 → `UpdateBatchStatuso(lngBatchID, 5)` (Finalized) → `RCOM = True` → Exit
   - Count > 0 → `UpdateBatchStatuso(lngBatchID, 4)` (RCMS Pending)
8. `Directory.Move(InitialDirectory, dInitialDirectory)` → archive to `\done\{GRID}\{BatchNo}\`

### 8.4 SDEA output (SDEA Part A and Part C)

**Entry points:** inline in `frmStartBatchEntry.vb` (triggered by "RCMS Completed" batch click) and standalone `Generatesdea.vb`.

**Part A — Standard client deposits:**
- SP sequence: `USP_RPT_SDEA_HEADER_File(batchID)` → `USP_RPT_SDEA_Deposit_File_NEW0(batchID)` → `USP_RPT_SDEA_CHEQUE_File(batchID)`
- Path: `RCMSFILEPATHNEW\{yyyy}\{yyyy-MM-dd}\{PickupLocation}\`
- Filename: `{ddMMyy}_LC_{PickupLocation}_{PIF}_A.{BatchNo:00000}`

**Part C — Rep-location deposits:**
- Generated only if `RPTSDEA_Deposit_File_NEW1(batchID)` returns rows
- SP sequence: `USP_RPT_SDEA_HEADER_FileA` (header uses `RepLocName` instead of `PICKUPLOCATION`) + same CHEQUE SP
- Filename: `{ddMMyy}_LC_{PickupLocation}_{PIF}_C.{BatchNo:00000}`

**Record layout — each line exactly 200 chars, padded with spaces:**

```
# RCMSG_SDEATXN{pad to 20 chars}SDEA Transaction Upload to RCMS{pad to 50}{pad 129}
H {ddMMyy}A{BatchNo(5)}{pad12} CHE{pad10} {ddMMyyyy}{PIF(10)}  {SourceOfUpload(10)}{PICKUPLOCATION(10)}{ProductCode(10)}{PDCFlag}{pad126}
D {CustCode(10)}{PickupPoint(10)}{CustRefNo(18)}{DepositSlipNo(10)}{ddMMyyyy}{TotalChqs(5)}{SlipAmount*100(15)}{ProductCode(10)}{PickupLocation(10)}{DepositSlipNo(103)}
C {ChequeNo(10)}{BankCode(10)}{BranchCode(10)}{ChqAmount*100(12)}{ddMMyyyy}{DrawerName<=40(40)}{PickupLocation(10)}{Remarks(71)}{ISNo(20)}{pad8}
T {totDeposits:00000}{totalAmount*100 padLeft 15}{pad179}
```

**Special rules in SDEA:**
- All amounts: `Val(amount) * 100` with `.Replace(".000","")` — paise, no decimal
- DrawerName: `Microsoft.VisualBasic.Left(DrawerName, 40)` — hard 40-char cap
- ISNo rule: `If Mid(drC.MICR1.ToString(), 4, 3) = "036" Then _ISNo = "SCB TRANSFER"` else normal ISNo
- Part C trailer guard: if `totDepo = 0` or `totAmount = 0` → warning message, no trailer written

**After each file written:**
- `UpdateBatchStatuso(lngBatchID, 6)` — status to Completed
- `btnSlipSummaryPDF_Click()` auto-runs → Crystal Report PDF export

### 8.5 Auto Slip Summary PDFs

Report: `\Reports\CTSBatchWiseSummary.rpt` (Crystal Reports)
- PDF 1 (Part A slips, param 6=0): `{ddMMyyyy}_{BatchNo}_SLIP_SUMMARY_{LocationName}1.pdf`
- PDF 2 (Part C slips, param 6=1): `{ddMMyyyy}_{BatchNo}_SLIP_SUMMARY_{LocationName}2.pdf`
Written to: `RCMSFILEPATHNEW\{yyyy}\{yyyy-MM-dd}\{LocationName}\`

### 8.6 EOD Excel exports (`frmProcessEOD.vb`)

- Loads via `USP_SEL_ProcessEOD(yyyyMMdd, GRID)`
- Grid columns: Grid, Location, BatchAmount (CTSAmount), TotalCheques (CTSChq), RetChqCount, RetChqAmount, UserName
- Export button → `DatatableToExcel()` → saved to `ExportOutwardBankFile` setting path
- Filename: `{yyyyMMdd}_{GRID}_{yyyy-MMM-dd}_{Location}.xlsx`

**NACH Excel export (`btnGenNachExcel`):**
- SP: `USP_SEL_NACH_Entry(batchID, 0)` → 22-column Excel
- Columns include: UtilityCode, IFSC, Amount, Frequency, and 18 others
- Also copies `ImgFileName1` (renamed to `_T.tiff`) and `ImgFileName2` (renamed to `_J.jpg`)
- Filename: `F_{UtilityCode}_1_{ddMMyyyy}_{ScannerID}.xlsx`

### 8.7 Return file processing

| Form | Format handled |
|---|---|
| `frmImportOutwardReturn.vb` | Generic clearing house return files |
| `frmImportCTSReturn.vb` | CTS XML return files |
| `frmImportDBF.vb` | Legacy `.dbf` format CBS return files (via `SocialExplorer.FastDBF`) |
| `frmGenerateReturnXML.vb` | NPCI-standard return XML for bounced cheques |
| `frmImportBankXML.vb` | Bank XML import |
| `frmImportE4File.vb` | E4 file import |
| `frmOutwardReturnFile.vb` | Outward return file generation |
| `frmOutwardReturnReprocess.vb` | Reprocess return items |

### 8.8 Batch export (Branch → Hub transfer)

Three pipe-delimited text files → ZIP (Ionic.Zip) → AES-encrypt (Rijndael, key `"QuickCTS"`) → saved to `gstrEncryptFilePath`:
- `BatchMaster.txt`: `BatchID|BatchNo|BatchDate|BatchAmount|TotalSlips|TotalChqs|BatchStatus|ClearingType|...|PickupLocation|SummRefNo|PIF`
- `BatchDetails.txt`: `BDID|BatchID|MICRText|NoOfChqs|ImgFileName1|ImgFileName2|ImgFileName3|Status|Reason|ItemSeqNo|EndorseText|ChNo|MICR|AcNo|AcType|IsCheque`
- `SlipEntry.txt`: `SlipID|SlipNo|SlipDate|CustCode|AC_Name|AC_No|PickupPoint|DepositSlipNo|TotalChqs|SlipAmount|CustRefNo|ProductCode|Remarks`

### 8.9 PTF (Post-Dated Transaction) files

- `frmGeneratePTFCSV.vb` — generates PTF CSV for outward items
- `frmGeneratePTFInwardCSV.vb` — generates PTF inward CSV
- PTF cheques have `DocType = "C"` in CHI XML (regular = `"B"`)

### 8.10 Outward ACK upload

`Frm_OUTWARDACK_UPLOAD.vb` — uploads acknowledgement file from Excel format via `FtpWebRequest`.

---

## 9) Security and Compliance Parity (Modernized Requirements)

Legacy had embedded keys and credentials in code. New application must preserve behavior but modernize controls:

| Legacy Item | New Requirement |
|---|---|
| AES key `"QuickCTS"` hardcoded | Move to secure secret store; keep AES/equivalent encryption |
| FTP credentials hardcoded (`AIRANFTP/Airan@123`) | Move to secret store; use SFTP/HTTPS with cert validation |
| Bulk approve password `"ACPL123"` hardcoded | Replace with role-based privileged action |
| Bulk delete password `"QuickCTS2020"` hardcoded | Replace with role-based privileged action |
| Admin usernames hardcoded in visibility logic | Replace with proper RBAC rights check |
| Login/session controls | Preserve: lockout, expiry, version gating |

---

## 10) Detailed Feature Parity Checklist

Use this as implementation acceptance checklist:

- [ ] Dual deployment semantics (HUB-style vs BRANCH-style behavior)
- [ ] Scanner-driven login/session context (location, scanner station, rights)
- [ ] Version gate on login (`CHIVersion`)
- [ ] Auto-patch on login (SQL and Crystal Report hot-update)
- [ ] Batch creation with all 8 field validations
- [ ] Multi-slip single-batch support
- [ ] Deposit slip pre-check before each scanner feed
- [ ] With-deposit-slip and without-deposit-slip flows
- [ ] MICR auto-capture per scanner model
- [ ] Endorsement sequencing per scanner type (CR120/CR50 CSN format; CR135/CR150 OEM batch format; CR190 DB-derived; no endorsement paths)
- [ ] IQA test pipeline (9 active tests; 5 disabled)
- [ ] IQA fail queue + rescan flow
- [ ] 3-image output per cheque (Front BW TIFF, Back BW TIFF, Front Gray JPEG)
- [ ] Scan limit enforcement (OutwardChqCount)
- [ ] RR 9-check validation chain per item
- [ ] RR image dimension validation (6 bounds from settings)
- [ ] RR 3-mode image viewer with pixel dimensions
- [ ] Lock batch after RR completion
- [ ] Slip 8-step save validation chain
- [ ] Auto slip number (starts at 101)
- [ ] Drawer minimum length check
- [ ] Drawer 40-char cap at file generation
- [ ] Maker L1 11-step save chain
- [ ] Maker OCR override confirmation dialog
- [ ] Maker L2 queue (different user, `ChqAmount_1 = 0` items)
- [ ] L1/L2 user segregation enforcement (FIBy/DEBy)
- [ ] SP_CLIENT_FLAG side-by-side mismatch mode (red highlight, mismatch fields editable)
- [ ] L3 QC queue (mismatch/auth/amount discrepancies)
- [ ] L4 high-value / RBI threshold queue
- [ ] Technical rejection with reason (permanent CHI exclusion)
- [ ] Checker Y/R keyboard flow with PTF flag
- [ ] Checker mandatory reject remarks
- [ ] Checker hidden bulk approve (Ctrl+Shift+F10 + password)
- [ ] Web checker parity (browser-based authorization)
- [ ] CHI preflight: blank slip check, all-auth check, concurrency lock
- [ ] CHI SCB Transfer exclusion (MICR code `036` → skip from XML)
- [ ] CHI XML/IMG naming convention (short vs long ScannerID)
- [ ] CHI XML structure (FileHeader, Item, AddendA, MICRDS RSA-SHA256, ImageViewDetail × 3)
- [ ] IMG binary file with 256-byte random pads and correct image order
- [ ] ItemSeqNo and CycleNo logic (DB lookup + sequence increment)
- [ ] PGP artifact validation (exactly 2 files)
- [ ] HTTP registration before FTP upload (must return "Success")
- [ ] FTP upload (FtpWebRequest, 2KB buffer, binary, progress bar)
- [ ] Post-upload RCMS pending routing
- [ ] Archive outward folder to `\done\` path
- [ ] RCMS single-operator lock
- [ ] SDEA Part A/C fixed-length record generation (200 chars/line, all 5 record types)
- [ ] SDEA SCB TRANSFER ISNo override
- [ ] SDEA amounts in paise (×100, no decimal)
- [ ] SDEA Part C conditional generation and trailer guard
- [ ] Auto Slip Summary PDF (Crystal Report, 2 PDFs per batch)
- [ ] EOD Excel export (per-grid, per-location)
- [ ] NACH Excel export (22 columns, image copy)
- [ ] NACH batch management flow
- [ ] NACH scanning variant
- [ ] Return file import (XML, DBF, generic)
- [ ] Return status update and return XML generation
- [ ] PTF CSV export (outward and inward)
- [ ] Batch export (3 text files → ZIP → AES encrypt)
- [ ] Batch delete (rights-gated, via SP)
- [ ] Batch status change admin utility
- [ ] Bulk delete admin utility (date range, password-gated)
- [ ] Change amount/MICR admin utility (data change log)
- [ ] Change batch status admin utility (rights-gated: "Change Batch Status")
- [ ] Dashboard 6-second auto-refresh
- [ ] Dashboard status routing table (10 status routes)
- [ ] OCR mismatch user-lock (FIBy/DEBy check)
- [ ] Admin-only button visibility (replace hardcoded usernames with RBAC)
- [ ] RCMS Completed counter label on dashboard
- [ ] Soft-data / enrichment import flows
- [ ] Technical re-scan mapping (`frmMapTechnicalReScan.vb`)
- [ ] Slip mismatch reconciliation (`FrmSlipMismatch.vb`)
- [ ] Technical scrutiny (`frmTechnucalScrutiny.vb`)
- [ ] Technical review supervisor (`frmTechnicalReview.vb`)
- [ ] Bank-wise presentation summary report
- [ ] Batch-wise report
- [ ] Product-wise presentation summary
- [ ] Slip summary report
- [ ] Portal features (web checker, image-linked cheque details)

---

## 11) Explicit Requirements for New System Design

### 11.1 Functional requirements
- Preserve every status transition and gate from legacy
- Preserve every file contract (or provide reversible compatibility adapter)
- Preserve all validation error semantics where operations depend on them
- Preserve role-level segregation and locking behavior

### 11.2 Technical requirements
- Device abstraction layer for scanner drivers (model profile per scanner code)
  - Must map `ScannerCode` values: `CR120`, `CR50`, `CR135`, `CR150`, `CR190` to correct endorsement path
  - Must expose `SetFixedEndorseText`, `GetMicrText`, IQA test interface, `GetImageAddress` per scanner
- Rule engine for validation and status computation
- File generation services with deterministic test fixtures
- Integration services (PGP, upload, RCMS, mail/report dispatch)
- Full audit trail for all user/system actions

### 11.3 Non-functional requirements
- High throughput for batch scanning and maker/checker queues
- Recoverable retries for upload/generation failures
- Operational observability (structured logs + batch trace IDs)
- Idempotency in generation and upload endpoints

---

## 12) Data/Settings Contract to Carry Forward

Minimum settings keys to preserve (from `CCTSvb.vb` + source-verified):

| Setting Key | Type | Purpose |
|---|---|---|
| `APPTYPE` | String | `"HUB"` or `"BRANCH"` deployment mode |
| `CHIVersion` | String | Version gate — must match compiled constant |
| `ScannerCode` | String | Scanner model: `"CR120"`, `"CR50"`, `"CR135"`, `"CR150"`, `"CR190"` |
| `ScannerID` | String | Physical scanner station ID (must not be `"000"` or blank) |
| `EnableEndorse` | Integer | `1` = endorsement enabled, `0` = disabled |
| `EndorseLine` | Integer | Endorsement print line (1–3) |
| `OutwardChqCount` | Integer | Max cheques per batch (scan stop limit) |
| `CLEARINGTYPE` | String | CTS clearing type code (e.g. `"01"`) |
| `TrancatingRTNo` | String | Truncating bank routing number (in endorsement text, CHI XML) |
| `RCMSFILEPATHNEW` | String | Local path for SDEA file output |
| `gstrExportOutwardFilePath` | String | Path for PGP files (FTP source directory) |
| `ExportOutwardBankFile` | String | Path for EOD Excel exports |
| `gstrrcmpath` | String | Alternate SDEA export path used in `Generatesdea.vb` |
| `gstrSharedPath` | String | Network shared path for batch image folders |
| `gstrEncryptFilePath` | String | Path for AES-encrypted batch export ZIPs |
| `FBWMinHeight` | Integer | Front B/W image minimum height (pixels) |
| `FBWMaxHeight` | Integer | Front B/W image maximum height (pixels) |
| `FBWMinWidth` | Integer | Front B/W image minimum width (pixels) |
| `FBWMaxWidth` | Integer | Front B/W image maximum width (pixels) |
| `BBWMinHeight` | Integer | Back B/W image minimum height (pixels) |
| `BBWMaxHeight` | Integer | Back B/W image maximum height (pixels) |
| `BBWMinWidth` | Integer | Back B/W image minimum width (pixels) |
| `BBWMaxWidth` | Integer | Back B/W image maximum width (pixels) |
| `FGMinHeight` | Integer | Front Grayscale image minimum height (pixels) |
| `FGMaxHeight` | Integer | Front Grayscale image maximum height (pixels) |
| `FGMinWidth` | Integer | Front Grayscale image minimum width (pixels) |
| `FGMaxWidth` | Integer | Front Grayscale image maximum width (pixels) |
| `SecurityOriginatorName` | String | Embedded in CHI XML `<MICRDS>` signature |
| `SecurityAuthenticatorName` | String | Embedded in CHI XML `<MICRDS>` signature |
| `CMSACNO` | String | Auto-fills account field in slip entry |

Security rule: All credentials/secrets must move to secret storage; no hardcoded password/user/URL in code.

---

## 13) Gap Notes and Clarifications for Build Team

1. Manager flow lists Canon/TS240 family names; code paths use Ranger API with `CR*` keys. TS240 not found as an explicit code branch — implement scanner adapter mapping table so both naming schemes resolve to supported drivers.
2. CR120/CR50 and CR135/CR150 share endorsement paths respectively; CR190 uses a distinct DB-lookup path. All three must be implemented as distinct profiles in the scanner abstraction layer.
3. Hardcoded admin username list in `frmStartBatchEntry.vb` must be replaced with RBAC rights. The new "Change Batch Status" right (`frmchangebatchstatus.vb`) provides a model for this.
4. Bulk delete password `"QuickCTS2020"` and bulk approve password `"ACPL123"` must be replaced with privileged role checks.
5. `gstrPickupLocation` in session: if set, `txtPickupLocation` in batch creation is disabled (pre-filled, non-editable). New app must preserve this constraint.
6. BRANCH mode: `txtTotalAmount` disabled; PDC dropdown hidden; all dashboard status routes redirect to batch edit instead of workflow screens.
7. `frmSlipMasternew.vb` and `frmSlipMaster_HMIL.vb` are alternate slip master variants for specific client types — must be accounted for.
8. `frmBBatchMaster.vb` and `frmbSlipMaster.vb` are B-series variants (branch-mode specific). Map to equivalent BRANCH-mode behavior in new app.

---

## 14) Recommended Build Order (Feature-Safe)

1. Master data + user/rights
2. Batch + scanner abstraction + image pipeline
3. RR + slip + maker L1/L2
4. QC/checker + status engine
5. XML/IMG generation + encryption/upload
6. RCMS + SDEA + reporting
7. Returns + daily status + portal parity
8. Admin utilities and operational hardening

---

## 15) Deliverable Definition (What "Parity Complete" Means)

Parity is complete only when:
- Same input batch set produces equivalent status progression and output files
- Same scanner model mapping gives equivalent endorsement/image output behavior
- Same validation rejects/accepts are observed at each workflow stage
- Same role restrictions and locks are enforced
- Same reporting and return cycles are operational end-to-end

---

## 16) Legacy Solution Inventory (Must Be Accounted For)

| Legacy Project | Role | New Equivalent |
|---|---|---|
| `CCTS` (VB WinForms) | Primary operations client | React SPA frontend |
| `CCTSClass` (VB class library) | LINQ-to-SQL data-access layer | Infrastructure + Repository layer |
| `CCTS_Web` (ASP.NET WebForms) | Web checker authorization channel | Browser-native React (same role management) |
| `RSAendn` | RSA-SHA256 signing for CHI digital signatures | .NET System.Security.Cryptography (RSA) |
| `cctsImageConverter` | Image format conversion to CTS 2010 spec | ImageSharp or equivalent .NET library |
| `AutoUpdater` | Silent SQL patch + report hot-swap on login | Handled by migration system; hot-patch not needed if CI/CD in place |

Required parity note: if any legacy project is not rebuilt 1:1, provide explicit replacement component and migration mapping.

---

## 17) NACH and Secondary Flows (Explicit Parity)

NACH (National Automated Clearing House) behavioral contract from source:

| Form | Purpose |
|---|---|
| `frmNACHBatchMaster.vb` | NACH batch create/manage |
| `frmNachEntry.vb` | NACH transaction data entry |
| `frmNACHReport.vb` | NACH reports |
| `frmScanNACH.vb` | NACH scanning (same Ranger API; CR120/CR50 endorsement paths) |
| `frmNACHImageProcess.vb` | NACH image processing |
| `frmNACHClient.vb` | NACH client master |
| `frmNACHRejectionReason.vb` | NACH rejection reason maintenance |
| `frmImportNachBatch.vb` / `frmImportNachBatchNew.vb` | Import NACH batch |
| `frmStartNACHEntry.vb` | NACH entry dashboard |
| `frmUploadNACHResponse.vb` | Upload NACH response |
| `frmNachMCQ.vb` | NACH MCQ |

**NACH DB tables:** `NACH_Batch_Master`, `NACH_Batch_Details`, `NACH_Import`, `NACH_ClientMaster`

**NACH SPs (verified from `NACH_SP.sql`):**
- `USP_SEL_NACH_Entry_InitRejection`
- `USP_SEL_NACH_Tracker`
- `USP_UPD_NACH_ExcelFile`
- `USP_SEL_NACH_Entry_New`
- `USP_SEL_Nach_BatechDetailsForCEQC`
- `USP_INS_UPD_NACH_EntryNew`
- `USP_Reject_Repait_NACH_BatchDetails`
- `USP_SEL_NACHBatchMaster`
- `USP_INS_UPD_NACH_BatchMaster`
- `USP_DEL_NACH_BatchMaster_new`
- `USP_SEL_Nach_BatechDetails`
- `USP_INS_UPD_NACH_Import`
- `USP_GET_NachBatch_Master`
- `USP_SEL_NACH_ClientMaster`
- `USP_UPD_NACH_QC`
- `USP_UPD_NACH_Checker`
- `USP_SEL_NACH_Import`
- `USP_INS_UPD_NACH_BatchDetails`
- `USP_UPD_NACH_DispDetails`
- `USP_UPD_NACH_Status`
- `USP_SEL_NACH_Entry` (used by EOD: 22-column Excel output)

**NACH EOD export:** 22-column format including UtilityCode, IFSC, Amount, Frequency. Images copied: `ImgFileName1` → `_T.tiff`, `ImgFileName2` → `_J.jpg`. Filename: `F_{UtilityCode}_1_{ddMMyyyy}_{ScannerID}.xlsx`

If NACH is deferred, mark it as deferred with compatibility boundaries (input format, output format, statuses impacted).

---

## 18) Web Portal and Remote Checker Parity

Legacy has a browser-based authorization channel:

| File | Role |
|---|---|
| `Default.aspx` | Web login and session routing |
| `UserMaster.Master` | Master page layout |
| `authorizescheques.aspx` | Browser-based cheque authorization (mirrors `frmChequeAuthorization.vb`) |

New app requirement: desktop and web checker behavior consistent under same authorization policy and audit trail.

---

## 19) Admin Utility Forms (Complete Inventory)

These forms are used by supervisors and admins for operational adjustments:

| Form | Function | Right Required |
|---|---|---|
| `frmchangebatchstatus.vb` | Change batch status to any value (0-5) | `"Change Batch Status"` Access |
| `frmBulkDelete.vb` | Purge all batches in a date range | Password `"QuickCTS2020"` (replace with role) |
| `frmChangeAmount.vb` | Change cheque amount OR MICR/ChequeNo/AcNo/AcType | Accessed via `USP_INS_DataChangeLog` |
| `frmChangeLocation.vb` | Change pickup location on a batch | Admin |
| `frmChequeSearch.vb` | Search cheques across batches | — |
| `frmBatchDetails.vb` | View batch item details | — |
| `frmBatchWiseReport.vb` | Batch-wise reporting | — |
| `frmBankWisePresentationSummary.vb` | Bank-wise summary | — |
| `frmProductWisePresentationSummary.vb` | Product-wise summary | — |
| `frmDeletedInstrumentReport.vb` | Report of deleted instruments | — |
| `frmSlipEntrySearch.vb` | Search slip entries | — |
| `frmSlipSummaryReport.vb` | Slip summary reporting | — |
| `frmMapTechnicalReScan.vb` | Map technical re-scan items | — |
| `FrmBlock_micr.vb` | Maintain blocked MICR list | — |
| `frmExportRepository.vb` | Export repository to external | — |
| `frmImportSoftData.vb` | Import soft data for enrichment | — |
| `frmSlipSoftDataImport.vb` | Soft data import for slip | — |
| `frmImportAdhocRequest.vb` | Ad-hoc import request | — |
| `frmImportInwardFile.vb` | Import inward file | — |
| `frmEditRetSummary.vb` | Edit return summary | — |
| `frmReCheckEntry.vb` | Re-check entry form | — |
| `frmOutwardAutoChequeEntry.vb` | Auto cheque entry | — |
| `frmGridMaster.vb` | CTS grid master maintenance | Admin |
| `frmCMSLocation.vb` | CMS location management | Admin |
| `frmMandateSearch.vb` | Mandate search (NACH) | — |
| `frmStreightImage.vb` | Image straightening utility | — |
| `frmPassword.vb` | Password change | — |
| `frmchangepassword.vb` | Forced password change on expiry/reset | — |
| `frmdashoboardActfiles.vb` | Dashboard activity files | — |
| `GenerateRCMSUtility.vb` | RCMS generation utility | — |
| `frmHMILReports.vb` | HMIL-specific reports | — |
| `frmVendorReports.vb` | Vendor reports | — |
| `frmInwardAcNo.vb` | Inward account number management | — |
| `frmLotList.vb` | Lot list management | — |
| `frmImportBatch.vb` | Import batch from file | — |
| `Summary_pdf.vb` | PDF summary generation | — |
| `frmDateRange.vb` | Date range selection helper | — |

**`frmChangeAmount.vb` detail (source-verified):**
- Change type `"A"` = amount change: validates amount > 0; calls `USP_INS_DataChangeLog` + optional `USP_UPD_SlipAndBatchAmount` (auto-balance)
- Change type (other) = MICR/ChequeNo change: validates ChequeNo 6-digit numeric, MICR 9-digit numeric, AcNo 6-digit if provided, AcType 2-digit numeric in valid list

**`frmBulkDelete.vb` detail (source-verified):**
- Password check: `"QuickCTS2020"` → replace with role
- Loops date range batches → calls `USP_DEL_BatchMaster_new(BatchID)` per batch
- Confirmation: *"Once data purge it will not be recovered anymore. ARE YOU SURE ?"*

**`frmchangebatchstatus.vb` detail (source-verified):**
- Right check: `CheckUserMenuRights(glngUserID, "Change Batch Status", "Access")`
- Status options: Reject Repair (0), Pending Authorization (1), Pending XML (2), XML Generated (3), XML Uploaded (4), RCMS Completed (5)
- Calls: `UpdateBatchStatus(BatchID, intBatchStatus, ClearingType)`

---

## 20) Full Settings/Configuration Contract (Expanded)

Do not lose these behaviors during migration; keep all as configurable settings:

- App mode and version: `APPTYPE`, `CHIVersion`
- Scanner: `ScannerCode`, `ScannerID`, `EnableEndorse`, `EndorseLine`
- Scan limits and clearing controls: `OutwardChqCount`, `CLEARINGTYPE`
- File paths: `gstrSharedPath`, `gstrEncryptFilePath`, `gstrExportOutwardFilePath`, `RCMSFILEPATHNEW`, `gstrrcmpath`, `ExportOutwardBankFile`
- XML security labels: `SecurityOriginatorName`, `SecurityAuthenticatorName`
- Routing values: `TrancatingRTNo`, `gintPresentBankRoutingNo`
- Image bounds: `FBWMinHeight`, `FBWMaxHeight`, `FBWMinWidth`, `FBWMaxWidth`, `BBWMinHeight`, `BBWMaxHeight`, `BBWMinWidth`, `BBWMaxWidth`, `FGMinHeight`, `FGMaxHeight`, `FGMinWidth`, `FGMaxWidth`
- Slip: `CMSACNO` (auto-fill account field)

Security rule: All credentials/secrets must move to secret storage; no hardcoded password/user/URL in code.

---

## 21) Source Coverage Matrix (Verification)

This blueprint now covers content from all provided sources:

### 21.1 Documentation source coverage
- `both_old_app_docs/desktop/project_documentation.md`
- `both_old_app_docs/desktop/ccts_master_specification.md`
- `both_old_app_docs/desktop/complete_process_flow_from_code.md`
- `both_old_app_docs/desktop/modules_and_flows.md`
- `both_old_app_docs/desktop/detailed_business_process_flow.md`
- `both_old_app_docs/desktop/file_inventory_and_flows.md`
- `SCB_CTS_Process_Flow_v1.0.pdf`

### 21.2 Legacy codebase source coverage (files directly read)
- `CCTSvb.vb` — global variables, settings, utility functions, endorsement enable/line
- `frmScanCheque.vb` — scanner models, endorsement branches per model, IQA, image capture (2500+ lines sampled)
- `frmStartBatchEntry.vb` — dashboard, routing, FTP, SDEA inline, admin controls
- `NEWRptCreateXML.vb` — CHI generation (1981 lines)
- `Generatesdea.vb` — standalone SDEA
- `LoginPage.vb` — login/auth/patch
- `frmBatchMaster.vb` — batch creation/export
- `frmchangebatchstatus.vb` — admin status change (fully read)
- `frmBulkDelete.vb` — bulk delete (fully read)
- `frmChangeAmount.vb` — data change log (fully read)
- `Frm_OUTWARDACK_UPLOAD.vb` — ACK upload (sampled)
- `frmScanNACH.vb` — scanner model check for NACH (line 1469)
- Full `.vb` file listing from CCTS project (130+ files identified)

### 21.3 Remaining implementation-time validation
- Reconcile any doc-vs-code differences using production behavior/logs as tie-breaker
- Freeze a signed parity matrix before UAT

---

## 22) Frontend to Backend to Database Traceability (Full Chain)

### 22.1 Login and session chain

- **Frontend**: `LoginPage.vb` / web login
- **Backend action**: validate version, encrypt password, call login validation procedure, auto-patch
- **DB checks**: `Settings` (`CHIVersion`), `User_Master` (status/attempt/expiry), `USP_Validate_Login`, `USP_SEL_UserMaster*`
- **Output**: session context (user, rights flags, pickup location); forced password-change or lockout; SQL patch execution; Crystal Report deployment

### 22.2 Batch creation chain

- **Frontend**: `frmBatchMaster`
- **Backend action**: validate 8 fields, validate location-scanner mapping, create batch, create network path
- **DB checks**: `Batch_Master`, location master (`USP_SEL_CMS_Location` path), `Settings` (`APPTYPE`, `CLEARINGTYPE`)
- **Output**: batch number, network folder, batch ready for scan

### 22.3 Scanning chain

- **Frontend**: `frmScanCheque` (and `frmScanNACH` variant)
- **Backend action**: Ranger transport init, MICR read, endorsement by scanner code, IQA tests, 3-image capture, DB write
- **DB checks/writes**: `Batch_Details`, `Batch_Master` total update, `Settings` (scanner/endorse keys), endorsement SPs
- **Output**: image files + detail rows; RR or entry-pending path based on quality

### 22.4 Reject Repair chain

- **Frontend**: `frmRejectRepair`
- **Backend action**: 9-check MICR/ChequeNo/TransCode/AcNo validation + image dimension check; save repair; lock batch
- **DB checks/writes**: `Batch_Details`, `Bank_Master`, `TransactionCodeMaster`, blocked MICR list, `TranslationRule`, `Settings` (image dimension bounds)
- **Output**: repaired cheques saved; lock batch advances to entry stage

### 22.5 Slip and cheque entry chain

- **Frontend**: `frmSlipMaster` → `ChequeDetails`
- **Backend action**: slip 8-step validation, duplicate prevention, capacity check, auto-slip number, drawer validation
- **DB checks/writes**: `Slip_Entry`, `Batch_Details`, client/pickup datasets (`tblClientInfo` + pickup SPs), duplicate lookup
- **Output**: slip saved and bound to scanned cheques; detail entry queue advanced

### 22.6 Maker/QC (L1-L4) chain

- **Frontend**: `frmAmtEntry`, `Frmqcamt`, `FrmqcAmtq`, `FRM_VALIDATE3`
- **Backend action**: queue build by level, L1/L2 mismatch handling, technical rejection, SP_CLIENT_FLAG side-by-side mode
- **DB checks/writes**: `Cheque_Entry`, `USP_UPD_AmtEntry_new`, `USP_UPD_TechnicalReturn`, user lock fields (FI/DE)
- **Output**: level progression and status change; routed to checker or next QC level

### 22.7 Checker chain (desktop + web)

- **Frontend**: `frmChequeAuthorization` and `authorizescheques.aspx`
- **Backend action**: approve/reject each item; enforce reject remarks; PTF tagging
- **DB checks/writes**: `Cheque_Entry` auth fields, `AuthenticateCheque` procedures
- **Output**: all items authorized/rejected; batch eligible for CHI only when all auth done

### 22.8 CHI generation chain

- **Frontend**: dashboard `Btn_RCMS` / generation forms
- **Backend action**: preflight checks, XML+IMG build, RSA-SHA256 MICR signature, concurrency lock
- **DB checks/writes**: authorization completion on cheque rows, blank-slip guards, `USP_UPD_BatchXMLGenInProgress`, item/cycle sequence tables
- **Output**: `CXF_*.XML`, `CIBF_*.IMG`; `CHI XML Generated` state

### 22.9 Upload chain

- **Frontend**: dashboard FTP action / `frmFTPUpload`
- **Backend action**: validate 2 PGP files, HTTP registration handshake, FTP upload
- **DB checks/writes**: RCMS pending lookup (`sel_pending_CHEQUEENTRY_RCMS`), batch status update
- **Output**: `RCMS Pending` or `RCMS Completed` route; archive path move

### 22.10 RCMS and SDEA chain

- **Frontend**: `FrmRcmsEntry`, inline/standalone SDEA (`Generatesdea` + dashboard)
- **Backend action**: RCMS operator lock; SDEA A/C fixed-length records; summary PDF auto-export
- **DB checks/writes**: RCMS lock procedures, `USP_RPT_SDEA_*` family, `GetBatchReportStatus` gate
- **Output**: Part A/C files + PDF summaries; final completion status

### 22.11 EOD/Returns/NACH chain

- **Frontend**: `frmProcessEOD`, return import forms, NACH forms
- **Backend action**: EOD reconciliation, return import+status update, NACH export
- **DB checks/writes**: `USP_SEL_ProcessEOD`, return procedures, NACH procedures + tables
- **Output**: EOD exports/reports; return outcomes persisted; NACH operational outputs

---

## 23) Master Validation Lookup Matrix (What Checks Which Master)

### 23.1 Location and scanner validation
- **Where used**: batch creation, dashboard filtering
- **Validation**: location exists AND `ScannerID <> null` AND `ScannerID <> "000"`
- **Data source**: `USP_SEL_CMS_Location` path, `Settings.ScannerCode/ScannerID`

### 23.2 Bank/MICR validation
- **Where used**: reject repair, file generation rules
- **Validation**: `MICR.Substring(3,3)` bank code must be participating; special handling for code `036`
- **Data source**: `Bank_Master`, `CheckBankIsAvailable1()`, `GetBlockMicr()`, `GetTransactionRule()`

### 23.3 Transaction code validation
- **Where used**: reject repair + maker save + `frmChangeAmount`
- **Validation**: trans code in `ValidateTransactionCode()` approved list
- **Data source**: `TransactionCodeMaster`

### 23.4 User rights validation
- **Where used**: all protected actions
- **Validation**: Access/Add/Edit by menu-right via `CheckUserMenuRights()` or `NEWCheckUserMenuRights()`
- **Data source**: `UserMenuRights`, `MenuMaster`, `User_Master`

### 23.5 Client/pickup validation
- **Where used**: slip save
- **Validation**: pickup point belongs to selected client and location context (`Mid(LocationCode,1,5)` AND `LocCode`)
- **Data source**: `tblClientInfo` + `USP_SEL_ClientPickupPoints`

### 23.6 Image standard validation
- **Where used**: reject repair save
- **Validation**: min/max dimensions for BW/Gray images
- **Data source**: `Settings` keys (`FBW*`, `BBW*`, `FG*`)

### 23.7 Drawer name validation
- **Where used**: cheque entry, SDEA generation
- **Validation at entry**: minimum 2 characters; client `IsDrawerCodeRequired` config
- **Validation at file generation**: hard-cap `Left(DrawerName, 40)` — no error, auto-truncate
- **Data source**: client config (`frmMngClient`), `Settings`

### 23.8 Cheque count vs inventory validation
- **Where used**: slip save
- **Validation**: `intscannedcheques >= txtTotalChqs` (scanned capacity must cover slip's claimed count)
- **Data source**: `Batch_Details` (count where `Status >= 1`)

### 23.9 Segregation of duties validation
- **Where used**: OCR mismatch routing (L2 entry)
- **Validation**: `FIBy` (L1 user) ≠ current user; `DEBy` (L2 user) ≠ current user
- **Data source**: `Batch_Details` user lock fields

---

## 24) Backend Contract for New Application (How To Build Without Missing Logic)

Implement backend services by legacy module boundaries:

| Service | Legacy Forms | Key Responsibilities |
|---|---|---|
| `AuthService` | `LoginPage` | Version gate, login result-code mapping, lockout/expiry, session, auto-patch |
| `BatchService` | `frmBatchMaster` | Create/edit/delete, route-state transitions, path generation, export |
| `ScannerIngestionService` | `frmScanCheque`, `frmScanNACH` | MICR read, endorsement by scanner code, IQA, 3-image capture, DB write |
| `RejectRepairService` | `frmRejectRepair`, `frmRejectRepairAuto` | 9-check validation, image dimension check, lock batch |
| `SlipService` | `frmSlipMaster`, `frmSlipMasternew` | Slip CRUD, 8-step validation, duplicate+capacity check, auto-slip number |
| `EntryService` | `frmAmtEntry`, `Frmqcamt`, `FrmqcAmtq`, `FRM_VALIDATE3` | L1-L4 queue build+save, SP_CLIENT_FLAG mode, technical return |
| `AuthorizationService` | `frmChequeAuthorization`, `authorizescheques.aspx` | Y/R approve/reject, remarks enforcement, PTF, bulk approve |
| `ChiGenerationService` | `NEWRptCreateXML`, `frmOut1gen` | Preflight, XML/IMG output, RSA signing, concurrency lock, SCB Transfer exclusion |
| `UploadService` | `frmStartBatchEntry`, `frmFTPUpload` | PGP validation, HTTP registration, FTP upload, post-upload routing, archive |
| `RcmsService` | `FrmRcmsEntry` | Operator lock management, RCMS entry, progression |
| `SdeaService` | `Generatesdea`, `frmStartBatchEntry` (inline) | Part A/C writer, drawer truncation, SCB TRANSFER ISNo, PDF export, completion |
| `ReturnService` | Return import forms, `frmGenerateReturnXML` | Return file import (XML/DBF/generic), status updates, return XML generation |
| `EodService` | `frmProcessEOD` | EOD reconciliation, Excel export, NACH Excel export |
| `NachService` | NACH forms | Full NACH path: batch/scan/entry/QC/export |
| `MasterDataService` | All master forms | Bank, branch, user, client, location, return reason, holiday CRUD |
| `AdminService` | Admin utility forms | Status change, bulk delete, amount change, batch status override |

Rule: Each service must expose test cases for all negative validation paths documented in sections 7 and 23.

---

## 25) Completeness Answer (For This Document)

Current status of this document after latest update (2026-04-11):
- Covers manager flow from `SCB_CTS_Process_Flow_v1.0.pdf`
- Covers operational legacy docs from `both_old_app_docs/desktop` (all 6 docs)
- Covers source behavior from `frmScanCheque.vb`, `CCTSvb.vb`, `frmchangebatchstatus.vb`, `frmBulkDelete.vb`, `frmChangeAmount.vb`, `frmStartBatchEntry.vb`, `NEWRptCreateXML.vb`, `Generatesdea.vb`, `LoginPage.vb`, `frmBatchMaster.vb`, `frmScanNACH.vb`, `Frm_OUTWARDACK_UPLOAD.vb` — plus full file listing of 130+ forms
- Adds: scanner model-specific endorsement text format (source-verified with exact CSN/OEM-batch format strings), complete admin utility form inventory, all missing forms from legacy source file listing
- Includes frontend→backend→DB traceability and master-validation mapping

Final caution for strict 100%: Some legacy DB definitions beyond available SQL scripts are represented through DBML + code behavior. Before build lock, run one final extraction pass from full production DB schema/SP catalog and append as Appendix B.

---

## 26) Appendix A - Audit Traceability Matrix (Screen -> Validation -> SP -> Table -> Output)

Use this appendix as implementation/UAT checklist.
Legend: `Confirmed` = directly seen in docs/source | `Derived` = inferred from code path | `TBD-ProdDB` = requires final production DB/SP extraction

| Screen/Form | Key Validation/Rule | SP/Function Path | Table/Master Path | Status/Output | Confidence |
|---|---|---|---|---|---|
| `LoginPage` | App version must match | `GetSettings("CHIVersion")`, `USP_Validate_Login`, `USP_SEL_UserMaster*` | `Settings`, `User_Master` | Login success/lock/reset/expiry outcomes | Confirmed |
| `LoginPage` | Password encrypted before compare | `EncryptString(...,"QuickCTS")` | user credential store via login SP | Auth check only after encryption | Confirmed |
| `LoginPage` | Silent SQL/report patch on login | `processUpdate()` | patch files + report artifacts | runtime patch/report refresh | Confirmed |
| `LoginPage` | 5-attempt lockout + remaining count shown | `USP_Validate_Login` ResultCode=1, `5 - FailedAttempts` | `User_Master` | block on ResultCode=5 | Confirmed |
| `LoginPage` | 90-day password expiry → forced change | `USP_Validate_Login` ResultCode=3 | `User_Master` | redirect to `frmchangepassword` | Confirmed |
| `frmBatchMaster` | SummRefNo must equal PIF | batch save path | `Batch_Master` fields | block create if mismatch | Confirmed |
| `frmBatchMaster` | Location must have valid scanner (`ScannerID ≠ "000"`) | `USP_SEL_CMS_Location` | location master + scanner mapping | create blocked when invalid scanner | Confirmed |
| `frmBatchMaster` | Total slips > 0 + amount > 0 (mode-dependent) | create batch path | `Batch_Master` | batch created with batch no | Confirmed |
| `frmBatchMaster` | Delete requires rights | `USP_DEL_BatchMaster_new` | `Batch_Master` cascades | batch deleted | Confirmed |
| `frmBatchMaster` | Export: 3 text files → ZIP → AES encrypt | Ionic.Zip + Rijndael (`"QuickCTS"`) | `gstrEncryptFilePath` | encrypted batch transfer package | Confirmed |
| `frmScanCheque` | Scanner startup/transport states | Ranger event pipeline | runtime + `Settings.ScannerCode` | scanner ready/feed/shutdown transitions | Confirmed |
| `frmScanCheque` | MICR read; endorsement by scanner code | `GetMicrText`, `USP_GET_Batch_EndorseText*` | `Batch_Details`, endorsement sequence | per-item endorsement + sequence | Confirmed |
| `frmScanCheque` | CR120/CR50: CSN-based endorsement text with `TrancatingRTNo` | `TransportReadyToSetEndorsement` CR120/CR50 branch | `Settings.TrancatingRTNo` | text: `ddMMyyyy BatchNo <CSN:0000> RoutNo SCBL0036001` | Confirmed |
| `frmScanCheque` | CR135/CR150: OEM batch mode endorsement | `TransportReadyToSetEndorsement` CR135/CR150 branch | `GetBatchEndorsementText_NEW` | text: `ddMMyyyy BatchNoSuffix SeqNo 400036000 SCBL0036001` | Confirmed |
| `frmScanCheque` | CR190: DB-derived endorsement text | `TransportSetItemOutput` CR190 path | endorsement SP | `ENDORMENTTEXT1` from DB | Confirmed |
| `frmScanCheque` | CR135: No endorsement in `TransportSetItemOutput` | `strScannerCode <> "CR135"` guard | n/a | block skipped entirely | Confirmed |
| `frmScanCheque` | IQA test chain (9 active, 5 disabled) | `DoIQATesting()` | image buffers + fail list | failed items queued for rescan | Confirmed |
| `frmScanCheque` | Max cheque scan limit | `OutwardChqCount` setting check | `Settings` | scanning stop at limit silently | Confirmed |
| `frmScanCheque` | Save 3 images per item | image save + `CreateNewBatchDetails` | `Batch_Details` (`ImgFileName1/2/3`) | front BW/back BW/front gray persisted | Confirmed |
| `frmRejectRepair` | 9-check MICR/ChequeNo/TransCode/AcNo validation chain | all checks via inline code + `ValidateTransactionCode` | `Batch_Details`, `TransactionCodeMaster` | flag items for repair | Confirmed |
| `frmRejectRepair` | MICR bank participation check | `CheckBankIsAvailable1()` | `Bank_Master` | save blocked for non-participating | Confirmed |
| `frmRejectRepair` | Blocked MICR and translation checks | `GetBlockMicr()`, `GetTransactionRule()` | blocked MICR list, `TranslationRule` | MICR cleared/translated | Confirmed |
| `frmRejectRepair` | Image dimensions in configured bounds | `ValidateImageSize()` | `Settings` (`FBW*`,`BBW*`,`FG*`) | save blocked when out of bounds | Confirmed |
| `frmRejectRepair` | ChequeNo not `"000000"` | inline save check | `Batch_Details` | save blocked | Confirmed |
| `frmRejectRepair` | Batch lock after all repairs | `LockBatch(...)` | `Batch_Master` | route to entry pending | Confirmed |
| `frmSlipMaster` | Batch must be locked | `IsBatchLocked(...)` | `Batch_Master` lock/status fields | entry blocked if unlocked | Confirmed |
| `frmSlipMaster` | Pickup point must belong to client/location | `USP_SEL_ClientPickupPoints` path | `tblClientInfo` + pickup master | save blocked when invalid pickup | Confirmed |
| `frmSlipMaster` | Duplicate slip check | `GetSlipDetails(batchID, slipNo)` | `Slip_Entry` | duplicate blocked | Confirmed |
| `frmSlipMaster` | Scanned inventory must cover slip cheque count | `CalculateBatchCheques()` | `Batch_Details` | save blocked on over-assignment | Confirmed |
| `frmSlipMaster` | Account No dual-entry | inline compare | `Slip_Entry` | save blocked on mismatch | Confirmed |
| `frmSlipMaster` | Auto slip number starts at 101 | `GetAutoSlipNumber()` | `Slip_Entry` | `LastSlipNo + 1`, default 101 | Confirmed |
| `ChequeDetails` | Drawer minimum length + client requirement | inline checks + `IsDrawerCodeRequired` | `Cheque_Entry`, client config | drawer validation outcome | Confirmed |
| `ChequeDetails` | Drawer hard-cap 40 chars at SDEA generation | `Microsoft.VisualBasic.Left(DrawerName, 40)` | `Cheque_Entry` drawer field | normalized SDEA output | Confirmed |
| `frmAmtEntry` (L1-L4) | 11-step save validation | `USP_UPD_AmtEntry_new` | `Cheque_Entry`, `TransactionCodeMaster` | level save + queue progression | Confirmed |
| `frmAmtEntry` | L1/L2 user segregation (FIBy/DEBy) | FI/DE user lock fields check | batch/entry user fields | same-user blocked | Confirmed |
| `frmAmtEntry` | SP_CLIENT_FLAG side-by-side red mismatch mode | `SP_CLIENT_FLAG` client config | client config + cheque data | mismatched fields editable | Confirmed |
| `frmAmtEntry` | Technical rejection requires reason | `USP_UPD_TechnicalReturn` | technical return flags | cheque excluded from CHI | Confirmed |
| `frmAmtEntry` | OCR amount override confirmation dialog | inline YES/NO dialog | cheque entry data | override accepted or cleared | Confirmed |
| `frmChequeAuthorization` | Reject requires non-blank remarks | `AuthenticateCheque(status=2, remarks)` | `Cheque_Entry` auth fields | auth status updated | Confirmed |
| `frmChequeAuthorization` | PTF flag support | Y key → PTF checkbox | `Cheque_Entry` PTF/DocType fields | DocType="C" in CHI XML | Confirmed |
| `frmChequeAuthorization` | Hidden bulk approve Ctrl+Shift+F10 + `"ACPL123"` | password check → `btnApproveAll` | all cheque rows | bulk AuthStatus=1 | Confirmed |
| `authorizescheques.aspx` | Web checker parity with desktop | web BAL + auth path | same auth data path | remote authorize/reject | Confirmed |
| `frmStartBatchEntry` | Status routing by computed conditions | dashboard routing logic (lines 1098-1145) | `Batch_Master`, queue/progress fields | route to 10 different workflow screens | Confirmed |
| `frmStartBatchEntry` | OCR mismatch user-lock (FIBy/DEBy) | `_batchdetails(0).FIBy/DEBy` check | batch detail user fields | same-user blocked from L2 | Confirmed |
| `frmStartBatchEntry` | 6-second auto-refresh timer | `Timer1.Interval = 6000` | dashboard data | live status updates | Confirmed |
| `frmStartBatchEntry` | Admin-only button visibility (hardcoded usernames) | username comparison | `gstrUserName` session | buttons shown/hidden | Confirmed |
| `NEWRptCreateXML` | Blank-slip and auth preflight checks | generation pre-check path | `Slip_Entry`, `Cheque_Entry` | generation blocked on failures | Confirmed |
| `NEWRptCreateXML` | Concurrency lock while generating | `USP_UPD_BatchXMLGenInProgress` | batch progress fields | `CHI In Progress` lock | Confirmed |
| `NEWRptCreateXML` | MICR code `036` items excluded from XML | `Mid(MICR1,4,3)="036"` check | cheque MICR fields | SCB Transfer items skipped | Confirmed |
| `NEWRptCreateXML` | XML/IMG naming by ScannerID length | ScannerID length check | `Settings.ScannerID` | `CXF_*.XML`, `CIBF_*.IMG` | Confirmed |
| `NEWRptCreateXML` | RSA-SHA256 MICR digital signature | `RSAendn` sub-project | fingerprint: SerialNo;PayorBankRoutNo;TransCode;Amount | `<MICRDS>` in CHI XML | Confirmed |
| `NEWRptCreateXML` | IMG 256-byte random pads + image index swap | IMG binary write logic | image file bytes | `CIBF_*.IMG` binary structure | Confirmed |
| `frmStartBatchEntry` / FTP forms | Must have exactly 2 PGP files | upload precheck | file system export path | upload continues or halts | Confirmed |
| `frmStartBatchEntry` / FTP | HTTP registration → must return "Success" | `FireURL(strURL)` HTTP POST | batch + upload metadata | upload proceeds or aborted | Confirmed |
| `frmStartBatchEntry` / FTP | FtpWebRequest 2KB buffer binary upload | `UploadFile(...)` | FTP server | XML + IMG PGP transferred | Confirmed |
| `FrmRcmsEntry` | Single-operator lock | `sel_pending_CHEQUEENTRY_RCMS`, `USP_SEL_rcmsLGenInProgess` | RCMS lock fields | prevent concurrent RCMS entry | Confirmed |
| `Generatesdea` / inline | Part A/C fixed-length records | `USP_RPT_SDEA_HEADER_File*`, `USP_RPT_SDEA_Deposit_File_NEW*`, `USP_RPT_SDEA_CHEQUE_File` | slip/cheque/header datasets | SDEA A/C files written | Confirmed |
| `Generatesdea` / inline | Drawer ≤40 chars + SCB TRANSFER ISNo | inline format rules | cheque MICR/drawer fields | normalized SDEA records | Confirmed |
| `Generatesdea` / inline | Part C trailer guard | `totDepo > 0 And totAmount > 0` | SDEA trailer write | trailer written or warning | Confirmed |
| `Generatesdea` / inline | Auto PDF slip summary after each file | `btnSlipSummaryPDF_Click()` + Crystal Reports | `CTSBatchWiseSummary.rpt` | PDF exported, status → 6 | Confirmed |
| `frmProcessEOD` | EOD reconciliation and Excel export | `USP_SEL_ProcessEOD` | EOD source datasets | Excel file at `ExportOutwardBankFile` | Confirmed |
| `frmProcessEOD` (NACH) | NACH Excel 22-column export + image copy | `USP_SEL_NACH_Entry` | NACH datasets + image refs | NACH Excel + `_T.tiff`/`_J.jpg` copies | Confirmed |
| Return forms | Return file import (XML/DBF/generic) | return import procedures | outward/return tables | return statuses updated | Derived |
| `frmGenerateReturnXML` | NPCI return XML generation | return XML path | return datasets | return XML written | Derived |
| `frmchangebatchstatus` | Batch status forced change | `UpdateBatchStatus(BatchID, status, clgType)` | `Batch_Master` | status updated to chosen value | Confirmed |
| `frmchangebatchstatus` | Requires "Change Batch Status" Access right | `CheckUserMenuRights(uid, "Change Batch Status", "Access")` | `UserMenuRights` | access denied if not granted | Confirmed |
| `frmBulkDelete` | Date range batch purge with password | `USP_DEL_BatchMaster_new(BatchID)` loop | `Batch_Master` + cascades | all batches in range deleted | Confirmed |
| `frmChangeAmount` | Amount change: validates amount > 0 | `USP_INS_DataChangeLog` | cheque data | amount change logged | Confirmed |
| `frmChangeAmount` | MICR/ChequeNo change: 6-digit/9-digit/TransCode | inline validation chain | cheque data | change logged with audit trail | Confirmed |
| `frmChangeAmount` | Optional auto-balance: `USP_UPD_SlipAndBatchAmount` | triggered if `mblnDoAutoBal = True` | `Slip_Entry`, `Batch_Master` | slip+batch amounts rebalanced | Confirmed |

### 26.1 Core table domains (from DBML/scripts)

- User/security: `User_Master`, `UserMenuRights`, `MenuMaster`
- Settings/config: `Settings`
- Masters: `Bank_Master`, `Branch_Master`, `TransactionCodeMaster`, `CalendorMaster`, `tblClientInfo`, pickup structures, `TranslationRule`
- Outward transaction: `Batch_Master`, `Batch_Details`, `Slip_Entry`, `Cheque_Entry`
- Sequence/cycle: `ItemSeq_Master`, `Cycle_Master`, `ReturnCycle_Master`, `PTFCycle_Master`, `PTFItemSeq_Master`, `PTFInwardCycle_Master`, `PTFInwardItemSeq_Master`
- Returns: `OutwardReturnMaster`, `OutwardReturnDetails`, `Return_Master`, `ReturnReasonMaster`, `ReturnTypes`
- Inward: `Inward_Chq_Details`, `Inward_File_Master`, `Inward_LotDetails`, `Inward_LotMaster`
- NACH: `NACH_Batch_Master`, `NACH_Batch_Details`, `NACH_Import`, `NACH_ClientMaster`
- Misc: `PIFPRELOC`, `IMP_CHQ_DETAILS`, `Import_Deposit_data`, `dbf_upload_Pwr`

### 26.2 Final strict-completeness action (mandatory before sign-off)

Run this final extraction and append Appendix B:
- Full production table catalog with columns/constraints/indexes
- Full production SP catalog with parameter list and side-effects
- Per-screen negative validation matrix with exact error messages
- Per-status transition condition truth table

Mark each row: `Implemented` | `Not Implemented` | `Deferred (approved)`

---

## 27) Appendix B - Build/UAT Control Pack (Future-Proof)

### 27.1 Module-level Definition of Done (DoD)

A module is done only when ALL below are true:
1. Functional flow implemented end-to-end.
2. All validations (positive + negative) are tested.
3. Master-data dependencies are enforced.
4. Status transitions match legacy rules.
5. Output artifacts match naming/content rules.
6. Audit logs capture actor/time/action/result.
7. Error messages and block behavior match expected operations.

---

### 27.2 Engineering task template

| Module | Legacy Screen/Form | New API/Service | Master Dependencies | SP/Table Dependencies | Test Cases | Status |
|---|---|---|---|---|---|---|
| Login | `LoginPage` | `AuthService` | `Settings`, `User_Master` | `USP_Validate_Login`, `USP_SEL_UserMaster*` | lockout/expiry/version/patch | Planned |
| Batch | `frmBatchMaster` | `BatchService` | location/scanner settings | `Batch_Master`, location SPs | create/edit/delete/export | Planned |
| Scan | `frmScanCheque` | `ScannerIngestionService` | scanner settings + endorsement keys | `Batch_Details`, `Batch_Master` | CR120/CR50/CR135/CR150/CR190 + IQA + images | Planned |
| RR | `frmRejectRepair` | `RejectRepairService` | `Bank_Master`, `TransactionCodeMaster`, `Settings` | `Batch_Details` | all 9 checks + image bounds + lock | Planned |
| Slip | `frmSlipMaster` | `SlipService` | client/pickup masters | `Slip_Entry`, `Batch_Details` | duplicate/capacity/dual-entry/auto-no | Planned |
| Entry/QC | `frmAmtEntry` + QC forms | `EntryService` | trans code + user segregation + client config | `Cheque_Entry`, entry SPs | L1-L4 + SP_CLIENT_FLAG + technical reject | Planned |
| Checker | `frmChequeAuthorization`, `authorizescheques.aspx` | `AuthorizationService` | rights | auth update path | approve/reject/PTF/bulk | Planned |
| CHI | `NEWRptCreateXML` | `ChiGenerationService` | settings + cycle/seq + RSAendn | sequence/cycle tables | preflight/signature/files/SCB-excl | Planned |
| Upload | dashboard/FTP forms | `UploadService` | FTP endpoint config | RCMS pending + status updates | 2 PGP + register + upload + archive | Planned |
| RCMS/SDEA | `FrmRcmsEntry`, `Generatesdea` | `RcmsService`, `SdeaService` | SDEA settings | `USP_RPT_SDEA_*` | lock + A/C files + PDFs + Part C guard | Planned |
| Returns | return import forms | `ReturnService` | reason masters | return tables/SPs | import/update/XML/DBF | Planned |
| NACH | NACH forms | `NachService` | NACH masters | NACH tables/SPs | batch/scan/entry/qc/excel/image-copy | Planned |
| Admin | admin utility forms | `AdminService` | rights | change-log SPs, batch SPs | status-change/bulk-delete/amount-change | Planned |

---

### 27.3 Current known table catalog

#### A) Core/CTS tables (from DBML)
`User_Master`, `Cycle_Master`, `Inward_Chq_Details`, `Inward_File_Master`, `Inward_LotDetails`, `Inward_LotMaster`, `Return_Master`, `ReturnReasonMaster`, `ReturnTypes`, `ReturnCycle_Master`, `PTFCycle_Master`, `PTFItemSeq_Master`, `UserMenuRights`, `MenuMaster`, `PTFInwardCycle_Master`, `PTFInwardItemSeq_Master`, `Settings`, `Bank_Master`, `Branch_Master`, `OutwardReturnMaster`, `OutwardReturnDetails`, `ItemSeq_Master`, `TransactionCodeMaster`, `CalendorMaster`, `Batch_Details`, `TranslationRule`, `IMP_CHQ_DETAILS`, `Import_Deposit_data`, `tblClientInfo`, `dbf_upload_Pwr`, `NACH_Batch_Master`, `Cheque_Entry`, `PIFPRELOC`, `Batch_Master`, `Slip_Entry`

#### B) NACH tables (from SQL scripts)
`NACH_ClientMaster`, `NACH_Import`, `NACH_Batch_Details`, `NACH_Batch_Master`

> Note: final production schema may include additional tables not present in currently available SQL scripts/DBML snapshot.

---

### 27.4 Current known SP catalog

#### A) NACH SPs
`USP_SEL_NACH_Entry_InitRejection`, `USP_SEL_NACH_Tracker`, `USP_UPD_NACH_ExcelFile`, `USP_SEL_NACH_Entry_New`, `USP_SEL_Nach_BatechDetailsForCEQC`, `USP_INS_UPD_NACH_EntryNew`, `USP_Reject_Repait_NACH_BatchDetails`, `USP_SEL_NACHBatchMaster`, `USP_INS_UPD_NACH_BatchMaster`, `USP_DEL_NACH_BatchMaster_new`, `USP_SEL_Nach_BatechDetails`, `USP_INS_UPD_NACH_Import`, `USP_GET_NachBatch_Master`, `USP_SEL_NACH_ClientMaster`, `USP_UPD_NACH_QC`, `USP_UPD_NACH_Checker`, `USP_SEL_NACH_Import`, `USP_INS_UPD_NACH_BatchDetails`, `USP_UPD_NACH_DispDetails`, `USP_UPD_NACH_Status`, `USP_SEL_NACH_Entry`

#### B) Core SP families (from code/docs)
- Login/user: `USP_Validate_Login`, `USP_SEL_UserMaster`, `USP_SEL_UserMaster_new`
- Batch/status: `USP_UPD_BatchStatus`, `UpdateBatchStatuso`, `UpdateBatchStatus`, batch create/delete/select families, `GetBatchDetails`, `GetBatchDetailsnew2`
- Scan/endorse: `GetBatchEndorsementText_NEWN`, `GetBatchEndorsementText_NEW`, `CreateNewBatchDetails`, `UpdateNoOfCheques`
- RR: `RejectRepairBatchDetails`, `CheckBankIsAvailable1`, `GetBlockMicr`, `GetTransactionRule`
- Entry: `USP_UPD_AmtEntry_new`, `USP_UPD_TechnicalReturn`, `GetRejectedCheques`
- Slip: `ManageSlipsWithSoftSlip`, `GetSlipDetails`, `GetAutoSlipNumber`, `CalculateBatchCheques`, `IsBatchLocked`, `LockBatch`
- Auth: `AuthenticateCheque`
- CHI: `USP_UPD_BatchXMLGenInProgress`, `GetItemSeqDetails`, `GetCycleDetails`
- RCMS: `sel_pending_CHEQUEENTRY_RCMS`, `USP_SEL_rcmsLGenInProgess`
- SDEA: `USP_RPT_SDEA_HEADER_File`, `USP_RPT_SDEA_HEADER_FileA`, `USP_RPT_SDEA_Deposit_File_NEW0`, `USP_RPT_SDEA_Deposit_File_NEW1`, `USP_RPT_SDEA_CHEQUE_File`, `GetBatchReportStatus`
- Admin: `USP_INS_DataChangeLog`, `USP_UPD_SlipAndBatchAmount`
- EOD: `USP_SEL_ProcessEOD`
- Location/grid: `USP_SEL_CMS_Location`, `USP_SEL_CTS_GRID_MASTER`
- Client: `USP_SEL_ClientMaster_NEW`, `USP_SEL_ClientPickupPoints`
- Returns: return import/update/generate families

---

### 27.5 Strict validation checklist (must pass before go-live)

| Area | Must Validate | Evidence Required |
|---|---|---|
| Login | version gate, lockout, reset, expiry | test report + screenshots + logs |
| Scanner | MICR read, IQA per model, endorsement per model (CR120/CR50/CR135/CR150/CR190) | scanner run logs + sample endorsement outputs |
| RR | all 9 rule checks + image dimensions | negative test matrix |
| Slip | duplicate/limits/pickup mapping/dual-entry | DB assertions + UI behavior |
| L1-L4 | mismatch routing + segregation + SP_CLIENT_FLAG | test run with two users |
| Checker | mandatory reject remarks, PTF, bulk approve | auth log extracts |
| CHI | blank-slip/auth preflight + generation lock + SCB excl | generated files + lock audit |
| Upload | exactly 2 PGP + HTTP register + FTP transfer + archive | transfer logs + remote ack |
| RCMS/SDEA | lock + A/C output + PDFs + Part C guard | output files + row counts |
| Returns | import/mapping/status update | before/after status evidence |
| NACH | batch/scan/entry/qc/excel/image-copy chain | NACH output package |
| Admin | status change / bulk delete / amount change | audit log evidence |

---

### 27.6 Change control log

| Date | Author | Change | Reason |
|---|---|---|---|
| 2026-04-11 | Auto-updated from source read | Added scanner model endorsement text formats (source-verified); added complete admin utility form inventory; added all missing forms from full CCTS file listing; added `frmchangebatchstatus`, `frmBulkDelete`, `frmChangeAmount` source-verified detail; added `CR50`, `CR150` scanner codes confirmed from source; clarified BRANCH mode behavior; expanded settings table; added `gintEnableEndorse`/`gintEndorseLine` globals; expanded Appendix A with all new items | Full source code read from `frmScanCheque.vb`, `CCTSvb.vb`, `frmchangebatchstatus.vb`, `frmBulkDelete.vb`, `frmChangeAmount.vb` and file listing of 130+ CCTS source files |

---

### 27.7 Recommended next enhancement

Add Appendix C:
- Sample payloads/files for each stage (input + output)
- One "golden batch" replay dataset
- Expected outcomes by stage for regression automation

---

## 28) Exact Execution Chains (Desktop Deep-Mapping)

### 28.1 Login chain
1. `LoginPage` submit.
2. Version read via `Settings.CHIVersion` — mismatch → hard block.
3. Password encrypted with `"QuickCTS"` key.
4. `USP_Validate_Login` called — result code 0–5.
5. On success, `USP_SEL_UserMaster*` loads session rights and context (including `gstrPickupLocation` — if set, disables location field in batch creation).
6. `processUpdate()` executes SQL patches from `\SQL\` folder; copies updated `.rpt` files from `\NewReports\` to `\Reports\`.
7. `frmSelectPresentingBrach` → sets `glngPresentBranchID`, `gstrCMSLocation`, `gintPresentBankRoutingNo`.

**Verify**: `Settings`, `User_Master`, user-right fields.
**Next**: branch selection + dashboard.

### 28.2 Batch create chain
1. `frmBatchMaster` validate 8 fields in order.
2. Location/scanner check (`ScannerID` not null/`"000"` via `USP_SEL_CMS_Location`).
3. `CreateNewBatch(...)` → 6-digit zero-padded BatchNo.
4. Filesystem path created: `gstrSharedPath\YYYY\MMM\dd-MM-yyyy\BatchNo\`
5. Optional export: 3 pipe-delimited text files → Ionic.Zip → Rijndael AES (`"QuickCTS"`) → `gstrEncryptFilePath`.
6. Delete cheque from unlocked batch: press **D** on grid row → `DeleteChqFromBatch(BDID)`.

**Verify**: `Batch_Master`, location master, config keys.
**Next**: scan workflow.

### 28.3 Scan chain
1. `frmScanCheque` starts Ranger: `StartUp()` → `TransportChangeOptionsState` (disable IQA) → `EnableOptions()` → Ready.
2. Before feeding: check slip counter → open `frmDepositSlipEntry` if new slip needed.
3. On `TransportSetItemOutput`: `GetMicrText(1)` (spaces → `_`) → endorsement by scanner code → `SetFixedEndorseText()`.
4. IQA tests applied via `DoIQATesting()` (9 active) — failures to fail list.
5. On `TransportItemInPocket`: scan limit check → 3 images saved → `CreateNewBatchDetails(...)` writes DB row.
6. Stop → `ShutDown()` → `UpdateNoOfCheques(batchID, totalScanned)`.
7. Form close blocked while scanner not shut down.

**Verify**: `Batch_Details`, `Batch_Master`, endorsement sequence, scanner model branching.
**Next**: RR pending or entry pending.

### 28.4 RR chain
1. `frmRejectRepair` loads scanned entries with issues.
2. Applies 9-check validation per item.
3. 3-mode image viewer with pixel dimensions.
4. Applies image dimension bounds check (6 settings) on save.
5. Saves repair update via `RejectRepairBatchDetails()`.
6. After all done → Lock Batch button → `LockBatch(mlngBatchID)`.

**Verify**: `Batch_Details`, `Bank_Master`, `TransactionCodeMaster`, `Settings` (image bounds).
**Next**: locked batch for slip/maker.

### 28.5 Slip and maker chain
1. `frmSlipMaster` checks `IsBatchLocked()`.
2. Validates pickup point/client; duplicate slip; capacity; account dual-entry; amount.
3. `ManageSlipsWithSoftSlip(...)` persists slip; `ChequeDetails` opens.
4. `frmAmtEntry` L1-L4 updates via `USP_UPD_AmtEntry_new` with 11-step validation.
5. L2 queue: items where `ChqAmount_1 = 0`; different user mandatory.
6. SP_CLIENT_FLAG mode: side-by-side red mismatch highlighting.
7. Technical reject via `USP_UPD_TechnicalReturn` — permanent CHI exclusion.
8. If L3+ queue empty → auto: `USP_UPD_BatchStatus(batchID, "2", CLEARINGTYPE)`.

**Verify**: `Slip_Entry`, `Batch_Details`, `Cheque_Entry`, client/pickup masters.
**Next**: OCR mismatch/QC/checker.

### 28.6 Checker chain
1. `frmChequeAuthorization` / `authorizescheques.aspx`.
2. Y = approve (`AuthStatus=1`); R = reject (`AuthStatus=2`, blank remarks = blocked).
3. PTF checkbox → `IsPTF=1` → `DocType="C"` in CHI.
4. Bulk approve: `Ctrl+Shift+F10` → password `"ACPL123"` → loop all rows.
5. Grid auto-advances after each action.

**Verify**: auth status fields in cheque data.
**Next**: CHI eligibility.

### 28.7 CHI + upload chain
1. `NEWRptCreateXML` preflight: blank slips, all `AuthStatus=1`, not `IsXMLGenInProgress`, MICR `036` items excluded.
2. Lock via `USP_UPD_BatchXMLGenInProgress`.
3. Build XML per cheque with RSA-SHA256 MICRDS signature; 3 `<ImageViewDetail>` blocks.
4. Build IMG binary with 256-byte pads and correct image order.
5. Upload: validate exactly 2 PGP files → create FTP folders → HTTP register (must return "Success") → `FtpWebRequest` upload XML + IMG → check RCMS pending → update status → archive.

**Verify**: `Batch`, `Cheques`, sequence/cycle tables, RCMS pending sources.
**Next**: RCMS pending or completed.

### 28.8 RCMS + SDEA + closure chain
1. RCMS entry guarded by operator lock (`RCMSBY` + `USP_SEL_rcmsLGenInProgess`).
2. SDEA pre-check: `GetBatchReportStatus()` must be true.
3. Part A: `USP_RPT_SDEA_HEADER_File` → `USP_RPT_SDEA_Deposit_File_NEW0` → `USP_RPT_SDEA_CHEQUE_File` → write 200-char records.
4. Drawer truncation to 40 chars; SCB TRANSFER ISNo override for MICR code `036`.
5. Blank slip guard before each file.
6. Part C: conditional on `RPTSDEA_Deposit_File_NEW1()` returning rows; trailer guard.
7. After each file: `UpdateBatchStatuso(6)` + PDF slip summary export.

**Verify**: RCMS lock data, SDEA output datasets, final status, PDF outputs.
**Next**: Completed batch; EOD/returns.

---

## 29) Desktop Validation-to-Source Matrix (Quick Audit)

| Validation | Trigger Screen | Source Location |
|---|---|---|
| Version match | `LoginPage` | `Settings.CHIVersion` |
| Login result-code flow | `LoginPage` | `USP_Validate_Login` + `User_Master` |
| Auto-patch on login | `LoginPage` | `processUpdate()` — `\SQL\` + `\NewReports\` folders |
| Location has valid scanner | `frmBatchMaster` | `USP_SEL_CMS_Location`, `ScannerID <> "000"` |
| SummRefNo = PIF | `frmBatchMaster` | batch input validation step 5 |
| Branch selection sets routing no | `frmSelectPresentingBrach` | `glngPresentBranchID`, `gintPresentBankRoutingNo` |
| Scanner endorsement by model | `frmScanCheque` | `TransportSetItemOutput` + `TransportReadyToSetEndorsement` branches |
| CR120/CR50 CSN endorsement format | `frmScanCheque` line ~1625–1664 | `"QuickCTS"` → `TrancatingRTNo` + `"SCBL0036001"` |
| CR135/CR150 OEM batch format | `frmScanCheque` line ~1670–1715 | `"400036000 SCBL0036001"` format |
| CR135 no endorsement in TransportSetItemOutput | `frmScanCheque` line ~626 | `strScannerCode <> "CR135"` guard |
| CR190 DB-derived endorsement | `frmScanCheque` line ~680 | `GetBatchEndorsementText_NEW` |
| Scan limit | `frmScanCheque` | `Settings.OutwardChqCount` |
| IQA checks (9 active) | `frmScanCheque` | `DoIQATesting()`, tests 1-5,7-10 |
| MICR bank validity | `frmRejectRepair` | `Bank_Master`, `CheckBankIsAvailable1()` |
| MICR block + translation | `frmRejectRepair` | `GetBlockMicr()`, `GetTransactionRule()` |
| Transaction code validity | RR + Maker + `frmChangeAmount` | `TransactionCodeMaster`, `ValidateTransactionCode()` |
| Image dimension bounds | RR save | `Settings` (`FBW*`, `BBW*`, `FG*`) |
| ChequeNo not `"000000"` | RR save | inline check |
| Batch lock prerequisite | `frmSlipMaster` | `IsBatchLocked()` |
| Slip duplicate + capacity | `frmSlipMaster` | `Slip_Entry`, `Batch_Details` |
| Account dual-entry | `frmSlipMaster` | inline compare |
| Pickup point belongs to client | `frmSlipMaster` | `USP_SEL_ClientPickupPoints` |
| L1/L2 segregation | maker/QC route | FI/DE user fields in `Batch_Details` |
| OCR override confirmation | `frmAmtEntry` | inline YES/NO dialog |
| Technical rejection | `frmAmtEntry` | `USP_UPD_TechnicalReturn` |
| Reject remarks mandatory | checker | `AuthenticateCheque` remarks check |
| PTF → DocType="C" in XML | checker + CHI | PTF flag → XML `<DocType>` |
| Bulk approve password | checker | `"ACPL123"` → `Ctrl+Shift+F10` |
| XML preflight (blank slips + all auth) | CHI generation | slip/cheque/auth state queries |
| SCB Transfer (MICR `036`) excluded | CHI generation | `Mid(MICR1,4,3)="036"` check |
| IMG 256-byte pads + image order swap | IMG binary | `img1=Front`, `img2=FrontG`, `img3=Back` |
| RCMS single-operator lock | RCMS entry | `sel_pending_CHEQUEENTRY_RCMS`, `USP_SEL_rcmsLGenInProgess` |
| HTTP registration before FTP | FTP upload | `FireURL(...)` must return "Success" |
| Exactly 2 PGP files | FTP upload | `*.pgp` file count check |
| SDEA record constraints | SDEA generation | `USP_RPT_SDEA_*` + drawer/MICR rules |
| Part C trailer guard | SDEA Part C | `totDepo > 0 And totAmount > 0` |
| Batch status change rights | `frmchangebatchstatus` | `"Change Batch Status"` Access right |
| Bulk delete password | `frmBulkDelete` | `"QuickCTS2020"` (replace with role) |
| Amount change audit log | `frmChangeAmount` | `USP_INS_DataChangeLog` |
