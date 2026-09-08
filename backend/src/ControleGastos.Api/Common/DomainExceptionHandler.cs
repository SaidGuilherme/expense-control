using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace ControleGastos.Api.Common;

/// <summary>Converte exceções em respostas ProblemDetails legíveis pelo frontend.</summary>
public class DomainExceptionHandler(ILogger<DomainExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        var (status, title, detail) = exception switch
        {
            DomainException domain => (domain.StatusCode, "Regra de negócio", domain.Message),
            _ => (StatusCodes.Status500InternalServerError, "Erro inesperado", "Não foi possível concluir a operação.")
        };

        if (status >= 500)
            logger.LogError(exception, "Erro não tratado ao processar {Path}", context.Request.Path);

        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = detail,
            Instance = context.Request.Path
        };

        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(problem, ct);
        return true;
    }
}
