using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddExtraMasters : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ClientCaptureRules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CEID = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ClientCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    FieldName1 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    FieldName2 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    FieldName3 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    FieldName4 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    FieldName5 = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientCaptureRules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "InternalBankMasters",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EBANK = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    SORTCODE = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    NAME = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    FULLNAME = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    BRANCH = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InternalBankMasters", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClientCaptureRules");

            migrationBuilder.DropTable(
                name: "InternalBankMasters");
        }
    }
}
