using ControleGastos.Api.Contracts;
using ControleGastos.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace ControleGastos.Api.Controllers;

[ApiController]
[Route("api/goals")]
public class GoalsController(GoalService goals) : ControllerBase
{
    /// <summary>Metas com progresso, prazo e quanto falta guardar por mês.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<GoalDto>>> List(
        [FromQuery] bool includeInactive = false, CancellationToken ct = default)
        => Ok(await goals.ListAsync(includeInactive, ct));

    [HttpPost]
    public async Task<ActionResult<GoalDto>> Create([FromBody] GoalInput input, CancellationToken ct)
    {
        var goal = await goals.CreateAsync(input, ct);
        return CreatedAtAction(nameof(List), new { id = goal.Id }, goal);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<GoalDto>> Update(int id, [FromBody] GoalInput input, CancellationToken ct)
        => Ok(await goals.UpdateAsync(id, input, ct));

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await goals.DeleteAsync(id, ct);
        return NoContent();
    }
}
