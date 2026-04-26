using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class AddGlobalSlipNoToBatch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GlobalSlipNo",
                table: "Batches",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GlobalSlipNo",
                table: "Batches");
        }
    }
}
