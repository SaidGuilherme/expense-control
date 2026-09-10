using System.ComponentModel.DataAnnotations;

namespace ControleGastos.Api.Contracts;

/// <summary>
/// Meta com o progresso já calculado.
/// <para><c>ContributedAmount</c> é a soma de todos os aportes lançados para ela.</para>
/// <para><c>MonthsRemaining</c> conta o mês atual e é zero quando o prazo já passou.</para>
/// <para><c>SuggestedMonthlyAmount</c> é quanto faltaria guardar por mês para bater o prazo.</para>
/// </summary>
public record GoalDto(
    int Id,
    string Name,
    decimal TargetAmount,
    int TargetYear,
    int TargetMonth,
    string TargetLabel,
    int CategoryId,
    string CategoryName,
    string CategoryColor,
    bool IsActive,
    decimal ContributedAmount,
    decimal RemainingAmount,
    decimal ProgressPercent,
    int MonthsRemaining,
    decimal SuggestedMonthlyAmount,
    bool IsAchieved,
    bool IsLate);

public record GoalInput
{
    [Required, MaxLength(80)]
    public string Name { get; init; } = string.Empty;

    [Range(0.01, 999_999_999, ErrorMessage = "O valor da meta precisa ser maior que zero.")]
    public decimal TargetAmount { get; init; }

    [Range(2000, 2100)]
    public int TargetYear { get; init; }

    [Range(1, 12)]
    public int TargetMonth { get; init; }

    [Range(1, int.MaxValue, ErrorMessage = "Informe a categoria da meta.")]
    public int CategoryId { get; init; }

    public bool? IsActive { get; init; }
}

/// <summary>Aporte de uma meta dentro de um mês, já com o contexto da meta.</summary>
public record PlannedGoalDto(
    int GoalId,
    string GoalName,
    int CategoryId,
    decimal Amount,
    decimal TargetAmount,
    string TargetLabel,
    decimal ContributedAmount,
    decimal ProgressPercent);

public record GoalContributionInput
{
    [Range(1, int.MaxValue)]
    public int GoalId { get; init; }

    [Range(0, 999_999_999)]
    public decimal Amount { get; init; }
}

public record GoalContributionsInput
{
    public List<GoalContributionInput> Items { get; init; } = [];
}
