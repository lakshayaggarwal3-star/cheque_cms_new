# CPS — Cheque Processing System (New Web App)
## CLAUDE.md — Instructions for AI-Assisted Development

This file is the primary instruction set for all AI assistance on this project.
Read this ENTIRELY before writing any code.

---

## WHAT IS THIS PROJECT

A new web-based cheque clearing system replacing:
- **Legacy desktop**: CCTS (Standard Chartered Bank / SCB) — .NET WinForms
- **Legacy web**: CS (HDFC) — ASP.NET Core 8 MVC

**New system**: Single .NET 8 Web API + React 18 TypeScript SPA, same port, clean architecture.

Bank: SCB (Standard Chartered Bank)

---

## FULL BLUEPRINT LOCATION

**READ THIS FIRST FOR EVERY TASK:**
`PHASE1_BLUEPRINT.md` in the project root — contains ALL details:
- Database schema (every table, every field)
- API routes (all controllers + actions)
- Business rules and validation logic
- Scanning flow (with/without slip)
- Image storage structure
- Mistakes from old apps to avoid
- Role and auth system

---

## CRITICAL ARCHITECTURE RULES (NEVER VIOLATE)

### 1. Single Port (5000)
```
https://localhost:5000/          → React SPA
https://localhost:5000/api/...   → Web API
https://localhost:5000/images/... → Scanned images (static files)
```
NEVER run frontend on port 3000 and backend on port 5000 separately.

### 2. Strict Layered Architecture
```
Controller → Service → Repository → DB
```
- Controllers: ONLY parse request + call service + return response. NO logic.
- Services: ALL business logic, validation, flow control.
- Repositories: ONLY EF Core DB queries. NO business logic.
- NEVER write SQL/EF directly in controllers.

### 3. Authentication
- JWT Bearer tokens (8-hour expiry)
- BCrypt password hashing (cost factor 12) — NEVER plain text passwords
- Server-side session token stored in `UserMaster.SessionToken` — rotated every login
- Middleware validates JWT + DB session token on every request

### 4. Database Rules
- ALL tables must have: `CreatedBy`, `CreatedAt`, `UpdatedBy`, `UpdatedAt`
- ALL tables must have soft delete: `IsDeleted` (bit), `DeletedBy`, `DeletedAt`
- NEVER hard delete — always soft delete
- NEVER store images in DB — store file path only
- NEVER use base64 for images in API responses
- Index every column used in WHERE clauses
- Use parameterized queries (EF Core) — NO string concatenation in SQL
- Batch sequence number generation MUST use a locked transaction (see blueprint section 3.7)

