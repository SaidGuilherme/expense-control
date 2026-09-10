using System.ComponentModel.DataAnnotations;
using ControleGastos.Api.Domain;

namespace ControleGastos.Api.Contracts;

// ---------- Criação / listagem ----------

public record CreatePlanInput
{
    [Range(2000, 2100)]
    public int Year { get; init; }

    [Range(1, 12)]
    public int Month { get; init; }

    /// <summary>Id de um planejamento existente para copiar entradas, alocações e saídas.</summary>
    public int? CopyFromPlanId { get; init; }
}

/// <summary>
/// Um mês já composto pelo cliente: o padrão do período com os ajustes daquele mês
/// aplicados. O servidor só grava — a noção de "padrão" vive no assistente.
/// </summary>
public record BatchMonthInput
{
    [Range(2000, 2100)]
    public int Year { get; init; }

    [Range(1, 12)]
    public int Month { get; init; }

    public List<PlannedIncomeInput> Incomes { get; init; } = [];
    public List<AllocationInput> Allocations { get; init; } = [];
    public List<PlannedExpenseInput> Expenses { get; init; } = [];
    public List<GoalContributionInput> GoalContributions { get; init; } = [];
}

/// <summary>
/// Grava de uma vez todos os meses de um período. Meses que já têm planejamento
/// são preservados, nunca sobrescritos.
/// </summary>
public record CreatePlanBatchInput
{
    public List<BatchMonthInput> Months { get; init; } = [];
}

/// <summary>Resultado da edição em conjunto: o que foi sobrescrito e o que foi criado.</summary>
public record ApplyPlanBatchResultDto(
    int UpdatedCount,
    int CreatedCount,
    IReadOnlyList<PlanSummaryDto> Plans);

public record CreatePlanRangeResultDto(
    int CreatedCount,
    int SkippedCount,
    IReadOnlyList<PlanSummaryDto> Created,
    IReadOnlyList<string> SkippedMonths);

public record PlanSummaryDto(
    int Id,
    int Year,
    int Month,
    string Label,
    PlanStep Step,
    decimal TotalIncome,
    decimal TotalAllocatedPercentage,
    decimal TotalPlannedExpense,
    decimal Balance,
    DateTime UpdatedAt);

// ---------- Detalhe ----------

public record PlannedIncomeDto(int IncomeSourceId, string IncomeSourceName, decimal Amount);

public record PlannedExpenseDto(int ExpenseSourceId, string ExpenseSourceName, int CategoryId, string CategoryName, decimal Amount);

/// <summary>
/// Como uma categoria está no mês. <c>PlannedExpense</c> é o total comprometido —
/// fontes de saída <b>mais</b> aportes em metas —, então <c>Difference</c> já
/// desconta as metas do teto. <c>PlannedGoals</c> isola só a parte das metas.
/// </summary>
public record CategoryBreakdownDto(
    int CategoryId,
    string CategoryName,
    string Color,
    decimal Percentage,
    decimal Budget,
    decimal PlannedExpense,
    decimal PlannedGoals,
    decimal Difference,
    IReadOnlyList<PlannedExpenseDto> Expenses,
    IReadOnlyList<PlannedGoalDto> Goals);

public record PlanDetailDto(
    int Id,
    int Year,
    int Month,
    string Label,
    PlanStep Step,
    string? Notes,
    IReadOnlyList<PlannedIncomeDto> Incomes,
    decimal TotalIncome,
    IReadOnlyList<CategoryBreakdownDto> Categories,
    decimal TotalAllocatedPercentage,
    decimal UnallocatedPercentage,
    decimal UnallocatedAmount,
    decimal TotalPlannedExpense,
    decimal TotalGoalContribution,
    decimal Balance,
    DateTime CreatedAt,
    DateTime UpdatedAt);

// ---------- Entradas de dados do assistente ----------

public record PlannedIncomeInput
{
    [Range(1, int.MaxValue)]
    public int IncomeSourceId { get; init; }

    [Range(0, 999_999_999)]
    public decimal Amount { get; init; }
}

public record PlannedIncomesInput
{
    public List<PlannedIncomeInput> Items { get; init; } = [];
}

public record AllocationInput
{
    [Range(1, int.MaxValue)]
    public int CategoryId { get; init; }

    [Range(0, 100)]
    public decimal Percentage { get; init; }
}

public record AllocationsInput
{
    public List<AllocationInput> Items { get; init; } = [];
}

public record PlannedExpenseInput
{
    [Range(1, int.MaxValue)]
    public int ExpenseSourceId { get; init; }

    [Range(0, 999_999_999)]
    public decimal Amount { get; init; }
}

public record PlannedExpensesInput
{
    public List<PlannedExpenseInput> Items { get; init; } = [];
}

public record StepInput
{
    [Range(1, 4)]
    public int Step { get; init; }
}
