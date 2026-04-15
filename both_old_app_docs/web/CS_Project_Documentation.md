# CS (Modern) – Project Documentation

## 1. Project Overview

**CS (Clearing System)** is a mission-critical enterprise web application designed for the automated truncation and clearing of physical cheques. It modernizes the legacy CCTS desktop workflow into a distributed, browser-based environment while ensuring 100% compliance with India's **CTS-2010 standards** and **RBI/NPCI clearing house** requirements.

The application manages the full cheque lifecycle: from hardware-integrated web scanning → multi-stage dual-entry verification (Maker/Checker) → automated quality control (QC) → RSA-signed XML/IMG generation → secure SFTP transmission.

---

## 2. Architecture & Technology Stack

### Core Infrastructure
| Component | Technology | Description |
|---|---|---|
| **Web Framework** | **ASP.NET Core 8.0 (MVC)** | Provides a robust, cross-platform foundation for the application and API layers. |
| **Data Access** | **Entity Framework Core** | Utilizes Code-First and Database-First approaches with `ApplicationDbContext` (Operational) and `SecondaryDbContext` (Account Lookup). |
| **Database** | **SQL Server** | High-availability storage for batch metadata, item details, and master data. |
| **Security** | **Session-Based JWT** | Implements `SessionToken` concurrency checks to prevent simultaneous logins from multiple browsers. |

### Technical Integrations & Libraries
| Library | Purpose |
|---|---|
| **Ranger.js** | WebSocket bridge for controlling **Silver Bullet Ranger** physical scanners directly from the browser. |
| **SSH.NET** | Provides secure SSH/SFTP capabilities for file transmission to bank grids. |
| **SixLabors.ImageSharp** | Server-side image processing for TIF/JPEG manipulation and concatenation. |
| **RSA Cryptography** | Native .NET libraries for RSA-SHA256 signing of MICR fingerprints (using `2048.pke` key). |
| **ClosedXML** | Robust Excel generation for productivity and operational reporting. |
| **Emgu.CV** | Computer Vision for automated MICR band detection and image alignment. |

---

## 3. Solution Structure & Sub-systems

The **CS** solution is organized into a clean MVC architecture:

### 3.1 Controllers (The Engine)
- **Workflow Controllers**: [MakerController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/MakerController.cs), [CheckerController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/CheckerController.cs), and [QCController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/QCController.cs) implement the primary business logic for dual-entry verification.
- **Hardware Controller**: [ScanController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/ScanController.cs) handles the orchestration of the scanning hardware and image persistence.
- **Generation Controllers**: [XMLController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/XMLController.cs) and [GEFUReportController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/GEFUReportController.cs) finalize batch data into clearing house and CBS formats.

### 3.2 Data Models (The Schema)
- **Operational Entities**: `Batch`, `Cheques`, `Slip_Entry`, and `SubBatchTbl` represent the core clearing containers.
- **Master Data**: `LocationMaster`, `UserMaster`, `Bank_Master`, and `Branch_Master` store system-wide configuration.
- **ViewModels**: Specialized DTOs like `SlipDto` and `ChequeDuplicateData` for efficient UI-to-DB communication.

### 3.3 Services & Middleware
- **[sftpUploader.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Services/sftpUploader.cs)**: Encapsulates the logic for SSH connectivity and file uploading.
- **[AutoLogoutMiddleware.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Models/AutoLogoutMiddleware.cs)**: Intercepts requests to enforce session inactivity timeouts.

---

## 4. Key Configuration & Deployment

### 4.1 Application Settings ([appsettings.json](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/appsettings.json))
- **ConnectionStrings**:
  - `DefaultConnection`: Operational database.
  - `SecondaryConnection`: External account verification database.
- **SFTP Configuration**: Host, Port, Username, and Password for the bank's secure grid.

### 4.2 Storage Strategy
- **Image Store**: `wwwroot/{LocationName}/{HubLocationName}/{BatchNo}/` — Hierarchical storage of 4 images per cheque.
- **Report Store**: `E:\HDFC Department\Location Reports\{ddMMyyyy}\` — Standardized path for generated XML and IMG files.

---

## 5. Security & Compliance

- **Segregation of Duties**: The code enforces that the same `UserID` cannot perform both Maker and Checker roles for the same batch.
- **Data Integrity**: RSA-SHA256 signing of MICR data ensures that clearing files cannot be tampered with during transmission.
- **CTS-2010 Compliance**: Automatic capture of bitonal (B&W) TIFF images and GrayScale JPEGs as mandated by the clearing house standards.
