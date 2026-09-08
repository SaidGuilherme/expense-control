namespace ControleGastos.Api.Common;

/// <summary>Erro de regra de negócio — vira uma resposta 400/409 com ProblemDetails.</summary>
public class DomainException : Exception
{
    public int StatusCode { get; }

    public DomainException(string message, int statusCode = StatusCodes.Status400BadRequest)
        : base(message)
    {
        StatusCode = statusCode;
    }

    public static DomainException NotFound(string message) =>
        new(message, StatusCodes.Status404NotFound);

    public static DomainException Conflict(string message) =>
        new(message, StatusCodes.Status409Conflict);
}
