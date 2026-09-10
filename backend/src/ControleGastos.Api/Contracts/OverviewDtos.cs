using ControleGastos.Api.Domain;

namespace ControleGastos.Api.Contracts;

/// <summary>Um mês do ano, com ou sem planejamento criado.</summary>
public record MonthOverviewDto(
    int Month,
    string MonthName,
    string ShortName,
    bool HasPlan,
    int? PlanId,
    PlanStep? Step,
    decimal PlannedIncome,
    decimal PlannedExpense,
    decimal Balance);

/// <summary>Quanto uma categoria consome no ano inteiro.</summary>
public record CategoryYearTotalDto(
    int CategoryId,
    string CategoryName,
    string Color,
    decimal PlannedExpense,
    decimal ShareOfExpense,
    decimal MonthlyAverage);

/// <summary>
/// Resumo de um ano: totais anuais, médias mensais e a quebra mês a mês.
/// As médias consideram apenas os meses que já têm planejamento.
/// </summary>
public record YearOverviewDto(
    int Year,
    IReadOnlyList<int> AvailableYears,
    int PlannedMonths,
    decimal TotalIncome,
    decimal TotalExpense,
    decimal TotalBalance,
    decimal AverageMonthlyIncome,
    decimal AverageMonthlyExpense,
    decimal AverageMonthlyBalance,
    decimal HighestExpenseMonthAmount,
    string? HighestExpenseMonthName,
    IReadOnlyList<MonthOverviewDto> Months,
    IReadOnlyList<CategoryYearTotalDto> Categories);