### 5. Images
- Storage base path is **fully configurable** via `appsettings.json` (`ChequeData:BasePath`)
- Default dev path: `C:\Users\laksh\OneDrive\Desktop\new  cms applaiton\ChequeData`
- Production path: set to whatever the server admin configures — NO hardcoded paths anywhere in code
- Admin UI setting to change storage path at runtime (stored in DB `AppSettings` table, overrides appsettings.json)
- Folder structure under base path: `{BankCode}\{LocationCode}\{YYYY}\{MM}\{DD}\{BatchNo}\`
- File naming: `F_0001.jpg` (front), `B_0001.jpg` (back), `S_0001.jpg` (slip)
- Rescan: `F_0001_v2.jpg`
- Served via .NET static files at `/images/...` — the `/images` web path maps to whatever `BasePath` is configured
- DB stores **relative path only** — never full disk path, never base64

- **Images are used across ALL pages and modules** — RR, Maker (Phase 2), Checker (Phase 2), Reports — so the image serving URL must always resolve correctly regardless of where in the app you are. Always construct image URL as: `{window.origin}/images/{relativePath}`

---

## PROJECT STRUCTURE

```
/CPS/
├── CPS.API/              (.NET 8 Web API)
│   ├── Controllers/
│   ├── Services/
│   ├── Repositories/
│   ├── Models/           (EF Core entities)
│   ├── DTOs/             (request/response objects)
│   ├── Middleware/
│   └── wwwroot/          (React build output — DO NOT edit manually)
│
├── CPS.Frontend/         (React 18 + TypeScript)
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── services/     (axios API calls)
│       ├── hooks/
│       ├── store/        (Zustand)
│       └── utils/
│
└── /ChequeData/          (image storage — outside project)
```

---

## ROLES & ACCESS

| Role Flag | DB Column | Access |
|---|---|---|
| Scanner | `RoleScanner` | Batch create, scan, slip scan |
| Maker | `RoleMaker` | Slip entry, cheque data (Phase 2) |
| Checker | `RoleChecker` | Checker verification (Phase 2) |
| Admin | `RoleAdmin` | Everything + user management + master upload |
| Developer | `IsDeveloper` | Admin + mock scan + force status + skip validation |

**Admin = all role flags ON**
**Developer = all role flags ON + `IsDeveloper = 1`**

---

## API NAMING CONVENTION

All API routes: `/api/{resource}/{action}`

Examples:
- `POST /api/auth/login`
- `GET /api/batch`
- `POST /api/batch`
- `POST /api/master-upload/location`
- `GET /api/master-upload/template/location`

---

## BATCH NUMBER FORMAT (CRITICAL)

Format: `{PIFPrefix}{DDMMYYYY}{3-digit-seq-zero-padded}`

Example: `AHM14042026001`
- `AHM` = location PIFPrefix from Location table
- `14042026` = date DDMMYYYY
- `001` = daily sequence per location, starts from 1

**Both PIF Number AND Summary Ref No = same BatchNo value.**

Sequence generation: MUST use a transaction with `UPDLOCK` — see section 3.7 of blueprint.

---

## BATCH STATUS MACHINE

| Value | Label | Trigger |
|---|---|---|
| 0 | Created — Scanning Not Started | Batch creation |
| 1 | Scanning In Progress | User clicks Start Scanning |
| 2 | Scanning Pending | User navigates away mid-scan |
| 3 | Scanning Completed | Scanner shutdown + user confirms complete |
| 4 | RR Pending | System detects MICR errors post-scan |
| 5 | RR Completed | All RR items resolved |

---

## SCANNING RULES

### With Slip mode:
- Order: Slip scan → Cheque(s) → Slip scan → Cheque(s) → repeat
- After each slip scan: show Slip Entry form
- After all cheques of slip: ask for next slip or done

### Without Slip mode:
- Cheques only, no slip records

### Scanner types:
- **Cheque scanner (Ranger)**: WebSocket bridge, for MICR + cheque images — ALWAYS for cheques
- **Document scanner**: for slip scans — user selects which scanner for slip

### Scanner Service:
- Local agent running on scan PC at `http://localhost:7000`
- Developer mode: returns mock test images without real hardware

---

## RESPONSIVE UI

**All UI must work on mobile, tablet, and desktop.**

| Breakpoint | Layout |
|---|---|
| Mobile < 640px | Cards, stacked layout, hamburger nav, large touch buttons |
| Tablet 640–1024px | Compact tables, collapsible nav |
| Desktop > 1024px | Full tables, side-by-side scan layout, always-visible nav |

Use **Tailwind CSS** for all styling with `sm:`, `md:`, `lg:` prefixes.

---

## API RESPONSE STANDARD (ALL ENDPOINTS)

Every endpoint returns same envelope — no exceptions:

```json
// Success
{ "success": true, "data": {}, "message": "optional" }

// Error
{ "success": false, "errorCode": "VALIDATION_ERROR", "message": "User message", "details": [] }
```

