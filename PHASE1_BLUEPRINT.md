# CHEQUE PROCESSING SYSTEM (CPS) — PHASE 1 FULL BLUEPRINT

**Project**: New Web-Based Cheque Clearing System  
**Bank**: SCB (Standard Chartered Bank) — migrating from legacy desktop CCTS + learnings from web CS (HDFC)  
**Stack**: .NET 8 Web API + React SPA (same port, no separate frontend server)  
**Date**: April 2026  
**Scope of this document**: Phase 1 only — Login → Batch → Scan → Slip → RR Complete

---

## TABLE OF CONTENTS

1. Application Architecture
2. Tech Stack & Project Structure
3. Database Design (ALL tables, all fields)
4. API Routes (All controllers)
5. User & Role System
6. Location Master
7. Client Master
8. Master Upload System (Excel)
9. Batch Creation Flow
10. Scanning Engine
11. Slip Entry Module
12. RR (Reject Repair) Module
13. Image Storage Architecture
14. Batch Dashboard & Status Machine
15. Responsive UI Rules
16. Performance & Security Rules
17. Mistakes from Old Apps (DO NOT REPEAT)
18. Developer Mode
19. Definition of Done (Phase 1)
20. Phase 2 Preview (DO NOT BUILD YET)

---

## 1. APPLICATION ARCHITECTURE

### 1.1 Single Port Design

Everything runs on ONE port (e.g., `https://localhost:5000`).

```
https://localhost:5000/          → React SPA (served from wwwroot)
https://localhost:5000/api/...   → .NET Web API endpoints
https://localhost:5000/images/... → Static file serving for scanned images
```

No CORS issues. No port confusion. No separate React dev server in production.

### 1.2 Backend Architecture (LAYERED — MANDATORY)

```
Controller (HTTP only — no logic)
    ↓
Service (ALL business logic, validation, flow control)
    ↓
Repository (DB queries ONLY — no logic)
    ↓
Database (SQL Server)
```

**Rules:**
- Controllers: only parse request, call service, return response
- Services: validation, business rules, orchestration
- Repositories: EF Core queries, no business logic
- NEVER put business logic in a controller
- NEVER put SQL/EF calls directly in a controller

### 1.3 Frontend Architecture

```
/frontend/src/
├── pages/         (Login, Dashboard, BatchCreate, Scanning, SlipEntry, RR)
├── components/    (shared UI components)
├── services/      (API call wrappers — axios)
├── hooks/         (custom React hooks)
├── store/         (state management — Redux or Zustand)
└── utils/         (helpers, formatters)
```

React build output → `/wwwroot/` → served by .NET `UseStaticFiles()` + SPA fallback.

### 1.4 Project Folder Structure

```
/CPS/
├── CPS.API/                    (.NET Web API project)
│   ├── Controllers/
│   │   ├── AuthController.cs
│   │   ├── UserController.cs
│   │   ├── LocationController.cs
│   │   ├── ClientController.cs
│   │   ├── BatchController.cs
│   │   ├── ScanController.cs
│   │   ├── SlipController.cs
│   │   ├── RRController.cs
│   │   └── MasterUploadController.cs
│   ├── Services/
│   ├── Repositories/
│   ├── Models/                 (DB entities)
│   ├── DTOs/                   (request/response objects)
│   ├── Middleware/
│   │   ├── AuthMiddleware.cs
│   │   └── SessionMiddleware.cs
│   ├── wwwroot/                (React build output goes here)
│   └── Program.cs
│
├── CPS.Frontend/               (React project)
│   ├── src/
│   └── package.json
│
└── /ChequeData/                (image storage — outside wwwroot)
    └── {BankCode}/{LocationCode}/{YYYY}/{MM}/{DD}/{BatchNo}/
```

---

## 2. TECH STACK

| Layer | Technology |
|---|---|
| Backend framework | ASP.NET Core 8 Web API |
| Data access | Entity Framework Core 8 (Code-First) |
| Database | SQL Server 2019+ |
| Frontend | React 18 + TypeScript |
| State management | Zustand |
| HTTP client | Axios |
| UI library | Tailwind CSS (responsive by default) |
| Image processing | SixLabors.ImageSharp |
| Excel upload parsing | EPPlus or ClosedXML |
| Authentication | JWT Bearer tokens (stateless) |
| Password hashing | BCrypt.Net |
| Scanner service comm | HTTP REST (localhost:7000) |
| Image serving | .NET `UseStaticFiles` with `PhysicalFileProvider` |

---

## 3. DATABASE DESIGN

### RULES (before looking at tables)
- Every table has: `CreatedBy`, `CreatedAt`, `UpdatedBy`, `UpdatedAt`
- Soft delete: `IsDeleted` (bit, default 0), `DeletedBy`, `DeletedAt`
- All FK relationships enforced
- Index every column used in WHERE clauses
- NO images in DB — store path only
- NO business logic in stored procedures (use application layer)
- Normalize — no duplicate columns

---

### 3.1 UserMaster

```sql
UserMaster
----------
UserID          INT         PK IDENTITY
EmployeeID      VARCHAR(20) UNIQUE NOT NULL        -- used for login
Username        VARCHAR(50) UNIQUE NOT NULL        -- also usable for login
PasswordHash    VARCHAR(255) NOT NULL              -- bcrypt hash NEVER plain text
Email           VARCHAR(100)
IsActive        BIT         DEFAULT 1
RoleScanner     BIT         DEFAULT 0
RoleMaker       BIT         DEFAULT 0
RoleChecker     BIT         DEFAULT 0
RoleAdmin       BIT         DEFAULT 0
IsDeveloper     BIT         DEFAULT 0
DefaultLocationID INT       FK → Location.LocationID
IsLoggedIn      BIT         DEFAULT 0
SessionToken    UNIQUEIDENTIFIER                   -- rotated on every login
LoginAttempts   INT         DEFAULT 0
IsLocked        BIT         DEFAULT 0             -- locked after 5 bad attempts
CreatedBy       INT
CreatedAt       DATETIME2
UpdatedBy       INT
UpdatedAt       DATETIME2
IsDeleted       BIT         DEFAULT 0
DeletedBy       INT
DeletedAt       DATETIME2
```

**Admin role = all roles on**  
**Developer role = all roles on + IsDeveloper = 1**

---

### 3.2 UserLocationHistory

```sql
UserLocationHistory
-------------------
HistoryID       INT         PK IDENTITY
UserID          INT         FK → UserMaster.UserID
LocationID      INT         FK → Location.LocationID
AssignedDate    DATE        NOT NULL
IsTemporary     BIT         DEFAULT 0              -- 1 = day-only assignment
AssignedBy      INT         FK → UserMaster.UserID
CreatedAt       DATETIME2

INDEX: (UserID, AssignedDate)
```

Logic: To find current location for a user on a given date → get the most recent record where AssignedDate <= today.

---

### 3.3 Location

```sql
Location
--------
LocationID      INT         PK IDENTITY
LocationName    VARCHAR(100) NOT NULL
LocationCode    VARCHAR(20) UNIQUE NOT NULL        -- e.g., "AHM"
State           VARCHAR(50)
Grid            VARCHAR(50)
ClusterCode     VARCHAR(50)
Zone            VARCHAR(100)
LocType         VARCHAR(20)                        -- "Scanner" or "Mobile"
PIFPrefix       VARCHAR(10)                        -- e.g., "AHM" for batch no
IsActive        BIT         DEFAULT 1
CreatedBy       INT
CreatedAt       DATETIME2
UpdatedBy       INT
UpdatedAt       DATETIME2
IsDeleted       BIT         DEFAULT 0

INDEX: (LocationCode)
```

---

### 3.4 LocationScanner

```sql
LocationScanner
---------------
ScannerMappingID INT        PK IDENTITY
LocationID      INT         FK → Location.LocationID
ScannerID       VARCHAR(20) NOT NULL               -- from master e.g., "618"
ScannerModel    VARCHAR(100)                       -- e.g., "Ranger", "Flatbed"
ScannerType     VARCHAR(20)                        -- "Cheque" or "Document"
IsActive        BIT         DEFAULT 1
CreatedBy       INT
CreatedAt       DATETIME2
UpdatedBy       INT
UpdatedAt       DATETIME2

INDEX: (LocationID, IsActive)
```

---

### 3.5 LocationFinance

```sql
LocationFinance
---------------
FinanceID       INT         PK IDENTITY
LocationID      INT         FK → Location.LocationID UNIQUE
BOFD            VARCHAR(20)
PreTrun         VARCHAR(20)
DepositAccount  VARCHAR(30)
IFSC            VARCHAR(15)
CreatedBy       INT
CreatedAt       DATETIME2
UpdatedBy       INT
UpdatedAt       DATETIME2
```

---

### 3.6 ClientMaster

```sql
ClientMaster
------------
ClientID        INT         PK IDENTITY
CityCode        VARCHAR(20) NOT NULL               -- e.g., "MADANIP"
ClientName      VARCHAR(200) NOT NULL
Address1        VARCHAR(200)
Address2        VARCHAR(200)
Address3        VARCHAR(200)
Address4        VARCHAR(200)
Address5        VARCHAR(200)
PickupPointCode VARCHAR(20)
PickupPointDesc VARCHAR(200)
RCMSCode        VARCHAR(20)
Status          CHAR(1)                            -- 'A' = Active, 'X' = Inactive
StatusDate      DATE
CreatedBy       INT
CreatedAt       DATETIME2
UpdatedBy       INT
UpdatedAt       DATETIME2
IsDeleted       BIT         DEFAULT 0

INDEX: (CityCode)
INDEX: (RCMSCode)
```

---

### 3.7 BatchSequence

```sql
BatchSequence
-------------
SeqID           INT         PK IDENTITY
BatchDate       DATE        NOT NULL
LocationID      INT         FK → Location.LocationID NOT NULL
LastSeqNo       INT         NOT NULL DEFAULT 0

UNIQUE CONSTRAINT: (BatchDate, LocationID)

INDEX: (BatchDate, LocationID)
```

**CRITICAL**: Increment with a transaction + lock to prevent duplicates.

```sql
-- Safe increment pattern (always use this):
BEGIN TRANSACTION
  UPDATE BatchSequence WITH (UPDLOCK)
  SET LastSeqNo = LastSeqNo + 1
  WHERE BatchDate = @date AND LocationID = @locId
  
  IF @@ROWCOUNT = 0
    INSERT INTO BatchSequence (BatchDate, LocationID, LastSeqNo) VALUES (@date, @locId, 1)
  
  SELECT LastSeqNo FROM BatchSequence WHERE BatchDate = @date AND LocationID = @locId
COMMIT TRANSACTION
```

---

### 3.8 Batch

