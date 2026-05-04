using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddMakerCheckerQCPhases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CheckerCompletedAt",
                table: "ChequeItems",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CheckerCompletedBy",
                table: "ChequeItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CheckerState",
                table: "ChequeItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "MakerCompletedAt",
                table: "ChequeItems",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MakerCompletedBy",
                table: "ChequeItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MakerState",
                table: "ChequeItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "QCCompletedAt",
                table: "ChequeItems",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "QCCompletedBy",
                table: "ChequeItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QCNotes",
                table: "ChequeItems",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "QCState",
                table: "ChequeItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "CheckerCompletedAt",
                table: "Batches",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CheckerCompletedBy",
                table: "Batches",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CheckerLockedAt",
                table: "Batches",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CheckerLockedBy",
                table: "Batches",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CheckerStartedAt",
                table: "Batches",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CheckerStartedBy",
                table: "Batches",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "MakerCompletedAt",
                table: "Batches",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MakerCompletedBy",
                table: "Batches",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "MakerLockedAt",
                table: "Batches",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MakerLockedBy",
                table: "Batches",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "MakerStartedAt",
                table: "Batches",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MakerStartedBy",
                table: "Batches",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "QCCompletedAt",
                table: "Batches",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "QCCompletedBy",
                table: "Batches",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "QCLockedAt",
                table: "Batches",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "QCLockedBy",
                table: "Batches",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "QCStartedAt",
                table: "Batches",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "QCStartedBy",
                table: "Batches",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CheckerCompletedAt",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "CheckerCompletedBy",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "CheckerState",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "MakerCompletedAt",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "MakerCompletedBy",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "MakerState",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "QCCompletedAt",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "QCCompletedBy",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "QCNotes",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "QCState",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "CheckerCompletedAt",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "CheckerCompletedBy",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "CheckerLockedAt",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "CheckerLockedBy",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "CheckerStartedAt",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "CheckerStartedBy",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "MakerCompletedAt",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "MakerCompletedBy",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "MakerLockedAt",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "MakerLockedBy",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "MakerStartedAt",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "MakerStartedBy",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "QCCompletedAt",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "QCCompletedBy",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "QCLockedAt",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "QCLockedBy",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "QCStartedAt",
                table: "Batches");

            migrationBuilder.DropColumn(
                name: "QCStartedBy",
                table: "Batches");
        }
    }
}
