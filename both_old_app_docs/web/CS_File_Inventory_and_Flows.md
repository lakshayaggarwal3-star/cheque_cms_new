# CS (Modern) – File Inventory & Flow Mapping

This document provides a comprehensive inventory of all source files in the **Modern Web-based Clearing System (CS)**, their technical roles, and their detailed participation in the clearing flow.

---

## 1. Core Configuration & Startup

| File | Technical Role | Purpose |
|---|---|---|
| [CS.sln](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/CS.sln) | Visual Studio Solution | Orchestrates the modern .NET 8 project. |
| [Program.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Program.cs) | Startup Configuration | Configures Dependency Injection (DI), Authentication, Session settings, and MVC routing. |
| [appsettings.json](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/appsettings.json) | Configuration Settings | Stores SQL connection strings (`DefaultConnection`, `SecondaryConnection`) and SFTP credentials. |

---

## 2. Controllers (Business Logic Layers)

### Session & Security
| File | Functional Purpose |
|---|---|
| [LoginController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/LoginController.cs) | Handles `SessionToken` generation and concurrency checks. |
| [AutoLogoutMiddleware.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Models/AutoLogoutMiddleware.cs) | Middleware for expiring inactive sessions. |

### Core Clearing Workflow
| File | Functional Purpose | Key Methods |
|---|---|---|
| [BatchController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/BatchController.cs) | Lifecycle management of batches and sub-batches. | `CreateBatch`, `GetTodaysBatches`, `UnlockBatch` |
| [ScanController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/ScanController.cs) | Orchestrates image and MICR capture via Ranger.js. | `SaveScannedImages`, `UpdateMICR` |
| [RRController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/RRController.cs) | Post-scan MICR repair for unreadable items. | `GetRRItems`, `UpdateRepairData` |
| [MakerController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/MakerController.cs) | Level 1 entry and slip balancing logic. | `UpdateMakerDetails`, `GetSlips`, `InserSlipDetail` |
| [CheckerController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/CheckerController.cs) | Level 2 verification and segregation check. | `UpdateCheckerDetails`, `ValidateDuplicateData` |
| [QCController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/QCController.cs) | Automated field comparison and discrepancy review. | `GetMismatchedItems`, `ResolveDiscrepancy` |

### Generation & Submission
| File | Functional Purpose | Key Methods |
|---|---|---|
| [XMLController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/XMLController.cs) | Generates signed OTS XML and binary OTI IMG files. | `CreateXmlFile`, `Encrypt` (RSA-SHA256), `DownloadXmlFile` |
| [GEFUReportController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/GEFUReportController.cs) | Generates fixed-width text files for CBS integration. | `GenerateGEFUTextFile` |
| [SftpController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/SftpController.cs) | Securely uploads clearing files via SSH. | `UploadToBank` |

---

## 3. Models & Data Layer (DbContexts)

| File | Technical Role | Table Mapping |
|---|---|---|
| [ApplicationDbContext.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Data/ApplicationDbContext.cs) | Primary Context | `Batch`, `Cheques`, `SubBatchTbl`, `UserMaster`, `LocationMaster` |
| [SecondaryDbContext.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Data/SecondaryDbContext.cs) | Lookup Context | `AccountMaster` (External validation) |
| [Cheques.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Models/Cheques.cs) | Data Model | Maps all MICR fields, Amounts, Dates, and 4 Image Paths. |
| [Batch.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Models/Batch.cs) | Data Model | Maps `BatchStatus`, `User_Lock`, and `Report_Status`. |

---

## 4. Front-End (Views & Hardware Integration)

| File | Purpose |
|---|---|
| [Ranger.js](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/wwwroot/js/Ranger.js) | Hardware bridge for controlling Silver Bullet Ranger scanners via WebSockets. |
| [_Layout.cshtml](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Views/Shared/_Layout.cshtml) | Main UI shell, sidebar navigation, and global JS/CSS references. |

---

## Detailed Combined Flow Mapping

```
A. AUTHENTICATION (LoginController.cs)
   User Credentials Check → SessionToken Generation → EOD Date Assignment
   → Concurrency Validation (AutoLogoutMiddleware.cs)

B. BATCHING (BatchController.cs)
   Select Location → Create BatchNo ({LocID}{Date}{Seq}) → Set User_Lock
   → [Optional] Create Sub-batches (SubBatchTbl.cs)

C. SCANNING (ScanController.cs + Ranger.js)
   WebSocket Start → Capture 4 Images (wwwroot/...) → OCR/MICR Read
   → Save to Cheques Table (Ini_Rej=0 or RR_Pending)

D. REJECT REPAIR (RRController.cs) [If RR_Pending]
   Load Image (Front/Back) → Manual MICR Correction → Numeric Length Checks
   → Move to Maker Status

E. MAKER (MakerController.cs)
   Load Slip → Load Cheques → Enter Amount/Date/Account
   → [Validation] TotalChequeAmount == SlipAmount
   → [Validation] AccountMaster (SecondaryDbContext) lookup
   → Set BatchStatus = 6

F. CHECKER (CheckerController.cs)
   [Validation] MakerUserID != CheckerUserID (Segregation of Duties)
   → Blind Verification of Amount/Date/MICR
   → Set BatchStatus = 7

G. QUALITY CONTROL (QCController.cs)
   Automated Field Comparison (Maker vs Checker) → Flag Mismatches
   → Manual Supervisor Decision → Set BatchStatus = 8

H. FILE GENERATION (XMLController.cs + GEFUReportController.cs)
   RSA-SHA256 MICR Signing → Binary Image Concatenation (OTI IMG)
   → XML Metadata Generation (OTS XML) → CBS Flat File (GEFU)
   → Set Report_Status = 1

I. SUBMISSION (SftpController.cs + sftpUploader.cs)
   Load SSH Settings (appsettings.json) → Secure Transfer to Bank FTP
   → Archive Local Files (E:\Location Reports\...)
```
