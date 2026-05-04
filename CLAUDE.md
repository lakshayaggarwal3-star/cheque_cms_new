# CPS — Cheque Processing System
## CLAUDE.md — AI Development Instructions

Read this entirely before writing any code.

---

## WHAT IS THIS PROJECT

Web-based cheque clearing system for SCB (Standard Chartered Bank). Replaces legacy .NET WinForms (CCTS) and ASP.NET MVC (CS/HDFC).

**Stack**: .NET 8 Web API + React 18 TypeScript SPA, single port (5000), clean architecture.

**Blueprint**: `PHASE1_BLUEPRINT.md` — contains full DB schema, API routes, business rules, scanning flow. Read it for every task.

---

## CRITICAL ARCHITECTURE RULES

### Single Port (5000)
```
https://localhost:5000/        → React SPA
https://localhost:5000/api/... → Web API
https://localhost:5000/api/images/... → Authenticated image serving
```
NEVER run frontend on port 3000 and backend on 5000 separately.

### Layered Architecture
```
Controller → Service → Repository → DB
```
- Controllers: parse request + call service + return response only. NO logic.
- Services: ALL business logic and validation.
- Repositories: ONLY EF Core queries. NO business logic.

### Database Rules
- Every table: `CreatedBy`, `CreatedAt`, `UpdatedBy`, `UpdatedAt`, `IsDeleted`, `DeletedBy`, `DeletedAt`
- NEVER hard delete — soft delete only
- NEVER store images in DB — relative path only
- NEVER base64 images in API
- Index every WHERE column
- EF Core parameterized queries only — no string-concat SQL
- Code-First ONLY — never DB-First

### Transactions
Every multi-table operation needs a transaction: `BeginTransactionAsync` → all work → single `SaveChangesAsync` → `CommitAsync`. On exception → `RollbackAsync`. NEVER call `SaveChangesAsync` mid-method.

| Operation | Tables |
|---|---|
| Batch creation | `BatchSequence` + `Batch` |
| Scan save | `ChequeItem` + `Batch` |
| Slip + scan linking | `SlipEntry` + `ChequeItem` |
| Scan complete | `Batch` status + MICR error evaluation |
| RR update | `ChequeItem` + `Batch` |

---

## PROJECT STRUCTURE

```
CPS/
├── CPS.API/
│   ├── Controllers/     (14 controllers)
│   ├── Services/        (23 services)
│   ├── Repositories/    (15 repositories)
│   ├── Models/          (EF Core entities)
│   ├── DTOs/
│   ├── Middleware/      (Session, GlobalException, RequestLogging)
│   ├── Migrations/      (37 migrations)
│   └── wwwroot/         (React build output — DO NOT edit manually)
│
└── CPS.Frontend/src/
    ├── pages/           (15 pages)
    ├── components/      (incl. ImageCropEditor, RangerFeedControl)
    ├── services/        (16 service files + WebSocket bridges)
    ├── hooks/
    ├── store/           (Zustand)
    └── utils/           (imageUtils.ts)
```

---

## ROLES & ACCESS

| Role | DB Column | Access |
|---|---|---|
| Scanner | `RoleScanner` | Batch create, scan, slip scan |
| MobileScanner | `RoleMobileScanner` | Mobile scan UI |
| Maker | `RoleMaker` | Phase 2 only |
| Checker | `RoleChecker` | Phase 2 only |
| ImageViewer | `RoleImageViewer` | Image access only |
| Admin | `RoleAdmin` | Everything + user mgmt + master upload |
| Developer | `IsDeveloper` | Admin + mock scan + force status |

Admin = all role flags ON. Developer = all ON + `IsDeveloper = 1`.

---

## AUTH FLOW

**Login** (`POST /api/auth/login`):
1. IP-based rate limit: 10 failed attempts / 15 min → 429
2. BCrypt verify (cost factor 12)
3. Rotate `UserMaster.SessionToken` (new Guid) — invalidates any existing session
4. Set `IsLoggedIn = true`, `LastActiveAt = now`
5. Generate JWT (8-hour expiry) with claims: `userId`, `sessionToken`, roles, `locationId`, `eodDate`
6. JWT stored in **httpOnly cookie** (`HttpOnly=true`, `Secure=true`, `SameSite=Lax`) — NOT localStorage

**Every authenticated request** — `SessionValidationMiddleware`:
1. JWT claim `sessionToken` must match `UserMaster.SessionToken` in DB
2. `IsActive` must be true — deactivated account → immediate 401
3. Inactivity check: `now - LastActiveAt > 30 minutes` → logout (clears `IsLoggedIn` + `SessionToken`)
4. Activity recorded in-memory via `ActivityFlushService`, flushed to `LastActiveAt` in DB every **20 minutes**; inactivity check uses cache first, DB as fallback

