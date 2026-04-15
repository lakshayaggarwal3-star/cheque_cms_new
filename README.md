# CPS — Cheque Processing System
### Fresh Start Guide

---

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| .NET SDK | 8.x | `dotnet --version` |
| SQL Server | 2019+ or LocalDB | `sqllocaldb info` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| EF Core CLI | latest | `dotnet ef --version` |

Install EF tools if missing:
```bash
dotnet tool install --global dotnet-ef
```

---

## Project Structure

```
new  cms applaiton/
├── CPS.API/          ← .NET 8 Web API (backend + SPA host)
├── CPS.Frontend/     ← React 18 TypeScript SPA
├── ChequeData/       ← Scanned images (outside project, configurable)
├── PHASE1_BLUEPRINT.md
└── README.md
```

---

## First-Time Setup

### 1. Configure the database connection

Edit `CPS.API/appsettings.json` → `ConnectionStrings:DefaultConnection`:

```json
"Server=(localdb)\\mssqllocaldb;Database=CPS_Dev;Trusted_Connection=True;"
```

Or for full SQL Server:
```json
"Server=localhost;Database=CPS_Dev;User Id=sa;Password=yourpassword;TrustServerCertificate=True;"
```

### 2. Install backend packages
```bash
dotnet restore CPS.API/CPS.API.csproj
```

### 3. Install frontend packages
```bash
cd CPS.Frontend
npm install
cd ..
```

### 4. Apply database migrations
```bash
dotnet ef database update --project CPS.API --startup-project CPS.API
```

---

## Running the App

### Option A — Production mode (React built into .NET)

```bash
cd CPS.Frontend
npm run build
xcopy /E /I /Y build "..\CPS.API\wwwroot"
cd ..
dotnet run --project CPS.API/CPS.API.csproj --urls "http://localhost:5000"
```

Open: `http://localhost:5000`

### Option B — Development mode (type-check only)

```bash
# Terminal 1 — backend
dotnet run --project CPS.API/CPS.API.csproj --urls "http://localhost:5000"

# Terminal 2 — frontend type check
cd CPS.Frontend
npx tsc --noEmit
```

> In dev mode the frontend is served through the .NET backend (wwwroot).  
> The `package.json` proxy points to `http://localhost:5000` for API calls during `npm start`.

---

## Default Login

On first run the app **auto-creates** a developer account if the Users table is empty:

| Field | Value |
|---|---|
| Employee ID | `DEV001` |
| Password | `DEV@1234` |
| EOD Date | Today's date (e.g. `2026-04-14`) |

This account has all roles: Scanner, Maker, Checker, Admin, Developer.

---

## Phase 1 Workflow

```
Login → Dashboard → Create Batch → Scan → (Slip Entry) → RR → Complete
```

| Route | Page |
|---|---|
| `/` | Dashboard — batch list + summary cards |
| `/batch/create` | Create a new batch |
| `/scan/:batchId` | Scanning screen |
| `/rr/:batchId` | Reject Repair (MICR correction) |
| `/admin/users` | User management (Admin only) |
| `/admin/masters` | Location + Client master upload (Admin only) |

---

## Adding a Migration

After any DB model change:
```bash
dotnet ef migrations add <MigrationName> --project CPS.API --startup-project CPS.API
dotnet ef database update --project CPS.API --startup-project CPS.API
```

---

## Image Storage

Images are stored outside the project at the path configured in `appsettings.json`:
```json
"ChequeData": {
  "BasePath": "C:\\Users\\laksh\\OneDrive\\Desktop\\new  cms applaiton\\ChequeData",
  "BankCode": "SCB"
}
```

Served securely via `GET /api/images/{*relativePath}` (requires login).

---

## Key Architecture Rules

- Single port `5000` — API + SPA + images on same port. Never split.
- JWT stored in `httpOnly` cookie — never localStorage.
- All DB writes use transactions. Never hard-delete — soft delete only.
- Images never stored in DB — file path only.
- Batch numbers generated with `UPDLOCK` to prevent duplicates.
