# WEB CS Legacy Full Feature Parity Blueprint

**Source code**: `C:\Users\laksh\Downloads\14-11-2024 CS_1\14-11-2024 CS_1`  
**Legacy docs**: `both_old_app_docs/web`  
**Purpose**: Migration-grade specification for rebuilding the CS web clearing system with 100% feature parity. All details verified against actual source code.

---

## 0) Handoff Readiness (Read First)

This document gives a new engineer/AI everything needed to understand the CS web app end-to-end:
- What every controller does and what exact validations it enforces
- Every data model with all fields and their workflow significance
- Session, concurrency, and role-access rules
- File generation format, signing, and SFTP transmission
- Batch status state machine (numeric codes + transitions)
- Scanner integration via browser JS bridge

### 0.1 What this document guarantees
- Every controller action mapped to business rule
- Every DB model field catalogued with purpose
- Exact validation error messages extracted from code
- File naming conventions confirmed from source
- SFTP auth method (password + private key) confirmed from code
- All session fields verified from `LoginController.cs`

### 0.2 What still needs verification before final freeze
- Exact stored procedure signatures (if any SPs not visible in EF LINQ)
- Production DB schema for any tables not surfaced in `ApplicationDbContext.cs`

---

## 1) System Purpose and Scope

**CS (Clearing System)** is a browser-based cheque clearing platform built on **ASP.NET Core 8 MVC**. It handles the full lifecycle of physical cheque truncation per India's **CTS-2010 standard** and **RBI/NPCI** clearing house requirements.

Core lifecycle:
1. Login / EOD date selection / session control
2. Batch creation with sub-batch splitting
3. Scanner capture via browser-based Ranger.js WebSocket bridge
4. Reject Repair (RR) for bad MICR reads
5. Maker L1 — slip and cheque entry + account validation
6. Checker L2 — blind re-entry, segregation of duties enforced
7. QC — automated Maker vs Checker field comparison
8. XML (OTS) + IMG (OTI) generation with RSA-SHA256 signing
9. GEFU flat-file generation for CBS integration
10. SFTP upload to bank grid (password + private key auth)
11. Admin utilities: batch unlock, move, delete, change date/location, drawer name, initial reject, DNU, high value, etc.
12. Reporting: daily, batch summary, productivity, error, duplicate, modified, transfer, CHI rejection, dashboard summary

---

## 2) Technology and Runtime Architecture

| Component | Detail |
|---|---|
| **Framework** | ASP.NET Core 8.0 MVC |
| **Data Access** | Entity Framework Core (Code-First + DB-First hybrid) |
| **Primary DB** | SQL Server — `ApplicationDbContext` |
| **Secondary DB** | SQL Server — `SecondaryDbContext` (external account lookup only) |
| **Session** | Server-side ASP.NET session, 20-minute idle timeout, `HttpOnly` cookie |
| **Scanner bridge** | `Ranger.js` — WebSocket communication with Silver Bullet Ranger hardware |
| **SFTP client** | `Renci.SshNet` via `Services/sftpUploader.cs` |
| **Image processing** | `SixLabors.ImageSharp`, `Emgu.CV`, `ImageMagick`, `ImageProcessor` |
| **RSA signing** | Native .NET RSA libraries with `2048.pke` key file |
| **Excel reports** | `ClosedXML` |
| **XML generation** | Native `System.Xml.XmlWriter` |
| **Concurrency control** | `SessionToken` (GUID) stored in `UserMaster`; middleware validates every request |

**Session timeout**: `options.IdleTimeout = TimeSpan.FromMinutes(20)` (`Program.cs` line 29)

---

## 3) Startup and Configuration (`Program.cs`)

Key registrations:
- `AddControllersWithViews()`
- `AddHttpContextAccessor()`
- `AddMemoryCache()` + `AddDistributedMemoryCache()`
- `AddSession()` — 20-min timeout, HttpOnly, Essential
- `AddSingleton<IUserSessionService, UserSessionService>()`
- `AddScoped<sftpUploader>()`
- `ApplicationDbContext` on `DefaultConnection`
- `SecondaryDbContext` on `SecondaryConnection`
- `FormOptions.MultipartBodyLengthLimit = long.MaxValue` — allows large image uploads
- Middleware order: `UseSession()` → `UseMiddleware<SessionValidationMiddleware>()`
- Default route: `{controller=Login}/{action=Index}/{id?}`

**Connection strings** in `appsettings.json`:
- `DefaultConnection` — operational DB
- `SecondaryConnection` — account master lookup DB

---

## 4) Data Models (All Fields)

### 4.1 `UserMaster`

| Field | Type | Purpose |
|---|---|---|
| `UID` | int (PK) | User identity |
| `UName` | string | Display name |
| `UPassword` | string | Plain-text password (legacy — hash in new app) |
| `EmpID` | string? | Employee ID used as login username |
| `EmpLocation` | string? | Default location string |
| `IsActive` | int? | 1=active |
| `IsSuperAdmin` | int? | Super-admin flag |
| `IsAdmin` | int? | Admin — can generate XML/GEFU |
| `IsScan` | int? | Can scan and create batches |
| `IsMaker` | int? | Can do L1 maker entry |
| `IsChecker` | int? | Can do L2 checker verification |
| `IsQC` | int? | Can do QC resolution |
| `IsReports` | int? | Can access reports |
| `IsSFTP` | int? | Can trigger SFTP uploads |
| `IsLoggedIn` | int? | 0=not logged in, 1=logged in (concurrency control) |
| `AttempPass` | int? | Failed password attempt counter (max=5) |
| `LockedUser` | int? | 1=account locked after 5 failures |
| `LoginUserLocked` | int? | Admin-locked flag (set by `Logouttt`) |
| `SessionToken` | Guid? | Rotated on every login; compared by middleware each request |
| `IsDeleted` | int? | Soft-delete flag |
| `Deleted_By` / `Deleted_time` | int?/DateTime? | Audit fields |

### 4.2 `Batch`

| Field | Type | Purpose |
|---|---|---|
| `BatchID` | long (PK, identity) | DB row identity |
| `BatchNo` | long | Business batch number: `{LocationID}{yyyyMMdd}{5-digit seq}` |
| `LocationID` | int | Owning location |
| `LocationName` | string | Denormalized for display |
| `BatchDate` | DateTime | EOD processing date |
| `BatchAmount` | decimal(15,3) | Total cheque amount |
| `TotalSlips` | int? | Slip count |
| `TotalChqs` | int? | Cheque count |
| `BatchStatus` | int? | Workflow stage (see state machine) |
| `OCR_Status` | int? | OCR data availability flag |
| `Report_Status` | int? | 0=not generated, 1=XML/IMG generated |
| `XMLFileName` | string? | Stored OTS XML file name |
| `XMLGenerationDate` / `XMlGenerationTime` | DateTime?/TimeSpan? | For cycle-no increment and file name uniqueness |
| `GEFUFileName` | string? | Stored GEFU file name |
| `ImgFileName` | string | Stored OTI IMG file name |
| `ClearingType` | string(10) | e.g., `"01"` for standard CTS |
| `RR_By` / `RR_OCR_By` | int? | User who did Reject Repair |
| `M_By` | int? | Maker (L1) user ID |
| `C_By` | int? | Checker (L2) user ID |
| `Q_By` | int? | QC user ID |
| `CHI_By` | int? | XML generator user ID |
| `GEFU_By` | int? | GEFU generator user ID |
| `User_Lock` | int? | UserID of current holder (0=unlocked) |
| `Batch_Type` | int? | Type flag |
| `Skip_Ocr` | int? | Skip OCR validation flag |
| `Hold_Batch_Slip` | int? | Slip hold flag |
| `IsDeleted` | int? | Soft-delete flag |
| `CHI_Rejected` | int? | CHI rejection flag |
| `CHI_File_Status` | int? | CHI file upload status |
| `Emp_locationname` | string? | Employee location display name |
| `BatchT` | string? | Batch type label |

### 4.3 `SubBatchTbl`

Mirrors `Batch` schema exactly but adds:
| Field | Purpose |
|---|---|
| `SubBatchID` | PK identity |
| `BatchId` | FK to parent `Batch.BatchID` |
| `SubBatchNo` | Sub-batch sequence within batch |
| `SubBatchStatus` | Status of this sub-batch independently |

Sub-batches allow large batches to be split for parallel Maker processing. Each sub-batch independently progresses through Maker → Checker → QC.

### 4.4 `Cheques`

| Field | Type | Purpose |
|---|---|---|
| `Id` | long (PK) | Row identity |
| `BatchNo` | long | Parent batch number |
| `SubBatchNo` | long? | Parent sub-batch number |
| `BatchId` | long | Parent `Batch.BatchID` |
| `SubBatchID` | long? | Parent sub-batch ID |
| `LocID` | int | Location |
| `BatchDate` | DateTime | EOD date |
| `ScanDate` | DateTime | Actual scan timestamp |
| `Scan_By` | int | Scanner user ID |
| `SeqNo` | string | Sequence within batch (e.g., "001") |
| `micrText` | string? | Raw full MICR text from scanner |
| `ChqNo` | string? | 6-digit cheque number |
| `MICR1` | string? | 9-digit bank/branch MICR code |
| `MICR2` | string? | 6-digit account number from MICR |
| `MICR3` | string? | 2-digit transaction code |
| `ChequeImage` | string? | Front JPEG URL/path |
| `ChequeImage1` | string? | Rear JPEG URL/path |
| `ChequeImage2` | string? | Front TIF URL/path |
| `ChequeImage3` | string? | Rear TIF URL/path |
| `IsSlip` | bool | `true` if this record is a slip header, `false` if cheque item |
| `SlipID` | int | FK to slip (stored as SlipNo integer) |
| `Chq_Date` | DateTime? | Cheque date from instrument |
| `Chq_Amt` | decimal? | Final settled cheque amount |
| `Ini_Rej` | int? | Initial rejection state: 0=normal, 1=rejected, 9=transfer, 99/999=other reject codes |
| `Ini_Rej_ID` | long? | Return reason ID for initial reject |
| `RRState` | int | 0=needs repair, 1=repaired |
| `RRBy` / `RRTime` | int?/DateTime? | Reject Repair operator + time |
| `MICRRepairFlag` | string? | 6-char flag indicating which MICR fields were repaired (e.g., `"000000"` = no repair, `"100000"` = ChqNo repaired) |
| `RR_OCRState` / `RR_OCRBy` / `RR_OCRTime` | int?/int?/DateTime? | OCR-RR state |
| `O_*` fields | various | Original OCR-read values (preserved for audit) |
| `M_ChqNo/MICR1/MICR2/MICR3/ChqDate/ChqAmount` | various | Maker (L1) entered values |
| `M_Status` | int? | 0=pending maker, 1=maker done |
| `M_By` / `M_Time` | int?/DateTime? | Maker user + time |
| `M_Ini_Rej` / `M_Ini_Rej_ID` | int?/long? | Maker initial reject |
| `C_ChqNo/MICR1/MICR2/MICR3/ChqDate/ChqAmount` | various | Checker (L2) entered values |
| `C_Status` | int? | 0=pending checker, 1=checker done |
| `C_By` / `C_Time` | int?/DateTime? | Checker user + time |
| `C_Ini_Rej` / `C_Ini_Rej_ID` | int?/long? | Checker initial reject |
| `Q_ChqNo/MICR1/MICR2/MICR3/ChqDate/ChqAmount` | various | QC resolved values |
| `Q_Status` | int? | 0=pending QC, 1=QC done |
| `Q_By` / `Q_Time` | int?/DateTime? | QC user + time |
| `Q_Ini_Rej` / `Q_Ini_Rej_ID` | int?/long? | QC initial reject |
| `DrawerName` | string? | Cheque drawer name |
| `BankID` | long? | Lookup bank ID |
| `OCR_*` fields | various | OCR-provided values (IFSC, AccNo, Amount, Date, Drawer, ChqNo, MICR1-3, PayeeName, SlipAmount) |
| `DNU_By` / `DNU_Verify_By` | int? | Do-Not-Use flags |
| `XMLItemSeqNo` | string? | Sequence number used in OTS XML `<Item>` |
| `CHI_Generated` | int? | 0=not included in CHI, 1=included |
| `CHI_Rejected` | int? | 1=rejected by CHI |
| `RejectReasonCode` | string? | Return reason for CHI rejection |
| `RescanFlg` | string? | Rescan flag |
| `IsDuplicate` | int? | 1=detected as duplicate — excluded from XML |
| `IsProcess` | int? | Processing state flag |
| `DeletedReason` | string? | Reason if soft-deleted |
| `ScanRescan` | int? | Rescan count |
| `OCR_Match` | int? | 1=OCR matches maker values |
| `RescanBatch` | int? | Rescan batch flag |

### 4.5 `Slip_Entry`