Standard error codes: `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `SCANNER_ERROR`, `INTERNAL_ERROR`

Pagination: `?page=1&pageSize=20` → response includes `totalCount`, `totalPages`.

---

## GLOBAL EXCEPTION HANDLING

- Register `GlobalExceptionMiddleware` in `Program.cs` — catches ALL unhandled exceptions
- Log full stack trace server-side (Serilog)
- Return `500 INTERNAL_ERROR` with safe message only — NEVER expose stack trace to client
- Custom exceptions: `ValidationException` → 400, `NotFoundException` → 404, `ConflictException` → 409, `ForbiddenException` → 403, `ScannerException` → 503

---

## LOGGING (SERILOG)

- Sinks: daily rolling file (`/Logs/cps-YYYYMMDD.log`) + console in dev
- Log: every API request (method/path/userId/duration), login success/failure, batch status changes, scanner calls, exceptions, image saves, master uploads, AppSettings changes
- Include correlation ID on every request (traceable across log lines)
- NEVER log: passwords, JWT tokens, session tokens

---

## CONCURRENCY CONTROL

- Batch sequence: locked transaction (section 3.7 of blueprint) — already defined
- Scanning lock: `Batch.ScanLockedBy` (UserID) + `Batch.ScanLockedAt` — only one user scans a batch at a time; stale lock = > 30 min → auto-release; Admin can force-release
- RR lock: same pattern — `Batch.RRLockedBy` + `Batch.RRLockedAt`
- Optimistic concurrency on Batch/Slip/ScanItems updates via EF `rowversion`

---

## SECURITY — ADDITIONAL RULES

- Rate limit login: max 10 attempts/IP/minute (middleware)
- JWT in `httpOnly` cookie — NOT localStorage (XSS risk). Cookie flags: `HttpOnly`, `Secure`, `SameSite=Strict`
- File uploads: validate MIME type + content header (not just extension), max 10 MB, scan filename for path traversal chars
- Image serving: use `/api/images/{*relativePath}` controller (not pure static files) — validates path stays within `BasePath`, resolves `BasePath` from `IImageStorageConfig` at runtime
- Input: trim whitespace, reject control characters, max length matching DB column sizes

---

## IMAGE SERVING — RUNTIME CONFIGURABLE

`BasePath` can change at runtime (admin setting). Use `IImageStorageConfig` singleton with 60-second cache + `Invalidate()` method.

Serve images via controller (not `UseStaticFiles`) so `BasePath` resolves dynamically:

```
GET /api/images/{*relativePath}
→ resolve BasePath from IImageStorageConfig
→ validate path is within BasePath
→ serve file
```

Frontend: `getImageUrl(relativePath)` in `/src/utils/imageUtils.ts` — used on EVERY page that shows images.

---

## IMAGE SIZE + DISK HEALTH

- Max per image after compression: cheque front/back = 2 MB, slip = 3 MB, thumbnail = 200 KB
- On startup: log available disk space; < 5 GB → Warning; < 1 GB → Error + show admin banner
- `GET /api/system/health` → returns disk space + scanner service status

---

## BACKUP REQUIREMENTS

- DB: full daily backup + hourly transaction log backup, 30-day retention
- Images: incremental daily + full weekly, 90-day retention (regulatory)
- Images and DB are critical financial records — loss = regulatory issue
- RTO < 4 hours, RPO < 1 hour

---

## FRONTEND API RULES

- All API calls go through `/src/services/api.ts` (axios instance with `withCredentials: true`)
- Response interceptor: on 401 → redirect to login
- Per-module service files: `batchService.ts`, `scanService.ts`, etc. — typed functions only
- `getImageUrl(relativePath)` utility in `/src/utils/imageUtils.ts` — used everywhere images appear, never inline
- Every async operation handles: loading state → spinner, error state → inline message, success → data

---

## STATUS ENUMS (USE THESE — NEVER RAW NUMBERS)

**C#:**
```csharp
public enum BatchStatus { Created=0, ScanningInProgress=1, ScanningPending=2, ScanningCompleted=3, RRPending=4, RRCompleted=5 }
public enum RRState { NeedsReview=0, Approved=1, Repaired=2 }
public enum SlipStatus { Open=0, Complete=1 }
```

**TypeScript:**
```typescript
export enum BatchStatus { Created=0, ScanningInProgress=1, ScanningPending=2, ScanningCompleted=3, RRPending=4, RRCompleted=5 }
```

---

## TESTING APPROACH

- Backend unit tests: xUnit + Moq — test services, mock repositories. Cover: batch number logic, login validation, slip validation, status transition guards
- Backend integration tests: `WebApplicationFactory` + LocalDB — cover: full login, batch creation, concurrent sequence increment, Excel upload
- Frontend: Vitest + React Testing Library — login form, batch form, `getImageUrl` utility, slip auto-fill
- Concurrency tests: two simultaneous batch creates for same location+date → no duplicate seq; two simultaneous scan lock requests → one conflict

---

## THINGS NEVER TO DO (FROM OLD APP MISTAKES)

1. **NEVER** store plain text passwords — always bcrypt
2. **NEVER** hardcode usernames in code for access control
3. **NEVER** put business logic in controllers or stored procedures
4. **NEVER** store images in the database (BLOB/binary)
5. **NEVER** send base64 images through API
6. **NEVER** run frontend and backend on separate ports
7. **NEVER** generate batch numbers without a locked DB transaction
8. **NEVER** do `SELECT *` — always specify columns
9. **NEVER** return all rows without pagination
10. **NEVER** allow same user to be both Maker and Checker (Phase 2 rule — enforce in Phase 2)
11. **NEVER** use `EF DB-First` — Code-First only
12. **NEVER** put connection strings in code — always `appsettings.json`
13. **NEVER** hard delete records — always soft delete
14. **NEVER** skip audit fields (`CreatedBy`, `CreatedAt` etc.)
15. **NEVER** do multi-step DB work without a transaction scope — see blueprint section 32
16. **NEVER** use raw int literals for status checks — always use the status enums
17. **NEVER** expose cheque images without authentication — `/api/images/` requires valid JWT
18. **NEVER** call `SaveChangesAsync()` multiple times in one service method — call once at end
19. **NEVER** create a new `.md` documentation file — update `PHASE1_BLUEPRINT.md` only
20. **NEVER** skip the file header comment block on any `.cs`, `.ts`, or `.tsx` file created

---

## MASTER UPLOAD SYSTEM

Admin and Developer can upload Excel files for:
- Location Master → splits into: Location + LocationScanner + LocationFinance tables
- Client Master → inserts/updates ClientMaster by CityCode

Upload flow:
1. Validate file format (check headers)
2. Parse rows
3. Validate each row
4. Insert/update
5. Log results in `MasterUploadLog`
6. Return: success count + error rows with messages

UI must provide: Upload button, template download, error display table.

---

## TECH STACK SUMMARY

| Layer | Tech |
|---|---|
| Backend | ASP.NET Core 8 Web API |
| ORM | Entity Framework Core 8 (Code-First ONLY) |
| DB | SQL Server 2019+ |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |
| HTTP | Axios |
| Auth | JWT Bearer |
| Password | BCrypt.Net |
| Image processing | SixLabors.ImageSharp |
| Excel | EPPlus or ClosedXML |
| Scanner comms | HTTP REST to local Scanner Service |
| Validation | FluentValidation |
| Logging | Serilog (file sink + console) |
| Forms (frontend) | React Hook Form |

---

## ENVIRONMENT CONFIG (appsettings.json keys)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "..."
  },
  "Jwt": {
    "SecretKey": "...",
    "ExpiryHours": 8
  },
  "ChequeData": {
    "BasePath": "D:\\ChequeData",
    "BankCode": "SCB",
    "WebPath": "/images"
  },
  "ScannerService": {
    "BaseUrl": "http://localhost:7000",
    "TimeoutSeconds": 30,
    "MaxRetries": 3
  }
}
```

