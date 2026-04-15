# CCTS (Cheque Truncation System) – Project Documentation

## Project Overview

**CCTS** is an enterprise-grade, multi-tier Windows desktop + web application built for banks and clearing management companies (CMC) to digitize and process physical cheques end-to-end in compliance with India's **CTS 2010 standard** and **RBI clearing house** requirements.

The system handles the complete lifecycle of an outward cheque: from physical scanning, MICR capture, and image quality validation → dual-entry data enrichment → authorization → RCMS data entry → SDEA/CHI file generation → PGP-encrypted FTP upload to the clearing grid.

The system supports two deployment modes:
- **HUB mode** (`APPTYPE = "HUB"`): Full-featured, centralized scanning and processing hub.
- **BRANCH mode** (`APPTYPE = "BRANCH"`): Lightweight branch terminal where totals are derived from scanned data, not manually entered.

---

## Architecture & Technology Stack

### Core Languages & Framework
| Component | Language | Framework |
|---|---|---|
| Desktop Client | VB.NET | .NET Framework 4.8 |
| Web Portal | C# | ASP.NET Web Forms |
| Data Access Layer | VB.NET | LINQ to SQL (DBML) |
| Database Scripts | T-SQL | Microsoft SQL Server |

### External Libraries & Integrations
| Library | Purpose |
|---|---|
| `AxInterop.RANGERLib` | Controls physical CTS cheque scanners (Silver Bullet Ranger API). Manages transport states, MICR reading, image capture, IQA testing, and endorsement printing. |
| `Emgu.CV` / `AForge.Imaging` | Computer vision for MICR band detection and image alignment. |
| `Crystal Reports` | Generating operational PDFs — Slip Summaries, Batch Reports, SDEA reconciliation. |
| `Ionic.Zip` | Creating ZIP archives for batch export and inter-branch transfer. |
| `ClosedXML` / `EPPlus` / `DocumentFormat.OpenXml` | Excel import/export for master data and reports. |
| `SocialExplorer.FastDBF` | Reading legacy `.dbf` files from some core banking systems. |
| `System.Security.Cryptography.RijndaelManaged` | AES encryption of batch export ZIPs (key: `"QuickCTS"`). |

---

## Solution Structure (`CCTS.sln`)

### 1. CCTS – Desktop Application (`CCTS.vbproj`)
The primary Windows Forms (WinExe) application. All operational staff work here.

**Sub-systems inside the desktop app:**
- **Login & Session Management** (`LoginPage.vb`) — Version check, credential encryption, 5-attempt lockout, forced password expiry at 90 days, silent SQL patch deployment on login.
- **Batch Dashboard** (`frmStartBatchEntry.vb`) — Central hub; 6-second auto-refresh; status-based routing to correct workflow screens.
- **Batch Creation** (`frmBatchMaster.vb`) — Creates a batch record, validates scanner location, creates network folder, supports export + Rijndael encryption.
- **Scanner Interface** (`frmScanCheque.vb`) — Full Ranger API integration; endorsement printing per scanner model; 14 IQA image quality tests; CCITT4 TIFF + JPEG grayscale image capture.
- **Slip Entry** (`frmSlipMaster.vb`) — Associates scanned cheques to deposit slips; enforces batch-lock prerequisite; account number dual-entry verification.
- **Reject Repair** (`frmRejectRepair.vb`) — Post-scan MICR/ChequeNo correction; 9-check validation chain; pixel-level image dimension validation against 6 DB-configured bounds.
- **Amount Entry / Maker** (`frmAmtEntry.vb`) — 4-level dual-entry system; SP_CLIENT_FLAG corporate mode with red-highlighted mismatches; 11-step save validation; technical rejection flagging.
- **Checker / Authorization** (`frmChequeAuthorization.vb`) — Keyboard-driven Y/R approval; PTF flag; hidden `Ctrl+Shift+F10` bulk approve (password: `"ACPL123"`).
- **RCMS Entry** (`FrmRcmsEntry.vb`) — Operator-locked RCMS data entry; single operator lock per batch.
- **SDEA File Generation** (inline in `frmStartBatchEntry.vb`) — Generates fixed-length SDEA text files (Part A & Part C) in RBI-prescribed format.
- **FTP Upload** (inline in `frmStartBatchEntry.vb`) — Uploads PGP-encrypted CHI XML + IMG files to `ftp://scbftp.airanlimited.com/`.
- **Master Data** — Banks, Branches, Users, Menu Rights, Return Reasons, Holidays, CTS Grid, Locations, Clients, Client Pickup Points.
- **NACH Processing** — `frmNACHBatchMaster`, `frmNACHReport`, `frmNachEntry` for National Automated Clearing House flows.
- **Returns** — Inward and outward return file import/export.