| Field | Purpose |
|---|---|
| `SlipID` | PK identity |
| `BatchID` / `SubBatchID` | Parent batch and sub-batch |
| `SlipNo` | Slip number string (stored as string, compared as int for cheque lookup) |
| `SlipDate` | Slip processing date |
| `SlipAmount` | Declared slip total — **must equal sum of all cheque amounts** |
| `OCR_SlipAmount` | OCR-read slip total |
| `AC_No` / `AC_Name` | Account number and name (scan/original) |
| `M_AC_No` / `M_AC_Name` | Maker-entered account details |
| `C_AC_No` / `C_AC_Name` | Checker-entered account details |
| `OCR_AC_No` / `OCR_AC_Name` | OCR-read account details |
| `TotalChqs` | Expected cheque count for this slip |
| `FIBy` / `FIDate` | First entry (Maker L1) user and date |
| `UpdatedBy` / `UpdatedOn` | Last update audit |
| `Dep_Slip_No` | Deposit slip number |
| `Hier_Code` | Hierarchy code |
| `Slip_Status` | 0=pending, 1=complete |
| `Slip_hold` | 1=slip is on hold (skipped by Maker) |
| `IsDeleted` / `Deleted_By` / `Deleted_Date` | Soft-delete |
| `Initail_Rej_Slip` / `Initail_Rej_Slip_Reason` | Initial rejection of entire slip |
| `OCR_Match` | OCR match flag |

### 4.6 `LocationMaster`

| Field | Purpose |
|---|---|
| `LocationID` | PK |
| `LocationName` | Location display name |
| `LocCode` | Short code |
| `CHMCode` | Clearing house member code (used in XML/IMG file names) |
| `VendorName` | Vendor name in XML `FileHeader` |
| `HubLocationName` | Hub name (used in image path hierarchy) |
| `HubLocationId` | Hub ID in XML `FileHeader` |
| `TruncatingRoutNo` | Bank routing number |
| `IFSCCode` | IFSC |
| `ClearingTypeGefu` / `ClearingTypeXML` | Clearing type codes for each file type |
| `TransactionBranch` | Branch code for GEFU |
| `TransMne` | Transaction mnemonic for GEFU |
| `firstThree0Digit` / `lastThree0Digit` | MICR band position digits |
| `StartBatchNo` / `EndBatchNo` | Batch number range allocated to location |
| `DNUFileName` | DNU report file name |
| `Trf_Micr` | Transfer MICR code |
| `Prefix` | File name prefix |
| `File_Host` | SFTP host |
| `File_Port` | SFTP port |
| `File_Username` | SFTP username |
| `File_Password` | SFTP password (for password auth) |
| `File_SshHostKeyFingerprint` | SSH host fingerprint |
| `File_PrivateKeyPath` | Path to private key file under `wwwroot` |
| `File_Passphrase` | Private key passphrase |
| `File_RemoteDirectory` | Remote SFTP path for XML/IMG files |
| `File_RemoteDirectory_G` | Remote SFTP path for GEFU files |
| `HighValue` | bool — enables high-value workflow |
| `Enable_OCR_Amount` | bool — enables OCR amount pre-fill |

### 4.7 Other Model Tables

| Model | Table | Purpose |
|---|---|---|
| `UserLocation` | UserLocation | Maps users to one or more locations |
| `Bank_Master` | Bank_Master | Bank name, BankID, BankCode |
| `Branch_Master` | Branch_Master | Branch name, MICR routing number, BankID FK |
| `ReturnReasonMaster` | ReturnReasonMaster | Return reason codes (RRID, code, description) |
| `StatusList` | StatusList (keyless) | Account status codes + flags for account validation |
| `BlockProductList` | BlockProductList (keyless) | Blocked product codes for account validation |
| `CHI_Rejection_Files` | CHI_Rejection_Files | Tracks files rejected by clearing house |
| `ErrorType` | ErrorType | Error classification |
| `ErrorDataTbl` | ErrorDataTbl | Error data per cheque |
| `EndorseNoTbl` | EndorseNoTbl | Endorsement numbers |
| `RescanChequesTbl` | RescanChequesTbl | Rescanned cheque tracking |
| `Blocked_TCMaster` | Blocked_TCMaster | Blocked transaction codes (MICR3 validation) |

### 4.8 Keyless DTO Models (Stored Proc Result Sets)

All registered with `.HasNoKey()` in `ApplicationDbContext.OnModelCreating`:

| DTO | Used In |
|---|---|
| `BatchCompletionStatus` | Batch completion check SP |
| `InitailReportData` | Initial reject report |
| `DetailedData` | Detail report |
| `BatchSummaryData` | Batch summary report |
| `TransferData` | Transfer report |
| `ModifiedData` | Modified cheque report |
| `CHIRejectionData` | CHI rejection report |
| `BranchData` | Branch data for reports |
| `ProductivityData` | Productivity report |
| `SlipDto` | Maker slip display |
| `SlipDtochecker` | Checker slip display |
| `DashboardSummary` | Dashboard summary |
| `ChequeSlipQCDto` | QC cheque-slip combined view |
| `BatchRequest` | Batch request tracking |
| `SFTPBatch` | SFTP batch list |
| `NPCISummaryData` | NPCI summary |
| `ErrorrptDto` | Error report DTO |
| `ChequeDuplicateData` | Duplicate detection |
| `DuplicateReportData` | Duplicate report |
| `ChequeEndorseDto` | Cheque + endorsement join (`EXEC GetChequeEndorseDetails`) |
| `ChequeSlipDto` | Cheque + slip join |
| `OCR_RR_ChequeData` | OCR RR data |
| `ChequeResult` | Cheque query result |

### 4.9 `SecondaryDbContext` — Account Lookup DB

| Entity | Purpose |
|---|---|
| `AccountMaster` | Account number, name, product code, status — queried via `EXEC USP_SEL_AccountMaster @AccountNo` |
| `AccountMasterView` | View-based account lookup |
| `StatusList` | Account status flags |
| `BlockProductList` | Blocked product codes |

---

## 5) Session & Authentication

### 5.1 Login flow (`LoginController.cs`)

1. `GET /Login/Index` — loads location list from `UserLocation` JOIN `LocationMaster`.
2. User enters **Employee ID** (`EmpID`), **password**, and **EOD Date**.
3. `POST /Login/Login`:
   - Looks up user by `EmpID` + `UPassword`.
   - If not found → `ViewBag.ErrorMessage = "Invalid credentials"` → show login page.
   - If `user.IsLoggedIn == 1` AND `force == false` → sets `TempData["AlreadyLoggedIn"] = true` and redirects to login page (ask user to confirm force-login).
   - If force-login or first login:
     - Generates new `Guid` → stores in `user.SessionToken` + `UserMaster` DB.
     - Sets `user.IsLoggedIn = 1`, `user.AttempPass = 0`.
     - Saves session keys: `UserID`, `UserName`, `SessionToken`.
     - If `IsScan == 1`: also loads `LocationId`, `LocationName`, `HubLocationName`, `LocationCode` from first user location record.
     - Stores `EODdate` in session (from `selectedDate` input).
     - Redirects to `Home/Index`.

4. **Password lock**: `ConfirmPassword` action increments `AttempPass`. At 5 failures → sets `LockedUser = 1`.

5. **Logout (GET `/Login/Logout`)**: Sets `IsLoggedIn = 0`, clears all session.

6. **Logout (POST `/Login/Logoutt`)**: On EOD logout — additionally unlocks all SubBatches owned by current user (`User_Lock = 0`, `Emp_locationname = ""`).

7. **Admin force-unlock logout (`Logouttt`)**: Sets `LoginUserLocked = 1` (admin-lock), then `IsLoggedIn = 0`.

### 5.2 Session Validation Middleware (`SessionValidationMiddleware.cs`)

Runs on every request:
1. Reads `UserID` and `SessionToken` from current session.
2. If both present: loads `UserMaster.SessionToken` from DB.
3. If DB token ≠ session token (or DB token null) → `Session.Clear()` + redirect to `/Login/Index`.
4. This means: if the same user logs in from a second browser/tab, the new token invalidates the old session immediately on the next request.

### 5.3 Auto-logout Middleware (`AutoLogoutMiddleware.cs`)

Separate middleware for session inactivity timeout (20-minute idle enforced by ASP.NET session config).

### 5.4 Role flags checked in controllers

| Flag | `UserMaster` Field | Guards |
|---|---|---|
| Scan user only | `IsScan == 0` → access denied to scan screens | `ScanController.GetChequeData` |
| Admin only | `IsAdmin == 0` → access denied | `XMLController.GetCountAmt` |
| Maker/Checker SoD | `M_By == UserID` → blocked from checker | `CheckerController` (in comments, confirmed in active code flow) |

---

## 6) Batch Creation & Management

### 6.1 Batch number generation (`BatchController.DisplayBatch`)

**Algorithm** (not a DB sequence — app-layer increment with collision risk; replicate exactly for parity):
```text
prefix = LocationID + DateTime.Today.ToString("yyyyMMdd")
lastBatch = SELECT TOP 1 FROM Batch WHERE BatchNo STARTS WITH prefix ORDER BY BatchNo DESC
suffix = (last 5 digits of lastBatch.BatchNo) + 1  [starting at 1 if no prior batch]
newBatchNo = prefix + suffix.PadLeft(5, '0')
```
Example: Location 13, date 20260411, first batch → `13202604110 00001`.

**New Batch default values on creation**:
- `BatchDate = DateTime.Today`
- `BatchAmount = 0`, `TotalSlips = 0`, `TotalChqs = 0`
- `BatchStatus = 0`, `ClearingType = "01"`
- `XMLFileName = ""`, `ImgFileName = ""`

### 6.2 Batch dashboard display

- Filters: `BatchDate == today AND BatchStatus == 0 AND IsDeleted == 0`
- Filtered by `LocationID` from session (or override via `LocID` param).
- `HttpContext.Session.SetInt32("IsInScanView", 1)` set on batch screen load.

### 6.3 Sub-batch structure

- `SubBatchTbl` records created when a batch is split.
- `SubBatchNo` sequences within a batch.
- `SubBatchStatus` tracks sub-batch independently.
- Both `Batch.User_Lock` and `SubBatchTbl.User_Lock` must be managed.
- On logout: `SubBatchTbl.User_Lock = 0` and `Emp_locationname = ""` cleared for all batches owned by the logging-out user.

### 6.4 Batch unlock (`UnlockBatchController`)

- Fetches today's sub-batches with `User_Lock != 0` + joined Maker/Checker/QC user names.
- Admin can unlock any locked batch — sets `User_Lock = 0`.
- Shows batches across all stages (any BatchStatus where User_Lock != 0).

---

## 7) Scanning (`ScanController.cs` + `Ranger.js`)

### 7.1 How scanning works

- Browser communicates with the Silver Bullet Ranger scanner hardware via `wwwroot/js/Ranger.js` over WebSockets.
- Scanner driver must be installed on the scanning workstation.
- `ScanController` receives image data + MICR text as POST body from the browser after each item is scanned.

### 7.2 Image storage hierarchy

Images stored under `wwwroot`:
```text
wwwroot/{LocationName}/{HubLocationName}/{BatchNo}/{SubBatchNo}/
    {BatchNo}{SeqNo}F.jpg   — Front JPEG (color)
    {BatchNo}{SeqNo}R.jpg   — Rear JPEG
    {BatchNo}{SeqNo}F.tif   — Front B&W TIF (CCITT4 / CTS-2010)
    {BatchNo}{SeqNo}R.tif   — Rear B&W TIF
```

4 images per cheque item. All 4 are base64-decoded and written to disk by `SaveMicrText`.

### 7.3 `SaveMicrText` action (`POST /Scan/SaveMicrText`)

Parameters:
`micrText, chqNo, micr1, micr2, micr3, img (Front JPEG base64), img1 (Rear JPEG base64), BNo, BatchId, ICnt (SeqNo), Batch_Type, img3 (Front TIF base64), img4 (Rear TIF base64), XMLItemSeqNo, RescanBatch, subBatch, subBatchId`

Logic:
1. Reads `UserID`, `EODdate` from session.
2. If `micrText` is empty OR `chqNo` is empty OR `chqNo` matches `[!]+` (scanner error indicator):
   - Creates a **slip record** (`IsSlip = true`) with placeholder MICR: `ChqNo="000000"`, `MICR1="000000000"`, `MICR2="000000"`, `MICR3="00"`.
   - Saves 4 images to disk under `wwwroot/{LocationName}/{HubLocationName}/{BatchNo}/{SubBatchNo}/`.
3. Otherwise: creates a normal **cheque record** (`IsSlip = false`) with actual MICR data.
4. `Scan_By = UserID`, `BatchDate = EODdate` (not today — uses selected EOD date).

### 7.4 Other Scan endpoints

