using ControleGastos.Api.Common;
using ControleGastos.Api.Contracts;
using ControleGastos.Api.Data;
using ControleGastos.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace ControleGastos.Api.Services;

/// <summary>Regras do assistente de planejamento mensal.</summary>
public class PlanService(AppDbContext db, GoalService goals)
{
    private static readonly string[] MonthNames =
    [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    private static readonly string[] ShortMonthNames =
    [
        "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
        "Jul", "Ago", "Set", "Out", "Nov", "Dez"
    ];

    /// <summary>Tolerância para comparação de porcentagens (evita ruído de arredondamento).</summary>
    private const decimal PercentTolerance = 0.01m;

    public static string LabelFor(int year, int month) => $"{MonthNames[month - 1]} de {year}";

    // ------------------------------------------------------------------
    // Consultas
    // ------------------------------------------------------------------

    public async Task<List<PlanSummaryDto>> ListAsync(CancellationToken ct)
    {
        var plans = await db.MonthlyPlans
            .AsNoTracking()
            .Include(p => p.Incomes)
            .Include(p => p.Allocations)
            .Include(p => p.Expenses)
            .Include(p => p.GoalContributions)
            .OrderByDescending(p => p.Year).ThenByDescending(p => p.Month)
            .ToListAsync(ct);

        return plans.Select(ToSummary).ToList();
    }

    private static PlanSummaryDto ToSummary(MonthlyPlan plan)
    {
        var totalIncome = plan.Incomes.Sum(i => i.Amount);
        var totalExpense = plan.Expenses.Sum(e => e.Amount) + plan.GoalContributions.Sum(c => c.Amount);

        return new PlanSummaryDto(
            plan.Id,
            plan.Year,
            plan.Month,
            LabelFor(plan.Year, plan.Month),
            plan.Step,
            totalIncome,
            plan.Allocations.Sum(a => a.Percentage),
            totalExpense,
            totalIncome - totalExpense,
            plan.UpdatedAt);
    }

    public async Task<PlanDetailDto> GetDetailAsync(int planId, CancellationToken ct)
    {
        var plan = await LoadAsync(planId, tracking: false, ct);
        return await BuildDetailAsync(plan, ct);
    }

    /// <summary>
    /// Consolida um ano: total previsto de entrada e de saída, a média por mês
    /// (contando só os meses já planejados) e a quebra mês a mês e por categoria.
    /// </summary>
    public async Task<YearOverviewDto> GetYearOverviewAsync(int? year, CancellationToken ct)
    {
        var availableYears = await db.MonthlyPlans
            .AsNoTracking()
            .Select(p => p.Year)
            .Distinct()
            .OrderByDescending(y => y)
            .ToListAsync(ct);

        // Sem ano pedido: o mais recente que tem planejamento; se não há nenhum, o ano corrente.
        var targetYear = year ?? (availableYears.Count > 0 ? availableYears[0] : DateTime.UtcNow.Year);

        if (!availableYears.Contains(targetYear))
            availableYears = availableYears.Append(targetYear).OrderByDescending(y => y).ToList();

        var plans = await db.MonthlyPlans
            .AsNoTracking()
            .Include(p => p.Incomes)
            .Include(p => p.Expenses)
            .Include(p => p.GoalContributions)
            .Where(p => p.Year == targetYear)
            .ToListAsync(ct);

        var months = new List<MonthOverviewDto>(12);
        for (var month = 1; month <= 12; month++)
        {
            var plan = plans.FirstOrDefault(p => p.Month == month);

            if (plan is null)
            {
                months.Add(new MonthOverviewDto(
                    month, MonthNames[month - 1], ShortMonthNames[month - 1],
                    false, null, null, 0m, 0m, 0m, 0m));
                continue;
            }

            var income = plan.Incomes.Sum(i => i.Amount);
            var contributions = plan.GoalContributions.Sum(c => c.Amount);
            var expense = plan.Expenses.Sum(e => e.Amount) + contributions;

            months.Add(new MonthOverviewDto(
                month, MonthNames[month - 1], ShortMonthNames[month - 1],
                true, plan.Id, plan.Step, income, expense, contributions, income - expense));
        }

        var plannedMonths = months.Where(m => m.HasPlan).ToList();
        var totalIncome = plannedMonths.Sum(m => m.PlannedIncome);
        var totalExpense = plannedMonths.Sum(m => m.PlannedExpense);
        var count = plannedMonths.Count;

        decimal PerMonth(decimal total) =>
            count == 0 ? 0m : Math.Round(total / count, 2, MidpointRounding.AwayFromZero);

        var expenseSources = await db.ExpenseSources.AsNoTracking().ToDictionaryAsync(s => s.Id, ct);
        var categories = await db.Categories.AsNoTracking().ToDictionaryAsync(c => c.Id, ct);
        var goalCategories = await db.Goals.AsNoTracking().ToDictionaryAsync(g => g.Id, g => g.CategoryId, ct);

        // Fontes de saída e aportes em metas caem na mesma categoria.
        var committed = plans
            .SelectMany(p => p.Expenses)
            .Select(e => new
            {
                e.Amount,
                CategoryId = expenseSources.GetValueOrDefault(e.ExpenseSourceId)?.CategoryId ?? 0
            })
            .Concat(plans
                .SelectMany(p => p.GoalContributions)
                .Select(c => new
                {
                    c.Amount,
                    CategoryId = goalCategories.GetValueOrDefault(c.GoalId)
                }));

        var categoryTotals = committed
            .Where(x => x.CategoryId != 0)
            .GroupBy(x => x.CategoryId)
            .Select(group =>
            {
                var category = categories.GetValueOrDefault(group.Key);
                var total = group.Sum(x => x.Amount);

                return new CategoryYearTotalDto(
                    group.Key,
                    category?.Name ?? "(categoria removida)",
                    category?.Color ?? "#898781",
                    total,
                    totalExpense == 0m ? 0m : Math.Round(total / totalExpense * 100m, 2, MidpointRounding.AwayFromZero),
                    PerMonth(total));
            })
            .OrderByDescending(c => c.PlannedExpense)
            .ThenBy(c => c.CategoryName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var peak = plannedMonths
            .Where(m => m.PlannedExpense > 0)
            .OrderByDescending(m => m.PlannedExpense)
            .FirstOrDefault();

        return new YearOverviewDto(
            targetYear,
            availableYears,
            count,
            totalIncome,
            totalExpense,
            totalIncome - totalExpense,
            PerMonth(totalIncome),
            PerMonth(totalExpense),
            PerMonth(totalIncome - totalExpense),
            peak?.PlannedExpense ?? 0m,
            peak?.MonthName,
            plannedMonths.Sum(m => m.GoalContribution),
            months,
            categoryTotals,
            await goals.ListAsync(includeInactive: false, ct));
    }

    // ------------------------------------------------------------------
    // Criação / remoção
    // ------------------------------------------------------------------

    public async Task<PlanDetailDto> CreateAsync(CreatePlanInput input, CancellationToken ct)
    {
        var exists = await db.MonthlyPlans
            .AnyAsync(p => p.Year == input.Year && p.Month == input.Month, ct);

        if (exists)
            throw DomainException.Conflict($"Já existe um planejamento para {LabelFor(input.Year, input.Month)}.");

        var plan = new MonthlyPlan { Year = input.Year, Month = input.Month };

        if (input.CopyFromPlanId is int sourceId)
        {
            var source = await LoadAsync(sourceId, tracking: false, ct);

            foreach (var i in source.Incomes)
                plan.Incomes.Add(new PlannedIncome { IncomeSourceId = i.IncomeSourceId, Amount = i.Amount });

            foreach (var a in source.Allocations)
                plan.Allocations.Add(new CategoryAllocation { CategoryId = a.CategoryId, Percentage = a.Percentage });

            foreach (var e in source.Expenses)
                plan.Expenses.Add(new PlannedExpense { ExpenseSourceId = e.ExpenseSourceId, Amount = e.Amount });

            foreach (var c in source.GoalContributions)
                plan.GoalContributions.Add(new GoalContribution { GoalId = c.GoalId, Amount = c.Amount });
        }

        db.MonthlyPlans.Add(plan);
        await db.SaveChangesAsync(ct);

        return await GetDetailAsync(plan.Id, ct);
    }

    /// <summary>Máximo de meses gravados de uma vez — evita um clique gerar anos de planejamento.</summary>
    private const int MaxRangeMonths = 36;

    /// <summary>
    /// Grava de uma vez os meses de um período. O cliente manda cada mês já
    /// composto (padrão do período + ajustes daquele mês); aqui só se valida e
    /// persiste. Meses que já têm planejamento são preservados e devolvidos na
    /// lista de pulados — nunca sobrescritos.
    /// </summary>
    public async Task<CreatePlanRangeResultDto> CreateBatchAsync(CreatePlanBatchInput input, CancellationToken ct)
    {
        var months = input.Months;

        if (months.Count == 0)
            throw new DomainException("Nenhum mês foi enviado.");

        if (months.Count > MaxRangeMonths)
            throw new DomainException($"São {months.Count} meses; o máximo por vez é {MaxRangeMonths}.");

        var seen = new HashSet<int>();
        foreach (var month in months)
        {
            if (!seen.Add(month.Year * 12 + (month.Month - 1)))
                throw new DomainException($"O mês {LabelFor(month.Year, month.Month)} foi enviado mais de uma vez.");
        }

        // Uma checagem de referências para o lote inteiro, em vez de uma por mês.
        await EnsureBatchReferencesAsync(months, ct);

        var years = months.Select(m => m.Year).Distinct().ToList();
        var taken = await db.MonthlyPlans
            .AsNoTracking()
            .Where(p => years.Contains(p.Year))
            .Select(p => new { p.Year, p.Month })
            .ToListAsync(ct);

        var takenIndexes = taken.Select(x => x.Year * 12 + (x.Month - 1)).ToHashSet();

        var created = new List<MonthlyPlan>();
        var skipped = new List<string>();

        foreach (var month in months.OrderBy(m => m.Year).ThenBy(m => m.Month))
        {
            var label = LabelFor(month.Year, month.Month);

            if (takenIndexes.Contains(month.Year * 12 + (month.Month - 1)))
            {
                skipped.Add(label);
                continue;
            }

            var incomes = Deduplicate(month.Incomes, x => x.IncomeSourceId, "fonte de entrada");
            var allocations = Deduplicate(month.Allocations, x => x.CategoryId, "categoria");
            var expenses = Deduplicate(month.Expenses, x => x.ExpenseSourceId, "fonte de saída");
            var contributions = Deduplicate(month.GoalContributions, x => x.GoalId, "meta");

            var totalPercentage = allocations.Values.Sum(a => a.Percentage);
            if (totalPercentage > 100m + PercentTolerance)
                throw new DomainException(
                    $"Em {label} a soma das porcentagens é {totalPercentage:0.##}% e não pode passar de 100%.");

            // Vem do assistente com as quatro etapas preenchidas.
            var plan = new MonthlyPlan { Year = month.Year, Month = month.Month, Step = PlanStep.Concluido };

            foreach (var (sourceId, item) in incomes.Where(x => x.Value.Amount > 0))
                plan.Incomes.Add(new PlannedIncome { IncomeSourceId = sourceId, Amount = item.Amount });

            foreach (var (categoryId, item) in allocations.Where(x => x.Value.Percentage > 0))
                plan.Allocations.Add(new CategoryAllocation { CategoryId = categoryId, Percentage = item.Percentage });

            foreach (var (sourceId, item) in expenses.Where(x => x.Value.Amount > 0))
                plan.Expenses.Add(new PlannedExpense { ExpenseSourceId = sourceId, Amount = item.Amount });

            foreach (var (goalId, item) in contributions.Where(x => x.Value.Amount > 0))
                plan.GoalContributions.Add(new GoalContribution { GoalId = goalId, Amount = item.Amount });

            db.MonthlyPlans.Add(plan);
            created.Add(plan);
        }

        if (created.Count > 0)
            await db.SaveChangesAsync(ct);

        return new CreatePlanRangeResultDto(
            created.Count,
            skipped.Count,
            created.Select(ToSummary).ToList(),
            skipped);
    }

    /// <summary>
    /// Edição em conjunto: substitui o conteúdo de cada mês enviado. Diferente do
    /// POST, aqui os meses existentes <b>são</b> sobrescritos — é o efeito
    /// pretendido de aplicar um padrão a vários meses de uma vez. Meses que ainda
    /// não existem são criados.
    /// </summary>
    public async Task<ApplyPlanBatchResultDto> ApplyBatchAsync(CreatePlanBatchInput input, CancellationToken ct)
    {
        var months = input.Months;

        if (months.Count == 0)
            throw new DomainException("Nenhum mês foi enviado.");

        if (months.Count > MaxRangeMonths)
            throw new DomainException($"São {months.Count} meses; o máximo por vez é {MaxRangeMonths}.");

        var seen = new HashSet<int>();
        foreach (var month in months)
        {
            if (!seen.Add(month.Year * 12 + (month.Month - 1)))
                throw new DomainException($"O mês {LabelFor(month.Year, month.Month)} foi enviado mais de uma vez.");
        }

        await EnsureBatchReferencesAsync(months, ct);

        var years = months.Select(m => m.Year).Distinct().ToList();
        var plans = await db.MonthlyPlans
            .Include(p => p.Incomes)
            .Include(p => p.Allocations)
            .Include(p => p.Expenses)
            .Include(p => p.GoalContributions)
            .Where(p => years.Contains(p.Year))
            .ToListAsync(ct);

        var byIndex = plans.ToDictionary(p => p.Year * 12 + (p.Month - 1));

        var touched = new List<MonthlyPlan>();
        var updated = 0;
        var created = 0;

        foreach (var month in months.OrderBy(m => m.Year).ThenBy(m => m.Month))
        {
            var label = LabelFor(month.Year, month.Month);

            var incomes = Deduplicate(month.Incomes, x => x.IncomeSourceId, "fonte de entrada");
            var allocations = Deduplicate(month.Allocations, x => x.CategoryId, "categoria");
            var expenses = Deduplicate(month.Expenses, x => x.ExpenseSourceId, "fonte de saída");
            var contributions = Deduplicate(month.GoalContributions, x => x.GoalId, "meta");

            var totalPercentage = allocations.Values.Sum(a => a.Percentage);
            if (totalPercentage > 100m + PercentTolerance)
                throw new DomainException(
                    $"Em {label} a soma das porcentagens é {totalPercentage:0.##}% e não pode passar de 100%.");

            var index = month.Year * 12 + (month.Month - 1);

            if (!byIndex.TryGetValue(index, out var plan))
            {
                plan = new MonthlyPlan { Year = month.Year, Month = month.Month };
                db.MonthlyPlans.Add(plan);
                byIndex[index] = plan;
                created++;
            }
            else
            {
                updated++;
            }

            // O mesmo merge das etapas do assistente: atualiza, remove e insere.
            // Nada de apagar tudo e reinserir, que esbarraria nos índices únicos.
            Sync(
                plan.Incomes, incomes,
                existing => existing.IncomeSourceId,
                (sourceId, item) => new PlannedIncome { IncomeSourceId = sourceId, Amount = item.Amount },
                (existing, item) => existing.Amount = item.Amount,
                item => item.Amount <= 0,
                db.PlannedIncomes);

            Sync(
                plan.Allocations, allocations,
                existing => existing.CategoryId,
                (categoryId, item) => new CategoryAllocation { CategoryId = categoryId, Percentage = item.Percentage },
                (existing, item) => existing.Percentage = item.Percentage,
                item => item.Percentage <= 0,
                db.CategoryAllocations);

            Sync(
                plan.Expenses, expenses,
                existing => existing.ExpenseSourceId,
                (sourceId, item) => new PlannedExpense { ExpenseSourceId = sourceId, Amount = item.Amount },
                (existing, item) => existing.Amount = item.Amount,
                item => item.Amount <= 0,
                db.PlannedExpenses);

            Sync(
                plan.GoalContributions, contributions,
                existing => existing.GoalId,
                (goalId, item) => new GoalContribution { GoalId = goalId, Amount = item.Amount },
                (existing, item) => existing.Amount = item.Amount,
                item => item.Amount <= 0,
                db.GoalContributions);

            plan.Step = PlanStep.Concluido;
            plan.UpdatedAt = DateTime.UtcNow;
            touched.Add(plan);
        }

        await db.SaveChangesAsync(ct);

        return new ApplyPlanBatchResultDto(
            updated,
            created,
            touched.OrderByDescending(p => p.Year).ThenByDescending(p => p.Month).Select(ToSummary).ToList());
    }

    /// <summary>Confere de uma vez todas as referências citadas por um lote de meses.</summary>
    private async Task EnsureBatchReferencesAsync(List<BatchMonthInput> months, CancellationToken ct)
    {
        await EnsureExistsAsync(
            db.IncomeSources.Select(s => s.Id),
            months.SelectMany(m => m.Incomes).Select(i => i.IncomeSourceId).Distinct(),
            "Fonte de entrada", ct);

        await EnsureExistsAsync(
            db.Categories.Select(c => c.Id),
            months.SelectMany(m => m.Allocations).Select(a => a.CategoryId).Distinct(),
            "Categoria", ct);

        await EnsureExistsAsync(
            db.ExpenseSources.Select(s => s.Id),
            months.SelectMany(m => m.Expenses).Select(e => e.ExpenseSourceId).Distinct(),
            "Fonte de saída", ct);

        await EnsureExistsAsync(
            db.Goals.Select(g => g.Id),
            months.SelectMany(m => m.GoalContributions).Select(c => c.GoalId).Distinct(),
            "Meta", ct);
    }

    public async Task DeleteAsync(int planId, CancellationToken ct)
    {
        var plan = await db.MonthlyPlans.FirstOrDefaultAsync(p => p.Id == planId, ct)
                   ?? throw DomainException.NotFound("Planejamento não encontrado.");

        db.MonthlyPlans.Remove(plan);
        await db.SaveChangesAsync(ct);
    }

    // ------------------------------------------------------------------
    // Etapa 1 — entradas
    // ------------------------------------------------------------------

    public async Task<PlanDetailDto> SetIncomesAsync(int planId, PlannedIncomesInput input, CancellationToken ct)
    {
        var plan = await LoadAsync(planId, tracking: true, ct);

        var items = Deduplicate(input.Items, x => x.IncomeSourceId, "fonte de entrada");
        await EnsureExistsAsync(db.IncomeSources.Select(s => s.Id), items.Keys, "Fonte de entrada", ct);

        Sync(
            plan.Incomes,
            items,
            existing => existing.IncomeSourceId,
            (sourceId, item) => new PlannedIncome { MonthlyPlanId = plan.Id, IncomeSourceId = sourceId, Amount = item.Amount },
            (existing, item) => existing.Amount = item.Amount,
            item => item.Amount <= 0,
            db.PlannedIncomes);

        await TouchAndSaveAsync(plan, ct);
        return await BuildDetailAsync(plan, ct);
    }

    // ------------------------------------------------------------------
    // Etapa 2 — alocação percentual
    // ------------------------------------------------------------------

    public async Task<PlanDetailDto> SetAllocationsAsync(int planId, AllocationsInput input, CancellationToken ct)
    {
        var plan = await LoadAsync(planId, tracking: true, ct);

        var items = Deduplicate(input.Items, x => x.CategoryId, "categoria");
        await EnsureExistsAsync(db.Categories.Select(c => c.Id), items.Keys, "Categoria", ct);

        var total = items.Values.Sum(x => x.Percentage);
        if (total > 100m + PercentTolerance)
            throw new DomainException($"A soma das porcentagens é {total:0.##}% e não pode passar de 100%.");

        Sync(
            plan.Allocations,
            items,
            existing => existing.CategoryId,
            (categoryId, item) => new CategoryAllocation { MonthlyPlanId = plan.Id, CategoryId = categoryId, Percentage = item.Percentage },
            (existing, item) => existing.Percentage = item.Percentage,
            item => item.Percentage <= 0,
            db.CategoryAllocations);

        await TouchAndSaveAsync(plan, ct);
        return await BuildDetailAsync(plan, ct);
    }

    // ------------------------------------------------------------------
    // Etapa 3 — saídas previstas
    // ------------------------------------------------------------------

    public async Task<PlanDetailDto> SetExpensesAsync(int planId, PlannedExpensesInput input, CancellationToken ct)
    {
        var plan = await LoadAsync(planId, tracking: true, ct);

        var items = Deduplicate(input.Items, x => x.ExpenseSourceId, "fonte de saída");
        await EnsureExistsAsync(db.ExpenseSources.Select(s => s.Id), items.Keys, "Fonte de saída", ct);

        Sync(
            plan.Expenses,
            items,
            existing => existing.ExpenseSourceId,
            (sourceId, item) => new PlannedExpense { MonthlyPlanId = plan.Id, ExpenseSourceId = sourceId, Amount = item.Amount },
            (existing, item) => existing.Amount = item.Amount,
            item => item.Amount <= 0,
            db.PlannedExpenses);

        await TouchAndSaveAsync(plan, ct);
        return await BuildDetailAsync(plan, ct);
    }

    // ------------------------------------------------------------------
    // Etapa 3 — aportes em metas (ocupam o teto da categoria da meta)
    // ------------------------------------------------------------------

    public async Task<PlanDetailDto> SetGoalContributionsAsync(
        int planId, GoalContributionsInput input, CancellationToken ct)
    {
        var plan = await LoadAsync(planId, tracking: true, ct);

        var items = Deduplicate(input.Items, x => x.GoalId, "meta");
        await EnsureExistsAsync(db.Goals.Select(g => g.Id), items.Keys, "Meta", ct);

        Sync(
            plan.GoalContributions,
            items,
            existing => existing.GoalId,
            (goalId, item) => new GoalContribution { MonthlyPlanId = plan.Id, GoalId = goalId, Amount = item.Amount },
            (existing, item) => existing.Amount = item.Amount,
            item => item.Amount <= 0,
            db.GoalContributions);

        await TouchAndSaveAsync(plan, ct);
        return await BuildDetailAsync(plan, ct);
    }

    // ------------------------------------------------------------------
    // Navegação entre etapas
    // ------------------------------------------------------------------

    public async Task<PlanDetailDto> SetStepAsync(int planId, PlanStep target, CancellationToken ct)
    {
        var plan = await LoadAsync(planId, tracking: true, ct);

        // Voltar é sempre permitido; avançar exige que a etapa anterior esteja válida.
        if (target > plan.Step)
        {
            if (target >= PlanStep.Alocacao && plan.Incomes.Sum(i => i.Amount) <= 0)
                throw new DomainException("Informe ao menos uma entrada antes de definir a distribuição por categoria.");

            if (target >= PlanStep.Saidas)
            {
                var total = plan.Allocations.Sum(a => a.Percentage);
                if (total <= 0)
                    throw new DomainException("Distribua a porcentagem entre as categorias antes de lançar os gastos previstos.");
                if (total > 100m + PercentTolerance)
                    throw new DomainException($"A soma das porcentagens é {total:0.##}% e não pode passar de 100%.");
            }
        }

        plan.Step = target;
        await TouchAndSaveAsync(plan, ct);
        return await BuildDetailAsync(plan, ct);
    }

    // ------------------------------------------------------------------
    // Infraestrutura interna
    // ------------------------------------------------------------------

    private async Task<MonthlyPlan> LoadAsync(int planId, bool tracking, CancellationToken ct)
    {
        var query = db.MonthlyPlans
            .Include(p => p.Incomes)
            .Include(p => p.Allocations)
            .Include(p => p.Expenses)
            .Include(p => p.GoalContributions)
            .AsQueryable();

        if (!tracking) query = query.AsNoTracking();

        return await query.FirstOrDefaultAsync(p => p.Id == planId, ct)
               ?? throw DomainException.NotFound("Planejamento não encontrado.");
    }

    private async Task TouchAndSaveAsync(MonthlyPlan plan, CancellationToken ct)
    {
        plan.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    private static Dictionary<int, T> Deduplicate<T>(IEnumerable<T> items, Func<T, int> keySelector, string label)
    {
        var map = new Dictionary<int, T>();
        foreach (var item in items)
        {
            var key = keySelector(item);
            if (!map.TryAdd(key, item))
                throw new DomainException($"A mesma {label} foi enviada mais de uma vez.");
        }
        return map;
    }

    private static async Task EnsureExistsAsync(
        IQueryable<int> existingIds, IEnumerable<int> ids, string label, CancellationToken ct)
    {
        var wanted = ids.ToList();
        if (wanted.Count == 0) return;

        var found = await existingIds.Where(id => wanted.Contains(id)).ToListAsync(ct);

        var missing = wanted.Except(found).ToList();
        if (missing.Count > 0)
            throw DomainException.NotFound($"{label} não encontrada: {string.Join(", ", missing)}.");
    }

    /// <summary>Espelha a lista enviada pelo cliente na coleção persistida (insere, atualiza e remove).</summary>
    private static void Sync<TEntity, TInput>(
        ICollection<TEntity> current,
        Dictionary<int, TInput> incoming,
        Func<TEntity, int> keyOf,
        Func<int, TInput, TEntity> create,
        Action<TEntity, TInput> update,
        Func<TInput, bool> isEmpty,
        DbSet<TEntity> set)
        where TEntity : class
    {
        foreach (var existing in current.ToList())
        {
            var key = keyOf(existing);
            if (incoming.TryGetValue(key, out var item) && !isEmpty(item))
            {
                update(existing, item);
            }
            else
            {
                current.Remove(existing);
                set.Remove(existing);
            }
        }

        var keptKeys = current.Select(keyOf).ToHashSet();
        foreach (var (key, item) in incoming)
        {
            if (keptKeys.Contains(key) || isEmpty(item)) continue;
            current.Add(create(key, item));
        }
    }

    private async Task<PlanDetailDto> BuildDetailAsync(MonthlyPlan plan, CancellationToken ct)
    {
        var categories = await db.Categories.AsNoTracking().ToDictionaryAsync(c => c.Id, ct);
        var incomeSources = await db.IncomeSources.AsNoTracking().ToDictionaryAsync(s => s.Id, ct);
        var expenseSources = await db.ExpenseSources.AsNoTracking().ToDictionaryAsync(s => s.Id, ct);

        var incomes = plan.Incomes
            .Select(i => new PlannedIncomeDto(
                i.IncomeSourceId,
                incomeSources.TryGetValue(i.IncomeSourceId, out var s) ? s.Name : "(removida)",
                i.Amount))
            .OrderByDescending(i => i.Amount)
            .ThenBy(i => i.IncomeSourceName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var totalIncome = incomes.Sum(i => i.Amount);

        var expensesByCategory = plan.Expenses
            .Select(e =>
            {
                var source = expenseSources.GetValueOrDefault(e.ExpenseSourceId);
                var categoryId = source?.CategoryId ?? 0;
                var categoryName = categoryId != 0 && categories.TryGetValue(categoryId, out var c) ? c.Name : "(sem categoria)";
                return new PlannedExpenseDto(e.ExpenseSourceId, source?.Name ?? "(removida)", categoryId, categoryName, e.Amount);
            })
            .GroupBy(e => e.CategoryId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(e => e.Amount).ToList());

        // Aportes em metas entram na categoria da meta, ao lado das fontes de saída.
        var goalsById = await db.Goals.AsNoTracking().ToDictionaryAsync(g => g.Id, ct);
        var contributedByGoal = await goals.ContributedByGoalAsync(ct);

        var goalsByCategory = plan.GoalContributions
            .Select(c =>
            {
                var goal = goalsById.GetValueOrDefault(c.GoalId);
                var contributed = contributedByGoal.GetValueOrDefault(c.GoalId);
                var target = goal?.TargetAmount ?? 0m;

                return new PlannedGoalDto(
                    c.GoalId,
                    goal?.Name ?? "(meta removida)",
                    goal?.CategoryId ?? 0,
                    c.Amount,
                    target,
                    goal is null ? "—" : LabelFor(goal.TargetYear, goal.TargetMonth),
                    contributed,
                    target <= 0m
                        ? 0m
                        : Math.Round(Math.Min(100m, contributed / target * 100m), 2, MidpointRounding.AwayFromZero));
            })
            .GroupBy(g => g.CategoryId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Amount).ToList());

        var categoryIds = plan.Allocations.Select(a => a.CategoryId)
            .Union(expensesByCategory.Keys.Where(id => id != 0))
            .Union(goalsByCategory.Keys.Where(id => id != 0))
            .Distinct()
            .ToList();

        var breakdown = categoryIds
            .Select(id =>
            {
                var category = categories.GetValueOrDefault(id);
                var percentage = plan.Allocations.FirstOrDefault(a => a.CategoryId == id)?.Percentage ?? 0m;
                var budget = Math.Round(totalIncome * percentage / 100m, 2, MidpointRounding.AwayFromZero);

                var expenses = expensesByCategory.TryGetValue(id, out var foundExpenses)
                    ? foundExpenses
                    : new List<PlannedExpenseDto>();

                var categoryGoals = goalsByCategory.TryGetValue(id, out var foundGoals)
                    ? foundGoals
                    : new List<PlannedGoalDto>();

                var plannedGoals = categoryGoals.Sum(g => g.Amount);
                var planned = expenses.Sum(e => e.Amount) + plannedGoals;

                return new CategoryBreakdownDto(
                    id,
                    category?.Name ?? "(categoria removida)",
                    category?.Color ?? "#898781",
                    percentage,
                    budget,
                    planned,
                    plannedGoals,
                    budget - planned,
                    expenses,
                    categoryGoals);
            })
            .OrderByDescending(c => c.Percentage)
            .ThenByDescending(c => c.PlannedExpense)
            .ThenBy(c => c.CategoryName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var totalPercentage = breakdown.Sum(c => c.Percentage);
        var unallocatedPercentage = Math.Max(0m, 100m - totalPercentage);
        var totalPlannedExpense = breakdown.Sum(c => c.PlannedExpense);

        return new PlanDetailDto(
            plan.Id,
            plan.Year,
            plan.Month,
            LabelFor(plan.Year, plan.Month),
            plan.Step,
            plan.Notes,
            incomes,
            totalIncome,
            breakdown,
            totalPercentage,
            unallocatedPercentage,
            Math.Round(totalIncome * unallocatedPercentage / 100m, 2, MidpointRounding.AwayFromZero),
            totalPlannedExpense,
            breakdown.Sum(c => c.PlannedGoals),
            totalIncome - totalPlannedExpense,
            plan.CreatedAt,
            plan.UpdatedAt);
    }
}
