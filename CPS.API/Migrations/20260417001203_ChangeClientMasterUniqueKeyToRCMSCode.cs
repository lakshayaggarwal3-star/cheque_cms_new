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
            // Drop existing indexes if they exist
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Clients_CityCode' AND object_id = OBJECT_ID('[dbo].[Clients]')) DROP INDEX [IX_Clients_CityCode] ON [Clients];");
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Clients_RCMSCode' AND object_id = OBJECT_ID('[dbo].[Clients]')) DROP INDEX [IX_Clients_RCMSCode] ON [Clients];");

            // Recreate non-unique indexes for searching (no unique constraint — multiple records per code/city allowed)
            migrationBuilder.CreateIndex(
                name: "IX_Clients_RCMSCode",
                table: "Clients",
                column: "RCMSCode");

            migrationBuilder.CreateIndex(
                name: "IX_Clients_CityCode",
                table: "Clients",
                column: "CityCode");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop the non-unique indexes
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Clients_RCMSCode' AND object_id = OBJECT_ID('[dbo].[Clients]')) DROP INDEX [IX_Clients_RCMSCode] ON [Clients];");
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Clients_CityCode' AND object_id = OBJECT_ID('[dbo].[Clients]')) DROP INDEX [IX_Clients_CityCode] ON [Clients];");

            // Recreate the original non-unique index on CityCode
            migrationBuilder.CreateIndex(
                name: "IX_Clients_CityCode",
                table: "Clients",
                column: "CityCode");
        }
    }
}
