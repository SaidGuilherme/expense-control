using ControleGastos.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace ControleGastos.Api.Data;

/// <summary>
/// Popula o banco vazio com categorias e fontes iniciais, para que o usuário
/// consiga fazer o primeiro planejamento sem cadastrar tudo do zero.
/// </summary>
public static class DbSeeder
{
    /// <summary>Paleta categórica validada para daltonismo — a ordem das cores importa.</summary>
    public static readonly string[] Palette =
    [
        "#2a78d6", // azul
        "#eb6834", // laranja
        "#1baf7a", // água
        "#eda100", // amarelo
        "#e87ba4", // magenta
        "#008300", // verde
        "#4a3aa7", // violeta
        "#e34948"  // vermelho
    ];

    public static async Task SeedAsync(AppDbContext db, CancellationToken ct = default)
    {
        if (!await db.Categories.AnyAsync(ct))
        {
            var seed = new (string Name, string[] Sources)[]
            {
                ("Moradia", ["Aluguel / Financiamento", "Condomínio", "Luz", "Água", "Internet"]),
                ("Alimentação", ["Supermercado", "Feira", "Restaurantes / Delivery"]),
                ("Transporte", ["Combustível", "Transporte público", "Manutenção do carro"]),
                ("Saúde", ["Plano de saúde", "Farmácia", "Academia"]),
                ("Educação", ["Cursos", "Mensalidade escolar", "Livros"]),
                ("Lazer", ["Streaming", "Viagens", "Passeios"]),
                ("Investimentos", ["Reserva de emergência", "Aportes"]),
                ("Outros", ["Presentes", "Imprevistos"])
            };

            for (var i = 0; i < seed.Length; i++)
            {
                var category = new Category
                {
                    Name = seed[i].Name,
                    Color = Palette[i % Palette.Length],
                    SortOrder = i,
                    ExpenseSources = seed[i].Sources
                        .Select(s => new ExpenseSource { Name = s })
                        .ToList()
                };
                db.Categories.Add(category);
            }
        }

        if (!await db.IncomeSources.AnyAsync(ct))
        {
            db.IncomeSources.AddRange(
                new IncomeSource { Name = "Salário" },
                new IncomeSource { Name = "Freelance" },
                new IncomeSource { Name = "Rendimentos" },
                new IncomeSource { Name = "Outras entradas" });
        }

        await db.SaveChangesAsync(ct);
    }
}
