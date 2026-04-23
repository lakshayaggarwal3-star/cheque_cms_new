using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddUserRoleSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ChequeItems_SlipEntries_SlipEntryId",
                table: "ChequeItems");

            migrationBuilder.DropForeignKey(
                name: "FK_SlipScans_SlipEntries_SlipEntryId",
                table: "SlipScans");

            migrationBuilder.CreateTable(
                name: "Roles",
                columns: table => new
                {
                    RoleID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RoleName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.RoleID);
                });

            migrationBuilder.CreateTable(
                name: "UserRoles",
                columns: table => new
                {
                    UserRoleID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserID = table.Column<int>(type: "int", nullable: false),
                    RoleID = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserRoles", x => x.UserRoleID);
                    table.ForeignKey(
                        name: "FK_UserRoles_Roles_RoleID",
                        column: x => x.RoleID,
                        principalTable: "Roles",
                        principalColumn: "RoleID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserRoles_Users_UserID",
                        column: x => x.UserID,
                        principalTable: "Users",
                        principalColumn: "UserID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserRoles_RoleID",
                table: "UserRoles",
                column: "RoleID");

            migrationBuilder.CreateIndex(
                name: "IX_UserRoles_UserID_RoleID",
                table: "UserRoles",
                columns: new[] { "UserID", "RoleID" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ChequeItems_SlipEntries_SlipEntryId",
                table: "ChequeItems",
                column: "SlipEntryId",
                principalTable: "SlipEntries",
                principalColumn: "SlipEntryId");

            migrationBuilder.AddForeignKey(
                name: "FK_SlipScans_SlipEntries_SlipEntryId",
                table: "SlipScans",
                column: "SlipEntryId",
                principalTable: "SlipEntries",
                principalColumn: "SlipEntryId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ChequeItems_SlipEntries_SlipEntryId",
                table: "ChequeItems");

            migrationBuilder.DropForeignKey(
                name: "FK_SlipScans_SlipEntries_SlipEntryId",
                table: "SlipScans");

            migrationBuilder.DropTable(
                name: "UserRoles");

            migrationBuilder.DropTable(
                name: "Roles");

            migrationBuilder.AddForeignKey(
                name: "FK_ChequeItems_SlipEntries_SlipEntryId",
                table: "ChequeItems",
                column: "SlipEntryId",
                principalTable: "SlipEntries",
                principalColumn: "SlipEntryId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SlipScans_SlipEntries_SlipEntryId",
                table: "SlipScans",
                column: "SlipEntryId",
                principalTable: "SlipEntries",
                principalColumn: "SlipEntryId",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