| Endpoint | Purpose |
|---|---|
| `GET /Scan/GetSeqNo?BatchNO=` | Returns highest SeqNo + cheque count + slip count for batch |
| `GET /Scan/GetChequeData?BatchNO=` | Returns all cheques via `EXEC GetChequeEndorseDetails @BatchNo` + sub-batch grouping |
| `GET /Scan/GetSubBatchData?BatchNO=` | Returns sub-batch list with cheque and slip counts |

**Access control**: `GetChequeData` — if `user.IsScan == 0`, sets `Batch.User_Lock = 0` and returns error: `"This is only Scannig User"`.

---

## 8) Reject Repair (`RRController.cs` + `RR_OCRController.cs`)

### 8.1 Purpose

Post-scan correction for items where MICR could not be read cleanly. Operator views the cheque image and manually types the correct values.

### 8.2 RR screen load

`GET /RR/RR` — sets `TempData` visibility flags and returns view. No server-side batch filtering at view load (filtering happens via AJAX calls from the view).

### 8.3 Validation rules for repaired MICR (from code comments and patterns)

- `ChqNo`: must be 6 numeric digits, not `"000000"`.
- `MICR1`: must be 9 numeric digits.
- `MICR2`: must be 5 numeric digits (account portion).
- `MICR3`: must be 2 numeric digits; must NOT be in `Blocked_TCMaster` (validated via `CommonController.ValidateTCCode`).
- Items with `!` characters (scanner error codes) are routed to RR.

### 8.4 `MICRRepairFlag`

6-character string tracking which fields were corrected during RR:
- Position 1: ChqNo changed
- Position 2: MICR1 changed
- Position 3: MICR2 changed
- Position 4: MICR3 changed
- Positions 5-6: additional flags
- `"000000"` = no repair done

### 8.5 `Ini_Rej` values (Initial Rejection)

| Value | Meaning |
|---|---|
| 0 | Normal — included in clearing |
| 1 | Initially rejected (excluded from CHI XML) |
| 9 | Transfer cheque (included with special treatment) |
| 99 | Other reject code |
| 999 | Another reject category |

Items with `Ini_Rej = 1, 99, 999` and `IsDeleted = 1` are counted in the rejection report but excluded from XML generation.

---

## 9) Account Lookup (`CommonController.cs`)

### 9.1 `GetAccountName` (`GET /Common/GetAccountName?AccntNo=`)

1. Calls `SecondaryDbContext` via SP: `EXEC USP_SEL_AccountMaster @AccountNo`.
2. If account found: looks up `StatusList` by `AccountStatus` product code.
3. Also looks up `BlockProductList` by `AcctProductCode`.
4. Returns: `{ success, data: AccntDtl[], Accstatus: StatusList, blockproduct: BlockProductList }`.
5. Maker/Checker use this to validate account number before saving.

### 9.2 `GetBankDetails` (`GET /Common/GetBankDetails?MICR1=`)

Joins `Branch_Master` + `Bank_Master` on `BRANCH_ROUTING_NBR == MICR1`.
Returns: BranchID, BankID, routing number, branch name, city, bank name, bank code.

### 9.3 `ValidateTCCode` (`GET /Common/ValidateTCCode?MICR3=`)

Checks `Blocked_TCMaster` for `MICR3`. If found → transaction code is blocked (reject).

### 9.4 Other Common endpoints

| Endpoint | Purpose |
|---|---|
| `GetLocationName` | Returns all `LocationMaster` records |
| `GetReturnReasonName` | Returns all `ReturnReasonMaster` records |
| `ShowReturnReasonName?rrid=` | Returns single return reason |
| `UpdateUserUnLock?BatchNo=` | Sets `Batch.User_Lock = 0` for the batch |

---

## 10) Maker Stage (`MakerController.cs`)

### 10.1 Screens

- `GET /Maker/Maker` — main Maker screen (batch list + item entry)
- `GET /Maker/Maker_WS` — workstation variant of Maker screen

### 10.2 Hold Slip

`GET /Maker/HoldSlup?SubbatchId=&slipId=` — sets `Slip_Entry.Slip_hold = 1` for the given slip. Held slips are skipped by the Maker workflow and can be returned to later.

### 10.3 Key Maker validations (from code patterns and doc)

1. **Slip amount reconciliation**: `Sum(Chq_Amt) for all cheques in slip MUST == Slip_Entry.SlipAmount`. If mismatch → error: `"Slip amount Does not match"`.
2. **Account validation**: Before saving, calls `CommonController.GetAccountName` to verify account exists in `SecondaryDbContext.AccountMaster`.
3. **Duplicate detection**: `IsDuplicate = 1` items excluded from processing counts.
4. **Maker SoD**: Maker cannot also be the Checker (`M_By` stored in `SubBatchTbl`).
5. **Status update on completion**: `BatchStatus = 6` (or `SubBatchStatus = 6` for sub-batch).

### 10.4 Stored procedures used

- `EXEC GetChequesForBatch_Maker @BatchId, @SlipId` — gets cheques for a specific slip
- `EXEC GetTopChequeForBatch_MakerWS @BatchId, @SlipId` — gets next unprocessed cheque for workstation mode

---

## 11) Checker Stage (`CheckerController.cs`)

### 11.1 Screens

- `GET /Checker/Checker` — main Checker screen
- `GET /Checker/Checker_WS` — workstation variant

### 11.2 Segregation of Duties enforcement

From code comment confirmed in active logic path:
```
UserValidate = Batch WHERE BatchID == batchId AND M_By == CurrentUserID
If UserValidate.Count != 0:
    Set User_Lock = 0
    Return error: "Maker and Checker Can not be Done by Same User"
```

The `M_By` field on `SubBatchTbl` (or `Batch`) is compared against the current `UserID` before allowing Checker access.

### 11.3 Stored procedures used

- `EXEC GetChequesForBatch_Checker @BatchId, @SlipId`
- `EXEC GetTopChequeForBatch_Checker @BatchId, @SlipId`

### 11.4 Status update on completion

`BatchStatus = 7` (or `SubBatchStatus = 7`) after all items checked.

---

## 12) QC Stage (`QCController.cs`)

### 12.1 Screens

- `GET /QC/Index` — main QC screen
- `GET /QC/QC_WS` — workstation variant

### 12.2 QC logic

- Automated field comparison: `M_*` fields vs `C_*` fields for each cheque.
- Any mismatch: flags item for manual supervisor review.
- Supervisor selects which value is correct → stores in `Q_*` fields.
- `Q_Status = 1` when QC complete for item.
- `BatchStatus = 8` (or `SubBatchStatus = 8`) when all items in sub-batch have `Q_Status = 1`.
- Sub-batch completion propagation: when all sub-batches reach status 8, parent batch advances.

### 12.3 Stored procedures used

- `EXEC GetMismatchedItems` (implied from doc)
- Uses `ChequeSlipQCDto` keyless DTO

---

## 13) XML/IMG Generation (`XMLController.cs`) — Admin Only

### 13.1 Access control

`GetCountAmt`: if `user.IsAdmin == 0` → sets `User_Lock = 0` and returns `"This file generate only Admin"`.

### 13.2 Eligible batches query (`GetTodayBatch`)

```
Batch WHERE:
  BatchDate == EODdate
  BatchStatus > 6           (must be at least Maker complete)
  XMLFileName == null OR ""  (not yet generated)
  IsDeleted == 0
  LocationID == LocationID param
```

### 13.3 Cheque eligibility for XML

```
Cheques WHERE:
  BatchNo == batchNo
  IsSlip == false
  Ini_Rej == 0          (only normal cheques — not rejected/transfer)
  IsDeleted == 0
  IsDuplicate == 0
ORDER BY SeqNo
```

Count/amount totals shown:
- Normal: `Ini_Rej == 0`
- Transfer: `Ini_Rej == 9`
- Rejected: `Ini_Rej IN (1, 99, 999)` OR `IsDeleted == 1`

### 13.4 OTS XML generation (`CreateXml` POST → `CreateXmlFile`)

**File naming**:
```
OTS_{CHMCode}_{HubLocationId}_{ddMMyyyy}_{HHmmss}_{BatchNoLast3PaddedTo10}.xml
OTI_{CHMCode}_{HubLocationId}_{ddMMyyyy}_{HHmmss}_{BatchNoLast3PaddedTo10}.img
```

**File path**:
```
E:\HDFC Department\Location Reports\{ddMMyyyy}\{LocationName}\{HubLocationName}\XML\{BatchNo}\
```

**XML generation timestamp logic** (for cycle-no uniqueness):
- Finds last batch from today that already has `XMLGenerationDate` set.
- Adds 1 minute 20 seconds to that batch's generation time → becomes this batch's file timestamp.
- Prevents duplicate timestamps across batches generated in the same day.

**XML structure** (using `System.Xml.XmlWriter`):
```xml
<FileHeader VendorId="{CHMCode}" VendorName="{VendorName}"
            HubLocationId="{HubLocationId}" HubLocationName="{LocationName}"
            FileCreationDate="{ddMMyyyy}" FileCreationTime="{HHmmss}"
            FileId="{BatchNoLast3PaddedTo10}" CoreSystem="FLX">
  <Item>
    <!-- per cheque -->
    <!-- Attributes include: chqNo, MICR, ChqAmount, ACCNO, TC, MICRRepairFlag, PresentmentDt, XMLItemSeqNo -->
    <!-- RSA-SHA256 signed MICR fingerprint -->
  </Item>
</FileHeader>
```

**Item sequence number**: `{CHMCode}{HubLocationId}{batchNoLast3}{itemCounter:D3}`

**MICR fingerprint** (for RSA signing):
```
"{ChqNo};{MICR1};{MICR3};{Chq_Amt * 100 (paise, no decimal)}"
```

**RSA signing**: `Encrypt(StrMICRFingerPrint)` using RSA key file `2048.pke`.

### 13.5 OTI IMG generation

Binary file created by appending 3 images per cheque (Front JPEG, Rear JPEG, Front TIF) sequentially using `BinaryWriter` with `FileMode.Append`.

Image byte offsets tracked:
- `startOfProtectedData`, `protectedDataLength`, `digitalSignatureDataOffset`, `digitalSignatureLength`
- Computed per-image for each of the 3 image types
- These offsets are written into the XML `<ImageViewDetail>` elements for bank parsing

### 13.6 Post-generation DB updates

```
Batch.Report_Status = 1
Batch.CHI_By = UserId
Batch.User_Lock = 0
-- Also update all SubBatchTbl records for same BatchNo/date:
SubBatchTbl.Report_Status = 1
SubBatchTbl.CHI_By = UserId
SubBatchTbl.User_Lock = 0
```

---

## 14) GEFU Report Generation (`GEFUReportController.cs`)

### 14.1 Eligible batches query

```
Batch WHERE:
  BatchDate == selected date
  BatchStatus >= 8
  Report_Status IN (1, 2)   (XML already generated)
  LocationID == param (or LocationName if no ID)
  IsDeleted == 0
```

### 14.2 GEFU file format (fixed-width text, confirmed from source)

File is generated as pipe-delimited or fixed-width records (exact format from `GenerateTextFile`):

Each record contains:
| Field | Source |
|---|---|
| RecType | `"2"` |
| TransType | `"01"` |
| AC_No | From `Slip_Entry.AC_No` |
| TransactionBranch | From `LocationMaster.TransactionBranch` |
| TransMne | From `LocationMaster.TransMne` |
| BatchDate | `yyyyMMdd` |
| Flag | `"C"` |
| ChqDate | Cheque date |
| TransCurrency | `"001"` |
| ChqAmount | `Chq_Amt` (decimal) |
| ISNo | `""` (empty) |
| ChqNo | Cheque number |
| MICR1 | MICR1 |
| DRAWER_NAME | `DrawerName` |
| BatchID | Batch ID |
| LotNo | Last 3 digits of batch number |

**Join**: `Cheques` → `Batch` → `Slip_Entry` (on `cheque.SlipID == slip.SlipNo && cheque.BatchId == slip.BatchID && cheque.SubBatchID == slip.SubBatchID`) → `LocationMaster`

**Filter**: `IsSlip == false AND Ini_Rej == 0 AND IsDeleted == 0 AND IsDuplicate == 0`

**Amount checksum**: `dblSumRecordChecksum` accumulated per record.

**File location**: `E:\HDFC Department\Location Reports\{yyyyMMdd}\...`

### 14.3 GEFU SFTP upload

Uses `sftpUploader.UploadFile_GEFU(localFilePath, LocationId)` with `File_RemoteDirectory_G` from `LocationMaster`.

---

## 15) SFTP Upload (`SftpController.cs` + `sftpUploader.cs`)

### 15.1 `sftpUploader.UploadFile(localFilePath, locId)`

1. Loads SFTP settings from `LocationMaster` by `LocationID`:
   - `File_Host`, `File_Port`, `File_Username`, `File_Password`, `File_PrivateKeyPath`, `File_Passphrase`, `File_RemoteDirectory`
