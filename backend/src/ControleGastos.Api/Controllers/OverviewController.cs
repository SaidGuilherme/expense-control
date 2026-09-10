using ControleGastos.Api.Contracts;
using ControleGastos.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace ControleGastos.Api.Controllers;

[ApiController]
[Route("api/overview")]
public class OverviewController(PlanService plans) : ControllerBase
{
    /// <summary>
    /// Resumo do ano: quanto está previsto entrar e sair no ano inteiro, a média
    /// por mês e a quebra mês a mês e por categoria. Sem o parâmetro `year`,
    /// usa o ano mais recente que já tem planejamento.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<YearOverviewDto>> Get([FromQuery] int? year, CancellationToken ct)
        => Ok(await plans.GetYearOverviewAsync(year, ct));
}
