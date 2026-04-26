// =============================================================================
// File        : CpsDbContext.cs
// Project     : CPS — Cheque Processing System
// Module      : Data Access
// Description : EF Core DbContext with all entity configurations and indexes.
// Created     : 2026-04-14
// =============================================================================

using Microsoft.EntityFrameworkCore;

namespace CPS.API.Models;

public class CpsDbContext : DbContext
{
    public CpsDbContext(DbContextOptions<CpsDbContext> options) : base(options) { }

    public DbSet<UserMaster> Users { get; set; }
    public DbSet<Role> Roles { get; set; }
    public DbSet<UserRole> UserRoles { get; set; }
    public DbSet<UserLocationHistory> UserLocationHistories { get; set; }
    public DbSet<Location> Locations { get; set; }
    public DbSet<LocationScanner> LocationScanners { get; set; }
    public DbSet<LocationFinance> LocationFinances { get; set; }
    public DbSet<GlobalClient> GlobalClients { get; set; }
    public DbSet<ClientMaster> Clients { get; set; }
    public DbSet<BackgroundJob> Jobs { get; set; }
    public DbSet<JobError> JobErrors { get; set; }
    public DbSet<BatchSequence> BatchSequences { get; set; }
    public DbSet<BatchSlipSequence> BatchSlipSequences { get; set; }
    public DbSet<BatchItemSequence> BatchItemSequences { get; set; }
    public DbSet<Batch> Batches { get; set; }
    public DbSet<SlipEntry> SlipEntries { get; set; }
    public DbSet<SlipItem> SlipItems { get; set; }

    public DbSet<ChequeItem> ChequeItems { get; set; }
    public DbSet<MasterUploadLog> MasterUploadLogs { get; set; }
    public DbSet<AppSetting> AppSettings { get; set; }
    public DbSet<UserSetting> UserSettings { get; set; }
    public DbSet<ErrorLog> ErrorLogs { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }

