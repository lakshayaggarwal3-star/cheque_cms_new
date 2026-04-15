# Application Documentation: CS (Clearing System)

This documentation provides an overview of the modules, features, and file generation processes within the CS .NET application.

## **Modules & Features**

### **1. Batch Management**
Handles the creation, selection, and lifecycle of batches for cheque processing.
- **Batch Creation**: Generates new batch numbers using a combination of `LocationID`, current date (`yyyyMMdd`), and a 5-digit sequence number.
- **Batch Selection**: Users can view and select today's batches assigned to their location.
- **Batch Locking**: Prevents multiple users from working on the same batch/sub-batch simultaneously.
- **Key Files**: 
  - [BatchController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/BatchController.cs)
  - [UnlockBatchController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/UnlockBatchController.cs)
  - [Batch.cs (Model)](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Models/Batch.cs)

### **2. Scanner Module**
Captures images and data from physical cheques and slips.
- **Scanning**: Uses Ranger.js to interface with physical scanners.
- **Image Capture**: Saves four images per item: Front JPEG, Rear JPEG, Front TIF (Black & White), and Rear TIF (Black & White).
- **MICR Reading**: Automatically reads MICR lines, including Cheque Number, MICR1, MICR2, and MICR3.
- **Storage**: Images are stored in `wwwroot` under a directory structure: `{LocationName}/{HubLocationName}/{BatchNo}/{SubBatchNo}/`.
- **Key Files**: 
  - [ScanController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/ScanController.cs)
  - [Ranger.js](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/wwwroot/js/Ranger.js)
  - [Cheques.cs (Model)](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Models/Cheques.cs)

### **3. Maker Module**
The first level of data entry where a user verifies and corrects scanned data.
- **Data Entry**: Verifies MICR details, enters cheque amounts, dates, and account details.
- **Validation**: Checks for errors and flags items for correction.
- **Workflow**: Updates the batch status to indicate Maker completion.
- **Key Files**: 
  - [MakerController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/MakerController.cs)
  - [Maker.cshtml (View)](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Views/Maker/Maker.cshtml)

### **4. Checker Module**
The second level of verification performed by a different user.
- **Verification**: Re-enters or verifies data entered by the Maker.
- **Account Validation**: Validates account numbers against a secondary database.
- **Amount Matching**: Ensures the total of cheque amounts matches the slip amount.
- **Key Files**: 
  - [CheckerController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/CheckerController.cs)
  - [Checker.cshtml (View)](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Views/Checker/Checker.cshtml)

### **5. QC (Quality Control) Module**
Automated and manual comparison to resolve discrepancies.
- **Comparison**: Automatically compares Maker and Checker entries for all fields (MICR, Amount, Date, etc.).
- **Mismatch Handling**: Items with differences are flagged for a QC user to make the final decision.
- **Batch Completion**: Once QC is finished, the batch is ready for XML generation.
- **Key Files**: 
  - [QCController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/QCController.cs)
  - [QC_WS.cshtml (View)](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Views/QC/QC_WS.cshtml)

### **6. XML & File Generation**
Finalizes batch data into standard formats for bank submission.
- **XML Generation**: Creates `OTS_*.xml` files containing all cheque metadata.
- **Binary Image Generation**: Combines multiple item images into a single `OTI_*.img` file.
- **Naming Convention**: `OTS_{VendorId}_{HubLocationId}_{Date}_{Time}_{FileId}.xml`.
- **Paths**: Files are saved to a specific network/local path (e.g., `E:\HDFC Department\Location Reports\...`).
- **Key Files**: 
  - [XMLController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/XMLController.cs)

### **7. SFTP Module**
Handles secure transmission of generated files to the bank.
- **Upload**: Uploads the XML and IMG files via SFTP using configured credentials.
- **Key Files**: 
  - [SftpController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/SftpController.cs)
  - [sftpUploader.cs (Service)](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Services/sftpUploader.cs)

### **8. Reporting System**
A comprehensive reporting module for operational tracking and audit.
- **Operational Reports**: Includes Daily Reports, Batch Summary, and Productivity Reports.
- **Financial Reports**: GEFU Reports, High Value reports, and Transfer Reports.
- **Audit & Error Reports**: Error Reports, Duplicate Reports, and Modified Reports.
- **Key Files**: 
  - [DailyReportController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/DailyReportController.cs)
  - [BatchSummaryReportController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/BatchSummaryReportController.cs)
  - [ProductivityReportController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/ProductivityReportController.cs)
  - [GEFUReportController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/GEFUReportController.cs)

