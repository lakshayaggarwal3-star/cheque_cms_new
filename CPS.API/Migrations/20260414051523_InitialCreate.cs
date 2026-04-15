using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AppSettings",
                columns: table => new
                {
                    SettingID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SettingKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SettingValue = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppSettings", x => x.SettingID);
                });

            migrationBuilder.CreateTable(
                name: "AuditLogs",
                columns: table => new
                {
                    AuditID = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TableName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    RecordID = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Action = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    OldValues = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NewValues = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ChangedBy = table.Column<int>(type: "int", nullable: false),
                    ChangedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IPAddress = table.Column<string>(type: "nvarchar(45)", maxLength: 45, nullable: true),
                    SessionID = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogs", x => x.AuditID);
                });

            migrationBuilder.CreateTable(
                name: "Clients",
                columns: table => new
                {
                    ClientID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CityCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ClientName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Address1 = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Address2 = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Address3 = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Address4 = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Address5 = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    PickupPointCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    PickupPointDesc = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    RCMSCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    StatusDate = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Clients", x => x.ClientID);
                });

            migrationBuilder.CreateTable(
                name: "Locations",
                columns: table => new
                {
                    LocationID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LocationName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    LocationCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    State = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Grid = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ClusterCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Zone = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    LocType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    PIFPrefix = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Locations", x => x.LocationID);
                });

            migrationBuilder.CreateTable(
                name: "MasterUploadLogs",
                columns: table => new
                {
                    UploadID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MasterType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    UploadedBy = table.Column<int>(type: "int", nullable: false),
                    UploadDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    TotalRows = table.Column<int>(type: "int", nullable: false),
                    SuccessRows = table.Column<int>(type: "int", nullable: false),
                    ErrorRows = table.Column<int>(type: "int", nullable: false),
                    ErrorLog = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MasterUploadLogs", x => x.UploadID);
                });

            migrationBuilder.CreateTable(
                name: "BatchSequences",
                columns: table => new
                {
                    SeqID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BatchDate = table.Column<DateOnly>(type: "date", nullable: false),
                    LocationID = table.Column<int>(type: "int", nullable: false),
                    LastSeqNo = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BatchSequences", x => x.SeqID);
                    table.ForeignKey(
                        name: "FK_BatchSequences_Locations_LocationID",
                        column: x => x.LocationID,
                        principalTable: "Locations",
                        principalColumn: "LocationID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LocationFinances",
                columns: table => new
                {
                    FinanceID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LocationID = table.Column<int>(type: "int", nullable: false),
                    BOFD = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    PreTrun = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    DepositAccount = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    IFSC = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LocationFinances", x => x.FinanceID);
                    table.ForeignKey(
                        name: "FK_LocationFinances_Locations_LocationID",
                        column: x => x.LocationID,
                        principalTable: "Locations",
                        principalColumn: "LocationID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LocationScanners",
                columns: table => new
                {
                    ScannerMappingID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LocationID = table.Column<int>(type: "int", nullable: false),
                    ScannerID = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ScannerModel = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ScannerType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LocationScanners", x => x.ScannerMappingID);
                    table.ForeignKey(
                        name: "FK_LocationScanners_Locations_LocationID",
                        column: x => x.LocationID,
                        principalTable: "Locations",
                        principalColumn: "LocationID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    UserID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EmployeeID = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Username = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    RoleScanner = table.Column<bool>(type: "bit", nullable: false),
                    RoleMaker = table.Column<bool>(type: "bit", nullable: false),
                    RoleChecker = table.Column<bool>(type: "bit", nullable: false),
                    RoleAdmin = table.Column<bool>(type: "bit", nullable: false),
                    IsDeveloper = table.Column<bool>(type: "bit", nullable: false),
                    DefaultLocationID = table.Column<int>(type: "int", nullable: true),
                    IsLoggedIn = table.Column<bool>(type: "bit", nullable: false),
                    SessionToken = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    LoginAttempts = table.Column<int>(type: "int", nullable: false),
                    IsLocked = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedBy = table.Column<int>(type: "int", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.UserID);
                    table.ForeignKey(
                        name: "FK_Users_Locations_DefaultLocationID",
                        column: x => x.DefaultLocationID,
                        principalTable: "Locations",
                        principalColumn: "LocationID");
                });

            migrationBuilder.CreateTable(
                name: "Batches",
                columns: table => new
                {
                    BatchID = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BatchNo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    LocationID = table.Column<int>(type: "int", nullable: false),
                    ScannerMappingID = table.Column<int>(type: "int", nullable: true),
                    PickupPointCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    BatchDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ClearingType = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    IsPDC = table.Column<bool>(type: "bit", nullable: false),
                    PDCDate = table.Column<DateOnly>(type: "date", nullable: true),
                    TotalSlips = table.Column<int>(type: "int", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "decimal(15,3)", nullable: false),
                    ScanType = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    WithSlip = table.Column<bool>(type: "bit", nullable: true),
                    BatchStatus = table.Column<int>(type: "int", nullable: false),
                    StatusHistory = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ScanLockedBy = table.Column<int>(type: "int", nullable: true),
                    ScanLockedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RRLockedBy = table.Column<int>(type: "int", nullable: true),
                    RRLockedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedBy = table.Column<int>(type: "int", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Batches", x => x.BatchID);
                    table.ForeignKey(
                        name: "FK_Batches_LocationScanners_ScannerMappingID",
                        column: x => x.ScannerMappingID,
                        principalTable: "LocationScanners",
                        principalColumn: "ScannerMappingID");
                    table.ForeignKey(
                        name: "FK_Batches_Locations_LocationID",
                        column: x => x.LocationID,
                        principalTable: "Locations",
                        principalColumn: "LocationID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserLocationHistories",
                columns: table => new
                {
                    HistoryID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserID = table.Column<int>(type: "int", nullable: false),
                    LocationID = table.Column<int>(type: "int", nullable: false),
                    AssignedDate = table.Column<DateOnly>(type: "date", nullable: false),
                    IsTemporary = table.Column<bool>(type: "bit", nullable: false),
                    AssignedBy = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserLocationHistories", x => x.HistoryID);
                    table.ForeignKey(
                        name: "FK_UserLocationHistories_Locations_LocationID",
                        column: x => x.LocationID,
                        principalTable: "Locations",
                        principalColumn: "LocationID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserLocationHistories_Users_UserID",
                        column: x => x.UserID,
                        principalTable: "Users",
                        principalColumn: "UserID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Slips",
                columns: table => new
                {
                    SlipID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BatchID = table.Column<long>(type: "bigint", nullable: false),
                    SlipNo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ClientCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ClientName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    DepositSlipNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    PickupPoint = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    TotalInstruments = table.Column<int>(type: "int", nullable: false),
                    SlipAmount = table.Column<decimal>(type: "decimal(15,3)", nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SlipStatus = table.Column<int>(type: "int", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Slips", x => x.SlipID);
                    table.ForeignKey(
                        name: "FK_Slips_Batches_BatchID",
                        column: x => x.BatchID,
                        principalTable: "Batches",
                        principalColumn: "BatchID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ScanItems",
                columns: table => new
                {
                    ScanID = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BatchID = table.Column<long>(type: "bigint", nullable: false),
                    SeqNo = table.Column<int>(type: "int", nullable: false),
                    IsSlip = table.Column<bool>(type: "bit", nullable: false),
                    SlipID = table.Column<int>(type: "int", nullable: true),
                    ImageFrontPath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ImageBackPath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    MICRRaw = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ChqNo = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    MICR1 = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    MICR2 = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    MICR3 = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    ScannerType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ScanType = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    RRState = table.Column<int>(type: "int", nullable: false),
                    RRBy = table.Column<int>(type: "int", nullable: true),
                    RRTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    MICRRepairFlag = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    ScanStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ScanError = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RetryCount = table.Column<int>(type: "int", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScanItems", x => x.ScanID);
                    table.ForeignKey(
                        name: "FK_ScanItems_Batches_BatchID",
                        column: x => x.BatchID,
                        principalTable: "Batches",
                        principalColumn: "BatchID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ScanItems_Slips_SlipID",
                        column: x => x.SlipID,
                        principalTable: "Slips",
                        principalColumn: "SlipID");
                });

            migrationBuilder.CreateIndex(
                name: "IX_AppSettings_SettingKey",
                table: "AppSettings",
                column: "SettingKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_ChangedAt",
                table: "AuditLogs",
                column: "ChangedAt");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_ChangedBy",
                table: "AuditLogs",
                column: "ChangedBy");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_TableName_RecordID",
                table: "AuditLogs",
                columns: new[] { "TableName", "RecordID" });

            migrationBuilder.CreateIndex(
                name: "IX_Batches_BatchNo",
                table: "Batches",
                column: "BatchNo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Batches_BatchStatus",
                table: "Batches",
                column: "BatchStatus");

            migrationBuilder.CreateIndex(
                name: "IX_Batches_LocationID_BatchDate",
                table: "Batches",
                columns: new[] { "LocationID", "BatchDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Batches_ScannerMappingID",
                table: "Batches",
                column: "ScannerMappingID");

            migrationBuilder.CreateIndex(
                name: "IX_BatchSequences_BatchDate_LocationID",
                table: "BatchSequences",
                columns: new[] { "BatchDate", "LocationID" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BatchSequences_LocationID",
                table: "BatchSequences",
                column: "LocationID");

            migrationBuilder.CreateIndex(
                name: "IX_Clients_CityCode",
                table: "Clients",
                column: "CityCode");

            migrationBuilder.CreateIndex(
                name: "IX_Clients_RCMSCode",
                table: "Clients",
                column: "RCMSCode");

            migrationBuilder.CreateIndex(
                name: "IX_LocationFinances_LocationID",
                table: "LocationFinances",
                column: "LocationID",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Locations_LocationCode",
                table: "Locations",
                column: "LocationCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LocationScanners_LocationID",
                table: "LocationScanners",
                column: "LocationID");

            migrationBuilder.CreateIndex(
                name: "IX_ScanItems_BatchID",
                table: "ScanItems",
                column: "BatchID");

            migrationBuilder.CreateIndex(
                name: "IX_ScanItems_BatchID_SeqNo",
                table: "ScanItems",
                columns: new[] { "BatchID", "SeqNo" });

            migrationBuilder.CreateIndex(
                name: "IX_ScanItems_SlipID",
                table: "ScanItems",
                column: "SlipID");

            migrationBuilder.CreateIndex(
                name: "IX_Slips_BatchID",
                table: "Slips",
                column: "BatchID");

            migrationBuilder.CreateIndex(
                name: "IX_Slips_BatchID_SlipNo",
                table: "Slips",
                columns: new[] { "BatchID", "SlipNo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserLocationHistories_LocationID",
                table: "UserLocationHistories",
                column: "LocationID");

            migrationBuilder.CreateIndex(
                name: "IX_UserLocationHistories_UserID_AssignedDate",
                table: "UserLocationHistories",
                columns: new[] { "UserID", "AssignedDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Users_DefaultLocationID",
                table: "Users",
                column: "DefaultLocationID");

            migrationBuilder.CreateIndex(
                name: "IX_Users_EmployeeID",
                table: "Users",
                column: "EmployeeID",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AppSettings");

            migrationBuilder.DropTable(
                name: "AuditLogs");

            migrationBuilder.DropTable(
                name: "BatchSequences");

            migrationBuilder.DropTable(
                name: "Clients");

            migrationBuilder.DropTable(
                name: "LocationFinances");

            migrationBuilder.DropTable(
                name: "MasterUploadLogs");

            migrationBuilder.DropTable(
                name: "ScanItems");

            migrationBuilder.DropTable(
                name: "UserLocationHistories");

            migrationBuilder.DropTable(
                name: "Slips");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "Batches");

            migrationBuilder.DropTable(
                name: "LocationScanners");

            migrationBuilder.DropTable(
                name: "Locations");
        }
    }
}
