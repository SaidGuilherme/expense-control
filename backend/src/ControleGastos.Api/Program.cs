using System.Text.Json.Serialization;
using ControleGastos.Api.Common;
using ControleGastos.Api.Data;
using ControleGastos.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------------------
// Banco — a docker-compose injeta ConnectionStrings__Default.
// ---------------------------------------------------------------------------
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Connection string 'Default' não configurada.");

builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddScoped<GoalService>();
builder.Services.AddScoped<PlanService>();

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<DomainExceptionHandler>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options => options.SwaggerDoc("v1", new()
{
    Title = "Controle de Gastos API",
    Version = "v1",
    Description = "Planejamento mensal de entradas, distribuição por categoria e gastos previstos."
}));

// Em produção o nginx do frontend faz proxy de /api, então o CORS só importa
// para o `npm run dev` apontando direto para a API.
const string DevCorsPolicy = "dev";
var corsOrigins = (builder.Configuration["Cors:Origins"] ?? "http://localhost:5173;http://localhost:3000")
    .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options => options.AddPolicy(DevCorsPolicy, policy => policy
    .WithOrigins(corsOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()));

var app = builder.Build();

// ---------------------------------------------------------------------------
// Cria/atualiza o schema e garante os dados iniciais. O compose já espera o
// Postgres ficar saudável; o retry cobre o intervalo até aceitar conexões.
// ---------------------------------------------------------------------------
await PrepareDatabaseAsync(app);

app.UseExceptionHandler();
app.UseCors(DevCorsPolicy);

app.UseSwagger();
app.UseSwaggerUI(options => options.SwaggerEndpoint("/swagger/v1/swagger.json", "Controle de Gastos API v1"));

app.MapControllers();

app.MapGet("/health", async (AppDbContext db, CancellationToken ct) =>
{
    var healthy = await db.Database.CanConnectAsync(ct);
    return healthy
        ? Results.Ok(new { status = "healthy" })
        : Results.Json(new { status = "unhealthy" }, statusCode: StatusCodes.Status503ServiceUnavailable);
}).ExcludeFromDescription();

app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();

app.Run();

static async Task PrepareDatabaseAsync(WebApplication app)
{
    var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");
    const int maxAttempts = 12;

    for (var attempt = 1; attempt <= maxAttempts; attempt++)
    {
        try
        {
            using var scope = app.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // Sem migrations no projeto, o schema é criado direto a partir do modelo.
            // Assim que o primeiro `dotnet ef migrations add` for gerado, a aplicação
            // passa a usar migrations automaticamente — nada mais muda aqui.
            if (db.Database.GetMigrations().Any())
            {
                await db.Database.MigrateAsync();
            }
            else
            {
                await db.Database.EnsureCreatedAsync();
                // EnsureCreated ignora banco já existente: completa o que faltar.
                await SchemaUpdates.ApplyAsync(db);
            }

            await DbSeeder.SeedAsync(db);

            logger.LogInformation("Banco pronto (schema garantido e dados iniciais carregados).");
            return;
        }
        catch (Exception ex) when (attempt < maxAttempts)
        {
            logger.LogWarning("Banco indisponível (tentativa {Attempt}/{Max}): {Message}",
                attempt, maxAttempts, ex.Message);
            await Task.Delay(TimeSpan.FromSeconds(3));
        }
    }
}
