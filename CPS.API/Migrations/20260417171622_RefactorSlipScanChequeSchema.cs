using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class RefactorSlipScanChequeSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ScanItems");

            migrationBuilder.DropTable(
                name: "SlipSequences");

            migrationBuilder.DropTable(
                name: "Slips");

            migrationBuilder.CreateTable(
                name: "BatchSlipSequences",
                columns: table => new
                {
                    BatchSlipSeqId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BatchId = table.Column<long>(type: "bigint", nullable: false),
                    LastSeqNo = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BatchSlipSequences", x => x.BatchSlipSeqId);
                    table.ForeignKey(
                        name: "FK_BatchSlipSequences_Batches_BatchId",
                        column: x => x.BatchId,
                        principalTable: "Batches",
                        principalColumn: "BatchID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SlipEntries",
                columns: table => new
                {
                    SlipEntryId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BatchId = table.Column<long>(type: "bigint", nullable: false),
                    SlipNo = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    ClientCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ClientName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    DepositSlipNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    PickupPoint = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    TotalInstruments = table.Column<int>(type: "int", nullable: false),
                    SlipAmount = table.Column<decimal>(type: "decimal(15,3)", nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SlipStatus = table.Column<int>(type: "int", nullable: false),
                    EntryCompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
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
                    table.PrimaryKey("PK_SlipEntries", x => x.SlipEntryId);
                    table.ForeignKey(
                        name: "FK_SlipEntries_Batches_BatchId",
                        column: x => x.BatchId,
                        principalTable: "Batches",
                        principalColumn: "BatchID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ChequeItems",
                columns: table => new
                {
                    ChequeItemId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SlipEntryId = table.Column<int>(type: "int", nullable: false),
                    BatchId = table.Column<long>(type: "bigint", nullable: false),
                    SeqNo = table.Column<int>(type: "int", nullable: false),
                    ChqSeq = table.Column<int>(type: "int", nullable: false),
                    ChqNo = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    MICRRaw = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ScanMICR1 = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    ScanMICR2 = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    ScanMICR3 = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    ScanAmount = table.Column<decimal>(type: "decimal(15,3)", nullable: true),
                    RRMICR1 = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    RRMICR2 = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    RRMICR3 = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    RRAmount = table.Column<decimal>(type: "decimal(15,3)", nullable: true),
                    RRNotes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RRState = table.Column<int>(type: "int", nullable: false),
                    RRBy = table.Column<int>(type: "int", nullable: true),
                    RRTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    FrontImagePath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    BackImagePath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ScanStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ScanError = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RetryCount = table.Column<int>(type: "int", nullable: false),
                    ScannerType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ScanType = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChequeItems", x => x.ChequeItemId);
                    table.ForeignKey(
                        name: "FK_ChequeItems_Batches_BatchId",
                        column: x => x.BatchId,
                        principalTable: "Batches",
                        principalColumn: "BatchID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ChequeItems_SlipEntries_SlipEntryId",
                        column: x => x.SlipEntryId,
                        principalTable: "SlipEntries",
                        principalColumn: "SlipEntryId",
                        onDelete: ReferentialAction.NoAction);
                });

            migrationBuilder.CreateTable(
                name: "SlipScans",
                columns: table => new
                {
                    SlipScanId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SlipEntryId = table.Column<int>(type: "int", nullable: false),
                    ScanOrder = table.Column<int>(type: "int", nullable: false),
                    ImagePath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ScanStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ScanError = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RetryCount = table.Column<int>(type: "int", nullable: false),
                    ScannerType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SlipScans", x => x.SlipScanId);
                    table.ForeignKey(
                        name: "FK_SlipScans_SlipEntries_SlipEntryId",
                        column: x => x.SlipEntryId,
                        principalTable: "SlipEntries",
                        principalColumn: "SlipEntryId",
                        onDelete: ReferentialAction.NoAction);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BatchSlipSequences_BatchId",
                table: "BatchSlipSequences",
                column: "BatchId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChequeItems_BatchId",
                table: "ChequeItems",
                column: "BatchId");

            migrationBuilder.CreateIndex(
                name: "IX_ChequeItems_BatchId_SeqNo",
                table: "ChequeItems",
                columns: new[] { "BatchId", "SeqNo" });

            migrationBuilder.CreateIndex(
                name: "IX_ChequeItems_SlipEntryId",
                table: "ChequeItems",
                column: "SlipEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_ChequeItems_SlipEntryId_ChqSeq",
                table: "ChequeItems",
                columns: new[] { "SlipEntryId", "ChqSeq" });

            migrationBuilder.CreateIndex(
                name: "IX_SlipEntries_BatchId",
                table: "SlipEntries",
                column: "BatchId");

            migrationBuilder.CreateIndex(
                name: "IX_SlipEntries_BatchId_SlipNo",
                table: "SlipEntries",
                columns: new[] { "BatchId", "SlipNo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SlipScans_SlipEntryId",
                table: "SlipScans",
                column: "SlipEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_SlipScans_SlipEntryId_ScanOrder",
                table: "SlipScans",
                columns: new[] { "SlipEntryId", "ScanOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BatchSlipSequences");

            migrationBuilder.DropTable(
                name: "ChequeItems");

            migrationBuilder.DropTable(
                name: "SlipScans");

            migrationBuilder.DropTable(
                name: "SlipEntries");

            migrationBuilder.CreateTable(
                name: "Slips",
                columns: table => new
                {
                    SlipID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BatchID = table.Column<long>(type: "bigint", nullable: false),
                    ClientCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ClientName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    DepositSlipNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    PickupPoint = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    SlipAmount = table.Column<decimal>(type: "decimal(15,3)", nullable: false),
                    SlipNo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    SlipStatus = table.Column<int>(type: "int", nullable: false),
                    TotalInstruments = table.Column<int>(type: "int", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true)
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
                name: "SlipSequences",
                columns: table => new
                {
                    SeqID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LocationID = table.Column<int>(type: "int", nullable: false),
                    ScannerMappingID = table.Column<int>(type: "int", nullable: true),
                    LastSeqNo = table.Column<int>(type: "int", nullable: false),
                    SlipDate = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SlipSequences", x => x.SeqID);
                    table.ForeignKey(
                        name: "FK_SlipSequences_LocationScanners_ScannerMappingID",
                        column: x => x.ScannerMappingID,
                        principalTable: "LocationScanners",
                        principalColumn: "ScannerMappingID");
                    table.ForeignKey(
                        name: "FK_SlipSequences_Locations_LocationID",
                        column: x => x.LocationID,
                        principalTable: "Locations",
                        principalColumn: "LocationID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ScanItems",
                columns: table => new
                {
                    ScanID = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BatchID = table.Column<long>(type: "bigint", nullable: false),
                    SlipID = table.Column<int>(type: "int", nullable: true),
                    ChqNo = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    ImageBackPath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ImageFrontPath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsSlip = table.Column<bool>(type: "bit", nullable: false),
                    MICR1 = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    MICR2 = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    MICR3 = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    MICRRaw = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    MICRRepairFlag = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    RRBy = table.Column<int>(type: "int", nullable: true),
                    RRState = table.Column<int>(type: "int", nullable: false),
                    RRTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RetryCount = table.Column<int>(type: "int", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    ScanError = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ScanStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ScanType = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    ScannerType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    SeqNo = table.Column<int>(type: "int", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true)
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
                name: "IX_SlipSequences_LocationID",
                table: "SlipSequences",
                column: "LocationID");

            migrationBuilder.CreateIndex(
                name: "IX_SlipSequences_ScannerMappingID",
                table: "SlipSequences",
                column: "ScannerMappingID");

            migrationBuilder.CreateIndex(
                name: "IX_SlipSequences_SlipDate_LocationID_ScannerMappingID",
                table: "SlipSequences",
                columns: new[] { "SlipDate", "LocationID", "ScannerMappingID" },
                unique: true,
                filter: "[ScannerMappingID] IS NOT NULL");
        }
    }
}