**Multi-device**: one active session per user — new login rotates token, kills all others.

---

## BATCH NUMBER FORMAT

Format: `{PIFPrefix}{DDMMYYYY}{3-digit-seq}`

Example: `AHM14042026001` — prefix from `Location.PIFPrefix`, date DDMMYYYY, daily seq per location starting at 001.

PIF Number = Summary Ref No = BatchNo.

Sequence: MUST use `UPDLOCK` transaction on `BatchSequence` table — prevents duplicates under concurrency.

---

## BATCH STATUS MACHINE

| Value | Label | Trigger |
|---|---|---|
| 0 | Created | Batch creation |
| 1 | Scanning In Progress | Start scanning |
| 2 | Scanning Pending | Navigated away mid-scan |
| 3 | Scanning Completed | Complete scan confirmed |
| 4 | RR Pending | MICR errors detected post-scan |
| 5 | RR Completed | All RR items resolved |

Always use enum — NEVER raw ints.

**C#:** `public enum BatchStatus { Created=0, ScanningInProgress=1, ScanningPending=2, ScanningCompleted=3, RRPending=4, RRCompleted=5 }`
**C#:** `public enum RRState { NeedsReview=0, Approved=1, Repaired=2 }`
**TS:** `export enum BatchStatus { Created=0, ScanningInProgress=1, ScanningPending=2, ScanningCompleted=3, RRPending=4, RRCompleted=5 }`

---

## SCANNING

### Scanner Integration
- **Backend**: `ScannerOrchestrator` calls local Scanner Service via HTTP REST at `http://localhost:7000` (configurable). Calls: `cheque/start-feed`, `cheque/capture`, `slip/capture`, etc.
- **Frontend**: `rangerWebService.ts` (Ranger cheque scanner) and `flatbedWebService.ts` (flatbed/slip scanner) — WebSocket bridges for real-time feed display.
- **Mock mode**: Developer role only — returns fake images + randomized MICR without hardware.

### Scan Flow
- **With Slip**: Slip scan → Slip Entry form → Cheque(s) → repeat
- **Without Slip**: Cheques only

### Scanner Failure
- Health-check before session: `GET http://localhost:7000/scanner/status` — offline → block + show error
- `ChequeItem.ScanStatus`: `Pending` / `Captured` / `Failed` / `RetryPending`; max 3 retries
- On Complete: verify all Captured items have files on disk — missing → block

---

## CONCURRENCY & LOCKING

### Scan Lock (per batch)
- Fields: `Batch.ScanLockedBy` (int?), `Batch.ScanLockedAt` (DateTime?)
- Enforced server-side — `ScanService.GetLockedBatchContextAsync()` called by every scan operation; throws `ForbiddenException` if caller doesn't hold lock
- Stale auto-release: **7 minutes** — next user takes over; recorded in `StatusHistory`
- Released on `CompleteScan` or explicit `ReleaseScanLock`

### RR Lock (per batch)
- Fields: `Batch.RRLockedBy` (int?), `Batch.RRLockedAt` (DateTime?)
- Acquired on first `GetRRItems`, enforced on all subsequent RR operations
- Stale auto-release: **7 minutes** — same pattern as scan lock
- Released on `CompleteRR` or explicit `ReleaseRRLock`

### Session Lock (per user)
- 30-min inactivity → `SessionValidationMiddleware` clears session + returns 401
- Activity flush lag: up to 20 min — cache is always checked first

### Optimistic Concurrency
- `[Timestamp] byte[] RowVersion` on `Batch`, `SlipEntry`, `ChequeItem`
- Conflict → `DbUpdateConcurrencyException` → rethrow as `ConflictException`
- Frontend: disable submit on first click, re-enable on error only

---

## IMAGE HANDLING

