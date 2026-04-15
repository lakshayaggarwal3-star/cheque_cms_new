# CCTS – File Inventory & Combined Flow Mapping

This document provides a detailed inventory of all significant source files, their functional purpose, and a combined operational flow mapping showing which file handles each stage of cheque processing.

---

## 1. Root / Database Scripts

| File | Purpose |
|---|---|
| `CCTS.sln` | Visual Studio solution — orchestrates all sub-projects |
| `NACH_Tables.sql` | DDL: creates all operational tables (batches, cheques, slips, users, banks, branches, return reasons, holidays, locations, settings) |
| `NACH_SP.sql` | All stored procedures: login validation, batch CRUD, amount entry, status updates, SDEA report queries, RCMS queries, CHI file queries |
| `NACH_FUN.sql` | SQL scalar functions: clearing date calculations, MICR parsing, amount/digit formatting |
| `NACH_Client.sql` | Seed data: baseline client and bank records |

---

## 2. Desktop Application (`\CCTS` Project — VB.NET WinForms)

### Entry, Session & Navigation
| File | Purpose |
|---|---|
| `LoginPage.vb` | Authentication: version check, AES password encryption (`"QuickCTS"`), `USP_Validate_Login` SP, 5-attempt lockout, forced password expiry, session variable loading, silent SQL patch + report deployment on login |
| `CCTSMDI.vb` | Parent MDI frame: navigation ribbon, houses all child form windows |
| `CCTSvb.vb` | Global module: shared variables (`gstrUserName`, `glngUserID`, `gstrSharedPath`, `lngBatchID`, `StrBatchNo`, etc.), global utility functions (`GetSettings`, `LockBatch`, `CreateNewBatch`, `CheckUserMenuRights`, etc.) |
| `frmSelectPresentingBranch.vb` | Post-login branch selection; sets `glngPresentBranchID`, `gstrCMSLocation` |

### Batch & Scanning
| File | Purpose |
|---|---|
| `frmStartBatchEntry.vb` | **Central operational dashboard**: 6-second auto-refresh; CTS Grid + Location filters; role-based button visibility; status-based routing to all workflow screens; inline SDEA file generation; inline PGP FTP upload logic |
| `frmBatchMaster.vb` | Batch creation form: validates 8 fields, creates DB record + network folder, supports export (3 text files → ZIP → Rijndael AES encrypt), batch delete, edit mode |
| `frmScanCheque.vb` | **Scanner interface**: Ranger API integration; 7 transport states; per-item MICR read; endorsement printing (model-specific: CR120/CR135/CR190); 14 IQA image quality tests (9 active); 3 image captures per cheque (Front B/W TIFF, Back B/W TIFF, Front Gray JPEG); DB record creation; scan limit enforcement |
| `frmDepositSlipEntry.vb` | Slip header entry during scanning: captures SlipNo and TotalInstruments before feeding begins |
| `frmScanNACH.vb` | Scanner interface variant for NACH (National Automated Clearing House) items |

### Slip & Cheque Data Entry (Maker)
| File | Purpose |
|---|---|
| `frmSlipMaster.vb` | Slip entry: batch-lock prerequisite; 8 validation steps (pickup point, slip no, account no dual-entry, amount, duplicate check, cheque count vs scanned); auto slip number (starts at 101); opens `ChequeDetails` after save |
| `frmSlipMasternew.vb` | Newer variation of slip master for specific client types |
| `ChequeDetails.vb` | Individual cheque detail entry within a slip (bank name, cheque amount, date, drawer, etc.) |
| `frmAmtEntry.vb` | **Maker amount entry**: 4 entry levels; SP_CLIENT_FLAG corporate mode (side-by-side red mismatch highlighting); 11-step save validation; OCR override dialog; Technical Rejection to `USP_UPD_TechnicalReturn` |
| `Frmqcamt.vb` | Level 2 entry form (OCR Mismatch re-entry) |
| `FrmqcAmtq.vb` | Level 3 entry form (QC supervisor pass) |
| `FRM_VALIDATE3.vb` | Level 4 entry (High-Value / RBI override) |
| `frmchequeentry_autoslip.vb` | Auto-slip variant of cheque entry for bulk processing |

