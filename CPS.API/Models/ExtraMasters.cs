using System.ComponentModel.DataAnnotations;

namespace CPS.API.Models;

public class InternalBankMaster
{
    [Key]
    public int Id { get; set; }
    
    [MaxLength(50)]
    public string? EBANK { get; set; }
    
    [MaxLength(50)]
    public string? SORTCODE { get; set; }
    
    [MaxLength(100)]
    public string? NAME { get; set; }
    
    public string? FULLNAME { get; set; }
    
    [MaxLength(100)]
    public string? BRANCH { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedBy { get; set; }
}

public class ClientCaptureRule
{
    [Key]
    public int Id { get; set; }
    
    [MaxLength(100)]
    public string? CEID { get; set; }
    
    [MaxLength(100)]
    public string? ClientCode { get; set; }
    
    public string? FieldName1 { get; set; }
    public string? FieldName2 { get; set; }
    public string? FieldName3 { get; set; }
    public string? FieldName4 { get; set; }
    public string? FieldName5 { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedBy { get; set; }
}
