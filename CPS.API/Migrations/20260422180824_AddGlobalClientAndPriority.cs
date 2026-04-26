using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddGlobalClientAndPriority : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "GlobalClientID",
                table: "Clients",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsPriority",
                table: "Clients",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "GlobalClients",
                columns: table => new
                {
                    GlobalClientID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GlobalCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    GlobalName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    IsPriority = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GlobalClients", x => x.GlobalClientID);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Clients_GlobalClientID",
                table: "Clients",
                column: "GlobalClientID");

            migrationBuilder.CreateIndex(
                name: "IX_Clients_IsPriority",
                table: "Clients",
                column: "IsPriority");

            migrationBuilder.CreateIndex(
                name: "IX_GlobalClients_GlobalCode",
                table: "GlobalClients",
                column: "GlobalCode",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Clients_GlobalClients_GlobalClientID",
                table: "Clients",
                column: "GlobalClientID",
                principalTable: "GlobalClients",
                principalColumn: "GlobalClientID",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Clients_GlobalClients_GlobalClientID",
                table: "Clients");

            migrationBuilder.DropTable(
                name: "GlobalClients");

            migrationBuilder.DropIndex(
                name: "IX_Clients_GlobalClientID",
                table: "Clients");

            migrationBuilder.DropIndex(
                name: "IX_Clients_IsPriority",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "GlobalClientID",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "IsPriority",
                table: "Clients");
        }
    }
}
