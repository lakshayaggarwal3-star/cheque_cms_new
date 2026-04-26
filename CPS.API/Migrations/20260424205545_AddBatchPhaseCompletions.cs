using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddBatchPhaseCompletions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "RRCompletedAt",
                table: "Batches",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RRCompletedBy",
                table: "Batches",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ScanCompletedAt",
                table: "Batches",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ScanCompletedBy",
                table: "Batches",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RRCompletedAt",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "RRCompletedBy",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "ScanCompletedAt",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "ScanCompletedBy",
                table: "Batches");
        }
    }
}