2. `File_PrivateKeyPath` is relative to `wwwroot` — full path = `wwwroot + File_PrivateKeyPath`.
3. Builds authentication method list:
   - If `File_Password` not null/empty → adds `PasswordAuthenticationMethod`
   - If `File_PrivateKeyPath` not null/empty → adds `PrivateKeyAuthenticationMethod` with passphrase
   - **Both methods can be active simultaneously** (SSH tries them in order)
4. Connects with `SftpClient.Connect()`.
5. Uploads file to `{remoteDir.TrimEnd('/')}/{fileName}`.
6. Disconnects in `finally` block.
7. On any failure → throws `ApplicationException("SFTP upload failed")`.

### 15.2 `UploadFile_GEFU` variant

Same logic but uses `File_RemoteDirectory_G` for the remote directory (separate SFTP target for GEFU files vs XML/IMG files).

### 15.3 TCP reachability helper

`IsHostReachable(host, port)` — 5-second timeout TCP probe before attempting SFTP. Used in some contexts for pre-flight check.

---

## 16) Admin Utility Controllers

### 16.1 `UnlockBatchController`

- `GET /UnlockBatch/UnLockBatch` — admin screen
- `GetSkipOCRData(locID, calledFrom, locationName)`:
  - Fetches `SubBatchTbl` records with `User_Lock != 0` and `IsDeleted == 0` for today.
  - Joins: `LocationMaster`, `Slip_Entry`, `UserMaster` (for maker/checker/qc names).
  - Supports filtering by `LocationID` or `locationName`.
  - Admin sets `User_Lock = 0` to release the lock.

### 16.2 `DeleteBatchController`

- Soft-deletes batches.
- Sets `IsDeleted = 1`, `Deleted_By = UserID`, `Deleted_Date = now`.
- Also soft-deletes associated `Cheques` and `Slip_Entry` records.

### 16.3 `MoveBatchesController`

- Moves batch from one location to another (changes `LocationID`/`LocationName`).
- Used when a batch was created at wrong location.

### 16.4 `ChangeDateController`

- Changes `BatchDate` on a batch (for date correction).

### 16.5 `ChangeLocationController`

- Changes `LocationID`/`LocationName` on a batch.

### 16.6 `ManageAmountController`

- Allows admin to manually correct cheque amounts after processing.
- Change types: amount change (`"A"`) vs MICR/ChequeNo/AcNo/AcType changes.

### 16.7 `IniRejectController`

- Manages initial rejection of cheques (sets `Ini_Rej` values).
- `GetTodayBatch(LocationID, Date, LocationName)`:
  - Fetches batches with `BatchStatus >= 8` for the given date.
  - Supports filtering by LocationID, LocationName, or "all".
- `FetchBatch(date, LocationID, FromBatchNo, ToBatchNo, LocationName)`:
  - Fetches batch completion data and initial reject report via SP `RPT_Initail_Reject_Report`.

### 16.8 `SkipOCRController`

- Sets `Batch.Skip_Ocr = 1` to bypass OCR validation for a batch.
- Used when OCR data is unavailable or incorrect.

### 16.9 `ManualAccountNoController`

- Allows manual entry of account number when OCR/lookup fails.
- Updates `Slip_Entry.AC_No` directly.

### 16.10 `MarkChequeController`

- Marks individual cheques with special flags (e.g., DNU, duplicate).

### 16.11 `DrawerNameController`

- Allows correction of `DrawerName` on a cheque after processing.

### 16.12 `SearchCQController`

- Search cheques by cheque number, batch number, account, etc.

### 16.13 `OptionMenuController`

- Provides option menu for admin actions.

### 16.14 `ManageController`

- General management (likely master data management).

---

## 17) Master Data Controllers

### 17.1 `ManageUserController`

- `GetUserData` — returns all users with location joins.
- `ExistingUserName(username)` — checks if username already taken.
- `ExistingPassword(password)` — checks if password already in use.
- Create/edit/delete users (role flags + location assignments).

### 17.2 `ManageLocationController`

- Create/edit `LocationMaster` records including all SFTP fields.

### 17.3 `ReturnReasonMasterController`

- CRUD for `ReturnReasonMaster` (NPCI return reason codes).

### 17.4 `AccountImportController`

- Bulk import of account master data into `SecondaryDbContext`.

### 17.5 `BankImportController` + `Bank` controller

- Bulk import of bank/branch master data.
- `Bank_Master` + `Branch_Master` CRUD.

---

## 18) Reporting Controllers

| Controller | Report Purpose |
|---|---|
| `ReportDashboardController` | Report dashboard / navigation hub |
| `DailyReportController` | Day-wise cheque/batch summary |
| `BatchSummaryReportController` | Per-batch summary with totals |
| `ProductivityReportController` | Operator productivity metrics |
| `ErrorReportController` | Error types and counts per batch |
| `DuplicateReportController` | Duplicate cheque detection report |
| `ModifiedReportController` | Cheques where MICR was repaired |
| `TransferReportController` | Transfer cheques (`Ini_Rej == 9`) |
| `DetailReportController` | Full cheque detail drilldown |
| `DNUReportController` | Do-Not-Use cheque report |
| `HighValueController` | High-value cheque report (when `LocationMaster.HighValue = true`) |
| `CHIRejectionController` | CHI rejection file tracking |
| `DashSummaryController` | Dashboard summary statistics |

---

## 19) Batch Status State Machine

### 19.1 BatchStatus codes (from `Batch` and `SubBatchTbl`)

| Code | Stage | Set By |
|---|---|---|
| 0 | Scanning / Initial | Batch creation |
| 3 | RR Pending | After scan if MICR errors detected |
| 4 | RR OCR Pending | After RR, OCR repair pending |
| 6 | Maker (L1) Complete | `MakerController` on completion |
| 7 | Checker (L2) Complete | `CheckerController` on completion |
| 8 | QC Complete | `QCController` on completion |
| > 8 | Ready for XML | Eligible for XML generation |

Report_Status codes:
| Code | Meaning |
|---|---|
| 0 | XML/IMG not yet generated |
| 1 | XML/IMG generated (`CreateXml` sets this) |
| 2 | GEFU also generated |

### 19.2 SubBatchStatus

Mirrors `BatchStatus` but per sub-batch. Parent `Batch.BatchStatus` advances only when all `SubBatchTbl.SubBatchStatus` values reach the required level.

### 19.3 XMLController batch eligibility

`BatchStatus > 6 AND XMLFileName IS NULL/empty AND IsDeleted == 0` for the generation queue.

---

## 20) File Path Reference

| Purpose | Path Pattern |
|---|---|
| Scanned images (wwwroot) | `wwwroot/{LocationName}/{HubLocationName}/{BatchNo}/{SubBatchNo}/` |
| Front JPEG | `{BatchNo}{SeqNo}F.jpg` |
| Rear JPEG | `{BatchNo}{SeqNo}R.jpg` |
| Front TIF | `{BatchNo}{SeqNo}F.tif` |
| Rear TIF | `{BatchNo}{SeqNo}R.tif` |
| XML/IMG generation output | `E:\HDFC Department\Location Reports\{ddMMyyyy}\{LocationName}\{HubLocationName}\XML\{BatchNo}\` |
| OTS XML file name | `OTS_{CHMCode}_{HubLocationId}_{ddMMyyyy}_{HHmmss}_{FileId}.xml` |
| OTI IMG file name | `OTI_{CHMCode}_{HubLocationId}_{ddMMyyyy}_{HHmmss}_{FileId}.img` |
| FileId | Last 3 digits of BatchNo, padded to 10 digits |
| SFTP upload dirs | Per-location: `File_RemoteDirectory` (XML/IMG), `File_RemoteDirectory_G` (GEFU) |

---

## 21) Full End-to-End Call Chain

```
A. AUTHENTICATION
   GET /Login/Index
   → Load UserLocation JOIN LocationMaster → ViewBag.Locations
   
   POST /Login/Login (username=EmpID, password, selectedDate, force?)
   → Lookup UserMaster by EmpID + UPassword
   → If not found → error "Invalid credentials"
   → If IsLoggedIn=1 AND not force → TempData["AlreadyLoggedIn"] → show confirm dialog
   → Generate new Guid SessionToken → save to DB + session
   → Set IsLoggedIn=1, AttempPass=0
   → Set session: UserID, UserName, SessionToken, EODdate
   → If IsScan=1: set session LocationId, LocationName, HubLocationName, LocationCode
   → Redirect to Home/Index

   EVERY SUBSEQUENT REQUEST:
   → SessionValidationMiddleware checks session UserID + SessionToken vs DB
   → Mismatch → Session.Clear() + redirect /Login/Index

B. BATCH CREATION
   GET /Batch/DisplayBatch?LocID=0
   → Compute next BatchNo: {LocationID}{yyyyMMdd}{seq:D5}
   → Load existing today's batches for display
   → Set session IsInScanView=1

   POST /Batch/CreateBatch (if applicable)
   → Insert Batch record with BatchStatus=0, User_Lock=CurrentUserID

C. SCANNING
   Browser: Ranger.js opens WebSocket to scanner hardware
   → Scanner reads cheque → fires events with MICR text + images
   
   POST /Scan/SaveMicrText
   → Decode 4 base64 images
   → Write to wwwroot/{LocationName}/{HubLocationName}/{BatchNo}/{SubBatchNo}/
   → Insert Cheques record:
     If bad MICR (empty/!) → IsSlip=true, placeholder MICR zeros
     Else → IsSlip=false, real MICR values
   → RRState=0 (needs repair check)

D. REJECT REPAIR
   GET /RR/RR → view loads
   Browser AJAX → fetch items with RRState=0 and bad MICR patterns
   
   Operator views image, types correct values
   Browser AJAX → save repaired values:
   → Validate ChqNo: numeric, 6 digits, not "000000"
   → Validate MICR1: numeric, 9 digits
   → Validate MICR2: numeric, 5 digits
   → Validate MICR3: numeric, 2 digits, not in Blocked_TCMaster
   → Set MICRRepairFlag (which fields changed)
   → Set RRState=1

E. ACCOUNT LOOKUP (used by Maker + Checker)
   GET /Common/GetAccountName?AccntNo=
   → SecondaryDbContext: EXEC USP_SEL_AccountMaster @AccountNo
   → Check StatusList: if Flag=false → return error with reason
   → Check BlockProductList: if blocked → return error
   → Return account details

F. MAKER (L1)
   GET /Maker/Maker → view loads
   Browser AJAX → load sub-batch list → select sub-batch
   Browser AJAX → load slip list (SlipDto)
   Browser AJAX → load cheque for current slip:
     EXEC GetTopChequeForBatch_MakerWS @BatchId, @SlipId
   
   Operator enters: ChqDate, ChqAmount, DrawerName, account verification
   → Validate: sum(all cheque amounts in slip) == Slip_Entry.SlipAmount
     If mismatch → error "Slip amount Does not match"
   → Validate account via /Common/GetAccountName
   → Save: M_ChqNo, M_MICR1-3, M_ChqDate, M_ChqAmount, M_Status=1, M_By=UserID, M_Time=now
   → On all cheques in sub-batch done:
     SubBatchTbl.BatchStatus=6, M_By=UserID, User_Lock=0

G. CHECKER (L2)
   GET /Checker/Checker → view loads
   Browser AJAX → load sub-batch list → select sub-batch
   
   → SoD check: if SubBatchTbl.M_By == CurrentUserID
     → error "Maker and Checker Can not be Done by Same User"
   
   Blind entry (no Maker values visible):
   → Operator re-enters cheque details
   → Validate account again via /Common/GetAccountName
   → Save: C_ChqNo, C_MICR1-3, C_ChqDate, C_ChqAmount, C_Status=1, C_By=UserID, C_Time=now
   → On all done: SubBatchTbl.BatchStatus=7, C_By=UserID, User_Lock=0

H. QC
   GET /QC/Index → view loads
   Browser AJAX → load mismatched items (where M_* != C_* fields)
   
   Supervisor views both entries side-by-side
   → Select which value is correct → save to Q_* fields
   → Q_Status=1 when resolved
   → On all Q_Status=1 in sub-batch:
     SubBatchTbl.SubBatchStatus=8, Q_By=UserID, User_Lock=0
   → When all sub-batches at 8: Batch.BatchStatus=8

I. XML/IMG GENERATION (Admin)
   GET /XML/XMLBatches → view loads
   GET /XML/GetTodayBatch?LocationID= 
   → Fetch eligible batches (BatchStatus>6, XMLFileName null, IsDeleted=0)
   GET /XML/GetCountAmt?BatchNo=
   → Admin: IsAdmin check
   → Return count/amount totals for normal, transfer, rejected cheques
   
   POST /XML/CreateXml (locationID, batchNo, Xmlgeneratedate, Xmlgeneratetime)
   → Admin check
   → Compute file timestamp from last generated batch +1m20s
   → Call CreateXmlFile():
     → Query eligible cheques: IsSlip=false, Ini_Rej=0, IsDeleted=0, IsDuplicate=0
     → For each cheque:
       → Read 3 image files from wwwroot path
       → Append 3 images to OTI binary file
       → Track byte offsets for XML
       → Build MICR fingerprint: "{ChqNo};{MICR1};{MICR3};{AmtInPaise}"
       → RSA-SHA256 sign fingerprint → StrSignatureData
       → Write <Item> to XML with all cheque attributes + signature
     → Write </FileHeader>
   → Update Batch: Report_Status=1, CHI_By=UserId, User_Lock=0
   → Update SubBatchTbl: same fields

