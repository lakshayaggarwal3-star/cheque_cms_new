// =============================================================================
// File        : AppExceptions.cs
// Project     : CPS — Cheque Processing System
// Module      : Shared
// Description : Custom exception types used across all service layers.
// Created     : 2026-04-14
// =============================================================================

namespace CPS.API.Exceptions;

public class ValidationException : Exception
{
    public List<FieldError> Errors { get; }

    public ValidationException(string message) : base(message)
    {
        Errors = new List<FieldError> { new FieldError(string.Empty, message) };
    }

    public ValidationException(IEnumerable<FluentValidation.Results.ValidationFailure> failures) : base("Validation failed")
    {
        Errors = failures.Select(f => new FieldError(f.PropertyName, f.ErrorMessage)).ToList();
    }
}

public class NotFoundException : Exception
{
    public NotFoundException(string message) : base(message) { }
}

public class ConflictException : Exception
{
    public ConflictException(string message) : base(message) { }
}

public class ForbiddenException : Exception
{
    public ForbiddenException(string message) : base(message) { }
}

public class ScannerException : Exception
{
    public ScannerException(string message) : base(message) { }
    public ScannerException(string message, Exception inner) : base(message, inner) { }
}

public record FieldError(string Field, string Message);