```sql
Batch
-----
BatchID         BIGINT      PK IDENTITY
BatchNo         VARCHAR(20) UNIQUE NOT NULL        -- system-generated: {PIFPrefix}{DDMMYYYY}{seq:D2} e.g. "AHM1404202601"
SummRefNo       VARCHAR(30)                        -- operator-entered from physical PIF paper form
PIF             VARCHAR(30)                        -- operator-entered Processing Instruction Form number; must equal SummRefNo
LocationID      INT         FK → Location.LocationID
ScannerMappingID INT        FK → LocationScanner.ScannerMappingID
PickupPointCode VARCHAR(20)
BatchDate       DATE        NOT NULL               -- EOD processing date
ClearingType    VARCHAR(5)  DEFAULT '01'           -- '01'=CTS, '11'=Non-CTS
IsPDC           BIT         DEFAULT 0
PDCDate         DATE                               -- only if IsPDC=1
TotalSlips      INT         DEFAULT 0
TotalAmount     DECIMAL(15,3) DEFAULT 0
ScanType        VARCHAR(10) DEFAULT 'Scan'         -- 'Scan' or 'Rescan'
WithSlip        BIT                                -- set when scanning starts
BatchStatus     INT         DEFAULT 0
StatusHistory   NVARCHAR(MAX)                      -- JSON audit trail of status changes
CreatedBy       INT         FK → UserMaster.UserID
CreatedAt       DATETIME2
UpdatedBy       INT
UpdatedAt       DATETIME2
IsDeleted       BIT         DEFAULT 0
DeletedBy       INT
DeletedAt       DATETIME2

INDEX: (LocationID, BatchDate)
INDEX: (BatchStatus)
INDEX: (BatchNo)
```

**BatchStatus values:**
| Value | Label |
|---|---|
| 0 | Created - Scanning Not Started |
| 1 | Scanning Started |
| 2 | Scanning Pending (started but not completed) |
| 3 | Scanning Completed |
| 4 | RR Pending |
| 5 | RR Completed |

---

### 3.9 Slip

```sql
Slip
----
SlipID          INT         PK IDENTITY
BatchID         BIGINT      FK → Batch.BatchID
SlipNo          VARCHAR(20) NOT NULL               -- user-entered slip number
ClientCode      VARCHAR(20) FK → ClientMaster.CityCode (lookup only, not hard FK)
ClientName      VARCHAR(200)
DepositSlipNo   VARCHAR(50)
PickupPoint     VARCHAR(20)
TotalInstruments INT        DEFAULT 0              -- expected cheque count
SlipAmount      DECIMAL(15,3) DEFAULT 0
Remarks         NVARCHAR(500)
SlipStatus      INT         DEFAULT 0             -- 0=Open, 1=Complete
CreatedBy       INT         FK → UserMaster.UserID
CreatedAt       DATETIME2
UpdatedBy       INT
UpdatedAt       DATETIME2
IsDeleted       BIT         DEFAULT 0

INDEX: (BatchID)
UNIQUE: (BatchID, SlipNo)
```

---

### 3.10 ScanItems

```sql
ScanItems
---------
ScanID          BIGINT      PK IDENTITY
BatchID         BIGINT      FK → Batch.BatchID
SeqNo           INT         NOT NULL               -- sequence within batch, starts at 1
IsSlip          BIT         DEFAULT 0              -- 1 = this record is a slip scan
SlipID          INT         FK → Slip.SlipID (nullable, only for cheques under a slip)
ImageFrontPath  VARCHAR(500)                       -- relative path: /ChequeData/SCB/AHM/2026/04/14/AHM14042026001/F_0001.jpg
ImageBackPath   VARCHAR(500)
MICRRaw         VARCHAR(100)                       -- raw MICR string from scanner
ChqNo           VARCHAR(10)                        -- 6 digits parsed from MICR
MICR1           VARCHAR(15)                        -- 9-digit bank/branch code
MICR2           VARCHAR(15)                        -- 6-digit account from MICR
MICR3           VARCHAR(5)                         -- 2-digit transaction code
ScannerType     VARCHAR(20)                        -- 'Cheque' or 'Document'
ScanType        VARCHAR(10)                        -- 'Scan' or 'Rescan'
RRState         INT         DEFAULT 0              -- 0=Needs Review, 1=Approved, 2=Repaired
RRBy            INT
RRTime          DATETIME2
MICRRepairFlag  VARCHAR(10)                        -- which MICR fields were repaired
CreatedBy       INT
CreatedAt       DATETIME2
UpdatedBy       INT
UpdatedAt       DATETIME2

INDEX: (BatchID)
INDEX: (BatchID, SeqNo)
INDEX: (SlipID)
```

---

### 3.11 MasterUploadLog

```sql
MasterUploadLog
---------------
UploadID        INT         PK IDENTITY
MasterType      VARCHAR(50) NOT NULL               -- 'Location', 'Client', etc.
FileName        VARCHAR(255)
UploadedBy      INT         FK → UserMaster.UserID
UploadDate      DATETIME2
Status          VARCHAR(20)                        -- 'Processing', 'Success', 'PartialSuccess', 'Failed'
TotalRows       INT         DEFAULT 0
SuccessRows     INT         DEFAULT 0
ErrorRows       INT         DEFAULT 0
ErrorLog        NVARCHAR(MAX)                      -- JSON array of error rows with messages
CreatedAt       DATETIME2
```

---

## 4. API ROUTES

All routes prefixed with `/api/`.

### Auth
```
POST   /api/auth/login             → login with EmployeeID or Username + password + EOD date
POST   /api/auth/logout            → logout, clear session token
POST   /api/auth/change-password   → user changes own password
```

### User Management (Admin/Developer only)
```
GET    /api/users                  → list all users
POST   /api/users                  → create user
PUT    /api/users/{id}             → update user
PUT    /api/users/{id}/location    → change user location (temp or permanent)
PUT    /api/users/{id}/status      → activate/deactivate
```

### Location
```
GET    /api/locations              → list all locations (with scanner + finance data)
GET    /api/locations/{id}         → single location detail
POST   /api/locations              → create location (Admin/Dev only)
PUT    /api/locations/{id}         → update location
GET    /api/locations/{id}/scanners → get scanners for location
```

### Client
```
GET    /api/clients                → list/search clients
GET    /api/clients/{code}         → get by city code (for auto-fill)
POST   /api/clients                → create
PUT    /api/clients/{id}           → update
```

### Master Upload
```
POST   /api/master-upload/location → upload location Excel
POST   /api/master-upload/client   → upload client Excel
GET    /api/master-upload/template/{type} → download Excel template
GET    /api/master-upload/logs     → upload history
```

### Batch
```
GET    /api/batch                  → list batches (filtered by date, status, location)
GET    /api/batch/{id}             → single batch detail
POST   /api/batch                  → create batch
PUT    /api/batch/{id}/status      → update batch status (admin/developer)
GET    /api/batch/dashboard        → dashboard summary counts
```

### Scan
```
GET    /api/scan/{batchId}         → get scan session info
POST   /api/scan/{batchId}/start   → mark scan started, set WithSlip flag
POST   /api/scan/{batchId}/save-image  → receive image from scanner service
POST   /api/scan/{batchId}/save-cheque → save cheque MICR data
POST   /api/scan/{batchId}/complete → mark scanning completed
```

### Slip
```
GET    /api/slip/{batchId}         → list slips in batch
POST   /api/slip                   → create slip
PUT    /api/slip/{id}              → update slip
GET    /api/slip/{id}/cheques      → get cheques linked to slip
```

### RR
```
GET    /api/rr/{batchId}           → list items needing RR
GET    /api/rr/item/{scanId}       → get single item with images + MICR
PUT    /api/rr/item/{scanId}       → save RR corrections
POST   /api/rr/{batchId}/complete  → mark RR done for batch
```

---

## 5. USER & ROLE SYSTEM

### 5.1 Roles

| Role | Access |
|---|---|
| Scanner | Batch create, scanning, slip scan |
| Maker | Slip entry, cheque data entry (Phase 2) |
| Checker | Verification (Phase 2) |
| Admin | Full access to everything including user management, location change, master upload |
| Developer | Admin + mock scan, data override, skip validations |

Roles stored as individual bit columns in `UserMaster`, not as a role table — keeps queries simple.

### 5.2 Login Flow

1. User enters EmployeeID OR Username + Password + selects EOD Date
2. Server looks up user by EmployeeID or Username
3. Verify bcrypt password hash
4. Check `IsActive = 1`, `IsLocked = 0`
5. If user already `IsLoggedIn = 1`: warn user, ask to force login (force clears old session)
6. On success:
   - Generate new `SessionToken` (GUID), save to DB
   - Set `IsLoggedIn = 1`, reset `LoginAttempts = 0`
   - Return JWT containing: UserID, EmployeeID, Roles, LocationID, EODDate, SessionToken
7. On failure: increment `LoginAttempts`, lock if >= 5

### 5.3 JWT Payload

```json
{
  "userId": 1,
  "employeeId": "EMP001",
  "roles": ["Scanner", "Admin"],
  "locationId": 5,
  "eodDate": "2026-04-14",
  "sessionToken": "uuid-here"
}
```

### 5.4 Session Validation (Middleware)

Every API request:
1. Extract JWT → get UserID + SessionToken
2. Load `UserMaster.SessionToken` from DB
3. If mismatch → 401 Unauthorized (user logged in elsewhere)

### 5.5 Dynamic Location Assignment

Admin can change user location:
- **Temporary**: valid for one day only (insert into `UserLocationHistory` with `IsTemporary = 1`)
- **Permanent**: update `UserMaster.DefaultLocationID` + insert history record

Current location resolution: most recent `UserLocationHistory` record for today, or `DefaultLocationID` if no today record.

### 5.6 Password Rules

- User can change own password only
- Admin/Developer can reset any user's password
- Minimum 8 chars (enforce in service layer)
- Store bcrypt hash ONLY — never plain text

---

## 6. LOCATION MASTER

### 6.1 Data from Provided Sample (normalize into 3 tables)

The location Excel has these columns:
`SrNo, Grid, State, LocationName, LocationCode, ClusterCode, Zone, ScannerID, BOFD, PreTrun, DepositAc, IFSC, LocType, PIFNumber`

Split on upload:
- `SrNo, Grid, State, LocationName, LocationCode, ClusterCode, Zone, LocType` → **Location table**
- `ScannerID, LocType (type of scanner)` → **LocationScanner table**
- `BOFD, PreTrun, DepositAc, IFSC` → **LocationFinance table**
- `PIFNumber` → stored in Location as `PIFPrefix`

### 6.2 Scanner Dropdown in Batch Creation

When creating a batch, show scanners for the user's current location:
```
GET /api/locations/{locationId}/scanners
→ Returns: ScannerID, ScannerModel, ScannerType
```

