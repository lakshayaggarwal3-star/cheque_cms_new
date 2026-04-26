using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSpecializedMICRFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RRChqNo",
                table: "ChequeItems",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ScanChqNo",
                table: "ChequeItems",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ScanMICRRaw",
                table: "ChequeItems",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RRChqNo",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "ScanChqNo",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "ScanMICRRaw",
                table: "ChequeItems");
        }
    }
}