---

## PHASE 1 SCOPE (BUILD THIS ONLY)

Phase 1 = Login → Batch Create → Scan → Slip Entry → RR Complete

**DO NOT build in Phase 1:**
- Maker entry
- Checker entry
- QC
- XML/IMG file generation
- SFTP upload
- RCMS
- Reports

---

## PHASE 2 (FUTURE — DO NOT BUILD NOW)

After Phase 1 is production-tested:
1. Maker (L1) — cheque data entry
2. Checker (L2) — blind re-entry, SoD enforced
3. QC — mismatch resolution
4. XML (OTS) + IMG (OTI) generation
5. RSA signing + PGP encryption
6. SFTP upload
7. RCMS processing
8. Reports
9. Return processing

---

## TRANSACTIONS (ALL MULTI-STEP DB OPERATIONS)

Every operation touching more than one table or more than one row in a logical unit MUST use a transaction:

| Operation | Tables involved |
|---|---|
| Batch creation | `BatchSequence` + `Batch` |
| Scan save | `ScanItems` + `Batch` |
| Slip + scan linking | `Slip` + `ScanItems` |
| Scan complete | `Batch` status + MICR error evaluation |
| RR update | `ScanItems` + `Batch` (if all resolved) |
| User location change | `UserLocationHistory` + `UserMaster` |

