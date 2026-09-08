using ControleGastos.Api.Common;
using ControleGastos.Api.Contracts;
using ControleGastos.Api.Data;
using ControleGastos.Api.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ControleGastos.Api.Controllers;

[ApiController]
[Route("api/income-sources")]
public class IncomeSourcesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<IncomeSourceDto>>> List(
        [FromQuery] bool includeInactive = false, CancellationToken ct = default)
    {
        var query = db.IncomeSources.AsNoTracking();
        if (!includeInactive) query = query.Where(s => s.IsActive);

        var items = await query
            .OrderBy(s => s.Name)
            .Select(s => new IncomeSourceDto(s.Id, s.Name, s.IsActive))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpPost]
    public async Task<ActionResult<IncomeSourceDto>> Create([FromBody] IncomeSourceInput input, CancellationToken ct)
    {
        var name = input.Name.Trim();
        if (await db.IncomeSources.AnyAsync(s => s.Name.ToLower() == name.ToLower(), ct))
            throw DomainException.Conflict($"Já existe a fonte de entrada \"{name}\".");

        var source = new IncomeSource { Name = name, IsActive = input.IsActive ?? true };
        db.IncomeSources.Add(source);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(List), new { id = source.Id },
            new IncomeSourceDto(source.Id, source.Name, source.IsActive));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<IncomeSourceDto>> Update(int id, [FromBody] IncomeSourceInput input, CancellationToken ct)
    {
        var source = await db.IncomeSources.FirstOrDefaultAsync(s => s.Id == id, ct)
                     ?? throw DomainException.NotFound("Fonte de entrada não encontrada.");

        var name = input.Name.Trim();
        if (await db.IncomeSources.AnyAsync(s => s.Id != id && s.Name.ToLower() == name.ToLower(), ct))
            throw DomainException.Conflict($"Já existe a fonte de entrada \"{name}\".");

        source.Name = name;
        if (input.IsActive is bool active) source.IsActive = active;

        await db.SaveChangesAsync(ct);
        return Ok(new IncomeSourceDto(source.Id, source.Name, source.IsActive));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var source = await db.IncomeSources.FirstOrDefaultAsync(s => s.Id == id, ct)
                     ?? throw DomainException.NotFound("Fonte de entrada não encontrada.");

        if (await db.PlannedIncomes.AnyAsync(p => p.IncomeSourceId == id, ct))
            source.IsActive = false;
        else
            db.IncomeSources.Remove(source);

        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
