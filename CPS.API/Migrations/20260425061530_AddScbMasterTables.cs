using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddScbMasterTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ScbBanks",
                columns: table => new
                {
                    BankRoutingNo = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    StreetAddress = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    City = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    StateProvince = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PostalZipCode = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Country = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ClearingStatusCode = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Note = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ServiceBranchRoutingNo = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DesignatedBranchRoutingNo = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CbsEnabled = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScbBanks", x => x.BankRoutingNo);
                });

            migrationBuilder.CreateTable(
                name: "ScbBranches",
                columns: table => new
                {
                    BranchRoutingNo = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    BankRoutingNo = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    StreetAddress = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    City = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    StateProvince = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PostalZipCode = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Country = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    BranchNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Note = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScbBranches", x => x.BranchRoutingNo);
                });

            migrationBuilder.CreateTable(
                name: "ScbCities",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CityCode = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CityName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ClearingType = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScbCities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ScbMasterStatuses",
                columns: table => new
                {
                    SectionName = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RecordCount = table.Column<int>(type: "int", nullable: false),
                    Version = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScbMasterStatuses", x => x.SectionName);
                });

            migrationBuilder.CreateTable(
                name: "ScbReturnReasons",
                columns: table => new
                {
                    ReturnReasonCode = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScbReturnReasons", x => x.ReturnReasonCode);
                });

            migrationBuilder.CreateTable(
                name: "ScbSessionDefinitions",
                columns: table => new
                {
                    SessionNbr = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    OpenReceivingTime = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CloseReceivingTime = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CalendarCode = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CurrencyCode = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScbSessionDefinitions", x => x.SessionNbr);
                });

            migrationBuilder.CreateTable(
                name: "ScbTranslationRules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PayorBankRoutingNo = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    LogicalRoutingNo = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    FromDate = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ToDate = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScbTranslationRules", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ScbBranches_BankRoutingNo",
                table: "ScbBranches",
                column: "BankRoutingNo");

            migrationBuilder.CreateIndex(
                name: "IX_ScbTranslationRules_PayorBankRoutingNo",
                table: "ScbTranslationRules",
                column: "PayorBankRoutingNo");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ScbBanks");

            migrationBuilder.DropTable(
                name: "ScbBranches");

            migrationBuilder.DropTable(
                name: "ScbCities");

            migrationBuilder.DropTable(
                name: "ScbMasterStatuses");

            migrationBuilder.DropTable(
                name: "ScbReturnReasons");

            migrationBuilder.DropTable(
                name: "ScbSessionDefinitions");

            migrationBuilder.DropTable(
                name: "ScbTranslationRules");
        }
    }
}