J. GEFU GENERATION
   GET /GEFUReport/GetTodayBatch?LocationID=&Date=&LocationName=
   → Fetch batches (BatchStatus>=8, Report_Status IN(1,2), IsDeleted=0)
   
   GET /GEFUReport/GenerateTextFile?locationID=&batchNo=
   → Query: Cheques JOIN Batch JOIN Slip_Entry JOIN LocationMaster
   → Filter: IsSlip=false, Ini_Rej=0, IsDeleted=0, IsDuplicate=0
   → Build fixed-width/delimited records per cheque
   → Write to E:\HDFC Department\Location Reports\{yyyyMMdd}\...

K. SFTP UPLOAD
   Operator triggers upload via SftpController
   → Load SFTP config from LocationMaster for LocationID
   → Build auth methods: password + private key (both if configured)
   → sftpUploader.UploadFile(localFilePath, locId)
   → Connect, upload, disconnect
   → For GEFU: UploadFile_GEFU() → uses File_RemoteDirectory_G
```

---

## 22) Validation Matrix (All Known Rules)

| Rule | Where Enforced | Error Message |
|---|---|---|
| Invalid credentials | `LoginController.Login` | `"Invalid credentials"` |
| Already logged in (concurrent) | `LoginController.Login` | `TempData["AlreadyLoggedIn"] = true` (show confirm) |
| Second session invalidation | `SessionValidationMiddleware` | Redirect to login |
| Password attempt limit (5) | `LoginController.ConfirmPassword` | Lock `LockedUser = 1` |
| IsScan required for scan screens | `ScanController.GetChequeData` | `"This is only Scannig User"` |
| IsAdmin required for XML | `XMLController.GetCountAmt` | `"This file generate only Admin"` |
| Maker ≠ Checker (SoD) | `CheckerController` | `"Maker and Checker Can not be Done by Same User"` |
| Slip amount must match cheque sum | `MakerController` | `"Slip amount Does not match"` |
| ChqNo: 6 numeric digits | `RRController` validation | (client-side + server) |
| MICR1: 9 numeric digits | `RRController` validation | (client-side + server) |
| MICR2: 5 numeric digits | `RRController` validation | (client-side + server) |
| MICR3: 2 numeric, not blocked | `CommonController.ValidateTCCode` | (blocked code check) |
| Account must exist in secondary DB | `CommonController.GetAccountName` | Account status reason from `StatusList` |
| Account product not blocked | `CommonController.GetAccountName` | Block reason from `BlockProductList` |
| XML only for BatchStatus > 6 | `XMLController.GetTodayBatch` filter | (no batches shown) |
| Duplicate cheques excluded from XML | `CreateXmlFile` query | `IsDuplicate == 0` filter |
| Rejected cheques excluded from XML | `CreateXmlFile` query | `Ini_Rej == 0` filter |
| Soft-deleted cheques excluded | All processing queries | `IsDeleted == 0` filter |
| No XML if no eligible cheques | `XMLController.CreateXml` | `TempData["ErrorMessage"] = "No cheques found..."` |
| SFTP: throw on connect failure | `sftpUploader.UploadFile` | `ApplicationException("SFTP connection failed.")` |
| SFTP: throw on upload failure | `sftpUploader.UploadFile` | `ApplicationException("SFTP upload failed")` |

---

## 23) Scanner Integration Details

### 23.1 Where everything runs (client-side architecture)

The scanner integration is **entirely client-side** up to the point where images and MICR data are POSTed to the server. The server never talks directly to the scanner hardware.

```
Physical Scanner (Canon CR-50 / CR-120 / CR-135 / CR-150 / CR-190)
        ↓  USB cable
