using ControleGastos.Api.Common;
using ControleGastos.Api.Contracts;
using ControleGastos.Api.Data;
using ControleGastos.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace ControleGastos.Api.Services;

/// <summary>Cadastro de metas e cálculo do progresso a partir dos aportes.</summary>
public class GoalService(AppDbContext db)
{
    // ------------------------------------------------------------------
    // Consultas
    // ------------------------------------------------------------------

    public async Task<List<GoalDto>> ListAsync(bool includeInactive, CancellationToken ct)
    {
        var query = db.Goals.AsNoTracking().Include(g => g.Category).AsQueryable();
        if (!includeInactive) query = query.Where(g => g.IsActive);

        var goals = await query.ToListAsync(ct);
        var contributed = await ContributedByGoalAsync(ct);

        return goals
            .Select(goal => ToDto(goal, contributed.GetValueOrDefault(goal.Id)))
            // Pendentes primeiro, da mais próxima do prazo para a mais distante.
            .OrderBy(g => g.IsAchieved)
            .ThenBy(g => g.TargetYear)
            .ThenBy(g => g.TargetMonth)
            .ThenBy(g => g.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    /// <summary>Total já aportado em cada meta, somando todos os meses.</summary>
    public async Task<Dictionary<int, decimal>> ContributedByGoalAsync(CancellationToken ct) =>
        await db.GoalContributions
            .AsNoTracking()
            .GroupBy(c => c.GoalId)
            .Select(group => new { GoalId = group.Key, Total = group.Sum(x => x.Amount) })
            .ToDictionaryAsync(x => x.GoalId, x => x.Total, ct);

    // ------------------------------------------------------------------
    // Escrita
    // ------------------------------------------------------------------

    public async Task<GoalDto> CreateAsync(GoalInput input, CancellationToken ct)
    {
        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == input.CategoryId, ct)
                       ?? throw DomainException.NotFound("Categoria não encontrada.");

        var name = input.Name.Trim();
        if (await db.Goals.AnyAsync(g => g.Name.ToLower() == name.ToLower(), ct))
            throw DomainException.Conflict($"Já existe a meta \"{name}\".");

        var goal = new Goal
        {
            Name = name,
            TargetAmount = input.TargetAmount,
            TargetYear = input.TargetYear,
            TargetMonth = input.TargetMonth,
            CategoryId = category.Id,
            IsActive = input.IsActive ?? true
        };

        db.Goals.Add(goal);
        await db.SaveChangesAsync(ct);

        goal.Category = category;
        return ToDto(goal, 0m);
    }

    public async Task<GoalDto> UpdateAsync(int id, GoalInput input, CancellationToken ct)
    {
        var goal = await db.Goals.FirstOrDefaultAsync(g => g.Id == id, ct)
                   ?? throw DomainException.NotFound("Meta não encontrada.");

        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == input.CategoryId, ct)
                       ?? throw DomainException.NotFound("Categoria não encontrada.");

        var name = input.Name.Trim();
        if (await db.Goals.AnyAsync(g => g.Id != id && g.Name.ToLower() == name.ToLower(), ct))
            throw DomainException.Conflict($"Já existe a meta \"{name}\".");

        goal.Name = name;
        goal.TargetAmount = input.TargetAmount;
        goal.TargetYear = input.TargetYear;
        goal.TargetMonth = input.TargetMonth;
        goal.CategoryId = category.Id;
        if (input.IsActive is bool active) goal.IsActive = active;

        await db.SaveChangesAsync(ct);

        goal.Category = category;
        var contributed = await ContributedByGoalAsync(ct);
        return ToDto(goal, contributed.GetValueOrDefault(goal.Id));
    }

    /// <summary>Remove a meta; se já recebeu aporte em algum mês, apenas desativa.</summary>
    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        var goal = await db.Goals.FirstOrDefaultAsync(g => g.Id == id, ct)
                   ?? throw DomainException.NotFound("Meta não encontrada.");

        if (await db.GoalContributions.AnyAsync(c => c.GoalId == id, ct))
            goal.IsActive = false;
        else
            db.Goals.Remove(goal);

        await db.SaveChangesAsync(ct);
    }

    // ------------------------------------------------------------------
    // Projeção
    // ------------------------------------------------------------------

    public static GoalDto ToDto(Goal goal, decimal contributed)
    {
        var target = goal.TargetAmount;
        var remaining = Math.Max(0m, target - contributed);
        var progress = target <= 0m
            ? 0m
            : Math.Round(Math.Min(100m, contributed / target * 100m), 2, MidpointRounding.AwayFromZero);

        var today = DateTime.UtcNow;
        var monthsRemaining = Math.Max(
            0,
            (goal.TargetYear * 12 + goal.TargetMonth) - (today.Year * 12 + today.Month) + 1);

        var suggested = monthsRemaining > 0
            ? Math.Round(remaining / monthsRemaining, 2, MidpointRounding.AwayFromZero)
            : remaining;

        var achieved = target > 0m && contributed >= target;

        return new GoalDto(
            goal.Id,
            goal.Name,
            target,
            goal.TargetYear,
            goal.TargetMonth,
            PlanService.LabelFor(goal.TargetYear, goal.TargetMonth),
            goal.CategoryId,
            goal.Category?.Name ?? "(categoria removida)",
            goal.Category?.Color ?? "#898781",
            goal.IsActive,
            contributed,
            remaining,
            progress,
            monthsRemaining,
            suggested,
            achieved,
            !achieved && monthsRemaining == 0);
    }
}
