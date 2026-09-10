using ControleGastos.Api.Contracts;
using ControleGastos.Api.Domain;
using ControleGastos.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace ControleGastos.Api.Controllers;

[ApiController]
[Route("api/plans")]
public class PlansController(PlanService plans) : ControllerBase
{
    /// <summary>Lista todos os planejamentos, do mês mais recente para o mais antigo.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PlanSummaryDto>>> List(CancellationToken ct)
        => Ok(await plans.ListAsync(ct));

    /// <summary>Detalhe completo de um planejamento, já com totais e orçamento por categoria.</summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<PlanDetailDto>> Get(int id, CancellationToken ct)
        => Ok(await plans.GetDetailAsync(id, ct));

    /// <summary>Inicia o planejamento de um mês (opcionalmente copiando outro mês).</summary>
    [HttpPost]
    public async Task<ActionResult<PlanDetailDto>> Create([FromBody] CreatePlanInput input, CancellationToken ct)
    {
        var plan = await plans.CreateAsync(input, ct);
        return CreatedAtAction(nameof(Get), new { id = plan.Id }, plan);
    }

    /// <summary>
    /// Grava de uma vez os meses de um período — cada um já composto pelo
    /// assistente (padrão do período + ajustes do mês). Meses que já existem são
    /// preservados e listados em <c>skippedMonths</c>.
    /// </summary>
    [HttpPost("batch")]
    public async Task<ActionResult<CreatePlanRangeResultDto>> CreateBatch(
        [FromBody] CreatePlanBatchInput input, CancellationToken ct)
        => Ok(await plans.CreateBatchAsync(input, ct));

    /// <summary>
    /// Edição em conjunto: substitui o conteúdo dos meses enviados (e cria os que
    /// faltarem). Ao contrário do POST, aqui os meses existentes são sobrescritos.
    /// </summary>
    [HttpPut("batch")]
    public async Task<ActionResult<ApplyPlanBatchResultDto>> ApplyBatch(
        [FromBody] CreatePlanBatchInput input, CancellationToken ct)
        => Ok(await plans.ApplyBatchAsync(input, ct));

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await plans.DeleteAsync(id, ct);
        return NoContent();
    }

    /// <summary>Etapa 1 — substitui o planejamento de entradas do mês.</summary>
    [HttpPut("{id:int}/incomes")]
    public async Task<ActionResult<PlanDetailDto>> SetIncomes(int id, [FromBody] PlannedIncomesInput input, CancellationToken ct)
        => Ok(await plans.SetIncomesAsync(id, input, ct));

    /// <summary>Etapa 2 — substitui a distribuição percentual por categoria (soma máxima de 100%).</summary>
    [HttpPut("{id:int}/allocations")]
    public async Task<ActionResult<PlanDetailDto>> SetAllocations(int id, [FromBody] AllocationsInput input, CancellationToken ct)
        => Ok(await plans.SetAllocationsAsync(id, input, ct));

    /// <summary>Etapa 3 — substitui os valores previstos de saída do mês.</summary>
    [HttpPut("{id:int}/expenses")]
    public async Task<ActionResult<PlanDetailDto>> SetExpenses(int id, [FromBody] PlannedExpensesInput input, CancellationToken ct)
        => Ok(await plans.SetExpensesAsync(id, input, ct));

    /// <summary>Etapa 3 — substitui os aportes em metas do mês.</summary>
    [HttpPut("{id:int}/goal-contributions")]
    public async Task<ActionResult<PlanDetailDto>> SetGoalContributions(int id, [FromBody] GoalContributionsInput input, CancellationToken ct)
        => Ok(await plans.SetGoalContributionsAsync(id, input, ct));

    /// <summary>Avança ou volta a etapa do assistente.</summary>
    [HttpPost("{id:int}/step")]
    public async Task<ActionResult<PlanDetailDto>> SetStep(int id, [FromBody] StepInput input, CancellationToken ct)
        => Ok(await plans.SetStepAsync(id, (PlanStep)input.Step, ct));
}
