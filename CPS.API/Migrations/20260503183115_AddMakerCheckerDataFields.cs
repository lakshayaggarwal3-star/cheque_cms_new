using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddMakerCheckerDataFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Amount",
                table: "ChequeItems",
                type: "decimal(15,3)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CheckerAmount",
                table: "ChequeItems",
                type: "decimal(15,3)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CheckerBeneficiary",
                table: "ChequeItems",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "CheckerDate",
                table: "ChequeItems",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MakerAmount",
                table: "ChequeItems",
                type: "decimal(15,3)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MakerBeneficiary",
                table: "ChequeItems",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "MakerDate",
                table: "ChequeItems",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Amount",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "CheckerAmount",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "CheckerBeneficiary",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "CheckerDate",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "MakerAmount",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "MakerBeneficiary",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "MakerDate",
                table: "ChequeItems");
        }
    }
}
