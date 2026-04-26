using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddFinalMICRFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MICR1",
                table: "ChequeItems",
                type: "nvarchar(15)",
                maxLength: 15,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MICR2",
                table: "ChequeItems",
                type: "nvarchar(15)",
                maxLength: 15,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MICR3",
                table: "ChequeItems",
                type: "nvarchar(5)",
                maxLength: 5,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MICR1",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "MICR2",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "MICR3",
                table: "ChequeItems");
        }
    }
}