Pattern: `BeginTransactionAsync` → all work → single `SaveChangesAsync` → `CommitAsync`. On any exception → `RollbackAsync` → rethrow. NEVER call `SaveChangesAsync` mid-method.

---

## ROW VERSIONING (CONCURRENCY TOKENS)

Add `[Timestamp] public byte[] RowVersion { get; set; }` to: `Batch`, `Slip`, `ScanItems`.

EF Core uses this automatically in UPDATE WHERE clauses. On conflict → `DbUpdateConcurrencyException` → catch → throw `ConflictException("Record modified by another user. Refresh and try again.")`.

Frontend: disable submit button on first click. Re-enable only on error response.

---

## VALIDATION (FLUENT VALIDATION)

Use FluentValidation for all input. One validator class per request DTO in `/Validators/`. Services call validator and throw `ValidationException` on failure — caught by `GlobalExceptionMiddleware` → returns `400 VALIDATION_ERROR` with field-level details.

Key rules enforced:
- ChqNo: exactly 6 digits
- MICR1: exactly 9 digits
- MICR2: exactly 6 digits
- SlipNo: unique within batch
- ClientCode: must exist + Status = 'A'
- BatchDate: not future, not empty
- PDCDate: required + after BatchDate when IsPDC = true

---

## IMAGE ACCESS SECURITY

Images are sensitive financial records — NEVER serve without auth.

Use `GET /api/images/{*relativePath}` controller (not `UseStaticFiles`):
1. Require `[Authorize]`
2. Reject paths containing `..` or rooted paths
3. Resolve full path from `IImageStorageConfig.BasePath`
4. Verify resolved path starts with `BasePath` (path traversal guard)
5. Return `PhysicalFile(fullPath, "image/jpeg")`

Frontend `getImageUrl()` points to `/api/images/{relativePath}` — JWT cookie sent automatically.

---

## SCANNER FAILURE HANDLING

`ScanItems` has `ScanStatus` (`Pending` / `Captured` / `Failed` / `RetryPending`), `ScanError`, `RetryCount`.

- Before scan session: health-check `GET http://localhost:7000/scanner/status` — if offline, block and show error
- On capture failure: set `ScanStatus = Failed`, increment `RetryCount`, show "Retry" in UI
- Max retries: 3 — after that, item stays Failed, must be rescanned
- On "Complete Scanning": verify all `Captured` items have files on disk — missing files → block completion + show error list

---

## DEPLOYMENT