### 6.3 Scanner ID in Batch Number

PIF prefix comes from `Location.PIFPrefix` (e.g., "AHM").

---

## 7. CLIENT MASTER

### 7.1 Data from Provided Sample

Excel columns: `CITY_CODE, NAME, ADDRESS1-5, PICKUP_POINT_CODE, PICKUPPOINT_DESCRIPTION, RCMS_CODE, STATUS, STATUS_DATE`

Maps 1:1 to `ClientMaster` table.

### 7.2 Auto-fill in Slip Entry

User types `ClientCode` (CityCode) → API returns client details → auto-fill:
- ClientName
- PickupPointCode
- PickupPointDesc
- RCMSCode

User cannot edit auto-filled fields, only the code input.

---

## 8. MASTER UPLOAD SYSTEM

### 8.1 Flow

```
Admin uploads Excel file
    ↓
Backend validates file format (check column headers)
    ↓
Parse rows
    ↓
Validate each row (mandatory fields, data types, duplicates)
    ↓
For Location upload: split into Location + LocationScanner + LocationFinance
For Client upload: insert/update by CityCode
    ↓
Save success rows
    ↓
Log errors (row number + field + message)
    ↓
Return: total rows, success count, error count, error details
```

### 8.2 Validation Rules

**Location Upload:**
- `LocationCode` and `LocationName` are mandatory
- `ScannerID` must not be empty or "000"
- `LocType` must be "Scanner" or "Mobile"
- Duplicate `LocationCode` → update existing record

**Client Upload:**
- `CITY_CODE` and `NAME` are mandatory
- `STATUS` must be 'A' or 'X'
- Duplicate `CITY_CODE + NAME` combination → update existing record

### 8.3 Template Download

Pre-built Excel templates with correct column headers downloadable from UI.

### 8.4 UI Features

- Upload button (drag & drop support)
- Download template button
- Upload progress indicator
- Result table showing error rows with reason
- Upload history log

---

## 9. BATCH CREATION

### 9.1 Pre-conditions

- User must be logged in with Scanner role (or Admin/Developer)
- User must have a valid location assigned

### 9.2 Batch Creation Screen Fields

| Field | Source | Editable |
|---|---|---|
| Batch Date | EOD date from login (default today) | Yes |
| Location | User's current location | Yes (dropdown of all locations) |
| Scanner ID | From LocationScanner for selected location | Yes (dropdown) |
| Pickup Point Code | From ClientMaster for user's location | Yes (dropdown) |
| Clearing Type | Default "CTS (01)" | Yes (CTS=01, Non-CTS=11) |
| PDC Checkbox | Default unchecked | Yes |
| PDC Date | Hidden unless PDC checked | Yes |
| Total Slips | User input | Yes |
| Total Amount | User input | Yes |

### 9.3 Batch Number, SummRefNo, and PIF — Three Separate Fields

> Updated 2026-04-14: BatchNo, SummRefNo, and PIF are now stored as separate fields — matching legacy CCTS behaviour.

#### BatchNo — system-generated internal identifier

**Format**: `{ScannerPart(6)}{YYMMDD}{seq:D4}`

Example: `1281282604270001`

- `ScannerPart` = `Scanner.ScannerID`. If the ScannerID is **3 digits**, it is **duplicated** (e.g., "128" becomes "128128", "012" becomes "012012"). If it is **6 digits**, it is used as is.
- Date = batch date in **YYMMDD** format (last 2 digits of year, month, date).
- Sequence = day-wise counter per location/scanner, starting at 1, zero-padded to **4 digits** (0001, 0002 … 9999).
- Sequence resets to 1 each new date per location/scanner mapping.

**Safe generation** (transaction + lock — see section 3.7):
- Always use `UPDATE BatchSequences WITH (UPDLOCK)` inside a transaction
- Sequence resets to 1 each new date per location

#### SummRefNo — operator-entered

- Operator reads this from the physical PIF paper form and types it in.
- Required — cannot be blank.

#### PIF — operator-entered

- Operator reads this from the physical PIF paper form and types it in.
- Required — cannot be blank.
- **Must equal SummRefNo** — server rejects if they differ (same rule as legacy CCTS: *"Summary Ref No and PIF must be the same."*)
- On the batch creation form, PIF auto-fills to match SummRefNo as the operator types.

### 9.4 Create Batch Flow

1. User fills form including SummRefNo and PIF from the paper form, clicks "Create Batch"
2. API validates all fields; rejects if SummRefNo ≠ PIF
3. Lock `BatchSequence` row → increment → get new seq
4. Generate `BatchNo` as `{PIFPrefix}{DDMMYYYY}{seq:D2}`
5. Insert `Batch` record with `BatchStatus = 0`, storing BatchNo, SummRefNo, PIF separately
6. Return batch details
7. UI shows batch created confirmation with BatchNo + PIF
8. UI shows "Start Scanning" button

### 9.5 Batch Dashboard

Show batches with real-time status. Status labels:
| BatchStatus | Display Label |
|---|---|
| 0 | Created — Scanning Not Started |
| 1 | Scanning In Progress |
| 2 | Scanning Pending |
| 3 | Scanning Completed |
| 4 | RR Pending |
| 5 | RR Completed |

User can click any batch to resume from current status.

---

## 10. SCANNING ENGINE

### 10.1 Scan Types

| Type | Description |
|---|---|
| Scan | Normal — first time scanning this batch |
| Rescan | Correction run — old batch with scan issues |

Set at batch level when user starts scanning.

### 10.2 With Slip vs Without Slip

Set when user clicks "Start Scanning" — cannot be changed after.

**With Slip:**
- Order: Slip Scan → Cheque(s) → Slip Scan → Cheque(s) → repeat
- After slip scan: show slip entry form
- After all cheques of that slip: ask if more slips

**Without Slip:**
- Cheques only, no slip records required
- Can still capture cheque MICR data

### 10.3 Scanner Types

| Type | Library / Method | Notes |
|---|---|---|
| Cheque Scanner (Ranger) | Ranger WebSocket bridge | For MICR reading + cheque image |
| Normal Document Scanner | TWAIN or WIA via local scanner agent | For slip/document scanning |

Both scanners accessed through local Scanner Service (see section 10.6).

### 10.4 Scan Screen Layout

**Desktop layout:**
```
┌──────────────────┬────────────────────────────┐
│  Left Panel      │  Right Panel               │
│  ─────────────   │  ─────────────             │
│  [Front Image]   │  Scan Mode: Scan/Rescan    │
│                  │  With/Without Slip         │
│  [Back Image]    │  Current: Slip/Cheque      │
│                  │  Scanner: Cheque/Document  │
│                  │  ─────────────             │
│                  │  [Start Feed]              │
│                  │  [Stop Feed]               │
│                  │  [Save]                    │
│                  │  [Shutdown Scanner]        │
│                  │  ─────────────             │
│                  │  Item: 1/10               │
│                  │  Status: OK / MICR Error  │
└──────────────────┴────────────────────────────┘
```

**Mobile layout:** stack vertically (images on top, controls below).

### 10.5 Scanning Sequence (With Slip Mode)

```
Start Scanning
    ↓
Ask: Is this a SLIP or CHEQUE scan?
    ├── SLIP:
    │     Ask: Scanning with Cheque Scanner or Document Scanner?
    │     Start feed on selected scanner
    │     Capture slip image(s)
    │     Save to disk, store path in ScanItems (IsSlip=1)
    │     Show Slip Entry Form → user fills slip data → create Slip record
    │     ↓
    │     Ask: Is next item a CHEQUE?
    │     ├── YES: Switch to CHEQUE mode
    │     └── NO: More slips or done
    │
    └── CHEQUE:
          Cheque scanner ALWAYS used (Ranger only)
          Start feed on Ranger
          Capture front + back images + MICR
          Save images to disk, store paths
          Save ScanItems record (IsSlip=0, SlipID = current slip)
          Loop until no more cheques for this slip
          ↓
          Next slip or complete
```

### 10.6 Scanner Service (Local Agent)

A separate lightweight process running on the scanning PC at `http://localhost:7000`.

**Responsibilities:**
- Control Ranger scanner (start/stop/shutdown feed)
- Control document scanner (start/stop)
- Capture images
- Save images to configured `ChequeData` path
- Return file path + MICR data to web API

**Web app communication:**
- Web API calls Scanner Service REST endpoints
- Scanner Service saves files to shared disk
- Web app reads images via static file serving

**Scanner Service API (Phase 1):**
```
POST /scanner/ranger/start-feed
POST /scanner/ranger/stop-feed
POST /scanner/ranger/capture       → returns { imageFrontPath, imageBackPath, micrRaw }
POST /scanner/ranger/shutdown
POST /scanner/document/start
POST /scanner/document/capture     → returns { imagePath }
POST /scanner/document/stop
GET  /scanner/status               → health check
```

Developer mode: Scanner Service returns mock images from a test folder without real hardware.

### 10.7 Batch Status During Scanning

- Click "Start Scanning" → `BatchStatus = 1`
- If user leaves mid-scan → `BatchStatus = 2` (Scanning Pending)
- Click "Complete Scanning" → only allowed after Ranger shutdown confirmed → `BatchStatus = 3` → then system evaluates → if any MICR errors → `BatchStatus = 4` (RR Pending), else → `BatchStatus = 5`

### 10.8 Rescan Handling

New scan item created with `ScanType = 'Rescan'`. Original record preserved. If same SeqNo rescanned, create with suffix `_v2`:
```
F_0001_v2.jpg
B_0001_v2.jpg
```

---

## 11. SLIP ENTRY MODULE

### 11.1 Slip Entry Form Fields

| Field | Input Type | Notes |
|---|---|---|
| Slip No | Text | Manual entry |
| Client Code | Text | User types → auto-fill triggers |
| Client Name | Text (auto-fill) | Auto-filled from ClientMaster |
| Deposit Slip No | Text | Manual |
| Pickup Point | Dropdown | Auto-filled but changeable |
| Total Instruments | Number | Expected cheque count |
| Slip Amount | Decimal | Declared total |
| Remarks | Text | Optional |

### 11.2 Auto-fill Trigger

On blur of Client Code field:
```
GET /api/clients/{code}
→ fills: ClientName, PickupPoint (dropdown with pre-selected value)
```

### 11.3 Validation

- Client Code must exist in ClientMaster (and Status = 'A')
- Total Instruments must be > 0
- Slip Amount must be > 0
- Same SlipNo cannot appear twice in same batch

Phase 2 will add: Slip Amount must equal sum of linked cheque amounts.

### 11.4 Slip ↔ Cheque Linking

- When slip entry is saved: `SlipID` is set on the `Slip` record
- All `ScanItems` captured after slip scan (until next slip) are linked: `ScanItems.SlipID = Slip.SlipID`

