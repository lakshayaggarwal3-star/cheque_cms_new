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
            // Drop the UNIQUE index/constraint on RCMSCode (using raw SQL since it might be a constraint)
            migrationBuilder.Sql(@"
                -- Check if index exists and drop it
                IF EXISTS (SELECT 1 FROM sys.indexes
                           WHERE name = 'IX_Clients_RCMSCode'
                           AND object_id = OBJECT_ID('[dbo].[Clients]')
                           AND is_unique = 1)
                BEGIN
                    ALTER TABLE [Clients] DROP CONSTRAINT [IX_Clients_RCMSCode];
                END
                ELSE IF EXISTS (SELECT 1 FROM sys.indexes
                                WHERE name = 'IX_Clients_RCMSCode'
                                AND object_id = OBJECT_ID('[dbo].[Clients]'))
                BEGIN
                    DROP INDEX [IX_Clients_RCMSCode] ON [Clients];
                END
            ");

            // Drop non-unique CityCode index if it exists
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.indexes
                           WHERE name = 'IX_Clients_CityCode'
                           AND object_id = OBJECT_ID('[dbo].[Clients]'))
                BEGIN
                    DROP INDEX [IX_Clients_CityCode] ON [Clients];
                END
            ");

            // Recreate non-unique indexes for searching (no unique constraint — multiple records per code/city allowed)
            migrationBuilder.CreateIndex(
                name: "IX_Clients_RCMSCode",
                table: "Clients",
                column: "RCMSCode",
                unique: false);

            migrationBuilder.CreateIndex(
                name: "IX_Clients_CityCode",
                table: "Clients",
                column: "CityCode",
                unique: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop the non-unique indexes
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.indexes
                           WHERE name = 'IX_Clients_RCMSCode'
                           AND object_id = OBJECT_ID('[dbo].[Clients]'))
                BEGIN
                    DROP INDEX [IX_Clients_RCMSCode] ON [Clients];
                END
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.indexes
                           WHERE name = 'IX_Clients_CityCode'
                           AND object_id = OBJECT_ID('[dbo].[Clients]'))
                BEGIN
                    DROP INDEX [IX_Clients_CityCode] ON [Clients];
                END
            ");

            // Recreate the original non-unique index on CityCode
            migrationBuilder.CreateIndex(
                name: "IX_Clients_CityCode",
                table: "Clients",
                column: "CityCode");
        }
    }
}