- **Web app**: IIS on Windows, Application Pool No Managed Code, HTTPS
- **Scanner Service**: Windows Service (`UseWindowsService()`), auto-start on boot, runs on scan PC
- **Folder permissions**: IIS App Pool identity needs Read+Write on `ChequeData BasePath`; Scanner Service account needs Read+Write on same path
- **Config**: `appsettings.Production.json` lives on server only — NEVER committed to source control
- **React build**: `dotnet build` triggers `npm run build` via MSBuild target, copies output to `wwwroot`

---

## AUDIT LOG

`AuditLog` table: `AuditID`, `TableName`, `RecordID`, `Action` (INSERT/UPDATE/DELETE), `OldValues` (JSON), `NewValues` (JSON), `ChangedBy`, `ChangedAt`, `IPAddress`, `SessionID`.

Must audit: `Batch` status changes, `ScanItems` MICR edits, `UserMaster` role/password/lock changes, `AppSettings` changes, `Location` edits, `ClientMaster` edits, `Slip` edits.

Use `IAuditService` called from the service layer — NOT DB triggers. Store only changed fields (diff), not full object.

---

## FRONTEND DEPTH

- **Route protection**: `ProtectedRoute` component — unauthenticated → redirect `/login`; wrong role → redirect `/unauthorized`
- **Auth store** (Zustand): `UserSession` (userId, roles, locationId, eodDate). On page refresh: call `GET /api/auth/me` to rehydrate; 401 → redirect login
- **Toast notifications**: single `ToastProvider` — `toast.success/error/warning()`. Auto-dismiss: success 3s, error stays. Max 3 visible
- **Error boundary**: wrap each page — catches render crashes, shows "Go to Dashboard" fallback
- **Loading states**: skeleton screens (not spinners) for initial loads; `isLoading` → skeleton, `error` → inline error + retry button
- **Forms**: React Hook Form — field validation, dirty state guard ("Unsaved changes — leave?"), disable submit while in-flight

---

## FILE HEADER COMMENTS (MANDATORY — ALL SOURCE FILES)

Every `.cs`, `.ts`, `.tsx` file created for this project must start with:

**C#:**
```csharp
// =============================================================================
// File        : {FileName}.cs
// Project     : CPS — Cheque Processing System
// Module      : {Module}
// Description : {One sentence}
// Created     : {YYYY-MM-DD}
// =============================================================================
```

**TypeScript/TSX:**
```typescript
// =============================================================================
// File        : {FileName}.tsx
// Project     : CPS — Cheque Processing System
// Module      : {Module}
// Description : {One sentence}
// Created     : {YYYY-MM-DD}
// =============================================================================
```

Do NOT add headers to: EF migration files, `*.Designer.cs`, `appsettings.json`, `package.json`, `.csproj`.

---

## SINGLE LIVING DOCUMENTATION RULE

**`PHASE1_BLUEPRINT.md` is the ONE AND ONLY documentation file for this project.**

- NEVER create `README.md`, `SETUP.md`, `API.md`, `DECISIONS.md`, or any other `.md` file
- When anything new is decided, clarified, or discovered → update `PHASE1_BLUEPRINT.md`
- When a section becomes outdated → update it in place
- Add update notes inline: `> Updated YYYY-MM-DD: what changed and why`

---

## BUILD, MIGRATION & RUN COMMANDS

### Project Paths
```
Solution root  : C:\Users\laksh\OneDrive\Desktop\new  cms applaiton\CPS\
Backend        : CPS\CPS.API\
Frontend       : CPS\CPS.Frontend\
```

### Backend — .NET

```bash
# Restore packages
dotnet restore CPS/CPS.API/CPS.API.csproj

# Build (also triggers React build via MSBuild target)
dotnet build CPS/CPS.API/CPS.API.csproj

# Publish (release build — copies React output to wwwroot)
dotnet publish CPS/CPS.API/CPS.API.csproj -c Release -o ./publish

# Run the application (give this command to user — DO NOT run it yourself)
dotnet run --project CPS/CPS.API/CPS.API.csproj
# → App starts at https://localhost:5000
```