---

## 12. RR (REJECT REPAIR) MODULE

### 12.1 What triggers RR

After scanning completes:
- System reviews all `ScanItems` for the batch
- Any item with `MICRRaw` = null or empty, or MICR parse failures → `RRState = 0` (needs review)
- If any items have `RRState = 0` → `BatchStatus = 4` (RR Pending)

### 12.2 RR Screen Layout

```
┌─────────────────────────────────────────────────────────┐
│  Batch: AHM14042026001   Item: 3 of 8 needing repair    │
├──────────────────┬────────────────────────────────────── │
│  FRONT IMAGE     │  BACK IMAGE                          │
│                  │                                       │
│  [Image Tools]   │  [Image Tools]                        │
│  Crop            │  Crop                                 │
│  Brightness      │  Brightness                           │
│  Rotate          │  Rotate                               │
│  Zoom            │  Zoom                                 │
├──────────────────┴────────────────────────────────────── │
│  MICR DATA                Slip Data (if linked)         │
│  Cheque No: ______        Slip No: ____                  │
│  MICR1: _________         Client: ____                   │
│  MICR2: _________         Amount: ____                   │
│  MICR3: ___               Instruments: ____              │
├─────────────────────────────────────────────────────────┤
│  [APPROVE]    [SAVE CORRECTIONS]    [SKIP]    [NEXT]    │
└─────────────────────────────────────────────────────────┘
```

### 12.3 Actions

| Action | Effect |
|---|---|
| Approve | `RRState = 1`, `RRBy = UserID`, `RRTime = now` |
| Save Corrections | Update MICR fields, set `MICRRepairFlag`, `RRState = 2` (repaired) |
| Skip | Move to next item (come back later) |
| Next | Move to next item |

### 12.4 Image Tools

- **Crop**: draw selection rectangle on image
- **Brightness/Contrast**: slider controls
- **Rotate**: 90°/180°/270°
- **Zoom**: in/out

Tools apply only for display/editing in RR — save corrected image if user accepts.

Image processing backend: `SixLabors.ImageSharp`

### 12.5 RR Completion

When all items have `RRState != 0` → user can click "Complete RR" → `BatchStatus = 5`.

---

## 13. IMAGE STORAGE ARCHITECTURE

### 13.1 Configurable Base Path (IMPORTANT)

The image storage location is **fully configurable** — no hardcoded paths anywhere in code.

**Configuration sources (in priority order):**
1. `AppSettings` DB table — admin can change at runtime via Admin UI
2. `appsettings.json` — fallback if no DB override

```json
"ChequeData": {
  "BasePath": "C:\\Users\\laksh\\OneDrive\\Desktop\\new  cms applaiton\\ChequeData",
  "BankCode": "SCB",
  "WebPath": "/images"
}
```

**Dev default path**: `C:\Users\laksh\OneDrive\Desktop\new  cms applaiton\ChequeData`

**Production**: set to any path the server admin chooses — application reads from config.

Admin UI must expose a setting to change `BasePath` without restarting the app. Change is saved to `AppSettings` DB table and picked up on next request.

### 13.2 Folder Structure

```
{BasePath}\
  └── {BankCode}\                    e.g., SCB
        └── {LocationCode}\          e.g., AHM
              └── {YYYY}\            e.g., 2026
                    └── {MM}\        e.g., 04
                          └── {DD}\  e.g., 14
                                └── {BatchNo}\  e.g., AHM14042026001
                                      ├── F_0001.jpg   (front cheque)
                                      ├── B_0001.jpg   (back cheque)
                                      ├── F_0002.jpg
                                      ├── B_0002.jpg
                                      └── S_0001.jpg   (slip scan)
```

### 13.3 Serving Images via .NET

The static file middleware maps the configured `BasePath` to the `/images` web path:

```csharp
// In Program.cs — path read from config/DB, not hardcoded
var basePath = configuration["ChequeData:BasePath"];
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(basePath),
    RequestPath = "/images"
});
```

UI accesses image at:
```
https://localhost:5000/images/SCB/AHM/2026/04/14/AHM14042026001/F_0001.jpg
```

### 13.4 DB Storage

`ScanItems.ImageFrontPath` and `ScanItems.ImageBackPath` store **relative path only**:

```
SCB/AHM/2026/04/14/AHM14042026001/F_0001.jpg
```

UI constructs full URL as: `{window.location.origin}/images/{relativePath}`

NEVER store the full disk path in the DB — it will break when storage location changes.

### 13.5 Images Used Across All App Pages

Images appear in multiple modules — design image URL construction as a shared utility:

| Module | Where images appear |
|---|---|
| Scanning screen | Live preview while scanning |
| RR screen | Front + back side by side with edit tools |
| Maker (Phase 2) | View cheque while entering data |
| Checker (Phase 2) | View cheque while verifying |
| Reports (Phase 2) | Thumbnails in batch summary |

**Frontend rule**: create a single `getImageUrl(relativePath: string): string` utility function used everywhere. If `relativePath` is null/empty, show a placeholder image. Never construct the URL inline in components.

### 13.6 Image Format Rules

- Save as JPG (not PNG — smaller file size)
- Resize during save to max 1200px width (maintain aspect ratio)
- Quality: 85% compression
- Thumbnails for list views: max 300px (named `T_0001.jpg`)

### 13.7 Scanner Service Saves Images

Scanner Service (running locally) writes images directly to `{BasePath}\...`. The Scanner Service must also read its save path from the same config (passed from web app when starting a scan session). No base64. No streaming images through the API.

### 13.8 AppSettings DB Table

```sql
AppSettings
-----------
SettingID       INT         PK IDENTITY
SettingKey      VARCHAR(100) UNIQUE NOT NULL   -- e.g., "ChequeData:BasePath"
SettingValue    NVARCHAR(500) NOT NULL
Description     NVARCHAR(200)
UpdatedBy       INT         FK → UserMaster.UserID
UpdatedAt       DATETIME2
```

Keys stored:
- `ChequeData:BasePath`
- `ChequeData:BankCode`
- `ScannerService:BaseUrl`

Admin UI: Settings page (Admin/Developer only) — shows key + editable value + last changed by/at.

---

## 14. BATCH DASHBOARD & STATUS

### 14.1 Dashboard Summary Counts

```
Total Batches Today:  ___
Scanning Pending:     ___
RR Pending:           ___
Completed:            ___
```

### 14.2 Batch List Table

Columns: BatchNo | BatchDate | Location | Scanner | Status | Total Slips | Total Amount | Created By | Actions

Actions per status:
| Status | Actions |
|---|---|
| 0 - Created | Start Scanning |
| 1 - Scanning In Progress | Continue Scanning |
| 2 - Scanning Pending | Continue Scanning |
| 3 - Scanning Completed | Start RR |
| 4 - RR Pending | Continue RR |
| 5 - RR Completed | (no more actions in Phase 1) |

### 14.3 Status Transition Rules

```
Created (0)
  → Scanning In Progress (1)   [trigger: user clicks Start Scanning]
  → Scanning Pending (2)       [trigger: user navigates away mid-scan]
  → Scanning Completed (3)     [trigger: scanner shutdown + user clicks Complete]
  → RR Pending (4)             [trigger: system detects MICR errors]
  → RR Completed (5)           [trigger: all RR items resolved, user clicks Complete RR]
```

Admin/Developer can force status change at any time.

---

## 15. RESPONSIVE UI RULES

### 15.1 Device Breakpoints

| Breakpoint | Device |
|---|---|
| < 640px | Mobile |
| 640px–1024px | Tablet |
| > 1024px | Desktop/Laptop |

### 15.2 Layout Behavior

| Element | Mobile | Tablet | Desktop |
|---|---|---|---|
| Tables | Card layout | Scrollable compact table | Full table |
| Scan screen | Stacked (images above, controls below) | Compact side by side | Full side by side |
| Sidebar nav | Hamburger menu | Collapsible | Always visible |
| Buttons | Large, full-width | Medium | Normal |
| Fonts | 16px base | 15px base | 14px base |
| Form fields | Full width stacked | 2-column | 3-column grid |

### 15.3 Tailwind Config

Use Tailwind CSS utility classes with responsive prefixes:
```
sm:  → >= 640px
md:  → >= 768px
lg:  → >= 1024px
xl:  → >= 1280px
```

### 15.4 Scanner Screen Note

Scanning is primarily a desktop operation. On mobile, show a warning: "Scanning is best performed on desktop." But UI must not break — use stacked layout.

---

## 16. PERFORMANCE & SECURITY

### 16.1 Performance Rules

**Backend:**
- All controller actions `async`
- No synchronous DB calls
- Cache location master + client master in `IMemoryCache` (5-minute TTL)
- Avoid N+1 queries — use `.Include()` or explicit joins

**Frontend:**
- React lazy loading for page components
- No unnecessary re-renders (memoize components)
- Paginate batch list (20 per page)
- Lazy load images in RR screen (load only current item)

**Database:**
- Index columns in every WHERE clause
- Use pagination in all list queries (`OFFSET/FETCH`)
- Avoid `SELECT *` — always select specific columns
- No cross-join without filter

### 16.2 Security Rules

- All passwords: bcrypt with cost factor 12
- JWT tokens: HS256, 8-hour expiry
- All API endpoints require valid JWT (except `/api/auth/login`)
- Role checks enforced in service layer (not just controller)
- Input validation on ALL user inputs (server side — do not rely on client)
- SQL injection: use parameterized queries only (EF Core handles this)
- XSS: React escapes by default — do not use `dangerouslySetInnerHTML`
- CORS: restrict to same origin (no cross-origin since same port)
- Image paths: never expose full disk path to client — only relative web paths
- File upload: validate file type + size, reject non-Excel files

---

## 17. MISTAKES FROM OLD APPS — DO NOT REPEAT

### From Desktop CCTS (bad patterns):
- Hardcoded usernames in code for access control (e.g., `if username == "shivam"`) → **Use role flags in DB**
- Plain text passwords in database → **Use bcrypt**
- Business logic scattered across form code and stored procedures → **Use service layer**
- No audit trail on status changes → **Log every transition**
- Huge stored procedures that do everything → **Application-layer logic only**
- Batch number without locking → **Use locked transactions**
- WinForms tightly coupled to scanner → **Scanner Service abstraction**

### From Web CS/HDFC app (bad patterns):
- Separate frontend/backend ports (3000 + 5000) → **Same port**
- Session stored in cookies only with no server-side token validation → **JWT + server-side session token**
- UserMaster with multiple `IsAdmin` / `IsSuperAdmin` flags causing confusion → **Clean role flags**
- EF hybrid (Code-First + DB-First) causing migration conflicts → **Code-First only**
- `UserMaster.UPassword` stored plain text → **bcrypt always**
- `MaxValue` for file upload limit → **Set reasonable limit (50MB)**
- Secondary DB for account lookup hardcoded into controllers → **Abstract into repository**
- No image folder structure → one flat folder → **Structured hierarchy**
- Base64 images sent through API → **File system + static serving**
- Status labels hardcoded per row in view layer → **Status enum in service layer**
- LOC typo preserved: `"OCR Mistmatch"` → **Fix typos in new app**

