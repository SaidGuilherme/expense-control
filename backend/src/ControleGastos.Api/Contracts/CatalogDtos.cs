using System.ComponentModel.DataAnnotations;

namespace ControleGastos.Api.Contracts;

// ---------- Categorias ----------

public record CategoryDto(int Id, string Name, string Color, int SortOrder, bool IsActive, int ExpenseSourceCount);

public record CategoryInput
{
    [Required, MaxLength(80)]
    public string Name { get; init; } = string.Empty;

    [RegularExpression("^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", ErrorMessage = "Cor deve ser um hexadecimal como #2a78d6.")]
    public string? Color { get; init; }

    public bool? IsActive { get; init; }
}

// ---------- Fontes de entrada ----------

public record IncomeSourceDto(int Id, string Name, bool IsActive);

public record IncomeSourceInput
{
    [Required, MaxLength(80)]
    public string Name { get; init; } = string.Empty;

    public bool? IsActive { get; init; }
}

// ---------- Fontes de saída ----------

public record ExpenseSourceDto(int Id, string Name, int CategoryId, string CategoryName, string CategoryColor, bool IsActive);

public record ExpenseSourceInput
{
    [Required, MaxLength(80)]
    public string Name { get; init; } = string.Empty;

    [Range(1, int.MaxValue, ErrorMessage = "Informe a categoria da fonte de saída.")]
    public int CategoryId { get; init; }

    public bool? IsActive { get; init; }
}
