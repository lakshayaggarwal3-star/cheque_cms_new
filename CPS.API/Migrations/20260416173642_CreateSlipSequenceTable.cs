using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class CreateSlipSequenceTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SlipSequences",
                columns: table => new
                {
                    SeqID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SlipDate = table.Column<DateOnly>(type: "date", nullable: false),
                    LocationID = table.Column<int>(type: "int", nullable: false),
                    ScannerMappingID = table.Column<int>(type: "int", nullable: true),
                    LastSeqNo = table.Column<int>(type: "int", nullable: false)
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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SlipSequences");
        }
    }
}