### General anti-patterns to avoid:
- Copy-paste queries between controllers
- Hardcoded strings (connection strings, paths, magic numbers) → use `appsettings.json`
- No pagination → returning 10,000 rows at once
- Storing images in DB BLOB columns
- Random or timestamp-only file names (collisions possible)
- Fat controllers
- Fat stored procedures
- No soft delete (hard deletes lose audit trail)

---

## 18. DEVELOPER MODE

When `UserMaster.IsDeveloper = 1`:

| Feature | Normal | Developer |
|---|---|---|
| Scan | Real scanner required | Mock scanner returns test images |
| Batch status | Follow state machine | Can force any status |
| Validation | Enforced | Can skip with toggle |
| Data edit | Restricted | Can edit any field |
| MICR data | From scanner | Can manually enter |
| Location | Based on assignment | Can select any location |

Developer mode mock scan: returns pre-defined test images from `/ChequeData/TEST/MOCK/` folder. These images are bundled with the application.

---

## 19. DEFINITION OF DONE (PHASE 1)

All items below must be complete and tested before Phase 1 is considered done:

### Backend
- [ ] Auth API (login/logout/change password) with bcrypt + JWT
- [ ] User CRUD + location assignment API
- [ ] Location CRUD API + scanner mapping
- [ ] Client CRUD API
- [ ] Excel upload for Location + Client masters
- [ ] Batch creation with safe sequence generation
- [ ] Scan API (save image paths, MICR data)
- [ ] Slip creation API with client auto-fill
- [ ] RR API (list items, save corrections, complete RR)
- [ ] Dashboard summary API
- [ ] Static file serving for images
- [ ] Role-based authorization middleware

### Frontend
- [ ] Login page (Employee ID / Username, password, EOD date)
- [ ] Batch dashboard with status
- [ ] Batch creation form
- [ ] Scanning screen (with slip / without slip modes)
- [ ] Slip entry form with auto-fill
- [ ] RR screen with image viewer + image tools
- [ ] Location master management UI
- [ ] Client master management UI
- [ ] User management UI (admin)
- [ ] Master upload UI (Excel upload + error display)
- [ ] Fully responsive on mobile/tablet/desktop

### Database
- [ ] All tables created with proper indexes and constraints
- [ ] No duplicate batch numbers possible
- [ ] Audit fields on every table
- [ ] Soft delete implemented

### Testing
- [ ] Full flow end-to-end: Login → Create Batch → Scan → Slip Entry → RR → Complete
- [ ] Mock scan with developer mode
- [ ] Excel upload with valid + invalid rows
- [ ] Location assignment (temp + permanent)
- [ ] Concurrent batch creation (no duplicate sequence)

---

## 20. PHASE 2 PREVIEW (DO NOT BUILD IN PHASE 1)

Phase 2 starts only after Phase 1 is fully tested in production.

**Phase 2 modules:**
1. **Maker (L1)**: Cheque data entry + MICR verification + slip amount validation
2. **Checker (L2)**: Blind re-entry + segregation of duties (Maker ≠ Checker enforced)
3. **QC**: Compare Maker vs Checker values, resolve mismatches
4. **XML (OTS) Generation**: Bank-standard XML file with cheque data
5. **IMG (OTI) Generation**: Cheque image bundle file
6. **RSA Digital Signing**: RSA-SHA256 signature on generated files
7. **PGP Encryption**: Encrypt files before upload
8. **SFTP Upload**: Upload to bank grid server
9. **RCMS Processing**: Bank validation + enrichment
10. **Reports**: Batch summary, daily, error, duplicate reports
11. **Return Processing**: Import return files, update cheque status

---

## 21. API RESPONSE STANDARD

Every API endpoint — success or error — returns the same envelope shape. No exceptions.

### 21.1 Success Response

```json
{
  "success": true,
  "data": { },
  "message": "optional success message"
}
```

### 21.2 Error Response

```json
{
  "success": false,
  "errorCode": "VALIDATION_ERROR",
  "message": "User-friendly message shown in UI",
  "details": [
    { "field": "ClientCode", "message": "Client code not found" }
  ]
}
```

### 21.3 Error Codes (Standard Set)

| Code | Meaning |
|---|---|
| `VALIDATION_ERROR` | Input failed validation |
| `NOT_FOUND` | Record does not exist |
| `UNAUTHORIZED` | No valid JWT or session expired |
| `FORBIDDEN` | JWT valid but role insufficient |
| `CONFLICT` | Duplicate record (e.g., duplicate SlipNo) |
| `SCANNER_ERROR` | Scanner Service unreachable or returned error |
| `INTERNAL_ERROR` | Unhandled exception — details logged server-side only |

### 21.4 HTTP Status Codes

| Situation | HTTP Status |
|---|---|
| Success | 200 |
| Created | 201 |
| Validation error | 400 |
| Auth missing/expired | 401 |
| Role insufficient | 403 |
| Not found | 404 |
| Conflict/duplicate | 409 |
| Server error | 500 |

### 21.5 Pagination Standard

All list endpoints accept and return:

```
Request query params:
  ?page=1&pageSize=20&sortBy=CreatedAt&sortDir=desc

Response data shape:
{
  "success": true,
  "data": {
    "items": [...],
    "totalCount": 145,
    "page": 1,
    "pageSize": 20,
    "totalPages": 8
  }
}
```

Default page size: 20. Max page size: 100.

---

## 22. LOGGING STANDARD

### 22.1 Library

Use **Serilog** with .NET dependency injection.

### 22.2 Log Sinks

- **File**: daily rolling log files in `/Logs/cps-YYYYMMDD.log`
- **Console**: during development
- **DB** (optional, Phase 2): critical events only — login failures, status changes

### 22.3 What to Log

| Event | Level | What to include |
|---|---|---|
| Every API request | Information | Method, path, UserID, duration |
| Login success | Information | UserID, EmployeeID, IP |
| Login failure | Warning | EmployeeID attempted, IP, attempt count |
| Account locked | Warning | UserID, EmployeeID |
| Batch status change | Information | BatchID, OldStatus, NewStatus, UserID |
| Scanner Service call | Information | Endpoint, result, duration |
| Unhandled exception | Error | Full stack trace, request details |
| Image save | Information | BatchID, SeqNo, file path |
| Master upload | Information | MasterType, FileName, rows success/fail |
| AppSettings change | Warning | Key, OldValue masked, ChangedBy UserID |

### 22.4 Log Format

Structured JSON logging:

```json
{
  "timestamp": "2026-04-14T10:23:11.123Z",
  "level": "Information",
  "message": "Batch status changed",
  "batchId": 42,
  "oldStatus": 1,
  "newStatus": 3,
  "userId": 7
}
```

### 22.5 Rules

- NEVER log passwords, JWT tokens, or session tokens — not even partially
- NEVER log full image paths in user-facing responses
- Log correlation ID on every request (use `Activity.Current.Id` or middleware-generated GUID) so all log lines for one API call are traceable

---

## 23. GLOBAL EXCEPTION HANDLING

### 23.1 Middleware

Register a global exception handling middleware in `Program.cs` — catches ALL unhandled exceptions.

```
Request
  ↓
GlobalExceptionMiddleware
  ↓ catches exception
  → Log full stack trace (server only)
  → Return standardized error response (never expose stack trace to UI)
```

### 23.2 Response on Unhandled Exception

```json
{
  "success": false,
  "errorCode": "INTERNAL_ERROR",
  "message": "An unexpected error occurred. Please try again or contact support.",
  "details": []
}
```

Stack trace: logged internally. Never returned to client.

### 23.3 Validation Errors

Use a `ValidationException` (custom) thrown by services. The middleware catches it and returns `400 VALIDATION_ERROR` with field-level details.

### 23.4 Known Exception Types

| Exception | HTTP | Error Code |
|---|---|---|
| `ValidationException` | 400 | `VALIDATION_ERROR` |
| `NotFoundException` | 404 | `NOT_FOUND` |
| `ConflictException` | 409 | `CONFLICT` |
| `ForbiddenException` | 403 | `FORBIDDEN` |
| `ScannerException` | 503 | `SCANNER_ERROR` |
| All others | 500 | `INTERNAL_ERROR` |

---

## 24. CONCURRENCY CONTROL

### 24.1 Batch Sequence (Already Covered — Section 3.7)

Use `UPDLOCK` transaction. Only one batch number generated at a time per location+date.

### 24.2 Scanning Lock — One Scanner Per Batch

Only ONE user can actively scan a batch at any time.

**Implementation:**
- `Batch` table has `ScanLockedBy` (INT, nullable) — FK to UserMaster.UserID
- `ScanLockedAt` (DATETIME2, nullable)

```sql
-- Add to Batch table:
ScanLockedBy    INT         NULL    -- UserID currently scanning
ScanLockedAt    DATETIME2   NULL    -- When lock was acquired
```

**Lock flow:**
1. User clicks "Start Scanning" → API attempts to acquire lock
2. If `ScanLockedBy IS NULL` → set `ScanLockedBy = UserID`, `ScanLockedAt = NOW()`
3. If `ScanLockedBy = another UserID` → return `CONFLICT`: `"Batch is currently being scanned by another user"`
4. If `ScanLockedBy = same UserID` → allow (user returning to own session)
5. On "Complete Scanning" or logout → release lock (`ScanLockedBy = NULL`, `ScanLockedAt = NULL`)

**Stale lock detection:**
- If `ScanLockedAt` is more than 30 minutes ago → treat as stale, allow override
- Admin/Developer can always force-release any lock

### 24.3 RR Concurrency

Same pattern — one user per batch in RR at a time:

```sql
-- Add to Batch table:
RRLockedBy      INT         NULL
RRLockedAt      DATETIME2   NULL
```

### 24.4 Optimistic Concurrency on Updates

For `Batch`, `Slip`, `ScanItems` updates — use EF Core concurrency token (`[Timestamp]` / `rowversion`) to detect and reject conflicting simultaneous edits.

---

## 25. SECURITY — ADDITIONAL RULES

### 25.1 Login Rate Limiting

- Max 5 failed attempts per EmployeeID → account locked (`IsLocked = 1`)
- API-level: max 10 login attempts per IP per minute (middleware)
- Use `AspNetCoreRateLimit` or custom middleware

### 25.2 JWT Storage (Frontend)

