using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class UpgradeSlipEntryIdAndImageOptimization : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Drop Foreign Keys
            migrationBuilder.DropForeignKey(
                name: "FK_SlipScans_SlipEntries_SlipEntryId",
                table: "SlipScans");

            migrationBuilder.DropForeignKey(
                name: "FK_ChequeItems_SlipEntries_SlipEntryId",
                table: "ChequeItems");

            // 2. Drop Indexes on child tables that use SlipEntryId
            migrationBuilder.DropIndex(
                name: "IX_SlipScans_SlipEntryId",
                table: "SlipScans");
            migrationBuilder.DropIndex(
                name: "IX_SlipScans_SlipEntryId_ScanOrder",
                table: "SlipScans");
            migrationBuilder.DropIndex(
                name: "IX_ChequeItems_SlipEntryId",
                table: "ChequeItems");
            migrationBuilder.DropIndex(
                name: "IX_ChequeItems_SlipEntryId_ChqSeq",
                table: "ChequeItems");

            // 3. Drop Primary Key on SlipEntries (dependent on identity column)
            migrationBuilder.DropPrimaryKey(
                name: "PK_SlipEntries",
                table: "SlipEntries");

            // 4. Alter Columns
            migrationBuilder.AlterColumn<long>(
                name: "SlipEntryId",
                table: "SlipScans",
                type: "bigint",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<string>(
                name: "FileExtension",
                table: "SlipScans",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ImageBaseName",
                table: "SlipScans",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ImageHash",
                table: "SlipScans",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AlterColumn<long>(
                name: "SlipEntryId",
                table: "SlipEntries",
                type: "bigint",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .Annotation("SqlServer:Identity", "1, 1")
                .OldAnnotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<long>(
                name: "SlipEntryId",
                table: "ChequeItems",
                type: "bigint",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<string>(
                name: "FileExtension",
                table: "ChequeItems",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ImageBaseName",
                table: "ChequeItems",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ImageHash",
                table: "ChequeItems",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            // 5. Recreate Primary Key
            migrationBuilder.AddPrimaryKey(
                name: "PK_SlipEntries",
                table: "SlipEntries",
                column: "SlipEntryId");

            // 6. Recreate Indexes
            migrationBuilder.CreateIndex(
                name: "IX_SlipScans_SlipEntryId",
                table: "SlipScans",
                column: "SlipEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_SlipScans_SlipEntryId_ScanOrder",
                table: "SlipScans",
                columns: new[] { "SlipEntryId", "ScanOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_ChequeItems_SlipEntryId",
                table: "ChequeItems",
                column: "SlipEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_ChequeItems_SlipEntryId_ChqSeq",
                table: "ChequeItems",
                columns: new[] { "SlipEntryId", "ChqSeq" });

            // 7. Recreate Foreign Keys
            migrationBuilder.AddForeignKey(
                name: "FK_SlipScans_SlipEntries_SlipEntryId",
                table: "SlipScans",
                column: "SlipEntryId",
                principalTable: "SlipEntries",
                principalColumn: "SlipEntryId",
                onDelete: ReferentialAction.NoAction);

            migrationBuilder.AddForeignKey(
                name: "FK_ChequeItems_SlipEntries_SlipEntryId",
                table: "ChequeItems",
                column: "SlipEntryId",
                principalTable: "SlipEntries",
                principalColumn: "SlipEntryId",
                onDelete: ReferentialAction.NoAction);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FileExtension",
                table: "SlipScans");

            migrationBuilder.DropColumn(
                name: "ImageBaseName",
                table: "SlipScans");

            migrationBuilder.DropColumn(
                name: "ImageHash",
                table: "SlipScans");

            migrationBuilder.DropColumn(
                name: "FileExtension",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "ImageBaseName",
                table: "ChequeItems");

            migrationBuilder.DropColumn(
                name: "ImageHash",
                table: "ChequeItems");

            migrationBuilder.AlterColumn<int>(
                name: "SlipEntryId",
                table: "SlipScans",
                type: "int",
                nullable: false,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AlterColumn<int>(
                name: "SlipEntryId",
                table: "SlipEntries",
                type: "int",
                nullable: false,
                oldClrType: typeof(long),
                oldType: "bigint")
                .Annotation("SqlServer:Identity", "1, 1")
                .OldAnnotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "SlipEntryId",
                table: "ChequeItems",
                type: "int",
                nullable: false,
                oldClrType: typeof(long),
                oldType: "bigint");
        }
    }
}