### Reject Repair
| File | Purpose |
|---|---|
| `frmRejectRepair.vb` | Post-scan repair: 9-check MICR/ChequeNo validation chain; 3-mode image viewer (Front B/W, Grayscale, Back); pixel-dimension validation against 6 DB-configured bounds; saves via `RejectRepairBatchDetails()`; Lock Batch on completion |
| `frmRejectRepairAuto.vb` | Automated variant of reject repair for bulk MICR corrections |
| `FrmSlipMismatch.vb` | Reconciles mathematical mismatches between slip totals and sum of individual cheque amounts |

### Checker & Authorization
| File | Purpose |
|---|---|
| `frmChequeAuthorization.vb` | **Checker screen**: keyboard-driven (Y = approve, R = reject); PTF flag; mandatory reject remarks; grid auto-advances on each action; hidden bulk approve via `Ctrl+Shift+F10` + password `"ACPL123"` |
| `frmTechnucalScrutiny.vb` | Visual validation: stale/post-dated cheques, signature presence, MICR legibility |
| `frmTechnicalReview.vb` | Technical review interface for supervisors |

### RCMS & File Generation
| File | Purpose |
|---|---|
| `NEWRptCreateXML.vb` | **Primary CHI XML+IMG generator** (1981 lines): builds CXF XML (xmlns=010001) + binary CIBF IMG file; RSA-SHA256 MICRDS signing per cheque; 256-byte random pads in IMG; concurrent lock via `USP_UPD_BatchXMLGenInProgress`; skips MICR1[4-6]="036" SCB-Transfer cheques |
| `frmOut1gen.vb` / `frmOutgen.vb` | Menu-driven CHI generation form (calls `NEWRptCreateXML`) |
| `FrmRcmsEntry.vb` | RCMS data entry: operator-locked via `RCMSBY` + `USP_SEL_rcmsLGenInProgess` |
| `Generatesdea.vb` | Standalone SDEA form: Part A + Part C flat-file generation with 40-char drawer truncation and SCB TRANSFER ISNo override |
| `frmFTPUpload.vb` | Alternative FTP upload form (separate from inline logic in `frmStartBatchEntry`) |
| `frmFTPUploadBatchZip.vb` | Uploads entire batch ZIP over FTP |
| `frmFFileGenerate.vb` | Outward clearing file packaging |
| `frmGenerateReturnXML.vb` | Maps rejected cheques into NPCI-standard return XML |
| `frmProcessEOD.vb` | EOD reconciliation: `USP_SEL_ProcessEOD` grid (CTSAmount, RetChqCount); Excel export via `DatatableToExcel`; NACH Excel export via `USP_SEL_NACH_Entry` (22-column format, copies images) |

### Inward Returns
| File | Purpose |
|---|---|
| `frmImportOutwardReturn.vb` | Imports clearing house return files and marks cheques as bounced |
| `frmImportCTSReturn.vb` | Specifically handles CTS XML return files |
| `frmImportDBF.vb` | Imports legacy `.dbf` format return files from some CBS systems |

### Master Data Forms
| File | Purpose |
|---|---|
| `BankMaster.vb` / `BankSearch.vb` | Bank CRUD and search |
| `BranchDetails.vb` / `BranchSearch.vb` | Branch CRUD, IFSC/MICR codes |
| `frmUserMaster.vb` | User account management |
| `frmUserMenuRights.vb` | Dynamic menu right assignment per user |
| `frmClientAdd.vb` / `frmImportClientMaster.vb` | Corporate client management |
| `frmClientPoints.vb` / `frmClientEnrichmentSettings.vb` | Client pickup point and enrichment rules |
| `frmReturnReasonMaster.vb` | NPCI return reason code maintenance |
| `frmHolidayManage.vb` | Clearing holiday calendar |
| `frmLocationMaster.vb` / `frmZoneMaster.vb` | Physical scanner location hierarchy |

### NACH Module
| File | Purpose |
|---|---|
| `frmNACHBatchMaster.vb` | NACH batch management |
| `frmNACHReport.vb` | NACH reports |
| `frmNachEntry.vb` | NACH transaction data entry |

---

## 3. Web Authorization Portal (`\CCTS_Web` Project — C# ASP.NET)

| File | Purpose |
|---|---|
| `Default.aspx` | Login page and session routing |
| `UserMaster.Master` | Master page layout and CSS scaffolding for authenticated sessions |
| `authorizescheques.aspx` | Browser-based cheque authorization — mirrors `frmChequeAuthorization.vb` for branch managers without the desktop app |

