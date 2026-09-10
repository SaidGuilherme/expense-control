using ControleGastos.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace ControleGastos.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<IncomeSource> IncomeSources => Set<IncomeSource>();
    public DbSet<ExpenseSource> ExpenseSources => Set<ExpenseSource>();
    public DbSet<MonthlyPlan> MonthlyPlans => Set<MonthlyPlan>();
    public DbSet<PlannedIncome> PlannedIncomes => Set<PlannedIncome>();
    public DbSet<CategoryAllocation> CategoryAllocations => Set<CategoryAllocation>();
    public DbSet<PlannedExpense> PlannedExpenses => Set<PlannedExpense>();
    public DbSet<Goal> Goals => Set<Goal>();
    public DbSet<GoalContribution> GoalContributions => Set<GoalContribution>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Category>(e =>
        {
            e.ToTable("categories");
            e.Property(x => x.Name).HasMaxLength(80).IsRequired();
            e.Property(x => x.Color).HasMaxLength(9).IsRequired();
            e.HasIndex(x => x.Name).IsUnique();
        });

        b.Entity<IncomeSource>(e =>
        {
            e.ToTable("income_sources");
            e.Property(x => x.Name).HasMaxLength(80).IsRequired();
            e.HasIndex(x => x.Name).IsUnique();
        });

        b.Entity<ExpenseSource>(e =>
        {
            e.ToTable("expense_sources");
            e.Property(x => x.Name).HasMaxLength(80).IsRequired();
            e.HasIndex(x => new { x.CategoryId, x.Name }).IsUnique();
            e.HasOne(x => x.Category)
                .WithMany(c => c.ExpenseSources)
                .HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<MonthlyPlan>(e =>
        {
            e.ToTable("monthly_plans");
            e.Property(x => x.Notes).HasMaxLength(500);
            e.HasIndex(x => new { x.Year, x.Month }).IsUnique();
        });

        b.Entity<PlannedIncome>(e =>
        {
            e.ToTable("planned_incomes");
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.HasIndex(x => new { x.MonthlyPlanId, x.IncomeSourceId }).IsUnique();
            e.HasOne(x => x.MonthlyPlan)
                .WithMany(p => p.Incomes)
                .HasForeignKey(x => x.MonthlyPlanId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.IncomeSource)
                .WithMany(s => s.PlannedIncomes)
                .HasForeignKey(x => x.IncomeSourceId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<CategoryAllocation>(e =>
        {
            e.ToTable("category_allocations");
            e.Property(x => x.Percentage).HasPrecision(6, 2);
            e.HasIndex(x => new { x.MonthlyPlanId, x.CategoryId }).IsUnique();
            e.HasOne(x => x.MonthlyPlan)
                .WithMany(p => p.Allocations)
                .HasForeignKey(x => x.MonthlyPlanId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Category)
                .WithMany(c => c.Allocations)
                .HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Goal>(e =>
        {
            e.ToTable("goals");
            e.Property(x => x.Name).HasMaxLength(80).IsRequired();
            e.Property(x => x.TargetAmount).HasPrecision(18, 2);
            e.HasIndex(x => x.Name).IsUnique();
            e.HasOne(x => x.Category)
                .WithMany()
                .HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<GoalContribution>(e =>
        {
            e.ToTable("goal_contributions");
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.HasIndex(x => new { x.MonthlyPlanId, x.GoalId }).IsUnique();
            e.HasOne(x => x.MonthlyPlan)
                .WithMany(p => p.GoalContributions)
                .HasForeignKey(x => x.MonthlyPlanId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Goal)
                .WithMany(g => g.Contributions)
                .HasForeignKey(x => x.GoalId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<PlannedExpense>(e =>
        {
            e.ToTable("planned_expenses");
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.HasIndex(x => new { x.MonthlyPlanId, x.ExpenseSourceId }).IsUnique();
            e.HasOne(x => x.MonthlyPlan)
                .WithMany(p => p.Expenses)
                .HasForeignKey(x => x.MonthlyPlanId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.ExpenseSource)
                .WithMany(s => s.PlannedExpenses)
                .HasForeignKey(x => x.ExpenseSourceId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