    // --- SCB Master (CHM) ---
    public DbSet<ScbMasterStatus> ScbMasterStatuses { get; set; }
    public DbSet<ScbBank> ScbBanks { get; set; }
    public DbSet<ScbBranch> ScbBranches { get; set; }
    public DbSet<ScbReturnReason> ScbReturnReasons { get; set; }
    public DbSet<ScbSessionDefinition> ScbSessionDefinitions { get; set; }
    public DbSet<ScbCityMaster> ScbCities { get; set; }
    public DbSet<ScbTranslationRule> ScbTranslationRules { get; set; }
    public DbSet<InternalBankMaster> InternalBankMasters { get; set; }
    public DbSet<ClientCaptureRule> ClientCaptureRules { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // UserMaster
        modelBuilder.Entity<UserMaster>()
            .HasIndex(u => u.EmployeeID).IsUnique();
        modelBuilder.Entity<UserMaster>()
            .HasIndex(u => u.Username).IsUnique();

        // UserRole
        modelBuilder.Entity<UserRole>()
            .HasIndex(ur => new { ur.UserID, ur.RoleID }).IsUnique();

        // Location
        modelBuilder.Entity<Location>()
            .HasIndex(l => l.LocationCode).IsUnique();

        // LocationFinance: one-to-one
        modelBuilder.Entity<LocationFinance>()
            .HasIndex(f => f.LocationID).IsUnique();

        // UserLocationHistory
        modelBuilder.Entity<UserLocationHistory>()
            .HasIndex(h => new { h.UserID, h.AssignedDate });

        // GlobalClient: unique GlobalCode
        modelBuilder.Entity<GlobalClient>()
            .HasIndex(g => g.GlobalCode).IsUnique();

        // ClientMaster: FK to GlobalClient (no cascade delete — protect client data)
        modelBuilder.Entity<ClientMaster>()
            .HasOne(c => c.GlobalClient)
            .WithMany(g => g.Clients)
            .HasForeignKey(c => c.GlobalClientID)
            .OnDelete(DeleteBehavior.SetNull);

        // ClientMaster: unique combination of CityCode + RCMSCode + PickupPointCode
        modelBuilder.Entity<ClientMaster>()
            .HasIndex(c => new { c.CityCode, c.RCMSCode, c.PickupPointCode })
            .IsUnique()
            .HasFilter("[IsDeleted] = 0");

        modelBuilder.Entity<ClientMaster>()
            .HasIndex(c => c.GlobalClientID);
        modelBuilder.Entity<ClientMaster>()
            .HasIndex(c => c.IsPriority);

        // BatchSequence: unique per date+location+scanner
        modelBuilder.Entity<BatchSequence>()
            .HasIndex(s => new { s.BatchDate, s.LocationID, s.ScannerMappingID })
            .IsUnique()
            .HasFilter("[ScannerMappingID] IS NOT NULL");

        // BatchSlipSequence: one row per batch
        modelBuilder.Entity<BatchSlipSequence>()
            .HasIndex(s => s.BatchId).IsUnique();

        // Batch
        modelBuilder.Entity<Batch>()
            .HasIndex(b => b.BatchNo).IsUnique();
        modelBuilder.Entity<Batch>()
            .HasIndex(b => new { b.LocationID, b.BatchDate });
        modelBuilder.Entity<Batch>()
            .HasIndex(b => b.BatchStatus);
        modelBuilder.Entity<Batch>()
            .Property(b => b.TotalAmount).HasColumnType("decimal(15,3)");

        // SlipEntry: unique SlipNo within batch
        modelBuilder.Entity<SlipEntry>()
            .HasIndex(s => s.BatchId);
        modelBuilder.Entity<SlipEntry>()
            .HasIndex(s => new { s.BatchId, s.SlipNo }).IsUnique();
        modelBuilder.Entity<SlipEntry>()
            .Property(s => s.SlipAmount).HasColumnType("decimal(15,3)");

        // SlipItem: no cascade from SlipEntry (avoids multi-path cascade via Batch)
        modelBuilder.Entity<SlipItem>()
            .HasOne(s => s.SlipEntry)
            .WithMany(e => e.SlipItems)
            .HasForeignKey(s => s.SlipEntryId)
            .OnDelete(DeleteBehavior.NoAction);
        modelBuilder.Entity<SlipItem>()
            .HasIndex(s => s.SlipEntryId);
        modelBuilder.Entity<SlipItem>()
            .HasIndex(s => new { s.SlipEntryId, s.ScanOrder });

        // ChequeItem: no cascade from SlipEntry (avoids multi-path cascade via Batch)
        modelBuilder.Entity<ChequeItem>()
            .HasOne(c => c.SlipEntry)
            .WithMany(e => e.ChequeItems)
            .HasForeignKey(c => c.SlipEntryId)
            .OnDelete(DeleteBehavior.NoAction);
        modelBuilder.Entity<ChequeItem>()
            .HasIndex(c => c.BatchId);
        modelBuilder.Entity<ChequeItem>()
            .HasIndex(c => c.SlipEntryId);
        modelBuilder.Entity<ChequeItem>()
            .HasIndex(c => new { c.BatchId, c.SeqNo });
        modelBuilder.Entity<ChequeItem>()
            .HasIndex(c => new { c.SlipEntryId, c.ChqSeq });

        // AppSettings: unique key
        modelBuilder.Entity<AppSetting>()
            .HasIndex(a => a.SettingKey).IsUnique();

        // UserSetting: one value per key per user
        modelBuilder.Entity<UserSetting>()
            .HasIndex(s => new { s.UserID, s.SettingKey }).IsUnique();
        modelBuilder.Entity<UserSetting>()
            .HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserID)
            .OnDelete(DeleteBehavior.Cascade);

        // AuditLog indexes
        modelBuilder.Entity<AuditLog>()
            .HasIndex(a => new { a.TableName, a.RecordID });
        modelBuilder.Entity<AuditLog>()
            .HasIndex(a => a.ChangedBy);
        modelBuilder.Entity<AuditLog>()
            .HasIndex(a => a.ChangedAt);

        // ErrorLog indexes
        modelBuilder.Entity<ErrorLog>()
            .HasIndex(e => e.Timestamp);
        modelBuilder.Entity<ErrorLog>()
            .HasIndex(e => e.UserID);

        // --- SCB Master Indexes ---
        modelBuilder.Entity<ScbBranch>()
            .HasIndex(b => b.BankRoutingNo);
        modelBuilder.Entity<ScbTranslationRule>()
            .HasIndex(t => t.PayorBankRoutingNo);
    }
}
