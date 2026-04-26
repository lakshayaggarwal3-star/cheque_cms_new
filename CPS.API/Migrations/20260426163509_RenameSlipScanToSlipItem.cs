using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class RenameSlipScanToSlipItem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SlipScans");

            migrationBuilder.AddColumn<string>(
                name: "EntryMode",
                table: "ChequeItems",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SlipItems",
                columns: table => new
                {
                    SlipItemId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SlipEntryId = table.Column<long>(type: "bigint", nullable: false),
                    ScanOrder = table.Column<int>(type: "int", nullable: false),
                    ImageBaseName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ImageName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    FileExtension = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    ImageHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    ScanStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ScanError = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RetryCount = table.Column<int>(type: "int", nullable: false),
                    ScannerType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    EntryMode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SlipItems", x => x.SlipItemId);
                    table.ForeignKey(
                        name: "FK_SlipItems_SlipEntries_SlipEntryId",
                        column: x => x.SlipEntryId,
                        principalTable: "SlipEntries",
                        principalColumn: "SlipEntryId");
                });

            migrationBuilder.CreateIndex(
                name: "IX_SlipItems_SlipEntryId",
                table: "SlipItems",
                column: "SlipEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_SlipItems_SlipEntryId_ScanOrder",
                table: "SlipItems",
                columns: new[] { "SlipEntryId", "ScanOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SlipItems");

            migrationBuilder.DropColumn(
                name: "EntryMode",
                table: "ChequeItems");

            migrationBuilder.CreateTable(
                name: "SlipScans",
                columns: table => new
                {
                    SlipScanId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SlipEntryId = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    FileExtension = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    ImageBaseName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ImageHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    ImageName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    RetryCount = table.Column<int>(type: "int", nullable: false),
                    ScanError = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ScanOrder = table.Column<int>(type: "int", nullable: false),
                    ScanStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ScannerType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SlipScans", x => x.SlipScanId);
                    table.ForeignKey(
                        name: "FK_SlipScans_SlipEntries_SlipEntryId",
                        column: x => x.SlipEntryId,
                        principalTable: "SlipEntries",
                        principalColumn: "SlipEntryId");
                });

            migrationBuilder.CreateIndex(
                name: "IX_SlipScans_SlipEntryId",
                table: "SlipScans",
                column: "SlipEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_SlipScans_SlipEntryId_ScanOrder",
                table: "SlipScans",
                columns: new[] { "SlipEntryId", "ScanOrder" });
        }
    }
}