### Storage
- Base path: configurable via `appsettings.json` (`ChequeData:BasePath`) — can be changed at runtime via admin setting (stored in DB, `IImageStorageConfig` singleton, 60s cache)
- Folder: `{BasePath}\{BankCode}\{LocationCode}\{YYYY}\{MM}\{DD}\{BatchNo}\`
- Files: `F_0001.jpg` (front), `B_0001.jpg` (back), `S_0001.jpg` (slip); TIFF variants stored for cheques
- Rescan: `F_0001_v2.jpg`
- DB stores **relative path only** — never full disk path

### Serving
- `GET /api/images/{*relativePath}` — `[Authorize]`, validates no `..` traversal, resolves against `BasePath`
- TIFF → JPEG converted on-the-fly (SixLabors.ImageSharp)
- Cache headers: `no-store` (sensitive financial images)
- Frontend: `getImageUrl(relativePath)` in `imageUtils.ts` → `${window.location.origin}/api/images/${relativePath}`
- Also: `getChequeImageUrl(item, 'front'|'back'|'frontTiff'|'backTiff')` and `getSlipImageUrl(scan)`
- NEVER inline image URLs — always use these utilities

### Image Editing (ImageCropEditor)
- Component: `ImageCropEditor.tsx` — perspective correction, brightness/contrast, grayscale, rotation
- Document edge detection via **YOLO segmentation model** (`yolo26n-seg_float16.tflite`) loaded via TensorFlow.js tflite
- Cheque output: TIFF (grayscale); Slip output: JPG (color)
- Saves original + processed versions
- Mobile-optimized; integrated via `ImageEditModal.tsx` / `ImageEditModalMobile.tsx`

### Disk Health
- On startup: log disk space; < 5 GB → Warning; < 1 GB → Error + admin banner
- `GET /api/system/health` → disk space + scanner status
- Max image size: front/back = 2 MB, slip = 3 MB, thumbnail = 200 KB

---

## API STANDARDS

### Response Envelope (ALL endpoints)
```json
{ "success": true, "data": {}, "message": "optional" }
{ "success": false, "errorCode": "VALIDATION_ERROR", "message": "...", "details": [] }
```
Error codes: `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `SCANNER_ERROR`, `INTERNAL_ERROR`

Pagination: `?page=1&pageSize=20` → response includes `totalCount`, `totalPages`.

### Exception Handling
- `GlobalExceptionMiddleware` catches all unhandled exceptions → log full stack server-side → return safe 500
- Custom exceptions: `ValidationException`→400, `NotFoundException`→404, `ConflictException`→409, `ForbiddenException`→403, `ScannerException`→503

### Validation (FluentValidation)
One validator per DTO in `/Validators/`. Key rules:
- ChqNo: 6 digits, MICR1: 9 digits, MICR2: 6 digits
- SlipNo: unique within batch
- ClientCode: must exist + `Status = 'A'`
- BatchDate: not future; PDCDate: required + after BatchDate when IsPDC=true

---

## FRONTEND RULES

- All API calls through `api.ts` (Axios, `withCredentials: true`) — 401 interceptor → redirect login
- Per-module service files: `batchService.ts`, `scanService.ts`, `rrService.ts`, etc.
- **Route protection**: `ProtectedRoute` — unauthenticated → `/login`; wrong role → `/unauthorized`
- **Auth store** (Zustand): rehydrate on refresh via `GET /api/auth/me`; 401 → redirect login
- **Toast**: `ToastProvider` — `toast.success/error/warning()`; success auto-dismiss 3s, error stays; max 3 visible
- **Loading**: skeleton screens for initial loads; inline error + retry on failure
- **Forms**: React Hook Form — dirty state guard ("Unsaved changes — leave?"), disable submit while in-flight
- **Session expired**: `SessionTerminatedPage` shown on 401 with `X-Session-Conflict` header

---

## SECURITY

- Login rate limit: 10 attempts/IP/15 min
- JWT httpOnly cookie: `HttpOnly`, `Secure`, `SameSite=Lax`
- File uploads: validate MIME + content header (not extension only), max 10 MB, reject path traversal in filename
- Input: trim whitespace, reject control chars, enforce DB column max lengths
- NEVER expose cheque images without auth

---

## LOGGING (SERILOG)

- Sinks: daily rolling file (`/Logs/cps-YYYYMMDD.log`) + console in dev
- Log: every request (method/path/userId/duration), login events, batch status changes, scanner calls, exceptions, image saves
- Correlation ID on every request
- NEVER log: passwords, JWT tokens, session tokens

---

## AUDIT LOG

`AuditLog` table — `IAuditService` called from service layer (not DB triggers). Stores diff (changed fields only).

Audited: Batch status changes, ChequeItem MICR edits, UserMaster role/password/lock changes, AppSettings changes, Location edits, ClientMaster edits, SlipEntry edits.

---

## MASTER UPLOAD

Admin/Developer uploads Excel → `MasterUploadController` → `MasterUploadService` → `MasterImportJobProcessor` (background).

- Location Master → `Location` + `LocationScanner` + `LocationFinance`
- Client Master → `ClientMaster` upsert by CityCode

Flow: validate headers → parse rows → validate each → insert/update → log in `MasterUploadLog`.
UI: upload button, template download, error table, background job status polling.

---

## TECH STACK

| Layer | Tech |
|---|---|
| Backend | ASP.NET Core 8 Web API |
| ORM | EF Core 8 (Code-First ONLY) |
| DB | SQL Server 2019+ |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS (sm/md/lg breakpoints) |
| State | Zustand |
| HTTP | Axios |
| Auth | JWT Bearer (httpOnly cookie) |
| Password | BCrypt.Net (cost 12) |
| Image processing | SixLabors.ImageSharp + jscanify + TensorFlow.js |
| Excel | EPPlus / ClosedXML |
| Scanner comms | HTTP REST (backend) + WebSocket (frontend feed) |
| Validation | FluentValidation |
| Logging | Serilog |
| Forms | React Hook Form |