### EF Core Migrations

All migration commands run from the solution root. Target project = `CPS.API`, context = `AppDbContext`.

```bash
# Add a new migration (replace MigrationName with descriptive name e.g. InitialCreate, AddScanStatus)
dotnet ef migrations add MigrationName --project CPS/CPS.API --startup-project CPS/CPS.API

# Apply all pending migrations to the database
dotnet ef database update --project CPS/CPS.API --startup-project CPS/CPS.API

# Revert last migration (undo last applied migration)
dotnet ef database update PreviousMigrationName --project CPS/CPS.API --startup-project CPS/CPS.API

# Remove last unapplied migration (only if not yet applied to DB)
dotnet ef migrations remove --project CPS/CPS.API --startup-project CPS/CPS.API

# List all migrations and their applied status
dotnet ef migrations list --project CPS/CPS.API --startup-project CPS/CPS.API

# Generate SQL script for all migrations (useful for production deploy)
dotnet ef script --project CPS/CPS.API --startup-project CPS/CPS.API -o migrate.sql
```

EF Core tools must be installed:
```bash
dotnet tool install --global dotnet-ef
# or update if already installed:
dotnet tool update --global dotnet-ef
```

### Frontend — React

```bash
# Install dependencies
cd CPS/CPS.Frontend
npm install

# Build for production (output goes to CPS.Frontend/build/ — copied to wwwroot by dotnet build)
npm run build

# Type-check without building
npx tsc --noEmit
```

### Migration Naming Convention

Use descriptive names that describe what changed:

| Scenario | Migration name |
|---|---|
| First ever migration | `InitialCreate` |
| Adding a new table | `AddAuditLogTable` |
| Adding a column | `AddScanStatusToScanItems` |
| Adding an index | `AddIndexOnBatchDate` |
| Dropping a column | `RemoveObsoleteColumn` |

### Connection String for Dev

Set in `CPS/CPS.API/appsettings.Development.json` (not committed if it contains real credentials):

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\mssqllocaldb;Database=CPS_Dev;Trusted_Connection=True;"
  }
}
```

Or for full SQL Server:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=CPS_Dev;User Id=sa;Password=yourpassword;TrustServerCertificate=True;"
  }
}
```

### First-Time Setup Sequence (give to user)

```bash
# 1. Install EF tools (once)
dotnet tool install --global dotnet-ef

# 2. Restore backend packages
dotnet restore CPS/CPS.API/CPS.API.csproj

# 3. Install frontend packages
cd CPS/CPS.Frontend && npm install && cd ../..

# 4. Apply migrations to create DB
dotnet ef database update --project CPS/CPS.API --startup-project CPS/CPS.API

# 5. Run the app (user runs this)
dotnet run --project CPS/CPS.API/CPS.API.csproj
```

### Important Rules for AI
- **NEVER run `dotnet run` or `npm start`** — give the command to the user, do not execute it
- CAN run: `dotnet build`, `dotnet restore`, `dotnet ef migrations add`, `dotnet ef database update`, `npm install`, `npm run build`, `npx tsc --noEmit`
- After any DB model change → always add a migration immediately
- After any migration → update the relevant table schema in `PHASE1_BLUEPRINT.md`

---

## HOW TO USE THIS FILE

Before ANY coding task, ask:
1. Is this in Phase 1 scope? (If Phase 2 → don't build it)
2. What does the PHASE1_BLUEPRINT.md say about this module?
3. Does this follow the layered architecture?
4. Am I avoiding any of the "never do" items?
5. Is the DB change following the schema rules (audit fields, soft delete, indexes)?
6. Is the UI responsive?
7. Does any DB model change need a migration?
