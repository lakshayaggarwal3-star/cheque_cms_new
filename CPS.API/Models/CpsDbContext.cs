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
    public DbSet<UserLocationHistory> UserLocationHistories { get; set; }
    public DbSet<Location> Locations { get; set; }
    public DbSet<LocationScanner> LocationScanners { get; set; }
    public DbSet<LocationFinance> LocationFinances { get; set; }
    public DbSet<ClientMaster> Clients { get; set; }
    public DbSet<BatchSequence> BatchSequences { get; set; }
    public DbSet<SlipSequence> SlipSequences { get; set; }
    public DbSet<Batch> Batches { get; set; }
    public DbSet<Slip> Slips { get; set; }
    public DbSet<ScanItem> ScanItems { get; set; }
    public DbSet<MasterUploadLog> MasterUploadLogs { get; set; }
    public DbSet<AppSetting> AppSettings { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // UserMaster
        modelBuilder.Entity<UserMaster>()
            .HasIndex(u => u.EmployeeID).IsUnique();
        modelBuilder.Entity<UserMaster>()
            .HasIndex(u => u.Username).IsUnique();

        // Location
        modelBuilder.Entity<Location>()
            .HasIndex(l => l.LocationCode).IsUnique();

        // LocationFinance: one-to-one
        modelBuilder.Entity<LocationFinance>()
            .HasIndex(f => f.LocationID).IsUnique();

        // UserLocationHistory
        modelBuilder.Entity<UserLocationHistory>()
            .HasIndex(h => new { h.UserID, h.AssignedDate });

        // ClientMaster: indexes for searching (non-unique — multiple records per code/city allowed)
        modelBuilder.Entity<ClientMaster>()
            .HasIndex(c => c.RCMSCode);
        modelBuilder.Entity<ClientMaster>()
            .HasIndex(c => c.CityCode);

        // BatchSequence: unique per date+location+scanner
        modelBuilder.Entity<BatchSequence>()
            .HasIndex(s => new { s.BatchDate, s.LocationID, s.ScannerMappingID })
            .IsUnique()
            .HasFilter("[ScannerMappingID] IS NOT NULL");

        // SlipSequence: unique per date+location+scanner
        modelBuilder.Entity<SlipSequence>()
            .HasIndex(s => new { s.SlipDate, s.LocationID, s.ScannerMappingID })
            .IsUnique()
            .HasFilter("[ScannerMappingID] IS NOT NULL");

        // Batch
        modelBuilder.Entity<Batch>()
            .HasIndex(b => b.BatchNo).IsUnique();
        modelBuilder.Entity<Batch>()
            .HasIndex(b => new { b.LocationID, b.BatchDate });
        modelBuilder.Entity<Batch>()
            .HasIndex(b => b.BatchStatus);
        modelBuilder.Entity<Batch>()
            .Property(b => b.TotalAmount).HasColumnType("decimal(15,3)");

        // Slip: unique SlipNo within batch
        modelBuilder.Entity<Slip>()
            .HasIndex(s => s.BatchID);
        modelBuilder.Entity<Slip>()
            .HasIndex(s => new { s.BatchID, s.SlipNo }).IsUnique();
        modelBuilder.Entity<Slip>()
            .Property(s => s.SlipAmount).HasColumnType("decimal(15,3)");

        // ScanItems
        modelBuilder.Entity<ScanItem>()
            .HasIndex(s => s.BatchID);
        modelBuilder.Entity<ScanItem>()
            .HasIndex(s => new { s.BatchID, s.SeqNo });
        modelBuilder.Entity<ScanItem>()
            .HasIndex(s => s.SlipID);

        // AppSettings: unique key
        modelBuilder.Entity<AppSetting>()
            .HasIndex(a => a.SettingKey).IsUnique();

        // AuditLog indexes
        modelBuilder.Entity<AuditLog>()
            .HasIndex(a => new { a.TableName, a.RecordID });
        modelBuilder.Entity<AuditLog>()
            .HasIndex(a => a.ChangedBy);
        modelBuilder.Entity<AuditLog>()
            .HasIndex(a => a.ChangedAt);
    }
}
