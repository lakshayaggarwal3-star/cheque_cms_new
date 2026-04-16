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
            // Drop existing non-unique index on CityCode
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Clients_CityCode' AND object_id = OBJECT_ID('[dbo].[Clients]')) DROP INDEX [IX_Clients_CityCode] ON [Clients];");

            // Drop existing non-unique index on RCMSCode if it exists
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Clients_RCMSCode' AND object_id = OBJECT_ID('[dbo].[Clients]')) DROP INDEX [IX_Clients_RCMSCode] ON [Clients];");

            // Remove duplicates: keep only the most recent record per RCMSCode
            migrationBuilder.Sql(@"
DELETE FROM [Clients]
WHERE [ClientID] NOT IN (
    SELECT MAX([ClientID])
    FROM [Clients]
    WHERE [RCMSCode] IS NOT NULL AND [RCMSCode] != ''
    GROUP BY [RCMSCode]
) AND [RCMSCode] IS NOT NULL AND [RCMSCode] != '';
");

            // Create unique index on RCMSCode
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
            // Drop the unique index on RCMSCode
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Clients_RCMSCode' AND object_id = OBJECT_ID('[dbo].[Clients]')) DROP INDEX [IX_Clients_RCMSCode] ON [Clients];");

            // Drop the non-unique index on CityCode
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Clients_CityCode' AND object_id = OBJECT_ID('[dbo].[Clients]')) DROP INDEX [IX_Clients_CityCode] ON [Clients];");

            // Recreate the original non-unique index on CityCode
            migrationBuilder.CreateIndex(
                name: "IX_Clients_CityCode",
                table: "Clients",
                column: "CityCode");
        }
    }
}
