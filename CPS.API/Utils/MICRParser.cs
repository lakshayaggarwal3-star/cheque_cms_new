using System.Text.RegularExpressions;

namespace CPS.API.Utils;

public static class MICRParser
{
    /// <summary>
    /// Parses raw MICR data from Ranger scanner.
    /// Example: c001813c 380240025d 018107c 29
    /// Result: ChqNo=001813, MICR1=380240025, MICR2=018107, MICR3=29
    /// </summary>
    public static (string? ChqNo, string? MICR1, string? MICR2, string? MICR3) ParseRanger(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return (null, null, null, null);

        // Normalize
        string clean = raw.Replace(" ", "").ToLower();

        // 1. Cheque Number: usually between the two 'c' symbols at start
        var chqMatch = Regex.Match(clean, @"c(?<val>\d+)c");
        string? chqNo = chqMatch.Success ? chqMatch.Groups["val"].Value : null;

        // 2. MICR1 (Sort Code): usually between the second 'c' and the 'd' symbol
        var m1Match = Regex.Match(clean, @"c\d+c(?<val>\d+)d");
        string? m1 = m1Match.Success ? m1Match.Groups["val"].Value : null;

        // 3. MICR2 (Account/Serial): between 'd' and the next 'c'
        var m2Match = Regex.Match(clean, @"d(?<val>\d+)c");
        string? m2 = m2Match.Success ? m2Match.Groups["val"].Value : null;

        // 4. MICR3 (Transaction Code): whatever digits are at the very end
        var m3Match = Regex.Match(clean, @"(?<val>\d+)$");
        string? m3 = m3Match.Success ? m3Match.Groups["val"].Value : null;

        return (chqNo, m1, m2, m3);
    }
}