---

## 4. Shared Data Layer (`\CCTSClass` Project — VB.NET Class Library)

| File | Purpose |
|---|---|
| `CCTSData.dbml` | LINQ-to-SQL ORM for operational tables: batches, cheque records, slip records, batch details, scan records |
| `DataClassesM.dbml` | LINQ-to-SQL ORM for master/reference tables: banks, branches, users, locations, return reasons |

---

## 5. Utility Projects

| Project | Purpose |
|---|---|
| `RSAendn` | RSA cryptographic signing for PKI envelopes (NPCI clearing house standard) |
| `cctsImageConverter` | Converts scanned TIFFs/JPGs to CTS 2010-compliant B&W and grayscale formats |
| `AutoUpdater` | Silent deployment mechanism: executes `.sql` patches and swaps Crystal Report `.rpt` files on login |

---

## Combined Flow-Wise File Mapping

```
A. SETUP & INITIALIZATION
   NACH_Tables.sql → NACH_SP.sql → LoginPage.vb
   → frmSelectPresentingBranch.vb → CCTSMDI.vb (MDI shell)
   → [Admin: BankMaster, BranchDetails, frmUserMaster, frmUserMenuRights,
      frmClientAdd, frmClientPoints, frmLocationMaster, frmHolidayManage]

B. BATCH CREATION (Scanner Operator)
   frmStartBatchEntry.vb → frmBatchMaster.vb
   [Validates: Clearing Type, Location+ScannerID, SummRefNo=PIF, TotalSlips, TotalAmount]
   → CreateNewBatch() SP → Network folder created
   → frmScanCheque.vb opens

C. SCANNING (Scanner Operator)
   frmScanCheque.vb
   → AxRanger1.StartUp() → TransportChangeOptionsState → EnableOptions()
   → [Before feed] frmDepositSlipEntry.vb (if new slip needed)
   → AxRanger1.StartFeeding()
   → Per item: GetMicrText() → Endorsement text → IQA tests → 3x image capture → CreateNewBatchDetails()
   → AxRanger1.ShutDown() → UpdateNoOfCheques()
   [If MICR/ChequeNo errors] → Batch Status = "RR Pending"
   [If clean] → Batch Status = "Chq. Entry Pending"

D. REJECT REPAIR (Repair Clerk) [Only if "RR Pending"]
   frmStartBatchEntry.vb → frmRejectRepair.vb
   → 9-check validation per item → Image viewer → Pixel dimension check → RejectRepairBatchDetails()
   → LockBatch() → Next status

E. SLIP & CHEQUE DATA ENTRY (Maker - L1)
   frmStartBatchEntry.vb → frmSlipMaster.vb
   → [8 validations] → ManageSlipsWithSoftSlip() → ChequeDetails.vb
   → frmAmtEntry.vb (Level 1) → USP_UPD_AmtEntry_new()
   → Batch Status = "OCR Mismatch" (if L2 needed)

F. LEVEL 2 ENTRY (Second Maker) [If "OCR Mismatch"]
   frmStartBatchEntry.vb → [User-lock check: FIBy vs DEBy] → Frmqcamt.vb
   → USP_UPD_AmtEntry_new(entryLevel=2)
   → Batch Status = "QC Pending" (if L3 needed)

G. QC / LEVEL 3 (QC Supervisor) [If "QC Pending"]
   frmStartBatchEntry.vb → FrmqcAmtq.vb (Level 3)
   → USP_UPD_AmtEntry_new(entryLevel=3)
   → [if high value] Batch Status = "3 Level Max Amount/RBI"

H. LEVEL 4 HIGH-VALUE (If "3 Level Max Amount/RBI")
   frmStartBatchEntry.vb → FRM_VALIDATE3.vb (Level 4)
   → USP_UPD_AmtEntry_new(entryLevel=4)

I. AUTHORIZATION / CHECKER
   frmChequeAuthorization.vb (desktop) OR authorizescheques.aspx (web)
   → AuthenticateCheque(): AuthStatus=1 (Approved) or AuthStatus=2 (Rejected)
   → frmTechnucalScrutiny.vb for physical trait review

J. CHI XML GENERATION (If "CHI Pending" — BatchStatus=2, data clean)
   Btn_RCMS → NEWRptCreateXML.vb (primary, 1981 lines)
   [Pre-checks] blank slip guard → authorization check (AuthStatus=1 for all) → concurrency lock
   → Per cheque (skip MICR1[4-6]="036"): read 3 images → RSA-sign MICR fingerprint
   → Build <FileHeader> XML (xmlns=010001) with <Item><AddendA><MICRDS><ImageViewDetail>x3
   → Build binary IMG file (256-byte random pads between images)
   → Write CXF_*.XML + CIBF_*.IMG to gstrExportOutwardFilePath/{GRID}/{BatchNo}/
   → PGP encryption (external process)
   → BatchStatus = 3 ("CHI XML Generated")

K. FTP UPLOAD (If "CHI XML Generated" — BatchStatus=3)
   frmStartBatchEntry.vb (inline)
   → Validate exactly 2 .pgp files (*.XML*.pgp + *.IMG*.pgp)
   → CreateFTPFolder(yyyyMMdd) + CreateFTPFolder(yyyyMMdd/BatchNo)
   → FireURL: POST to https://scbftp.airanlimited.com/addbatch.aspx?b=...&bd=...&bx=...&bi=...&loc=...&bid=...&grid=...
   → Must return "Success" via FireURL() (HttpWebRequest, timeout=300000ms)
   → UploadFile(XML.pgp) via FtpWebRequest (2KB buffer, Binary, KeepAlive=False)
   → UploadFile(IMG.pgp)
   → sel_pending_CHEQUEENTRY_RCMS(batchID, 0):
     Count=0 → UpdateBatchStatuso(5) ["RCMS Completed"] + RCOM=True + Exit
     Count>0 → UpdateBatchStatuso(4) ["RCMS Pending"]
   → Directory.Move(InitialDirectory, dInitialDirectory) → archive to \done\{GRID}\{BatchNo}\

L. RCMS ENTRY (If "RCMS Pending" — BatchStatus=4)
   frmStartBatchEntry.vb → sel_pending_CHEQUEENTRY_RCMS(batchID,1) operator-lock check
   → USP_SEL_rcmsLGenInProgess(batchID) additional in-progress check
   → FrmRcmsEntry.vb
   → After entry: UpdateBatchStatuso(5) ["RCMS Completed"]

M. SDEA FILE GENERATION (If "RCMS Completed" — BatchStatus=5)
   frmStartBatchEntry.vb (inline) OR Generatesdea.vb (standalone)
   [Pre-check] GetBatchReportStatus() must return True
   → USP_RPT_SDEA_HEADER_File() for Part A header
   → USP_RPT_SDEA_Deposit_File_NEW0() → slip D records
   → USP_RPT_SDEA_CHEQUE_File() → cheque C records
     [Drawer] DrawerName capped to 40 chars: Left(DrawerName, 40)
     [ISNo] MICR1[4-6]="036" → _ISNo = "SCB TRANSFER" else normal ISNo
     [Blank slip guard] dtchq.count()=0 → halt
   → Write Part A: ddMMyy_LC_{Location}_{PIF}_A.{BatchNo:00000}
   → UpdateBatchStatuso(6) + btnSlipSummaryPDF_Click() (Crystal Report PDF auto-export)
   → [If RPTSDEA_Deposit_File_NEW1() has rows]
     USP_RPT_SDEA_HEADER_FileA() (uses RepLocName in header)
     → Write Part C: ddMMyy_LC_{Location}_{PIF}_C.{BatchNo:00000}
     [Part C trailer guard] If totDepo=0 or totAmount=0 → warning
     → UpdateBatchStatuso(6) + btnSlipSummaryPDF_Click()

N. END OF DAY (frmProcessEOD.vb)
   USP_SEL_ProcessEOD(yyyyMMdd, GRID) → reconciliation grid
   → Excel export: DatatableToExcel() to ExportOutwardBankFile setting path
   → NACH Excel: USP_SEL_NACH_Entry(batchID, 0) → 22-column Excel + copy images

O. INWARD RETURNS (Next Day)
   frmImportDBF.vb / frmImportCTSReturn.vb / frmImportOutwardReturn.vb
   → Parse clearing house return files → Mark cheques as returned
   → frmGenerateReturnXML.vb → Return XML for NPCI
```
