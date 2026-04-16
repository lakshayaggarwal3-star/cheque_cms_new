using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class ChangeClientMasterUniqueKeyToRCMSCode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop the old non-unique index on CityCode
            migrationBuilder.DropIndex(
                name: "IX_Clients_CityCode",
                table: "Clients");

            // Add unique index on RCMSCode
            migrationBuilder.CreateIndex(
                name: "IX_Clients_RCMSCode",
                table: "Clients",
                column: "RCMSCode",
                unique: true);

            // Recreate non-unique index on CityCode for location filtering
            migrationBuilder.CreateIndex(
                name: "IX_Clients_CityCode",
                table: "Clients",
                column: "CityCode");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop the unique constraint on RCMSCode
            migrationBuilder.DropIndex(
                name: "IX_Clients_RCMSCode",
                table: "Clients");

            // Drop the non-unique index on CityCode
            migrationBuilder.DropIndex(
                name: "IX_Clients_CityCode",
                table: "Clients");

            // Recreate the original non-unique index on CityCode
            migrationBuilder.CreateIndex(
                name: "IX_Clients_CityCode",
                table: "Clients",
                column: "CityCode");
        }
    }
}