---

## RESPONSIVE UI

| Breakpoint | Layout |
|---|---|
| Mobile < 640px | Cards, stacked, hamburger nav, large touch buttons |
| Tablet 640–1024px | Compact tables, collapsible nav |
| Desktop > 1024px | Full tables, side-by-side scan, visible nav |

---

## ENVIRONMENT CONFIG

```json
{
  "ConnectionStrings": { "DefaultConnection": "..." },
  "Jwt": { "SecretKey": "...", "ExpiryHours": 8 },
  "ChequeData": { "BasePath": "D:\\ChequeData", "BankCode": "SCB", "WebPath": "/images" },
  "ScannerService": { "BaseUrl": "http://localhost:7000", "TimeoutSeconds": 30, "MaxRetries": 3 }
}
```

---

## PHASE 1 SCOPE (BUILD THIS ONLY)

Phase 1 = Login → Batch Create → Scan → Slip Entry → RR Complete

**DO NOT build**: Maker entry, Checker entry, QC, XML/IMG generation, SFTP, RCMS, Reports.

Folder stubs `/pages/maker`, `/pages/checker`, `/pages/qc` exist but are empty — leave them empty.

---

## PHASE 2 (FUTURE — DO NOT BUILD NOW)

1. Maker (L1) — cheque data entry
2. Checker (L2) — blind re-entry, SoD enforced (same user cannot be both Maker and Checker)
3. QC — mismatch resolution
4. XML (OTS) + IMG (OTI) generation + RSA signing + PGP encryption
5. SFTP upload → RCMS → Return processing
6. Reports

---

## THINGS NEVER TO DO

1. Plain text passwords — always bcrypt
2. Business logic in controllers or stored procedures
3. Images in DB (BLOB) or base64 in API
4. Frontend + backend on separate ports
5. Batch numbers without locked DB transaction
6. `SELECT *` — always specify columns
7. Rows without pagination
8. EF DB-First — Code-First only
9. Connection strings in code — always `appsettings.json`
10. Hard delete — always soft delete
11. Skip audit fields (`CreatedBy/At`, `UpdatedBy/At`, `IsDeleted`)
12. Multi-step DB work without transaction
13. Raw int literals for status — always enums
14. `SaveChangesAsync()` more than once per service method
15. New `.md` files — update `PHASE1_BLUEPRINT.md` only
16. Skip file header comment on any `.cs`, `.ts`, `.tsx` file

---

## FILE HEADER (MANDATORY — ALL .cs / .ts / .tsx)

```
// =============================================================================
// File        : {FileName}
// Project     : CPS — Cheque Processing System
// Module      : {Module}
// Description : {One sentence}
// Created     : {YYYY-MM-DD}
// =============================================================================
```

Skip headers on: EF migration files, `*.Designer.cs`, `appsettings.json`, `package.json`, `.csproj`.

---

## BUILD & MIGRATION COMMANDS

### Paths
```
Solution root : C:\Users\laksh\OneDrive\Desktop\new  cms applaiton\CPS\
Backend       : CPS\CPS.API\
Frontend      : CPS\CPS.Frontend\
```

### Backend
```bash
dotnet restore CPS/CPS.API/CPS.API.csproj
dotnet build CPS/CPS.API/CPS.API.csproj
# Run (give to user — NEVER run yourself):
dotnet run --project CPS/CPS.API/CPS.API.csproj
```

### EF Migrations
```bash
dotnet ef migrations add MigrationName --project CPS/CPS.API --startup-project CPS/CPS.API
dotnet ef database update --project CPS/CPS.API --startup-project CPS/CPS.API
dotnet ef migrations list --project CPS/CPS.API --startup-project CPS/CPS.API
dotnet ef migrations remove --project CPS/CPS.API --startup-project CPS/CPS.API
```

### Frontend
```bash
cd CPS/CPS.Frontend && npm install
npm run build
npx tsc --noEmit
```

### AI Rules
- **NEVER run `dotnet run` or `npm start`** — give the command to the user
- CAN run: `dotnet build`, `dotnet restore`, `dotnet ef migrations add`, `dotnet ef database update`, `npm install`, `npm run build`, `npx tsc --noEmit`
- After any DB model change → add migration immediately
- After any migration → update schema in `PHASE1_BLUEPRINT.md`

---

## PRE-TASK CHECKLIST

Before any coding task:
1. Is this Phase 1 scope? (Phase 2 → don't build)
2. What does `PHASE1_BLUEPRINT.md` say about this module?
3. Layered architecture followed?
4. Any "never do" items violated?
5. DB change needs audit fields + soft delete + indexes?
6. UI is responsive?
7. DB model change needs a migration?
