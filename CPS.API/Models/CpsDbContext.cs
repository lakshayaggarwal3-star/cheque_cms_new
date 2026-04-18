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
    public DbSet<BatchSlipSequence> BatchSlipSequences { get; set; }
    public DbSet<Batch> Batches { get; set; }
    public DbSet<SlipEntry> SlipEntries { get; set; }
    public DbSet<SlipScan> SlipScans { get; set; }
    public DbSet<ChequeItem> ChequeItems { get; set; }
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

        // ClientMaster: indexes for searching
        modelBuilder.Entity<ClientMaster>()
            .HasIndex(c => c.RCMSCode);
        modelBuilder.Entity<ClientMaster>()
            .HasIndex(c => c.CityCode);

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

        // SlipScan: no cascade from SlipEntry (avoids multi-path cascade via Batch)
        modelBuilder.Entity<SlipScan>()
            .HasOne(s => s.SlipEntry)
            .WithMany(e => e.SlipScans)
            .HasForeignKey(s => s.SlipEntryId)
            .OnDelete(DeleteBehavior.NoAction);
        modelBuilder.Entity<SlipScan>()
            .HasIndex(s => s.SlipEntryId);
        modelBuilder.Entity<SlipScan>()
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
        modelBuilder.Entity<ChequeItem>()
            .Property(c => c.ScanAmount).HasColumnType("decimal(15,3)");
        modelBuilder.Entity<ChequeItem>()
            .Property(c => c.RRAmount).HasColumnType("decimal(15,3)");

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