### 2. CCTSClass – Data Layer (`CCTSClass.vbproj`)
A .NET Class Library serving as the shared Data Access Layer.
- `CCTSData.dbml` — LINQ-to-SQL ORM for operational tables (batches, cheques, slips, scan records).
- `DataClassesM.dbml` — ORM for master/reference tables (banks, branches, locations, users).
- All stored procedure calls from the desktop and web projects go through this layer.

### 3. CCTS_Web – Web Authorization Portal (`CCTS_Web.csproj`)
A lightweight C# ASP.NET Web Forms portal for remote authorization:
- `authorizescheques.aspx` — Browser-based cheque authorization for branch managers without a desktop install.
- `Default.aspx` / `UserMaster.Master` — Login and session scaffolding.

### 4. RSAendn
Handles cryptographic PKI operations (RSA signing) required for NPCI-format clearing house file transmissions.

### 5. cctsImageConverter
Utility for converting scanned TIFFs/JPGs into CTS 2010-compliant grayscale and B&W formats.

### 6. AutoUpdater
Silent hot-patch deployment mechanism. On every login, the app scans `\SQL\` for `.sql` patches to execute and `\NewReports\` for updated Crystal Report `.rpt` files — both applied automatically without user interaction.

---

## Database & Scripts

| File | Purpose |
|---|---|
| `NACH_Tables.sql` | DDL — Creates all operational and master tables |
| `NACH_SP.sql` | All stored procedures: `USP_Validate_Login`, `USP_UPD_BatchStatus`, `USP_UPD_AmtEntry_new`, `USP_UPD_TechnicalReturn`, `USP_RPT_SDEA_*`, `sel_pending_CHEQUEENTRY_RCMS`, etc. |
| `NACH_FUN.sql` | SQL scalar functions for date calculation, MICR parsing, amount formatting |
| `NACH_Client.sql` | Seed data for baseline client and bank configuration |

---

## Key Settings (Read via `GetSettings()`)

| Setting Key | Purpose |
|---|---|
| `APPTYPE` | `"HUB"` or `"BRANCH"` — controls which UI elements are shown |
| `ScannerCode` | `"CR120"`, `"CR135"`, or `"CR190"` — determines endorsement API call |
| `ScannerID` | Physical scanner station ID |
| `OutwardChqCount` | Maximum cheques allowed to scan per batch |
| `CLEARINGTYPE` | CTS clearing type code (e.g. `"01"`) |
| `RCMSFILEPATHNEW` | Local path where SDEA files are written |
| `gstrExportOutwardFilePath` | Path where PGP files are found for FTP upload |
| `FBWMinHeight/MaxHeight/MinWidth/MaxWidth` | Front B/W image pixel dimension limits for reject repair |
| `BBWMin*/Max*` | Back B/W image pixel dimension limits |
| `FGMin*/Max*` | Front Grayscale image pixel dimension limits |
| `CHIVersion` | Application version — must match DB setting or login is blocked |

---

## Deployment Steps

1. Restore `NACH_Tables.sql`, `NACH_SP.sql`, `NACH_FUN.sql`, `NACH_Client.sql` onto a **Microsoft SQL Server** instance.
2. Open `CCTS.sln` in **Visual Studio 2015 or later** (originally VS 2012; safe to upgrade).
3. Update connection strings in `CCTS/app.config` (desktop) and `CCTS_Web/Web.config` (web portal).
4. Set **CCTS** as the Startup Project for the desktop app, or **CCTS_Web** for the authorization portal.
5. Ensure the physical Ranger scanner driver is installed on the scanning workstation.
6. Configure `APPTYPE`, `ScannerCode`, `ScannerID`, and network shared path settings in the database settings table.
