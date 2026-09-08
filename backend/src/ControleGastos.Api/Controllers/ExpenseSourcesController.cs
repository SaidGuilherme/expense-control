using ControleGastos.Api.Common;
using ControleGastos.Api.Contracts;
using ControleGastos.Api.Data;
using ControleGastos.Api.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ControleGastos.Api.Controllers;

[ApiController]
[Route("api/expense-sources")]
public class ExpenseSourcesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ExpenseSourceDto>>> List(
        [FromQuery] int? categoryId = null,
        [FromQuery] bool includeInactive = false,
        CancellationToken ct = default)
    {
        var query = db.ExpenseSources.AsNoTracking().AsQueryable();
        if (!includeInactive) query = query.Where(s => s.IsActive && s.Category!.IsActive);
        if (categoryId is int id) query = query.Where(s => s.CategoryId == id);

        var items = await query
            .OrderBy(s => s.Category!.SortOrder).ThenBy(s => s.Name)
            .Select(s => new ExpenseSourceDto(s.Id, s.Name, s.CategoryId, s.Category!.Name, s.Category.Color, s.IsActive))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpPost]
    public async Task<ActionResult<ExpenseSourceDto>> Create([FromBody] ExpenseSourceInput input, CancellationToken ct)
    {
        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == input.CategoryId, ct)
                       ?? throw DomainException.NotFound("Categoria não encontrada.");

        var name = input.Name.Trim();
        if (await db.ExpenseSources.AnyAsync(s => s.CategoryId == category.Id && s.Name.ToLower() == name.ToLower(), ct))
            throw DomainException.Conflict($"A categoria \"{category.Name}\" já tem a fonte \"{name}\".");

        var source = new ExpenseSource { Name = name, CategoryId = category.Id, IsActive = input.IsActive ?? true };
        db.ExpenseSources.Add(source);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(List), new { id = source.Id },
            new ExpenseSourceDto(source.Id, source.Name, category.Id, category.Name, category.Color, source.IsActive));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ExpenseSourceDto>> Update(int id, [FromBody] ExpenseSourceInput input, CancellationToken ct)
    {
        var source = await db.ExpenseSources.FirstOrDefaultAsync(s => s.Id == id, ct)
                     ?? throw DomainException.NotFound("Fonte de saída não encontrada.");

        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == input.CategoryId, ct)
                       ?? throw DomainException.NotFound("Categoria não encontrada.");

        var name = input.Name.Trim();
        if (await db.ExpenseSources.AnyAsync(s => s.Id != id && s.CategoryId == category.Id && s.Name.ToLower() == name.ToLower(), ct))
            throw DomainException.Conflict($"A categoria \"{category.Name}\" já tem a fonte \"{name}\".");

        source.Name = name;
        source.CategoryId = category.Id;
        if (input.IsActive is bool active) source.IsActive = active;

        await db.SaveChangesAsync(ct);
        return Ok(new ExpenseSourceDto(source.Id, source.Name, category.Id, category.Name, category.Color, source.IsActive));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var source = await db.ExpenseSources.FirstOrDefaultAsync(s => s.Id == id, ct)
                     ?? throw DomainException.NotFound("Fonte de saída não encontrada.");

        if (await db.PlannedExpenses.AnyAsync(p => p.ExpenseSourceId == id, ct))
            source.IsActive = false;
        else
            db.ExpenseSources.Remove(source);

        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
