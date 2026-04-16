using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddScannerMappingToBatchSequence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_BatchSequences_BatchDate_LocationID",
                table: "BatchSequences");

            migrationBuilder.AddColumn<int>(
                name: "ScannerMappingID",
                table: "BatchSequences",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_BatchSequences_BatchDate_LocationID_ScannerMappingID",
                table: "BatchSequences",
                columns: new[] { "BatchDate", "LocationID", "ScannerMappingID" },
                unique: true,
                filter: "[ScannerMappingID] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_BatchSequences_ScannerMappingID",
                table: "BatchSequences",
                column: "ScannerMappingID");

            migrationBuilder.AddForeignKey(
                name: "FK_BatchSequences_LocationScanners_ScannerMappingID",
                table: "BatchSequences",
                column: "ScannerMappingID",
                principalTable: "LocationScanners",
                principalColumn: "ScannerMappingID");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BatchSequences_LocationScanners_ScannerMappingID",
                table: "BatchSequences");

            migrationBuilder.DropIndex(
                name: "IX_BatchSequences_BatchDate_LocationID_ScannerMappingID",
                table: "BatchSequences");

            migrationBuilder.DropIndex(
                name: "IX_BatchSequences_ScannerMappingID",
                table: "BatchSequences");

            migrationBuilder.DropColumn(
                name: "ScannerMappingID",
                table: "BatchSequences");

            migrationBuilder.CreateIndex(
                name: "IX_BatchSequences_BatchDate_LocationID",
                table: "BatchSequences",
                columns: new[] { "BatchDate", "LocationID" },
                unique: true);
        }
    }
}