- Store JWT in **`httpOnly` cookie** — NOT in `localStorage` (XSS risk) or `sessionStorage`
- Cookie flags: `HttpOnly`, `Secure`, `SameSite=Strict`
- On 401 response: clear cookie, redirect to login

### 25.3 File Upload Security

- Validate MIME type (must be `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` for .xlsx)
- Validate file extension AND content header (not just extension)
- Max upload size: 10MB per file
- Scan filename for path traversal characters (`../`, `..\\`, `/`)
- Save uploaded file to temp path, process, delete temp file

### 25.4 Image Path Traversal Prevention

When serving images via static files:
- URL is mapped through `PhysicalFileProvider` which restricts to `BasePath`
- Never accept raw file paths from client
- Never pass user-provided paths to `File.ReadAllBytes()` or similar
- DB-stored relative paths are the ONLY source for image paths

### 25.5 Input Sanitization

- Trim whitespace on all string inputs
- Reject null/empty on mandatory fields (service layer)
- Max length validation matching DB column sizes
- Reject control characters in text fields

### 25.6 HTTPS

- In production: HTTPS only, redirect HTTP → HTTPS
- In development: can use HTTP on 5000 for simplicity

---

## 26. IMAGE STORAGE — SIZE AND LIFECYCLE

### 26.1 Per-Image Size Limits

| Image Type | Max size after compression |
|---|---|
| Cheque front (full) | 2 MB |
| Cheque back (full) | 2 MB |
| Slip scan | 3 MB |
| Thumbnail | 200 KB |

- Scanner Service must resize + compress before saving
- Web API rejects image paths where the saved file exceeds limits

### 26.2 Disk Space Monitoring

- On application startup: log available disk space on image storage drive
- If available space < 5 GB → log `Warning`
- If available space < 1 GB → log `Error` and show admin banner in UI
- Expose `GET /api/system/health` endpoint: returns disk space + Scanner Service status

### 26.3 Image Lifecycle (Phase 1)

- Images are permanent for Phase 1 — no auto-deletion
- Phase 2/3 will add: archive to cold storage after 90 days, keep DB paths intact

---

## 27. BACKUP STRATEGY

Images and the database are **critical financial records**. Loss = regulatory issue.

### 27.1 Database Backup

- Full backup: daily (off-peak hours)
- Transaction log backup: every 1 hour
- Retention: 30 days minimum
- Store backups on separate drive or remote location

### 27.2 Image Storage Backup

- Incremental backup: daily (only new files)
- Full backup: weekly
- Retention: 90 days minimum (regulatory requirement for cheque records)
- Store backups off the primary server

### 27.3 Recovery Plan

- RTO (Recovery Time Objective): < 4 hours
- RPO (Recovery Point Objective): < 1 hour (due to hourly log backups)
- Test restore procedure: monthly

### 27.4 In-App Backup Awareness

- `AppSettings` table changes are logged with old + new value (for audit)
- `BatchSequence` table is part of DB backup — sequence integrity is preserved on restore

---

## 28. FRONTEND API LAYER STANDARD

### 28.1 All API Calls Through One Service Layer

No component should call axios directly. All calls go through `/src/services/api.ts`.

```typescript
// /src/services/api.ts
const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true   // send httpOnly cookie automatically
});

// Request interceptor — nothing needed (cookie sent automatically)

// Response interceptor
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Session expired → redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 28.2 Per-Module Service Files

```
/src/services/
├── api.ts          (axios instance + interceptors)
├── authService.ts
├── batchService.ts
├── scanService.ts
├── slipService.ts
├── rrService.ts
├── locationService.ts
├── clientService.ts
└── masterUploadService.ts
```

Each service file exports typed functions:

```typescript
// batchService.ts
export async function createBatch(data: CreateBatchDto): Promise<BatchDto> {
  const res = await apiClient.post('/batch', data);
  return res.data.data;
}
```

### 28.3 Image URL Utility (Mandatory)

```typescript
// /src/utils/imageUtils.ts
export function getImageUrl(relativePath: string | null | undefined): string {
  if (!relativePath) return '/assets/placeholder-cheque.png';
  return `${window.location.origin}/images/${relativePath}`;
}
```

Used everywhere images are displayed — scanning screen, RR, Maker, reports. Never inline.

### 28.4 Error Handling in Components

```typescript
try {
  const batch = await createBatch(formData);
  // success
} catch (error) {
  const apiError = error as ApiErrorResponse;
  showToast(apiError.message ?? 'An error occurred');
}
```

Use a shared `ApiErrorResponse` TypeScript type matching the backend error envelope.

### 28.5 Loading and Error States

Every async operation in a component must handle:
- `loading = true` → show spinner/skeleton
- `error` → show inline error message
- `success` → show data

---

## 29. TESTING STRATEGY

### 29.1 Backend — Unit Tests

Test services in isolation. Mock repositories.

What to test:
- Batch number generation logic (correct format, correct seq)
- Login validation (bad password, locked account, force login)
- Slip validation (duplicate SlipNo, missing client)
- Status transition guards (e.g., cannot complete scan without scanner shutdown)
- MICR parse logic

Framework: xUnit + Moq

### 29.2 Backend — Integration Tests

Test API endpoints with real (test) DB.

What to test:
- Full login flow
- Batch creation with sequence increment
- Concurrent batch creation (two requests at same time → no duplicate seq)
- Image path saving and retrieval
- Excel upload with mixed valid/invalid rows

Framework: `WebApplicationFactory<Program>` + in-memory SQL Server or LocalDB

### 29.3 Frontend — Component Tests

Framework: Vitest + React Testing Library

What to test:
- Login form validation (empty fields, wrong format)
- Batch creation form (all fields, dropdowns)
- Image URL utility (`getImageUrl` with null, empty, valid paths)
- Slip entry auto-fill (mock API call)

### 29.4 Scanner Service Mock

For all backend integration tests and frontend tests:
- Mock Scanner Service runs at `http://localhost:7000` during tests
- Returns fixed test images from `/TestData/MockImages/`
- Developer mode in real app uses same mock

### 29.5 Concurrency Test

Must test:
- Two simultaneous `POST /api/batch` calls for same location+date → only one gets seq 1, other gets seq 2, no error
- Two simultaneous scan lock requests for same batch → one succeeds, one gets `CONFLICT`

---

## 30. APPSETTINGS HOT-RELOAD

### 30.1 Problem

Admin changes `ChequeData:BasePath` in the DB `AppSettings` table. The .NET static file middleware is registered at startup — changing `BasePath` at runtime needs a reload mechanism.

### 30.2 Solution

Use a named singleton `IImageStorageConfig` that reads from DB on each access, cached for 60 seconds:

```csharp
public interface IImageStorageConfig
{
    string BasePath { get; }
    string BankCode { get; }
    void Invalidate();  // call this when admin changes settings
}
```

On `PUT /api/settings` → service calls `IImageStorageConfig.Invalidate()` → next access re-reads from DB.

### 30.3 Static File Middleware Hot-Reload

Static file middleware cannot be re-registered mid-request. Solution:

Use a custom image-serving controller instead of pure static files:

```
GET /api/images/{*relativePath}
→ reads BasePath from IImageStorageConfig
→ constructs full path
→ validates path is within BasePath (prevent traversal)
→ serves file with appropriate Content-Type
```

This adds a tiny bit of overhead vs pure static serving but allows runtime BasePath changes and proper security validation.

DB stores relative path. Frontend calls `/api/images/{relativePath}`. BasePath resolved server-side.

---

## 31. CODE STANDARDS

### 31.1 Backend Naming

| Element | Convention |
|---|---|
| Classes | PascalCase |
| Methods | PascalCase |
| Variables | camelCase |
| Constants | UPPER_SNAKE_CASE |
| DB columns | PascalCase (matching EF entity) |
| API routes | kebab-case (`/api/master-upload`) |

### 31.2 Frontend Naming

| Element | Convention |
|---|---|
| Components | PascalCase (`BatchCreateForm.tsx`) |
| Hooks | camelCase with `use` prefix (`useBatchList`) |
| Services | camelCase (`batchService.ts`) |
| Types/Interfaces | PascalCase (`BatchDto`, `CreateBatchRequest`) |
| Constants | UPPER_SNAKE_CASE |
| CSS classes | Tailwind utilities only (no custom CSS files unless necessary) |

### 31.3 Status Enums (Use These in Code — Not Magic Numbers)

