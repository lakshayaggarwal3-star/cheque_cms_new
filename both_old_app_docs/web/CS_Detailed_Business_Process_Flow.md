# CS (Modern) – Detailed Business Process Flow

This document provides an exhaustive walkthrough of the **Modern Web-based Clearing System (CS)** operational lifecycle. It details the functional steps, business rules, and technical validations implemented at each stage of the cheque truncation process.

---

## Phase 1: Authentication & System Initialization

Before daily operations begin, the system must be secured and configured for the specific business day.

### 1.1 Secure Multi-Browser Login
- **Process**: Users authenticate via [LoginController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/LoginController.cs).
- **Session Token**: On every successful login, the system generates a new `SessionToken` (GUID).
- **Concurrency Check**: The [AutoLogoutMiddleware.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Models/AutoLogoutMiddleware.cs) ensures that if a user logs in from a second browser, the first session is automatically invalidated.
- **EOD Date Selection**: Users must select an **EOD (End of Day) Date** from the session. All operations (Scanning, Maker, Checker) are strictly filtered by this date.

### 1.2 Role-Based Permissions
The system enforces strict access control based on the `UserMaster` record:
- **IsScan**: Access to [ScanController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/ScanController.cs) for batch creation and image capture.
- **IsMaker**: Access to [MakerController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/MakerController.cs) for L1 data entry.
- **IsChecker**: Access to [CheckerController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/CheckerController.cs) for L2 verification.
- **IsAdmin**: Access to [XMLController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/XMLController.cs) and master data management.

---

## Phase 2: Batch Management & Creation

### 2.1 Batch Lifecycle & Naming
- **Creation**: Batches are created in [BatchController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/BatchController.cs).
- **Batch Number**: Generated as `{LocationID}{yyyyMMdd}{5-digit sequence}` to ensure global uniqueness.
- **Sub-Batching**: Large batches can be split into sub-batches ([SubBatchTbl](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Models/SubBatchTbl.cs)) for parallel processing by multiple makers.

### 2.2 Operational Checks
- **User Locking**: When a batch is opened for processing, `User_Lock` is set to the current `UserID`.
- **Status Guard**: Batches cannot move to the next stage (e.g., Maker to Checker) until all items within the batch/sub-batch have been successfully processed.

---

## Phase 3: Web-Based Scanning

Scanning captures the physical cheque's digital representation and its MICR data.

### 3.1 Hardware Integration (Ranger.js)
- **Process**: Communication with Silver Bullet Ranger scanners via WebSockets in [Ranger.js](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/wwwroot/js/Ranger.js).
- **Image Sets**: Each item generates four images stored in `wwwroot`:
  1. **Front JPEG**: Color/Grayscale for human review.
  2. **Rear JPEG**: Back side of the cheque.
  3. **Front TIF**: CCITT-4 Black & White (CTS-2010 compliant).
  4. **Rear TIF**: Back side Black & White.

### 3.2 Automated MICR Capture
- **Extraction**: Reads Cheque No, MICR1 (Bank/Branch), MICR2 (Account No), and MICR3 (Transaction Code).
- **Fail-Safe**: Items with unreadable MICR characters ('?' or '*') are automatically routed to the **Reject Repair (RR)** module.

---

## Phase 4: Reject Repair (RR)

### 4.1 Post-Scan Correction
- **Controller**: [RRController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/RRController.cs).
- **Manual Repair**: A specialized role for correcting scanning errors without needing to re-scan.
- **Validations**: Corrected MICR must be numeric, 9 digits for MICR1, and 6 digits for Cheque Number.

---

## Phase 5: Maker / Checker (Dual Entry) Workflow

This is the primary data enrichment phase where dual-entry verification ensures 100% data accuracy.

### 5.1 Maker Stage (Level 1)
- **Controller**: [MakerController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/MakerController.cs).
- **Slip Entry**: Associates cheques to a deposit slip.
- **Amount Balancing**: The system calculates the sum of all cheque amounts in a slip. If `TotalChequeAmount != SlipAmount`, saving is blocked with: *"Slip amount Does not match"*.
- **Account Validation**: Performs lookups against [SecondaryDbContext.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Data/SecondaryDbContext.cs) (Account Master) to ensure the account number is valid for the bank.
- **Status Update**: Upon successful completion, `BatchStatus` is updated to **6**.

### 5.2 Checker Stage (Level 2)
- **Controller**: [CheckerController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/CheckerController.cs).
- **Segregation of Duties**: The system checks `M_By` vs current `UserID`. If they match, access is blocked: *"Maker and Checker Can not be Done by Same User"*.
- **Blind Entry**: The Checker must re-enter or verify the data without seeing the Maker's input to detect silent errors.
- **Status Update**: Upon successful completion, `BatchStatus` is updated to **7**.

---

## Phase 6: Quality Control (QC)

### 6.1 Automated Field Comparison
- **Controller**: [QCController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/QCController.cs).
- **Logic**: Every field (Amount, Date, MICR, Account No) is automatically compared between Maker and Checker entries.
- **Discrepancy Handling**: Any mismatch flags the item for manual supervisor review. Once all discrepancies are resolved, the main batch status moves to **8**.

---

## Phase 7: XML Generation & Finalization (Admin Only)

### 7.1 Clearing File Preparation
- **Controller**: [XMLController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/XMLController.cs).
- **OTS XML**: Generates a standard metadata file with RSA-SHA256 digital signatures built from the MICR fingerprint (`ChqNo;MICR1;MICR3;AmountInPaise`).
- **OTI Image**: Concatenates Front, Back, and Grayscale images into a single binary `.img` file using `BinaryWriter`.
- **GEFU Generation**: Handled by [GEFUReportController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/GEFUReportController.cs) for CBS integration.

### 7.2 Storage & Archiving
- **Paths**: Files are saved to `E:\HDFC Department\Location Reports\{ddMMyyyy}\{LocationName}\...`.
- **Status Update**: `Report_Status = 1` indicates the batch is finalized and ready for submission.

---

## Phase 8: Submission (SFTP)

### 8.1 Secure Transmission
- **Controller**: [SftpController.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Controllers/SftpController.cs).
- **Service**: [sftpUploader.cs](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/Services/sftpUploader.cs).
- **Process**: Securely transmits the OTS XML and OTI IMG files to the bank's FTP server using SSH credentials stored in [appsettings.json](file:///c:/Users/laksh/Downloads/14-11-2024 CS_1/14-11-2024 CS_1/appsettings.json).

---

## Summary: Modern Batch Status Journey

| Status Code | Stage Name | Description |
|---|---|---|
| **0** | **Scanning** | Initial capture of images and MICR. |
| **RR Pending** | **Reject Repair** | Manual correction of unreadable MICR data. |
| **6** | **Maker (L1)** | Level 1 data entry and slip balancing. |
| **7** | **Checker (L2)** | Level 2 verification (Segregation of Duties enforced). |
| **8** | **QC** | Automated comparison and discrepancy resolution. |
| **Finalized** | **XML Generated** | Clearing files created (`Report_Status = 1`). |
| **Uploaded** | **SFTP Complete** | Files transmitted to bank. |
