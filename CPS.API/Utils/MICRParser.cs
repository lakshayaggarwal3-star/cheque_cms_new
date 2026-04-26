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

        // Remove spaces for easier parsing
        string clean = raw.Replace(" ", "").ToLower();

        // Regex to capture parts between 'c' and 'd' symbols
        // c[CHQNO]c [MICR1]d [MICR2]c [MICR3]
        var match = Regex.Match(clean, @"c(?<chqNo>\d+)c(?<micr1>\d+)d(?<micr2>\d+)c(?<micr3>\d*)");

        if (match.Success)
        {
            return (
                match.Groups["chqNo"].Value,
                match.Groups["micr1"].Value,
                match.Groups["micr2"].Value,
                match.Groups["micr3"].Value
            );
        }

        // Fallback for variations
        return (null, null, null, null);
    }
}