### **9. Administration & Master Management**
System settings and master data management.
- **User Management**: Creating and managing users, including their roles (Scan, Maker, Checker, Admin) and assigned locations.
- **Location Management**: Managing branch and hub locations, including CHM codes and vendor details.
- **Master Data**: Bank Master, Branch Master, and Return Reason Master.
- **Key Files**: 
  - [ManageUserController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/ManageUserController.cs)
  - [ManageLocationController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/ManageLocationController.cs)
  - [Bank.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/Bank.cs)

### **10. Specialized Processing & Utilities**
Additional features for specific cheque handling scenarios.
- **High Value Processing**: Logic to identify and handle cheques above a certain amount threshold.
- **Initial Rejections (IniReject)**: Workflow for items that are rejected at the scanning or initial processing stage.
- **Manual Account Entry**: Ability to manually input or correct account numbers when OCR fails.
- **Batch Utilities**: Tools to move batches between locations, delete batches, or unlock stuck batches.
- **Search**: Advanced search for cheques and slips across the system.
- **Key Files**: 
  - [HighValueController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/HighValueController.cs)
  - [IniRejectController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/IniRejectController.cs)
  - [ManualAccountNoController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/ManualAccountNoController.cs)
  - [SearchCQController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/SearchCQController.cs)
  - [MoveBatchesController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/MoveBatchesController.cs)

### **11. Authentication & Security**
Securing access to the system and managing user sessions.
- **Login**: Credential-based access to the system with role-based redirection.
- **Auto-Logout**: Middleware to automatically log out users after a period of inactivity.
- **Session Tracking**: Tracks user login/logout times and assigned location for each session.
- **Key Files**: 
  - [LoginController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/LoginController.cs)
  - [AutoLogoutMiddleware.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Models/AutoLogoutMiddleware.cs)

### **12. Master Data Import & Management**
Tools for bulk importing and managing external master data.
- **Data Imports**: Functionality to import Account Master and Bank Master from external sources (Excel/CSV).
- **Blocked Accounts**: Managing lists of accounts that are blocked from processing.
- **Key Files**: 
  - [AccountImportController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/AccountImportController.cs)
  - [BankImportController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/BankImportController.cs)
  - [OptionMenuController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/OptionMenuController.cs)

### **13. Operational Dashboards**
Visual summaries and real-time tracking of clearing operations.
- **Dash Summary**: High-level overview of batch counts, cheque counts, and amounts processed.
- **Report Dashboard**: Centralized hub for accessing all operational and financial reports.
- **Key Files**: 
  - [DashSummaryController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/DashSummaryController.cs)
  - [ReportDashboardController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/ReportDashboardController.cs)

### **14. Miscellaneous Utilities**
Administrative tools for managing the clearing lifecycle.
- **Data Correction**: Tools to change batch processing dates or reassignment to different locations.
- **Skip OCR**: Manual processing of items where OCR/MICR cannot be reliably read.
- **Cleanup**: Deleting batches, sub-batches, or specific slips/cheques.
- **Drawer Name Verification**: Managing and verifying the names of drawers on cheques.
- **Key Files**: 
  - [ChangeDateController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/ChangeDateController.cs)
  - [ChangeLocationController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/ChangeLocationController.cs)
  - [SkipOCRController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/SkipOCRController.cs)
  - [DeleteBatchController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/DeleteBatchController.cs)
  - [DrawerNameController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/DrawerNameController.cs)

## **Data Flow & File Involvement**

1.  **Scanner**: Generates individual JPEG/TIF images in `wwwroot`. Stores metadata in the `Cheques` table.
2.  **Maker/Checker**: Reads data from the `Cheques` and `Slip_Entry` tables. Updates `M_Status` and `C_Status`.
3.  **QC**: Compares Maker/Checker data. Updates `Q_Status`.
4.  **XML Generation**:
    - Reads final verified data from `Cheques`.
    - Reads images from `wwwroot` directories.
    - Consolidates images into one binary `.img` file.
    - Generates one `.xml` metadata file.
5.  **SFTP**: Picks up the `.xml` and `.img` files from the generation folder and uploads them.

## **Key Database Contexts**
- **ApplicationDbContext**: Primary database for application data (Batches, Cheques, Slips, Users).
- **SecondaryDbContext**: Used for external lookups (e.g., Account Master verification).
