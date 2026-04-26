using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class RemoveLegacyRoleColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsDeveloper",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "RoleAdmin",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "RoleChecker",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "RoleImageViewer",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "RoleMaker",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "RoleMobileScanner",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "RoleScanner",
                table: "Users");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsDeveloper",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RoleAdmin",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RoleChecker",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RoleImageViewer",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RoleMaker",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RoleMobileScanner",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RoleScanner",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }
    }
}
