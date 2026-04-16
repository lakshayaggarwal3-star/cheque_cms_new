-- Drop the unique index on RCMSCode to allow duplicates
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Clients_RCMSCode' AND object_id = OBJECT_ID('[dbo].[Clients]'))
BEGIN
    DROP INDEX [IX_Clients_RCMSCode] ON [Clients];
    PRINT 'Dropped unique index IX_Clients_RCMSCode';
END
ELSE
BEGIN
    PRINT 'Index IX_Clients_RCMSCode does not exist or is not unique';
END

-- Verify no unique constraint exists
SELECT name, type_desc, is_unique
FROM sys.indexes
WHERE object_id = OBJECT_ID('[dbo].[Clients]')
  AND name LIKE '%RCMSCode%';
