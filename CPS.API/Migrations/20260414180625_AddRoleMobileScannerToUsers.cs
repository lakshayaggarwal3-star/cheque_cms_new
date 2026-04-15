using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddRoleMobileScannerToUsers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "RoleMobileScanner",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RoleMobileScanner",
                table: "Users");
        }
    }
}