**Backend (C#):**
```csharp
public enum BatchStatus
{
    Created = 0,
    ScanningInProgress = 1,
    ScanningPending = 2,
    ScanningCompleted = 3,
    RRPending = 4,
    RRCompleted = 5
}

public enum RRState
{
    NeedsReview = 0,
    Approved = 1,
    Repaired = 2
}

public enum SlipStatus
{
    Open = 0,
    Complete = 1
}
```

**Frontend (TypeScript):**
```typescript
export enum BatchStatus {
  Created = 0,
  ScanningInProgress = 1,
  ScanningPending = 2,
  ScanningCompleted = 3,
  RRPending = 4,
  RRCompleted = 5
}
```

Never use raw `0`, `1`, `2` etc. in conditional checks — always use the enum.

---

## 32. TRANSACTIONS & DATA CONSISTENCY

### 32.1 Rule

**ALL multi-step DB operations MUST be wrapped in a transaction scope.** A "multi-step operation" = anything that touches more than one table or more than one row in the same logical unit of work.

If step 2 fails, step 1 must be rolled back. No partial saves.

### 32.2 Mandatory Transaction Scopes

| Operation | Tables touched | Must be atomic |
|---|---|---|
| Batch creation | `BatchSequence` + `Batch` | Yes — seq increment + batch insert as one unit |
| Scan save | `ScanItems` + `Batch` (status update) | Yes |
| Slip + scan linking | `Slip` + `ScanItems` (SlipID update) | Yes |
| Scan complete | `Batch` (status + lock release) + evaluate MICR errors | Yes |
| RR update | `ScanItems` (MICR fields + RRState) + `Batch` (status if all resolved) | Yes |
| RR complete | `ScanItems` (remaining) + `Batch` (status → RRCompleted) | Yes |
| User location change | `UserLocationHistory` + `UserMaster.DefaultLocationID` (if permanent) | Yes |
| Master upload (per row) | Each row insert/update is its own transaction — fail one row, continue others | Yes (row-level) |

### 32.3 EF Core Implementation

Use `IDbContextTransaction`:

```csharp
await using var tx = await _context.Database.BeginTransactionAsync();
try
{
    // step 1
    // step 2
    await _context.SaveChangesAsync();
    await tx.CommitAsync();
}
catch
{
    await tx.RollbackAsync();
    throw;
}
```

For `BatchSequence` specifically, use raw SQL with `UPDLOCK` inside the transaction (EF does not support `WITH (UPDLOCK)` hints natively).

### 32.4 Never Call SaveChanges Mid-Method

In a multi-step service method, do NOT call `SaveChangesAsync()` between steps. Call it ONCE at the end, then commit. This ensures all changes are part of one transaction.

---

## 33. ROW VERSIONING / CONCURRENCY TOKENS

### 33.1 Problem

Two users simultaneously:
- Edit the same cheque in RR
- Update the same batch status
- Save the same slip

Without concurrency tokens → last write silently wins → data corruption.

### 33.2 Add `RowVersion` to Critical Tables

Add `RowVersion ROWVERSION` column to these tables:

```sql
-- Add to: Batch, Slip, ScanItems
RowVersion  ROWVERSION   NOT NULL
```

`ROWVERSION` is auto-incremented by SQL Server on every UPDATE. EF Core uses it as a concurrency token automatically.

### 33.3 EF Core Mapping

```csharp
public class Batch
{
    // ... other fields ...
    [Timestamp]
    public byte[] RowVersion { get; set; }
}
```

EF Core will include `WHERE RowVersion = @original` in all UPDATE statements. If the row was changed by another user between read and save, EF throws `DbUpdateConcurrencyException`.

### 33.4 Handling Concurrency Exception

In services, catch `DbUpdateConcurrencyException` and return a `ConflictException`:

```
"This record was modified by another user. Please refresh and try again."
```

Frontend shows this message and reloads the current item.

### 33.5 Double-Click / Double Submit Prevention

**Frontend**: disable the submit button immediately on first click, re-enable only on error response.

**Backend**: for idempotent operations (e.g., Complete Batch), check current status before acting — if already in target status, return success without re-processing.

---

## 34. VALIDATION LAYER (FLUENT VALIDATION)

### 34.1 Library

Use **FluentValidation** for all input validation in the service layer.

```
dotnet add package FluentValidation.AspNetCore
```

### 34.2 Validator Per DTO

One validator class per request DTO:

```
/Validators/
├── CreateBatchRequestValidator.cs
├── LoginRequestValidator.cs
├── CreateSlipRequestValidator.cs
├── SaveRRCorrectionValidator.cs
└── CreateUserRequestValidator.cs
```

### 34.3 Example Validator

```csharp
public class CreateBatchRequestValidator : AbstractValidator<CreateBatchRequest>
{
    public CreateBatchRequestValidator()
    {
        RuleFor(x => x.LocationID).GreaterThan(0).WithMessage("Location is required");
        RuleFor(x => x.ScannerMappingID).GreaterThan(0).WithMessage("Scanner is required");
        RuleFor(x => x.BatchDate).NotEmpty().WithMessage("Batch date is required");
        RuleFor(x => x.ClearingType).Must(v => v == "01" || v == "11").WithMessage("Clearing type must be 01 or 11");
        RuleFor(x => x.TotalSlips).GreaterThan(0).WithMessage("Total slips must be > 0");
        RuleFor(x => x.TotalAmount).GreaterThan(0).WithMessage("Total amount must be > 0");
        When(x => x.IsPDC, () =>
        {
            RuleFor(x => x.PDCDate).NotNull().WithMessage("PDC date is required when PDC is checked");
            RuleFor(x => x.PDCDate).GreaterThan(x => x.BatchDate).WithMessage("PDC date must be after batch date");
        });
    }
}
```

### 34.4 Invoke in Service

```csharp
var validator = new CreateBatchRequestValidator();
var result = await validator.ValidateAsync(request);
if (!result.IsValid)
    throw new ValidationException(result.Errors);
```

`ValidationException` is caught by `GlobalExceptionMiddleware` → returns `400 VALIDATION_ERROR` with field-level details.

### 34.5 Validation Rules Per Module

**Login:**
- EmployeeID or Username: not empty, max 50 chars
- Password: not empty, min 8 chars, max 100 chars
- EODDate: not empty, not future date

**User creation:**
- EmployeeID: not empty, unique (check DB), max 20 chars
- Username: not empty, unique (check DB), max 50 chars
- Email: valid format if provided
- Password: min 8 chars
- DefaultLocationID: must exist in Location table

**Batch creation:** (see example above)

**Slip creation:**
- SlipNo: not empty, max 20 chars, unique within batch (check DB)
- ClientCode: not empty, must exist in ClientMaster with Status = 'A'
- TotalInstruments: > 0
- SlipAmount: > 0

**RR correction:**
- ChqNo: exactly 6 digits if provided
- MICR1: exactly 9 digits if provided
- MICR2: exactly 6 digits if provided
- MICR3: exactly 2 digits if provided
- At least one MICR field must be filled if saving corrections (not just approving)

---

## 35. IMAGE FILE ACCESS SECURITY

### 35.1 Problem

If images are served via `UseStaticFiles` at `/images/...`, the URL is fully public — anyone with the URL can access cheque images without authentication. This is a banking system — cheque images are sensitive financial documents.

### 35.2 Solution: Authenticated Image Controller

Remove `UseStaticFiles` for the image folder. Instead, serve all images through an authenticated API endpoint:

```
GET /api/images/{*relativePath}
Authorization: Bearer <token>  (or httpOnly cookie automatically sent)
```

### 35.3 Controller Logic

```csharp
[Authorize]
[HttpGet("/api/images/{*relativePath}")]
public IActionResult GetImage(string relativePath)
{
    // 1. Sanitize: reject any path with ".." or absolute path indicators
    if (relativePath.Contains("..") || Path.IsPathRooted(relativePath))
        return BadRequest();

    // 2. Resolve full path using configured BasePath
    var basePath = _imageConfig.BasePath;
    var fullPath = Path.GetFullPath(Path.Combine(basePath, relativePath));

    // 3. Verify resolved path is still inside BasePath (prevent traversal)
    if (!fullPath.StartsWith(basePath, StringComparison.OrdinalIgnoreCase))
        return BadRequest();

    // 4. Check file exists
    if (!System.IO.File.Exists(fullPath))
        return NotFound();

    // 5. Serve file
    return PhysicalFile(fullPath, "image/jpeg");
}
```

### 35.4 Frontend Adjustment

`getImageUrl` utility updated:

```typescript
export function getImageUrl(relativePath: string | null | undefined): string {
    if (!relativePath) return '/assets/placeholder-cheque.png';
    return `${window.location.origin}/api/images/${relativePath}`;
}
```

JWT cookie is sent automatically with every request (`withCredentials: true` on axios).

### 35.5 Optional: Role-Based Image Access

If needed in future (Phase 2), the image controller can be extended:
- Scanner role: can access images from their own batches only
- Admin/Developer: can access all images
- For Phase 1: any authenticated user can access any image — simpler, sufficient

---

## 36. SCANNER SERVICE FAILURE HANDLING

### 36.1 Failure Scenarios

| Scenario | What happens |
|---|---|
| Scanner Service offline | Cannot reach `http://localhost:7000` |
| Scanner feed jams | Feed started but no image captured within timeout |
| Image saved to disk but DB write fails | File exists, no DB record |
| DB saved but file missing | DB record points to non-existent file |
| Partial MICR read | Image captured, MICR data null/incomplete |

### 36.2 ScanItems Status Field

Add `ScanStatus` to `ScanItems` table:

```sql
-- Add to ScanItems:
ScanStatus      VARCHAR(20)  DEFAULT 'Pending'
-- Values: 'Pending', 'Captured', 'Failed', 'RetryPending'
ScanError       NVARCHAR(500) NULL   -- error message if failed
RetryCount      INT           DEFAULT 0
```

### 36.3 Scanner Service Health Check

Before starting a scan session, call:
```
GET http://localhost:7000/scanner/status
```

If unreachable → return error to UI: `"Scanner service is offline. Please ensure the scanner application is running."`

Expose the scanner service status in `GET /api/system/health` as well.

### 36.4 Retry Logic

- On scan capture failure: `ScanStatus = 'Failed'`, `ScanError = error message`, `RetryCount++`
- User sees "Scan Failed — Retry" button in UI
- On retry: re-call Scanner Service capture endpoint, same SeqNo
- Max retries: 3. After 3 → `ScanStatus = 'Failed'` permanently, must skip or rescan whole item

### 36.5 Orphan Image Detection

On batch "Complete Scanning":
- System checks all `ScanItems` where `ScanStatus = 'Captured'`
- Verifies each `ImageFrontPath` file exists on disk
- Any missing → flag as `ScanStatus = 'Failed'`, include in error report to user before completion

### 36.6 Timeout Configuration

```json
"ScannerService": {
  "BaseUrl": "http://localhost:7000",
  "TimeoutSeconds": 30,
  "HealthCheckTimeoutSeconds": 5,
  "MaxRetries": 3
}
```

---

## 37. DEPLOYMENT ARCHITECTURE

### 37.1 Web Application Hosting

**Development:**
- Run with `dotnet run` — Kestrel on `http://localhost:5000`
- React frontend: `npm run build` output copied to `/CPS.API/wwwroot/`

**Production:**
- Host on **IIS** (standard for .NET on Windows)
- Application Pool: .NET CLR No Managed Code (for .NET 8+)
- Enable WebSocket support in IIS (required for Scanner Service communication)
- HTTPS binding with valid certificate
- Set `ASPNETCORE_ENVIRONMENT=Production` in IIS environment variables

**IIS site config:**
```
Site: CPS
Physical path: C:\inetpub\CPS\
Binding: https / port 443
App pool: CPS_Pool (No Managed Code, Identity: specific service account)
```

### 37.2 Scanner Service Hosting

The Scanner Service (local agent at localhost:7000) runs on the scanning PC:

- Deploy as a **Windows Service** (use `worker service` template with `UseWindowsService()`)
- Auto-start on Windows boot
- Runs silently in background — no UI
- Logs to `C:\CPS\ScannerService\Logs\`

```
Windows Service name: CPS.ScannerService
Display name: CPS Scanner Agent
Start type: Automatic
```

### 37.3 Folder Permissions

| Folder | Account needs access | Permissions |
|---|---|---|
| `{ChequeData BasePath}` | IIS App Pool identity | Read + Write |
| `{ChequeData BasePath}` | Scanner Service account | Read + Write (saves images) |
| `C:\inetpub\CPS\` | IIS App Pool identity | Read |
| `C:\inetpub\CPS\Logs\` | IIS App Pool identity | Read + Write |
| `C:\CPS\ScannerService\` | Scanner Service account | Read + Write |

### 37.4 Environment-Specific Config

```
/CPS.API/
├── appsettings.json             (base config — committed to repo)
├── appsettings.Development.json (dev overrides — committed, dev paths)
└── appsettings.Production.json  (prod overrides — NOT committed, set on server)
```

`appsettings.Production.json` contains real connection strings, production `ChequeData:BasePath`, JWT secret. This file lives on the server only — never in source control.

### 37.5 React Build Integration

```
/CPS.Frontend/
└── package.json  →  "build": "react-scripts build"

/CPS.API/
└── CPS.API.csproj:
    <Target Name="BuildFrontend" BeforeTargets="Build">
      <Exec Command="npm run build" WorkingDirectory="../CPS.Frontend" />
      <ItemGroup>
        <Content Include="../CPS.Frontend/build/**" LinkBase="wwwroot" CopyToOutputDirectory="PreserveNewest" />
      </ItemGroup>
    </Target>
```

Running `dotnet build` or `dotnet publish` automatically builds React and copies to `wwwroot`.

---

## 38. AUDIT LOG

### 38.1 Purpose

Every significant data change is tracked with old and new values. Required for banking compliance — auditors must be able to see who changed what and when.

### 38.2 AuditLog Table

```sql
AuditLog
--------
AuditID         BIGINT      PK IDENTITY
TableName       VARCHAR(100) NOT NULL     -- e.g., "Batch", "ScanItems", "Slip"
RecordID        VARCHAR(50) NOT NULL      -- PK value of the changed record (as string)
Action          VARCHAR(10) NOT NULL      -- 'INSERT', 'UPDATE', 'DELETE'
OldValues       NVARCHAR(MAX) NULL        -- JSON of changed fields before
NewValues       NVARCHAR(MAX) NULL        -- JSON of changed fields after
ChangedBy       INT         NOT NULL      -- FK → UserMaster.UserID
ChangedAt       DATETIME2   NOT NULL      DEFAULT GETUTCDATE()
IPAddress       VARCHAR(45)               -- client IP
SessionID       VARCHAR(50)               -- correlation ID from request

INDEX: (TableName, RecordID)
INDEX: (ChangedBy)
INDEX: (ChangedAt)
```

### 38.3 What Must Be Audited

| Table | Trigger |
|---|---|
| `Batch` | Any status change, any field edit |
| `ScanItems` | RR corrections (MICR changes) |
| `Slip` | Any edit after initial creation |
| `UserMaster` | Password change, role change, lock/unlock, location change |
| `AppSettings` | Any key/value change |
| `Location` | Any edit |
| `ClientMaster` | Any edit |

### 38.4 Implementation

Do NOT use DB triggers — use application-layer audit service.

Create `IAuditService`:

```csharp
public interface IAuditService
{
    Task LogAsync(string tableName, string recordId, string action,
                  object? oldValues, object? newValues);
}
```

Call from service layer before/after changes:

```csharp
// Before update (capture old values):
var oldBatch = await _repo.GetBatchAsync(id);

// Make the change:
batch.BatchStatus = newStatus;
await _context.SaveChangesAsync();

// After update (log both):
await _auditService.LogAsync("Batch", id.ToString(), "UPDATE", oldBatch, batch);
```

Serialize old/new to JSON (`System.Text.Json`). Store only fields that changed (diff), not full object — keeps log table lean.

### 38.5 Audit Log UI

Admin/Developer only. Filterable by:
- Table name
- Record ID
- User
- Date range
- Action type

Paginated, read-only.

---

## 39. FRONTEND ARCHITECTURE — DEPTH

### 39.1 Route Protection

All routes except `/login` require authentication. Use a `ProtectedRoute` wrapper component:

```typescript
// /src/components/ProtectedRoute.tsx
function ProtectedRoute({ children, requiredRole }: Props) {
    const { user, isAuthenticated } = useAuthStore();

    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (requiredRole && !user.roles.includes(requiredRole))
        return <Navigate to="/unauthorized" replace />;

    return children;
}
```

Route definitions:

```typescript
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
    <Route index element={<Dashboard />} />
    <Route path="batch/create" element={<ProtectedRoute requiredRole="Scanner"><BatchCreate /></ProtectedRoute>} />
    <Route path="scan/:batchId" element={<ProtectedRoute requiredRole="Scanner"><ScanPage /></ProtectedRoute>} />
    <Route path="rr/:batchId" element={<RRPage />} />
    <Route path="admin/users" element={<ProtectedRoute requiredRole="Admin"><UserManagement /></ProtectedRoute>} />
    <Route path="admin/masters" element={<ProtectedRoute requiredRole="Admin"><MasterManagement /></ProtectedRoute>} />
    <Route path="unauthorized" element={<UnauthorizedPage />} />
  </Route>
</Routes>
```

### 39.2 Auth Store (Zustand)

```typescript
// /src/store/authStore.ts
interface AuthStore {
    user: UserSession | null;
    isAuthenticated: boolean;
    login: (data: LoginResponse) => void;
    logout: () => void;
}

interface UserSession {
    userId: number;
    employeeId: string;
    roles: string[];
    locationId: number;
    eodDate: string;
}
```

On page refresh: attempt `GET /api/auth/me` to rehydrate store from cookie. If 401 → clear store, redirect to login.

### 39.3 Global Loading State

Show a full-page spinner during initial auth check (page load) and during navigation. Use a `usePageLoading` hook driven by React Router's loader state.

### 39.4 Toast Notifications

Use a single toast system for all success/error messages:

```typescript
// /src/components/Toast/ToastProvider.tsx
// Singleton toast queue — components call:
toast.success("Batch created successfully");
toast.error("Scanner service is offline");
toast.warning("Scanning still in progress");
```

- Auto-dismiss: success = 3s, warning = 5s, error = stays until dismissed
- Position: top-right on desktop, top-center on mobile
- Max 3 toasts visible at once (queue the rest)

### 39.5 Error Boundary

Wrap each page in a React `ErrorBoundary` to catch render errors without crashing the whole app:

```typescript
<ErrorBoundary fallback={<PageErrorFallback />}>
    <BatchCreatePage />
</ErrorBoundary>
```

`PageErrorFallback` shows: "Something went wrong on this page. [Go to Dashboard]"

### 39.6 Loading States Standard

Every component that fetches data follows this pattern:

```typescript
const { data, isLoading, error } = useBatchList();

if (isLoading) return <SkeletonTable rows={5} />;
if (error) return <InlineError message={error.message} onRetry={refetch} />;
return <BatchTable data={data} />;
```

Use skeleton screens (not spinners) for initial data loads — better perceived performance.

### 39.7 Form State Management

All forms use **React Hook Form** for:
- Field-level validation (client-side, mirrors backend FluentValidation rules)
- Dirty state tracking (warn before navigating away from unsaved form)
- Submit state (disables submit button while in-flight)

```typescript
const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm<CreateBatchForm>();
```

### 39.8 Unsaved Changes Guard

If user tries to navigate away from a form with unsaved changes:

```typescript
useBlocker(({ currentLocation, nextLocation }) =>
    isDirty && currentLocation.pathname !== nextLocation.pathname
);
```

Show confirmation dialog: "You have unsaved changes. Leave anyway?"

---

## 40. FILE HEADER COMMENTS (ALL SOURCE FILES)

### 40.1 Rule

**Every source file** created for this project — `.cs`, `.tsx`, `.ts` — must start with a standard header comment block.

### 40.2 Backend (.cs) Header Template

```csharp
// =============================================================================
// File        : {FileName}.cs
// Project     : CPS — Cheque Processing System
// Module      : {Module name, e.g., Batch, Auth, Scan}
// Description : {One sentence describing what this file does}
// Created     : {YYYY-MM-DD}
// =============================================================================
```

Example:
```csharp
// =============================================================================
// File        : BatchService.cs
// Project     : CPS — Cheque Processing System
// Module      : Batch
// Description : Business logic for batch creation, status transitions, and
//               sequence number generation.
// Created     : 2026-04-14
// =============================================================================
```

### 40.3 Frontend (.tsx / .ts) Header Template

```typescript
// =============================================================================
// File        : {FileName}.tsx
// Project     : CPS — Cheque Processing System
// Module      : {Module name, e.g., Batch, Scan, Auth}
// Description : {One sentence describing what this file does}
// Created     : {YYYY-MM-DD}
// =============================================================================
```

### 40.4 Where the Header Goes

- First lines of every `.cs` file — before `using` statements
- First lines of every `.ts` / `.tsx` file — before `import` statements
- Do NOT add headers to auto-generated files (EF migrations, `*.Designer.cs`)
- Do NOT add headers to config files (`appsettings.json`, `package.json`, `.csproj`)

---

## 41. SINGLE LIVING DOCUMENTATION RULE

### 41.1 Rule

**There is exactly ONE documentation file for this project: `PHASE1_BLUEPRINT.md`**

- NEVER create a new `.md` file for any feature, module, or decision
- NEVER create `README.md`, `SETUP.md`, `API.md`, `DECISIONS.md`, or any other doc
- When something new is decided, designed, or discovered → **update this file**
- When a section becomes outdated → **update this file**
- This file grows with the project — it is the single source of truth

### 41.2 What Gets Updated Here

- New DB columns discovered during development → add to the relevant table schema
- New API endpoints added → add to section 4
- A business rule is clarified → update the relevant section
- A mistake is found and fixed → update section 17 (Mistakes) and the relevant section
- Phase 2 details get clearer → update section 20

### 41.3 Update Format

When updating, add a note in the section:

```
> Updated {YYYY-MM-DD}: {what changed and why}
```

This keeps a lightweight change history inside the doc without needing a separate changelog file.

---

## APPENDIX A — BATCH NUMBER EXAMPLES

| Location | Date | Seq | BatchNo |
|---|---|---|---|
| AHM | 2026-04-14 | 1 | AHM14042026001 |
| AHM | 2026-04-14 | 2 | AHM14042026002 |
| AHM | 2026-04-15 | 1 | AHM15042026001 |
| DEL | 2026-04-14 | 1 | DEL14042026001 |

---

## APPENDIX B — FILE NAMING CONVENTIONS

| File | Pattern | Example |
|---|---|---|
| Front cheque image | `F_{SeqNo:0000}.jpg` | `F_0001.jpg` |
| Back cheque image | `B_{SeqNo:0000}.jpg` | `B_0001.jpg` |
| Slip scan image | `S_{SeqNo:0000}.jpg` | `S_0001.jpg` |
| Rescan (v2) | `F_{SeqNo:0000}_v2.jpg` | `F_0001_v2.jpg` |

---

## APPENDIX C — ENVIRONMENT SETUP

```
appsettings.json keys:
- ConnectionStrings:DefaultConnection     → SQL Server connection string
- Jwt:SecretKey                           → JWT signing key (min 32 chars)
- Jwt:ExpiryHours                         → Token expiry (default: 8)
- ChequeData:BasePath                     → e.g., "D:\\ChequeData"
- ChequeData:BankCode                     → e.g., "SCB"
- ChequeData:WebPath                      → e.g., "/images"
- ScannerService:BaseUrl                  → e.g., "http://localhost:7000"
- App:Port                                → e.g., 5000
```
