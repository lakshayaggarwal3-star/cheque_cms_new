using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSummRefNoPIFToBatch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PIF",
                table: "Batches",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SummRefNo",
                table: "Batches",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PIF",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "SummRefNo",
                table: "Batches");
        }
    }
}