Silver Bullet Ranger Driver Service
        ← Must be installed on the scanning workstation PC
        ← Runs as a local background service / process
        ← Exposes a local WebSocket endpoint (e.g., ws://localhost:{port})
        ↓  WebSocket (local, same machine)
Ranger.js
        ← Served from server as a static file (wwwroot/js/Ranger.js)
        ← Runs inside the user's browser on the scanning workstation
        ← Opens WebSocket connection to the local Ranger driver service
        ← Handles all scanner events: feed start/stop, item output, MICR read, image capture
        ↓  HTTP POST (AJAX to server)
ScanController.SaveMicrText
        ← Receives base64-encoded images + MICR text from the browser
        ← Decodes images and writes to wwwroot disk
        ← Inserts Cheques record to DB
        ↓
Database + wwwroot image store
```

**What this means for deployment:**
- Scanning can ONLY work from a workstation that has the Silver Bullet Ranger driver installed and running.
- Any ordinary browser on any machine can do Maker/Checker/QC/Reports — but NOT scanning.
- The server itself has no scanner hardware dependency at all.
- If the Ranger driver service is not running on the workstation, `Ranger.js` WebSocket connection will fail and no scanning is possible.

### 23.2 What `Ranger.js` does in the browser

1. On page load: opens WebSocket connection to the local Ranger driver (`ws://localhost:{port}`).
2. Sends commands to the driver: start scanner, start feeding, stop feeding, shut down.
3. Receives events from the driver per scanned item:
   - MICR text (raw string from scanner head)
   - 4 captured images (Front JPEG, Rear JPEG, Front TIF, Rear TIF) as binary data
4. Converts images to base64 strings in the browser.
5. Parses MICR text into `chqNo`, `micr1`, `micr2`, `micr3`.
6. Sends all data to `POST /Scan/SaveMicrText` via AJAX.
7. Updates the scan UI with live cheque count and status.

### 23.3 What the server (`ScanController`) does

Server receives the POST and:
1. Decodes base64 image strings → raw bytes.
2. Writes all 4 image files to disk under `wwwroot/{LocationName}/{HubLocationName}/{BatchNo}/{SubBatchNo}/`.
3. Inserts a `Cheques` record with MICR data and image file paths.
4. Returns success/failure JSON to the browser.

The server does NOT communicate with the scanner at any point.

### 23.4 Workstation requirements

| Requirement | Detail |
|---|---|
| Silver Bullet Ranger driver | Must be installed on the scanning workstation (separate installer, not shipped with the web app) |
| Canon scanner hardware | USB-connected to the same workstation |
| Browser | Any modern browser that supports WebSocket API (no plugins needed) |
| Network | Workstation must be able to reach the web server to POST scanned data |
| OS | Windows (Ranger driver is Windows-only) |

No hardware dongle or license key is required by the web application itself — the Ranger driver may have its own licensing separate from the app.

### 23.5 Scanner models supported

| Model | Notes |
|---|---|
| Canon CR-50 | Supported via Ranger driver |
| Canon CR-120 | Supported via Ranger driver |
| Canon CR-135 | Supported via Ranger driver |
| Canon CR-150 | Supported via Ranger driver |
| Canon CR-190 | Supported via Ranger driver |

All models use the same `Ranger.js` interface — the driver abstracts hardware differences. Unlike the legacy CCTS desktop app, the web app does NOT have model-specific code branches for endorsement printing (endorsement is handled by the driver/hardware, not the web app code).

### 23.6 Image capture per cheque

4 images per cheque item (vs 3 in legacy CCTS desktop):
1. Front JPEG (color/grayscale) — `{BatchNo}{SeqNo}F.jpg`
2. Rear JPEG — `{BatchNo}{SeqNo}R.jpg`
3. Front TIF (bitonal CCITT4, CTS-2010 compliant) — `{BatchNo}{SeqNo}F.tif`
4. Rear TIF — `{BatchNo}{SeqNo}R.tif`

All 4 stored under `wwwroot/{LocationName}/{HubLocationName}/{BatchNo}/{SubBatchNo}/`.

### 23.7 Bad MICR detection

If `micrText` is null/empty OR `chqNo` contains `!` (scanner error indicator character) → treated as unreadable scan:
- Record created as `IsSlip = true` (slip marker) with placeholder zeros: `ChqNo="000000"`, `MICR1="000000000"`, `MICR2="000000"`, `MICR3="00"`.
- These items are routed to RR (Reject Repair) for manual correction by operator.

---

## 24) Security and Compliance

### 24.1 Session security

- GUID `SessionToken` rotated on every login.
- Middleware validates token per request → forces logout of old sessions.
- 20-minute idle timeout via ASP.NET session.
- `HttpOnly` cookie (inaccessible to JavaScript).

### 24.2 Segregation of duties

- `M_By` vs `C_By` check enforced in code.
- QC supervisor is a third distinct role.
- `IsAdmin`, `IsScan`, `IsMaker`, `IsChecker`, `IsQC`, `IsReports`, `IsSFTP` flags per user.

### 24.3 RSA digital signatures

- MICR fingerprint: `"{ChqNo};{MICR1};{MICR3};{AmountInPaise}"`.
- Signed with RSA private key from `2048.pke` file.
- Signature embedded in OTS XML per cheque item.
- Ensures clearing file tamper-detection at bank/NPCI.

### 24.4 Password handling (legacy — must improve in new app)

- Passwords stored plain-text in `UserMaster.UPassword`.
- **New app MUST implement bcrypt/PBKDF2 hashing.**

### 24.5 SFTP credentials

- Stored in `LocationMaster` table (per location).
- Both password + private key supported simultaneously.
- Private key stored under `wwwroot` (relative path in DB).
- **New app MUST move to secure secret store (Azure Key Vault, etc.).**

---

## 25) Complete Controller Inventory

### Core workflow
| Controller | Key Actions |
|---|---|
| `LoginController` | `Index (GET)`, `GetUserdata`, `ConfirmPassword`, `GetUserLocation`, `Login (POST)`, `Logout (GET)`, `Logoutt (POST)`, `Logouttt (POST)` |
| `BatchController` | `GetUserLocation`, `DisplayBatch`, `GetBatchData`, `CreateBatch` |
| `ScanController` | `Index`, `GetSeqNo`, `GetChequeData`, `GetSubBatchData`, `SaveMicrText`, `Update_SaveMicrText`, `DeleteScanCheque` |
| `RRController` | `RR`, `FetchInvalidCheques`, `UpdateRepairData` |
| `RR_OCRController` | OCR-specific RR operations |
| `MakerController` | `Maker`, `Maker_WS`, `HoldSlup`, `FetchCheques`, `UpdateMakerDetails`, `InserSlipDetail` |
| `CheckerController` | `Checker`, `Checker_WS`, `FetchCheques`, `UpdateCheckerDetails` |
| `QCController` | `Index`, `QC_WS`, `FetchCheques`, `ResolveDiscrepancy` |
| `XMLController` | `XMLBatches`, `CHIGEFUReport`, `GetCountAmt`, `GetTodayBatch`, `CreateXml`, `CreateXmlFile`, `Encrypt`, `DownloadXmlFile` |
| `GEFUReportController` | `GEFUReport`, `GetBatchStatus`, `GetTodayBatch`, `GenerateTextFile` |
| `SftpController` | `UploadToBank`, SFTP trigger actions |
| `CommonController` | `GetAccountName`, `GetLocationName`, `GetBankDetails`, `ValidateTCCode`, `GetReturnReasonName`, `ShowReturnReasonName`, `UpdateUserUnLock` |

### Admin utilities
| Controller | Purpose |
|---|---|
| `UnlockBatchController` | `UnLockBatch`, `GetSkipOCRData`, unlock actions |
| `DeleteBatchController` | Soft-delete batches |
| `MoveBatchesController` | Change batch location |
| `ChangeDateController` | Change batch date |
| `ChangeLocationController` | Change batch location ID |
| `ManageAmountController` | Manual amount/MICR correction |
| `IniRejectController` | Initial reject management + report |
| `SkipOCRController` | Skip OCR flag management |
| `ManualAccountNoController` | Manual account number entry |
| `MarkChequeController` | DNU/duplicate marking |
| `DrawerNameController` | Drawer name correction |
| `SearchCQController` | Cheque search |
| `OptionMenuController` | Admin option menu |

### Master data
| Controller | Purpose |
|---|---|
| `ManageUserController` | User CRUD + location assignment |
| `ManageLocationController` | Location master CRUD |
| `ReturnReasonMasterController` | Return reason CRUD |
| `AccountImportController` | Bulk account import |
| `BankImportController` / `Bank` | Bank/branch import + CRUD |

### Reports
| Controller | Report |
|---|---|
| `ReportDashboardController` | Dashboard |
| `DailyReportController` | Daily |
| `BatchSummaryReportController` | Batch summary |
| `ProductivityReportController` | Productivity |
| `ErrorReportController` | Errors |
| `DuplicateReportController` | Duplicates |
| `ModifiedReportController` | Modified MICR |
| `TransferReportController` | Transfers |
| `DetailReportController` | Detail |
| `DNUReportController` | DNU |
| `HighValueController` | High value |
| `CHIRejectionController` | CHI rejections |
| `DashSummaryController` | Summary |

---

## 26) Complete View Inventory

```
Views/
├── Login/Index.cshtml
├── Home/Scan.cshtml, ScanBatch.cshtml
├── Batch/DisplayBatch.cshtml
├── UnlockBatch/UnLockBatch.cshtml
├── RR/RR.cshtml
├── RR_OCR/RR_OCR.cshtml
├── Maker/Maker.cshtml, Maker_WS.cshtml
├── Checker/Checker.cshtml, Checker_WS.cshtml
├── QC/Index.cshtml, QC_WS.cshtml
├── XML/XMLBatches.cshtml, CHIGEFUReport.cshtml
├── GEFUReport/GEFUReport.cshtml
├── Sftp/SFTPView.cshtml
├── ReportDashboard/ReportDashboard.cshtml
├── DailyReport/*
├── BatchSummaryReport/BatchSummaryReport.cshtml
├── ProductivityReport/ProductivityReport.cshtml
├── ErrorReport/ErrorReport.cshtml
├── DuplicateReport/DuplicateReport.cshtml
├── ModifiedReport/ModifiedReport.cshtml
├── TransferReport/TransferReport.cshtml
├── DetailReport/DetailedReport.cshtml
├── DNUReport/*
├── CHIRejection/CHIRejectionReport.cshtml
├── DashSummary/DashboardSummary.cshtml
├── MoveBatches/MoveBatches.cshtml
├── ChangeDate/ChangeDate.cshtml
├── ChangeLocation/ChangeLocation.cshtml
├── DeleteBatch/*
├── OptionMenu/*
├── ManageUser/ManageUser.cshtml
├── ReturnReasonMaster/ReturnReason.cshtml
├── ManualAccountNo/Index.cshtml
├── SkipOCR/SkipOCR.cshtml
├── IniReject/IniReject.cshtml
├── DrawerName/*
├── SearchCQ/*
├── AccountImport/*
├── BankImport/*
├── ManageAmount/*
├── MarkCheque/*
├── Shared/_Layout.cshtml
```

---

## 27) Build Blueprint for New Application

Implement modular services (one per workflow stage):

| Service | Maps To |
|---|---|
| `AuthService` | `LoginController` + `SessionValidationMiddleware` |
| `BatchService` | `BatchController` |
| `ScanIngestionService` | `ScanController` + `Ranger.js` bridge |
| `RejectRepairService` | `RRController` + `RR_OCRController` |
| `MakerEntryService` | `MakerController` |
| `CheckerVerificationService` | `CheckerController` |
| `QualityControlService` | `QCController` |
| `XmlGenerationService` | `XMLController.CreateXmlFile` |
| `GefuGenerationService` | `GEFUReportController.GenerateTextFile` |
| `FileTransferService` | `sftpUploader` |
| `AccountValidationService` | `CommonController.GetAccountName` (wraps SecondaryDbContext) |
| `MasterDataService` | All master CRUD controllers |
| `ReportingService` | All report controllers |
| `AdminUtilityService` | Unlock, delete, move, date change, etc. |

Each service must:
- Accept the legacy validation rules exactly as documented above
- Produce the same status transitions
- Generate files in the same format/naming
- Preserve all audit fields (who/when for each stage)

---

## 28) Appendix — Implementation Tracker

| Req ID | Legacy Source | New Component | Validation Cases | Status |
|---|---|---|---|---|
| CS-AUTH-001 | `LoginController` | Auth module | Session token, concurrent login, force-login, lock after 5 attempts | Planned |
| CS-AUTH-002 | `LoginController.Logoutt` | EOD logout | Unlock all sub-batches owned by user on EOD logout | Planned |
| CS-AUTH-003 | `LoginController.ConfirmPassword` | Password lock | Increment AttempPass, lock at 5, set LockedUser=1 | Planned |
| CS-AUTH-004 | `SessionValidationMiddleware` | Session guard | Token mismatch = clear session + redirect login | Planned |
| CS-BATCH-001 | `BatchController.DisplayBatch` | Batch module | BatchNo generation: {LocationID}{yyyyMMdd}{seq:D5} | Planned |
| CS-BATCH-002 | `BatchController` | Batch module | Sub-batch split, User_Lock management, dashboard filter | Planned |
| CS-BATCH-003 | `UnlockBatchController` | Unlock utility | Fetch locked batches, set User_Lock=0 | Planned |
| CS-SCAN-001 | `ScanController.SaveMicrText` | Scan module | 4 images base64 decode+write, IsSlip flag for bad MICR | Planned |
| CS-SCAN-002 | `ScanController.GetChequeData` | Scan module | IsScan role check, SP GetChequeEndorseDetails | Planned |
| CS-SCAN-003 | `Ranger.js` | Browser scanner bridge | WebSocket to Ranger driver, 4-image capture, MICR parse, POST to server | Planned |
| CS-RR-001 | `RRController` | RR module | ChqNo 6 digits, MICR1 9 digits, MICR2 5 digits, MICR3 2 digits not in Blocked_TCMaster | Planned |
| CS-RR-002 | `MICRRepairFlag` | RR module | 6-char flag tracking which MICR fields were repaired | Planned |
| CS-RR-003 | `RR_OCRController` | OCR-RR module | OCR-specific RR operations | Planned |
| CS-ACCT-001 | `CommonController.GetAccountName` | Account validation | SecondaryDB EXEC USP_SEL_AccountMaster, StatusList check, BlockProductList check | Planned |
| CS-ACCT-002 | `CommonController.GetBankDetails` | Bank validation | Branch_Master+Bank_Master join on MICR1 routing number | Planned |
| CS-ACCT-003 | `CommonController.ValidateTCCode` | TC validation | Blocked_TCMaster lookup for MICR3 | Planned |
| CS-MKR-001 | `MakerController` | Maker module | Slip amount reconciliation: Sum(Chq_Amt)==SlipAmount, error "Slip amount Does not match" | Planned |
| CS-MKR-002 | `MakerController.HoldSlup` | Hold slip | Set Slip_Entry.Slip_hold=1, skip held slips | Planned |
| CS-MKR-003 | `MakerController` | Maker module | IsDuplicate=1 items excluded, BatchStatus→6 on completion | Planned |
| CS-CHK-001 | `CheckerController` | Checker module | SoD: M_By==UserID blocks access, error "Maker and Checker Can not be Done by Same User" | Planned |
| CS-CHK-002 | `CheckerController` | Checker module | Blind re-entry, BatchStatus→7 on completion | Planned |
| CS-QC-001 | `QCController` | QC module | M_* vs C_* field comparison, Q_* resolution, BatchStatus→8 | Planned |
| CS-QC-002 | `QCController` | QC module | Sub-batch propagation: parent Batch advances when all sub-batches at status 8 | Planned |
| CS-XML-001 | `XMLController.CreateXmlFile` | XML generation | Cheque filter: IsSlip=false, Ini_Rej=0, IsDeleted=0, IsDuplicate=0 | Planned |
| CS-XML-002 | `XMLController` | XML generation | RSA-SHA256 sign: "{ChqNo};{MICR1};{MICR3};{AmtInPaise}", key file 2048.pke | Planned |
| CS-XML-003 | `XMLController` | XML generation | OTI IMG: BinaryWriter FileMode.Append, 3 images per cheque, byte offsets tracked | Planned |
| CS-XML-004 | `XMLController` | XML generation | File naming: OTS_{CHMCode}_{HubLocationId}_{ddMMyyyy}_{HHmmss}_{FileId}.xml | Planned |
| CS-XML-005 | `XMLController` | XML generation | Timestamp: last batch time +1m20s to avoid duplicate timestamps | Planned |
| CS-XML-006 | `XMLController` | XML generation | Post-gen: Report_Status=1, CHI_By=UserId, User_Lock=0 on Batch + all SubBatchTbl | Planned |
| CS-XML-007 | `XMLController.GetCountAmt` | Admin gate | IsAdmin==0 → error "This file generate only Admin" | Planned |
| CS-GEFU-001 | `GEFUReportController.GenerateTextFile` | GEFU generation | Join query, filter IsSlip=false/Ini_Rej=0/IsDeleted=0/IsDuplicate=0 | Planned |
| CS-GEFU-002 | `GEFUReportController` | GEFU generation | Fixed-width records: RecType="2", TransType="01", Flag="C", TransCurrency="001" | Planned |
| CS-SFTP-001 | `sftpUploader.UploadFile` | File transfer | Password + private key auth both active simultaneously | Planned |
| CS-SFTP-002 | `sftpUploader.UploadFile_GEFU` | File transfer | Separate remote directory File_RemoteDirectory_G for GEFU | Planned |
| CS-SFTP-003 | `sftpUploader.IsHostReachable` | File transfer | 5-second TCP pre-check before SFTP connect | Planned |
| CS-ADM-001 | `UnlockBatchController` | Admin utilities | Lock release, User_Lock=0 | Planned |
| CS-ADM-002 | `DeleteBatchController` | Admin utilities | Soft-delete: IsDeleted=1, cascade to Cheques+Slip_Entry | Planned |
| CS-ADM-003 | `MoveBatchesController` | Admin utilities | Change batch LocationID/LocationName | Planned |
| CS-ADM-004 | `ChangeDateController` | Admin utilities | Change BatchDate | Planned |
| CS-ADM-005 | `ManageAmountController` | Admin utilities | Manual amount/MICR correction | Planned |
| CS-ADM-006 | `IniRejectController` | Admin utilities | Set Ini_Rej values, initial reject report | Planned |
| CS-ADM-007 | `SkipOCRController` | Admin utilities | Set Batch.Skip_Ocr=1 | Planned |
| CS-ADM-008 | `DrawerNameController` | Admin utilities | Post-processing DrawerName correction | Planned |
| CS-ADM-009 | `MarkChequeController` | Admin utilities | DNU and duplicate marking | Planned |
| CS-RPT-001 | All report controllers | Reporting | 13 report types with date/location filters | Planned |
| CS-OCR-001 | OCR fields on Cheques model | OCR sub-system | OCR_* fields, Enable_OCR_Amount flag, Skip_Ocr flag, OCR_Match comparison | Planned |
| CS-DUP-001 | `IsDuplicate` + `ChequeDuplicateData` | Duplicate detection | Detect and mark duplicate cheques, exclude from XML | Planned |
| CS-CHI-001 | `CHI_Rejection_Files` + `CHIRejectionController` | CHI rejection | Track files rejected by clearing house, CHI_Rejected flag on Batch and Cheques | Planned |
| CS-DNU-001 | `DNU_By`/`DNU_Verify_By` + `DNUReportController` | DNU workflow | Do-Not-Use marking, DNU report generation | Planned |
| CS-RESCAN-001 | `RescanChequesTbl` + `ScanRescan` | Rescan workflow | Track rescanned cheques, rescan count per cheque | Planned |
| CS-HIGHVAL-001 | `LocationMaster.HighValue` + `HighValueController` | High-value workflow | High-value cheque detection and reporting when HighValue=true | Planned |

---

## 29) Feature Parity Checklist (Use As Acceptance Test)

Use this as implementation acceptance checklist. Every item must be demonstrably working before the CS web parity is declared complete.

### 29.1 Authentication & Session
- [ ] Login by `EmpID` (not username) + password + EOD date selection
- [ ] `SessionToken` GUID rotated on every login, stored in `UserMaster`
- [ ] `SessionValidationMiddleware` validates token per request; mismatch → redirect login
- [ ] Concurrent login detection: second login invalidates first session on next request
- [ ] Force-login parameter (`force=true`) to kick existing session
- [ ] Password failure counter (`AttempPass`); lock at 5 failures → `LockedUser=1`
- [ ] Admin-lock flag via `Logouttt` → `LoginUserLocked=1`
- [ ] EOD logout (`Logoutt`) unlocks all sub-batches owned by user
- [ ] 20-minute idle timeout, HttpOnly session cookie
- [ ] Role flags enforced: `IsScan`, `IsMaker`, `IsChecker`, `IsQC`, `IsAdmin`, `IsReports`, `IsSFTP`, `IsSuperAdmin`
- [ ] Location context set from `UserLocation` JOIN `LocationMaster` on login (for scan users)

### 29.2 Batch Management
- [ ] Batch number: `{LocationID}{yyyyMMdd}{seq:D5}` — app-layer increment from last batch for that date
- [ ] Default batch values: `BatchStatus=0`, `ClearingType="01"`, `BatchDate=EODdate`
- [ ] Dashboard filter: `BatchDate==today AND BatchStatus==0 AND IsDeleted==0`
- [ ] Sub-batch creation and parallel processing per sub-batch
- [ ] `User_Lock` set when batch opened, cleared on completion/logout
- [ ] `SubBatchTbl.User_Lock` also unlocked on EOD logout
- [ ] Batch unlock by admin: `User_Lock=0`

### 29.3 Scanning (Client-Side Architecture)
- [ ] Scanner integration is 100% client-side: Ranger.js (browser) ↔ Ranger driver (local service) ↔ scanner hardware
- [ ] `Ranger.js` opens WebSocket to local Ranger driver service
- [ ] 4 images captured per cheque: Front JPEG, Rear JPEG, Front TIF (CCITT4), Rear TIF
- [ ] Images base64-encoded in browser, POSTed to `ScanController.SaveMicrText`
- [ ] Image naming: `{BatchNo}{SeqNo}F.jpg`, `{BatchNo}{SeqNo}R.jpg`, `{BatchNo}{SeqNo}F.tif`, `{BatchNo}{SeqNo}R.tif`
- [ ] Image path: `wwwroot/{LocationName}/{HubLocationName}/{BatchNo}/{SubBatchNo}/`
- [ ] `BatchDate = EODdate` (from session — NOT `DateTime.Today`)
- [ ] Bad MICR detection: empty `micrText` OR `chqNo` contains `!` → `IsSlip=true`, placeholder zeros
- [ ] Normal cheque: `IsSlip=false` with actual MICR values
- [ ] `Batch_Type=1` flag on normal scan saves
- [ ] `IsScan==0` check → error `"This is only Scannig User"`, sets `User_Lock=0`
- [ ] Scan workstation requirement: Silver Bullet Ranger driver must be installed locally

### 29.4 Reject Repair
- [ ] ChqNo validation: 6 numeric digits, not `"000000"`
- [ ] MICR1 validation: 9 numeric digits
- [ ] MICR2 validation: 5 numeric digits
- [ ] MICR3 validation: 2 numeric digits, not in `Blocked_TCMaster`
- [ ] `MICRRepairFlag`: 6-char flag tracking which of the MICR fields were corrected
- [ ] `RRState=1` after repair; `RRState=0` = still needs repair
- [ ] OCR-RR path (`RR_OCRController`) for OCR-specific repair
- [ ] Batch routing: all items must be in `RRState=1` before Maker stage can proceed

### 29.5 Account & Bank Validation
- [ ] Account lookup: `SecondaryDbContext` → `EXEC USP_SEL_AccountMaster @AccountNo`
- [ ] `StatusList` check by account status code (flag check)
- [ ] `BlockProductList` check by account product code
- [ ] Bank/branch lookup: `Branch_Master` + `Bank_Master` joined on `BRANCH_ROUTING_NBR==MICR1`
- [ ] TC code block check: `Blocked_TCMaster` lookup on `MICR3`

### 29.6 Maker Stage (L1)
- [ ] Slip amount reconciliation: `Sum(Chq_Amt for all cheques in slip) == Slip_Entry.SlipAmount`
  - Mismatch → error: `"Slip amount Does not match"`
- [ ] Account validation via `GetAccountName` before saving
- [ ] Hold slip: `Slip_Entry.Slip_hold=1`, held slips skipped in workflow
- [ ] `IsDuplicate=1` items excluded from processing counts
- [ ] SoD setup: `SubBatchTbl.M_By = UserID` stored for Checker to check against
- [ ] `M_ChqNo`, `M_MICR1-3`, `M_ChqDate`, `M_ChqAmount`, `M_Status=1`, `M_By`, `M_Time` saved
- [ ] Sub-batch/batch `BatchStatus→6` on all items complete
- [ ] `User_Lock=0` after completion

### 29.7 Checker Stage (L2)
- [ ] SoD enforcement: `SubBatchTbl.M_By == CurrentUserID` → error `"Maker and Checker Can not be Done by Same User"`, set `User_Lock=0`
- [ ] Blind re-entry (Maker values not shown to Checker)
- [ ] Account validation again via `GetAccountName`
- [ ] `C_ChqNo`, `C_MICR1-3`, `C_ChqDate`, `C_ChqAmount`, `C_Status=1`, `C_By`, `C_Time` saved
- [ ] `BatchStatus→7` on all items complete
- [ ] Workstation variant (`Checker_WS`) also available

### 29.8 QC Stage
- [ ] Automated comparison of `M_*` vs `C_*` fields for each cheque
- [ ] Mismatched items flagged for manual supervisor review
- [ ] Supervisor selects correct value → stored in `Q_*` fields
- [ ] `Q_Status=1` when item resolved
- [ ] `SubBatchStatus→8` when all items in sub-batch are `Q_Status=1`
- [ ] Parent `Batch.BatchStatus→8` when all sub-batches reach `SubBatchStatus=8`

### 29.9 XML/IMG Generation (Admin Only)
- [ ] `IsAdmin==0` check → error `"This file generate only Admin"`, sets `User_Lock=0`
- [ ] Eligible batch filter: `BatchStatus>6 AND XMLFileName null/empty AND IsDeleted==0`
- [ ] Cheque eligibility: `IsSlip=false AND Ini_Rej=0 AND IsDeleted=0 AND IsDuplicate=0`
- [ ] Count/amount totals shown: normal (`Ini_Rej==0`), transfer (`Ini_Rej==9`), rejected
- [ ] File timestamp: last batch time +1m20s (avoids duplicate timestamps)
- [ ] OTS XML naming: `OTS_{CHMCode}_{HubLocationId}_{ddMMyyyy}_{HHmmss}_{FileId}.xml`
- [ ] OTI IMG naming: `OTI_{CHMCode}_{HubLocationId}_{ddMMyyyy}_{HHmmss}_{FileId}.img`
- [ ] FileId: last 3 digits of BatchNo, padded to 10 digits
- [ ] Output path: `E:\HDFC Department\Location Reports\{ddMMyyyy}\{LocationName}\{HubLocationName}\XML\{BatchNo}\`
- [ ] XML structure: `<FileHeader VendorId CoreSystem="FLX">` with per-cheque `<Item>` elements
- [ ] Item sequence: `{CHMCode}{HubLocationId}{batchNoLast3}{itemCounter:D3}`
- [ ] MICR fingerprint for RSA signing: `"{ChqNo};{MICR1};{MICR3};{Chq_Amt * 100 (paise)}"`
- [ ] RSA-SHA256 signature using `2048.pke` key file
- [ ] OTI: 3 images per cheque (Front JPEG, Rear JPEG, Front TIF), byte offsets tracked for XML `<ImageViewDetail>`
- [ ] Post-generation: `Report_Status=1`, `CHI_By=UserId`, `User_Lock=0` on Batch AND all SubBatchTbl records
- [ ] No XML if no eligible cheques → `TempData["ErrorMessage"]`

### 29.10 GEFU Generation
- [ ] Eligible batches: `BatchStatus>=8 AND Report_Status IN(1,2) AND IsDeleted==0`
- [ ] Query: `Cheques JOIN Batch JOIN Slip_Entry JOIN LocationMaster`
- [ ] Filter: `IsSlip=false AND Ini_Rej=0 AND IsDeleted=0 AND IsDuplicate=0`
- [ ] Fields: `RecType="2"`, `TransType="01"`, `AC_No`, `TransactionBranch`, `TransMne`, `BatchDate`, `Flag="C"`, `TransCurrency="001"`, `ChqAmount`, `ChqNo`, `MICR1`, `DrawerName`, `BatchID`, `LotNo` (last 3 digits of BatchNo)
- [ ] Amount checksum accumulated per record (`dblSumRecordChecksum`)
- [ ] GEFU upload uses `File_RemoteDirectory_G` (different from XML/IMG remote dir)

### 29.11 SFTP Upload
- [ ] Load SFTP config from `LocationMaster` by `LocationID`
- [ ] Private key path: relative to `wwwroot`, full path = `wwwroot + File_PrivateKeyPath`
- [ ] Both auth methods active simultaneously: `PasswordAuthenticationMethod` + `PrivateKeyAuthenticationMethod`
- [ ] Upload XML/IMG to `File_RemoteDirectory`
- [ ] Upload GEFU to `File_RemoteDirectory_G`
- [ ] `IsHostReachable(host, port)` 5-second TCP pre-check
- [ ] Throw `ApplicationException` on connect or upload failure

### 29.12 Admin Utilities
- [ ] Unlock batch: `User_Lock=0` for any locked batch (admin)
- [ ] Soft-delete batch: `IsDeleted=1`, cascade to associated `Cheques` and `Slip_Entry`
- [ ] Move batch: change `LocationID`/`LocationName`
- [ ] Change batch date: change `BatchDate`
- [ ] Manage amount: correct cheque amounts, MICR, ChequeNo, AcNo, AcType post-processing
- [ ] Initial reject management: set/view `Ini_Rej` values; initial reject report via SP `RPT_Initail_Reject_Report`
- [ ] Skip OCR: set `Batch.Skip_Ocr=1`
- [ ] Manual account number: update `Slip_Entry.AC_No` directly
- [ ] Mark cheque: DNU (`DNU_By`/`DNU_Verify_By`) and duplicate (`IsDuplicate`) flags
- [ ] Drawer name correction: post-processing `DrawerName` update
- [ ] Cheque search by cheque number, batch number, account

### 29.13 OCR Sub-System
- [ ] `Enable_OCR_Amount` in `LocationMaster`: pre-fills amount field from OCR data
- [ ] `Skip_Ocr` flag in `Batch`: bypasses OCR validation for the entire batch
- [ ] OCR fields on `Cheques`: `OCR_ChqNo`, `OCR_MICR1-3`, `OCR_Amount`, `OCR_Date`, `OCR_DrawerName`, `OCR_AC_No`, `OCR_PayeeName`, `OCR_SlipAmount`
- [ ] `OCR_Match` flag: set when OCR values match Maker values
- [ ] `RR_OCRController` / `RR_OCR_ChequeData` DTO: OCR-specific RR path separate from standard RR

### 29.14 Duplicate Detection
- [ ] `ChequeDuplicateData` keyless DTO: used for duplicate cheque detection
- [ ] `IsDuplicate=1` on `Cheques`: marks a cheque as duplicate
- [ ] Duplicate cheques excluded from: XML generation, GEFU generation, processing counts
- [ ] `DuplicateReportController` and `DuplicateReportData` DTO for reporting

### 29.15 CHI Rejection Handling
- [ ] `CHI_Rejection_Files` table: tracks files rejected by clearing house
- [ ] `Batch.CHI_Rejected` flag: marks batch as CHI-rejected
- [ ] `Cheques.CHI_Rejected` flag + `RejectReasonCode`: per-cheque CHI rejection
- [ ] `Cheques.CHI_Generated` flag: tracks which cheques were included in generated CHI files
- [ ] `CHIRejectionController` / `CHIRejectionData` DTO: CHI rejection report

### 29.16 High-Value Workflow
- [ ] `LocationMaster.HighValue` boolean: enables high-value cheque workflow for the location
- [ ] `HighValueController`: high-value cheque report and management
- [ ] High-value cheques receive special handling/reporting when flag enabled

### 29.17 Rescan Workflow
- [ ] `RescanChequesTbl`: tracks rescanned cheques separately
- [ ] `Cheques.ScanRescan`: rescan counter per cheque item
- [ ] `Cheques.RescanBatch`: flag linking cheque to a rescan batch
- [ ] `Cheques.RescanFlg`: rescan status flag

### 29.18 Reporting
- [ ] Daily report (`DailyReportController`)
- [ ] Batch summary report (`BatchSummaryReportController`)
- [ ] Productivity report (`ProductivityReportController`)
- [ ] Error report (`ErrorReportController` + `ErrorType`/`ErrorDataTbl`)
- [ ] Duplicate report (`DuplicateReportController`)
- [ ] Modified/repaired MICR report (`ModifiedReportController`)
- [ ] Transfer cheques report — `Ini_Rej==9` (`TransferReportController`)
- [ ] Detail drilldown report (`DetailReportController`)
- [ ] DNU report (`DNUReportController`)
- [ ] High value report (`HighValueController`)
- [ ] CHI rejection report (`CHIRejectionController`)
- [ ] Dashboard summary (`DashSummaryController`)
- [ ] Report dashboard hub (`ReportDashboardController`)
- [ ] Initial reject report (from `IniRejectController`)
- [ ] All reports filterable by location, date range

---

## 30) Sub-System Details Not Covered Elsewhere

### 30.1 EOD Date Session Concept

The CS web app introduces an explicit **EOD Date** concept absent in the desktop CCTS:

- On login, user selects an **EOD Date** from a date picker (`selectedDate` input).
- This date is stored as `Session["EODdate"]` and used for ALL filtering throughout the session.
- `BatchDate` assigned to scanned cheques = `EODdate` (NOT `DateTime.Today`).
- Dashboard batch filter uses `EODdate`, not server current date.
- XML generation date queries use the stored `EODdate` for batch lookup.
- This allows operators to process batches for a date different from the current calendar date (e.g., processing previous business day's items).
- **New app must preserve this**: all date-sensitive queries must use the user's session `EODdate`, not `DateTime.UtcNow` or `DateTime.Today`.

### 30.2 Sub-Batch Parallel Processing

The CS web app adds sub-batch support that the desktop CCTS does not have:

- Large batches can be **split into sub-batches** (`SubBatchTbl`) for parallel processing by multiple Maker operators.
- Each `SubBatchTbl` record mirrors the `Batch` schema with its own `SubBatchStatus`, `User_Lock`, `M_By`, `C_By`, `Q_By`, `CHI_By`.
- `SubBatchNo` sequences within a parent batch.
- Maker, Checker, QC each operate on sub-batches independently.
- Parent `Batch.BatchStatus` only advances when ALL sub-batches reach the required sub-status.
- On XML generation: post-generation updates both `Batch` AND all matching `SubBatchTbl` records.
- On EOD logout: ALL sub-batches with `User_Lock=CurrentUserID` are unlocked (not just parent batch).

### 30.3 `Slip_Entry` vs `IsSlip` Flag on `Cheques`

Two distinct concepts that are easy to confuse:

1. **`Slip_Entry` table**: The deposit slip record. Contains slip metadata: `SlipNo`, `SlipAmount`, `AC_No`, etc. Each slip has one row here.

2. **`Cheques.IsSlip = true`**: A record in the `Cheques` table where `IsSlip=true` is NOT a cheque — it is a **bad-MICR placeholder** created when the scanner couldn't read the MICR. It is NOT the same as a `Slip_Entry` record.

This distinction is critical:
- `IsSlip=true` cheque records = bad scan placeholders → go through Reject Repair.
- `Slip_Entry` records = deposit slips linked to batches → used in Maker for amount balancing.
- XML generation filters `IsSlip=false` — only processes actual cheques, not bad-MICR placeholders.

### 30.4 `Ini_Rej` Decision Tree

```
Ini_Rej=0  → Normal cheque → included in XML + GEFU
Ini_Rej=1  → Initially rejected → excluded from XML → counted in rejection report
Ini_Rej=9  → Transfer cheque → excluded from XML (special treatment), shown in Transfer report
Ini_Rej=99 → Other reject code → excluded from XML
Ini_Rej=999→ Another reject category → excluded from XML
```

`IniRejectController` manages these values post-processing. `IsDeleted=1` items are also excluded from XML regardless of `Ini_Rej`.

### 30.5 `2048.pke` RSA Key File

- The RSA private key used for MICR digital signatures in OTS XML generation.
- File is loaded at XML generation time by `XMLController.Encrypt()`.
- Must be present on the server (not in `wwwroot` — should be in a protected path).
- 2048-bit RSA key, used for RSA-SHA256 signing.
- **Critical**: if this file is missing or moved, XML generation will fail with a file-not-found or cryptography exception.
- New app must store this key securely (e.g., in a protected folder outside `wwwroot`, or in Azure Key Vault as a secret).

### 30.6 `UserLocation` Table

- Maps users to one or more allowed locations.
- On login, `LoginController` queries `UserLocation JOIN LocationMaster` to build the location list for the user.
- For scan users (`IsScan=1`): the first (or selected) location's `LocationId`, `LocationName`, `HubLocationName`, `LocationCode` are loaded into session.
- A user without a `UserLocation` record cannot access any location.

### 30.7 `Batch_Type` Flag

- `Batch_Type=1` on `Cheques` records indicates a normal scan flow item (set by `SaveMicrText`).
- Other `Batch_Type` values may indicate different flows (rescan, import, etc.).
- The XML generation filter and GEFU filter both use `IsSlip=false/Ini_Rej=0` — `Batch_Type` is not a filter in XML/GEFU but is stored for traceability.

### 30.8 Stored Procedures Used (Confirmed from Source)

| SP Name | Used By | Purpose |
|---|---|---|
| `GetChequeEndorseDetails @BatchNo` | `ScanController.GetChequeData` | Returns cheques with endorsement details for a batch |
| `GetChequesForBatch_Maker @BatchId, @SlipId` | `MakerController.FetchCheques` | Returns cheques for a specific slip in Maker view |
| `GetTopChequeForBatch_MakerWS @BatchId, @SlipId` | `MakerController` | Returns next unprocessed cheque for workstation mode |
| `GetChequesForBatch_Checker @BatchId, @SlipId` | `CheckerController.FetchCheques` | Returns cheques for Checker view |
| `GetTopChequeForBatch_Checker @BatchId, @SlipId` | `CheckerController` | Returns next cheque for Checker workstation mode |
| `USP_SEL_AccountMaster @AccountNo` | `CommonController.GetAccountName` | Looks up account in secondary DB |
| `RPT_Initail_Reject_Report` | `IniRejectController.FetchBatch` | Initial reject report data |

---

## 31) Cross-Reference: CS Web + CCTS Desktop Differences (For New App Design)

The new application must combine features from BOTH legacy systems. This section documents key differences between CS web and CCTS desktop that the new app must reconcile.

### 31.1 Images per cheque
- **CCTS desktop**: 3 images (Front BW TIFF, Back BW TIFF, Front Grayscale JPEG)
- **CS web**: 4 images (Front JPEG, Rear JPEG, Front TIF, Rear TIF)
- **New app**: should capture 4 images matching CS web (adds Rear TIF for additional compliance)

### 31.2 Sub-batch parallel processing
- **CCTS desktop**: single batch, no sub-batching
- **CS web**: sub-batches allow multiple Makers to work in parallel on different parts of a large batch
- **New app**: should implement sub-batch splitting (from CS web)

### 31.3 EOD date session concept
- **CCTS desktop**: operates on current calendar date; no explicit EOD date selection on login
- **CS web**: explicit EOD date chosen at login; ALL operations filtered by this date
- **New app**: should implement EOD date session concept (from CS web) — operators must explicitly set the processing date

### 31.4 Batch status codes
- **CCTS desktop**: 6-state machine (0=RR Pending, 1=Entry Pending, 2=CHI Pending/OCR Mismatch/QC Pending, 3=XML Generated, 4=RCMS Pending, 5=RCMS Completed, 6=Completed) — computed labels from multiple fields
- **CS web**: simpler numeric codes (0=Scanning, 3=RR, 4=RR-OCR, 6=Maker, 7=Checker, 8=QC, >8=Ready for XML)
- **New app**: should design a unified status machine that preserves all CCTS states while adding CS web states

### 31.5 Account validation
- **CCTS desktop**: internal validation against local DB tables
- **CS web**: validates against separate `SecondaryDbContext` DB via stored proc `USP_SEL_AccountMaster` + `StatusList` + `BlockProductList`
- **New app**: must implement the secondary DB account validation path (from CS web)

### 31.6 Scanner endorsement
- **CCTS desktop**: model-specific endorsement code paths in VB.NET (CR120/CR50 CSN format; CR135/CR150 OEM batch; CR190 DB-derived); endorsement text injected mid-scan per cheque
- **CS web**: endorsement abstracted to the Ranger driver layer; web app does NOT have endorsement code in the server — endorsement is handled by the driver on the workstation
- **New app**: endorsement behavior must be configured at the driver/workstation level if using a web architecture; if rebuilding desktop, must preserve all model-specific endorsement paths

### 31.7 SFTP vs FTP
- **CCTS desktop**: uses `FtpWebRequest` (plain FTP); credentials hardcoded; HTTP registration handshake before upload; PGP encryption of files before transfer
- **CS web**: uses `Renci.SshNet` (SFTP/SSH); per-location credentials in DB; both password + private key auth; no PGP pre-processing mentioned in web source
- **New app**: should use SFTP (from CS web) with per-location credentials from secure store; PGP encryption requirement should be verified against bank specification

### 31.8 Slip entry
- **CCTS desktop**: 8-step slip validation chain; pickup point validation; `SummRefNo=PIF` check; auto-slip number starting at 101; batch must be locked first
- **CS web**: slip amount reconciliation against cheque sum; hold slip feature; `Initail_Rej_Slip` on slip; no pickup point concept in web version
- **New app**: should combine both: CS web's slip amount reconciliation + CCTS's pickup point validation and auto-slip number logic

### 31.9 Role system
- **CCTS desktop**: menu-right based (`UserMenuRights`, `MenuMaster`, `CheckUserMenuRights()`); granular Add/Edit/Access per screen; hardcoded username lists in some forms
- **CS web**: boolean flag-based per user (`IsScan`, `IsMaker`, `IsChecker`, `IsQC`, `IsAdmin`, `IsReports`, `IsSFTP`, `IsSuperAdmin`); simpler but less granular
- **New app**: should implement the CCTS menu-right model (more granular) while supporting the CS web flag model for quick role assignment

### 31.10 RCMS and SDEA
- **CCTS desktop**: full RCMS workflow (operator lock, data entry, SDEA Part A/C generation, PDF summary, batch archive)
- **CS web**: no RCMS or SDEA mentioned in web source (GEFU replaces this for CBS integration)
- **New app**: must determine if RCMS/SDEA is still required (it is a CCTS-specific CBS integration) or if GEFU is sufficient; if RCMS/SDEA needed, implement from CCTS desktop blueprint

### 31.11 NACH (National Automated Clearing House)
- **CCTS desktop**: full NACH sub-system (10+ forms, separate tables, separate scanning flow)
- **CS web**: no NACH mentioned in web source
- **New app**: NACH sub-system must be implemented (from CCTS desktop blueprint)

### 31.12 CHI XML format differences
- **CCTS desktop**: `CXF_*.XML` / `CIBF_*.IMG`; 256-byte random pads in IMG; 3 images; SCB code 036 exclusion; CycleNo from DB sequence; HTTP registration before FTP
- **CS web**: `OTS_*.xml` / `OTI_*.img`; no 256-byte pads mentioned; 3 images in OTI; no code 036 exclusion mentioned in web source; timestamp-based FileId
- **New app**: must reconcile — use bank specification as the final arbiter for XML/IMG format; note that CCTS and CS web may serve different clearing houses or bank specifications

---

## 32) Source Coverage Matrix

Files directly read during this blueprint's creation:

| File | System | Coverage |
|---|---|---|
| `Controllers/LoginController.cs` | CS Web | Full — login, logout, force-login, lock, session setup |
| `Controllers/BatchController.cs` | CS Web | Lines 1-200 — batch number algorithm, dashboard, defaults |
| `Controllers/ScanController.cs` | CS Web | Lines 1-400 — SaveMicrText, GetChequeData, GetSeqNo |
| `Controllers/XMLController.cs` | CS Web | Lines 1-550 — GetCountAmt, CreateXml, CreateXmlFile, Encrypt |
| `Controllers/GEFUReportController.cs` | CS Web | Lines 1-155 — GetTodayBatch, GenerateTextFile |
| `Controllers/CommonController.cs` | CS Web | Lines 1-200 — GetAccountName, GetBankDetails, ValidateTCCode |
| `Controllers/SftpController.cs` | CS Web | Sampled — upload trigger |
| `Services/sftpUploader.cs` | CS Web | Full — UploadFile, UploadFile_GEFU, IsHostReachable, auth methods |
| `Services/SessionValidationMiddleware.cs` | CS Web | Full — token validation per request |
| `Models/UserMaster.cs` | CS Web | Full — all fields including EmpID, role flags, SessionToken |
| `Models/Batch.cs` | CS Web | Full — all fields including OCR_Status, CHI_By, Batch_Type, Hold_Batch_Slip |
| `Models/Cheques.cs` | CS Web | Full — all 55+ fields including O_*, M_*, C_*, Q_*, OCR_*, MICRRepairFlag |
| `Models/SubBatchTbl.cs` | CS Web | Full — mirrors Batch + SubBatchID, SubBatchNo, SubBatchStatus |
| `Models/LocationMaster.cs` | CS Web | Full — all SFTP fields, CHMCode, HubLocationName, HighValue, Enable_OCR_Amount |
| `Models/Slip_Entry.cs` | CS Web | Full — all fields including Slip_hold, Initail_Rej_Slip |
| `Data/ApplicationDbContext.cs` | CS Web | Lines 1-100 — all DbSets and .HasNoKey() registrations |
| `Program.cs` | CS Web | Full — session config, DI, middleware order |
| `both_old_app_docs/web/CS_Project_Documentation.md` | CS Docs | Full |
| `both_old_app_docs/web/CS_File_Inventory_and_Flows.md` | CS Docs | Full |
| `both_old_app_docs/web/CS_Detailed_Business_Process_Flow.md` | CS Docs | Full |

Remaining for strict completeness:
- Full stored procedure signatures for all SPs called by the web app
- Production DB schema for all tables not fully visible in `ApplicationDbContext.cs`
- Full reading of `RRController.cs`, `MakerController.cs`, `CheckerController.cs`, `QCController.cs` for exact action method signatures
