namespace ControleGastos.Api.Domain;

/// <summary>Etapa atual do assistente de planejamento mensal.</summary>
public enum PlanStep
{
    /// <summary>Preenchendo o planejamento de entradas.</summary>
    Entradas = 1,

    /// <summary>Distribuindo a porcentagem de gastos por categoria.</summary>
    Alocacao = 2,

    /// <summary>Lançando os valores previstos de saída.</summary>
    Saidas = 3,

    /// <summary>Planejamento concluído.</summary>
    Concluido = 4
}

/// <summary>Agrupador de gastos que recebe uma fatia do gráfico de pizza.</summary>
public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>Cor hexadecimal usada no gráfico (ex.: #2a78d6).</summary>
    public string Color { get; set; } = "#2a78d6";

    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<ExpenseSource> ExpenseSources { get; set; } = new List<ExpenseSource>();
    public ICollection<CategoryAllocation> Allocations { get; set; } = new List<CategoryAllocation>();
}

/// <summary>Fonte de entrada reutilizável entre os meses (salário, freela, aluguel recebido...).</summary>
public class IncomeSource
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;

    public ICollection<PlannedIncome> PlannedIncomes { get; set; } = new List<PlannedIncome>();
}

/// <summary>Fonte de saída reutilizável, sempre vinculada a uma categoria.</summary>
public class ExpenseSource
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public Category? Category { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<PlannedExpense> PlannedExpenses { get; set; } = new List<PlannedExpense>();
}

/// <summary>Planejamento de um mês específico.</summary>
public class MonthlyPlan
{
    public int Id { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public PlanStep Step { get; set; } = PlanStep.Entradas;
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<PlannedIncome> Incomes { get; set; } = new List<PlannedIncome>();
    public ICollection<CategoryAllocation> Allocations { get; set; } = new List<CategoryAllocation>();
    public ICollection<PlannedExpense> Expenses { get; set; } = new List<PlannedExpense>();
}

/// <summary>Valor planejado de entrada de uma fonte dentro de um mês.</summary>
public class PlannedIncome
{
    public int Id { get; set; }
    public int MonthlyPlanId { get; set; }
    public MonthlyPlan? MonthlyPlan { get; set; }
    public int IncomeSourceId { get; set; }
    public IncomeSource? IncomeSource { get; set; }
    public decimal Amount { get; set; }
}

/// <summary>Porcentagem da receita planejada destinada a uma categoria.</summary>
public class CategoryAllocation
{
    public int Id { get; set; }
    public int MonthlyPlanId { get; set; }
    public MonthlyPlan? MonthlyPlan { get; set; }
    public int CategoryId { get; set; }
    public Category? Category { get; set; }
    public decimal Percentage { get; set; }
}

/// <summary>Valor previsto de saída de uma fonte dentro de um mês.</summary>
public class PlannedExpense
{
    public int Id { get; set; }
    public int MonthlyPlanId { get; set; }
    public MonthlyPlan? MonthlyPlan { get; set; }
    public int ExpenseSourceId { get; set; }
    public ExpenseSource? ExpenseSource { get; set; }
    public decimal Amount { get; set; }
}
