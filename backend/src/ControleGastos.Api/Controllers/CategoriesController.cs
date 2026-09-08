using ControleGastos.Api.Common;
using ControleGastos.Api.Contracts;
using ControleGastos.Api.Data;
using ControleGastos.Api.Domain;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ControleGastos.Api.Controllers;

[ApiController]
[Route("api/categories")]
public class CategoriesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<CategoryDto>>> List(
        [FromQuery] bool includeInactive = false, CancellationToken ct = default)
    {
        var query = db.Categories.AsNoTracking();
        if (!includeInactive) query = query.Where(c => c.IsActive);

        var items = await query
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new CategoryDto(c.Id, c.Name, c.Color, c.SortOrder, c.IsActive, c.ExpenseSources.Count))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpPost]
    public async Task<ActionResult<CategoryDto>> Create([FromBody] CategoryInput input, CancellationToken ct)
    {
        var name = input.Name.Trim();
        if (await db.Categories.AnyAsync(c => c.Name.ToLower() == name.ToLower(), ct))
            throw DomainException.Conflict($"Já existe a categoria \"{name}\".");

        var used = await db.Categories.Select(c => c.Color).ToListAsync(ct);
        var nextColor = DbSeeder.Palette.FirstOrDefault(p => !used.Contains(p)) ?? DbSeeder.Palette[used.Count % DbSeeder.Palette.Length];

        var category = new Category
        {
            Name = name,
            Color = input.Color ?? nextColor,
            SortOrder = await db.Categories.CountAsync(ct),
            IsActive = input.IsActive ?? true
        };

        db.Categories.Add(category);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(List), new { id = category.Id },
            new CategoryDto(category.Id, category.Name, category.Color, category.SortOrder, category.IsActive, 0));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<CategoryDto>> Update(int id, [FromBody] CategoryInput input, CancellationToken ct)
    {
        var category = await db.Categories.Include(c => c.ExpenseSources).FirstOrDefaultAsync(c => c.Id == id, ct)
                       ?? throw DomainException.NotFound("Categoria não encontrada.");

        var name = input.Name.Trim();
        if (await db.Categories.AnyAsync(c => c.Id != id && c.Name.ToLower() == name.ToLower(), ct))
            throw DomainException.Conflict($"Já existe a categoria \"{name}\".");

        category.Name = name;
        if (input.Color is not null) category.Color = input.Color;
        if (input.IsActive is bool active) category.IsActive = active;

        await db.SaveChangesAsync(ct);

        return Ok(new CategoryDto(category.Id, category.Name, category.Color, category.SortOrder, category.IsActive, category.ExpenseSources.Count));
    }

    /// <summary>Remove a categoria; se ela já foi usada em algum planejamento, apenas desativa.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var category = await db.Categories.Include(c => c.ExpenseSources).FirstOrDefaultAsync(c => c.Id == id, ct)
                       ?? throw DomainException.NotFound("Categoria não encontrada.");

        var inUse = await db.CategoryAllocations.AnyAsync(a => a.CategoryId == id, ct)
                    || await db.PlannedExpenses.AnyAsync(e => e.ExpenseSource!.CategoryId == id, ct);

        if (inUse)
        {
            category.IsActive = false;
            foreach (var source in category.ExpenseSources) source.IsActive = false;
        }
        else
        {
            db.ExpenseSources.RemoveRange(category.ExpenseSources);
            db.Categories.Remove(category);
        }

        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
