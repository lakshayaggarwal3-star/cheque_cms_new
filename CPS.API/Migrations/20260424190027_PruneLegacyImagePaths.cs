using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class PruneLegacyImagePaths : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImagePath",
                table: "SlipScans");

            migrationBuilder.DropColumn(
                name: "BackImagePath",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "BackImageTiffPath",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "FrontImagePath",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "FrontImageTiffPath",
                table: "ChequeItems");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImagePath",
                table: "SlipScans",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BackImagePath",
                table: "ChequeItems",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BackImageTiffPath",
                table: "ChequeItems",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FrontImagePath",
                table: "ChequeItems",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FrontImageTiffPath",
                table: "ChequeItems",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);
        }
    }
}
