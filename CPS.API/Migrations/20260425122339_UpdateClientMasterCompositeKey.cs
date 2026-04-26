using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CPS.API.Migrations
{
    /// <inheritdoc />
    public partial class UpdateClientMasterCompositeKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM Clients");

            migrationBuilder.DropIndex(
                name: "IX_Clients_CityCode",
                table: "Clients");

            migrationBuilder.DropIndex(
                name: "IX_Clients_RCMSCode",
                table: "Clients");

            migrationBuilder.CreateIndex(
                name: "IX_Clients_CityCode_RCMSCode_PickupPointCode",
                table: "Clients",
                columns: new[] { "CityCode", "RCMSCode", "PickupPointCode" },
                unique: true,
                filter: "[IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Clients_CityCode_RCMSCode_PickupPointCode",
                table: "Clients");

            migrationBuilder.CreateIndex(
                name: "IX_Clients_CityCode",
                table: "Clients",
                column: "CityCode");

            migrationBuilder.CreateIndex(
                name: "IX_Clients_RCMSCode",
                table: "Clients",
                column: "RCMSCode");
        }
    }
}
