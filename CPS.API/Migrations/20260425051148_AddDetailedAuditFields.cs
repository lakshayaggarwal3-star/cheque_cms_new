using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddDetailedAuditFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "RRTime",
                table: "ChequeItems",
                newName: "ScannerStartedAt");

            migrationBuilder.RenameColumn(
                name: "RRBy",
                table: "ChequeItems",
                newName: "ScannerCompletedBy");

            migrationBuilder.AddColumn<DateTime>(
                name: "RRCompletedAt",
                table: "ChequeItems",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RRCompletedBy",
                table: "ChequeItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RRStartedAt",
                table: "ChequeItems",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ScannerCompletedAt",
                table: "ChequeItems",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RRStartedAt",
                table: "Batches",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RRStartedBy",
                table: "Batches",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ScanStartedAt",
                table: "Batches",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ScanStartedBy",
                table: "Batches",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RRCompletedAt",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "RRCompletedBy",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "RRStartedAt",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "ScannerCompletedAt",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "RRStartedAt",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "RRStartedBy",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "ScanStartedAt",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "ScanStartedBy",
                table: "Batches");

            migrationBuilder.RenameColumn(
                name: "ScannerStartedAt",
                table: "ChequeItems",
                newName: "RRTime");

            migrationBuilder.RenameColumn(
                name: "ScannerCompletedBy",
                table: "ChequeItems",
                newName: "RRBy");
        }
    }
}
