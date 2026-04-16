-- Check if the migration was applied
SELECT * FROM [CMS_APP].[dbo].[__EFMigrationsHistory] ORDER BY [MigrationId];

-- Check if ScannerMappingID column exists in BatchSequences
SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'BatchSequences' AND COLUMN_NAME = 'ScannerMappingID';
