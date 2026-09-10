import type {
  Category,
  ExpenseSource,
  Goal,
  IncomeSource,
  PlanDetail,
  PlannedExpense,
  PlannedGoal
} from '../types';

export type Draft = Record<number, number>;

/** Os quatro rascunhos de um alvo do assistente (o padrão do período ou um mês). */
export interface DraftSet {
  income: Draft;
  allocation: Draft;
  expense: Draft;
  goal: Draft;
}

export const emptyDrafts = (): DraftSet => ({ income: {}, allocation: {}, expense: {}, goal: {} });

export const cloneDrafts = (drafts: DraftSet): DraftSet => ({
  income: { ...drafts.income },
  allocation: { ...drafts.allocation },
  expense: { ...drafts.expense },
  goal: { ...drafts.goal }
});

export const sumDraft = (draft: Draft) =>
  Object.values(draft).reduce((total, value) => total + (value || 0), 0);

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Rascunhos a partir de um mês já gravado — semeia o padrão e o "manter atual". */
export function draftsFromDetail(detail: PlanDetail): DraftSet {
  const drafts = emptyDrafts();

  detail.incomes.forEach((income) => (drafts.income[income.incomeSourceId] = income.amount));
  detail.categories.forEach((category) => {
    drafts.allocation[category.categoryId] = category.percentage;
    category.expenses.forEach((expense) => (drafts.expense[expense.expenseSourceId] = expense.amount));
    category.goals.forEach((goal) => (drafts.goal[goal.goalId] = goal.amount));
  });

  return drafts;
}

interface Catalogs {
  categories: Category[];
  incomeSources: IncomeSource[];
  expenseSources: ExpenseSource[];
  goals: Goal[];
}

/**
 * Monta, a partir dos rascunhos, o mesmo formato que a API devolve para um mês.
 * É o que permite reaproveitar a tela de resumo no assistente de período, onde
 * nada foi gravado ainda.
 */
export function composePreview(
  drafts: DraftSet,
  catalogs: Catalogs,
  label: string,
  year: number,
  month: number
): PlanDetail {
  const { categories, incomeSources, expenseSources, goals } = catalogs;

  const incomes = incomeSources
    .filter((source) => (drafts.income[source.id] ?? 0) > 0)
    .map((source) => ({
      incomeSourceId: source.id,
      incomeSourceName: source.name,
      amount: drafts.income[source.id] ?? 0
    }))
    .sort((a, b) => b.amount - a.amount);

  const totalIncome = round2(incomes.reduce((total, income) => total + income.amount, 0));

  const breakdown = categories
    .map((category) => {
      const percentage = drafts.allocation[category.id] ?? 0;
      const budget = round2((totalIncome * percentage) / 100);

      const categoryExpenses: PlannedExpense[] = expenseSources
        .filter((source) => source.categoryId === category.id && (drafts.expense[source.id] ?? 0) > 0)
        .map((source) => ({
          expenseSourceId: source.id,
          expenseSourceName: source.name,
          categoryId: category.id,
          categoryName: category.name,
          amount: drafts.expense[source.id] ?? 0
        }))
        .sort((a, b) => b.amount - a.amount);

      const categoryGoals: PlannedGoal[] = goals
        .filter((goal) => goal.categoryId === category.id && (drafts.goal[goal.id] ?? 0) > 0)
        .map((goal) => ({
          goalId: goal.id,
          goalName: goal.name,
          categoryId: category.id,
          amount: drafts.goal[goal.id] ?? 0,
          targetAmount: goal.targetAmount,
          targetLabel: goal.targetLabel,
          contributedAmount: goal.contributedAmount,
          progressPercent: goal.progressPercent
        }))
        .sort((a, b) => b.amount - a.amount);

      const plannedGoals = round2(categoryGoals.reduce((total, goal) => total + goal.amount, 0));
      const plannedExpense = round2(
        categoryExpenses.reduce((total, expense) => total + expense.amount, 0) + plannedGoals
      );

      return {
        categoryId: category.id,
        categoryName: category.name,
        color: category.color,
        percentage,
        budget,
        plannedExpense,
        plannedGoals,
        difference: round2(budget - plannedExpense),
        expenses: categoryExpenses,
        goals: categoryGoals
      };
    })
    .filter((category) => category.percentage > 0 || category.plannedExpense > 0)
    .sort((a, b) => b.percentage - a.percentage || b.plannedExpense - a.plannedExpense);

  const totalAllocatedPercentage = round2(
    breakdown.reduce((total, category) => total + category.percentage, 0)
  );
  const unallocatedPercentage = Math.max(0, round2(100 - totalAllocatedPercentage));
  const totalPlannedExpense = round2(
    breakdown.reduce((total, category) => total + category.plannedExpense, 0)
  );

  return {
    id: 0,
    year,
    month,
    label,
    step: 'Concluido',
    notes: null,
    incomes,
    totalIncome,
    categories: breakdown,
    totalAllocatedPercentage,
    unallocatedPercentage,
    unallocatedAmount: round2((totalIncome * unallocatedPercentage) / 100),
    totalPlannedExpense,
    totalGoalContribution: round2(
      breakdown.reduce((total, category) => total + category.plannedGoals, 0)
    ),
    balance: round2(totalIncome - totalPlannedExpense),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/** Converte os rascunhos de um mês no corpo que o endpoint de lote espera. */
export function toBatchMonth(drafts: DraftSet, year: number, month: number) {
  const entries = (draft: Draft) =>
    Object.entries(draft).filter(([, amount]) => (amount || 0) > 0);

  return {
    year,
    month,
    incomes: entries(drafts.income).map(([id, amount]) => ({
      incomeSourceId: Number(id),
      amount
    })),
    allocations: entries(drafts.allocation).map(([id, percentage]) => ({
      categoryId: Number(id),
      percentage
    })),
    expenses: entries(drafts.expense).map(([id, amount]) => ({
      expenseSourceId: Number(id),
      amount
    })),
    goalContributions: entries(drafts.goal).map(([id, amount]) => ({
      goalId: Number(id),
      amount
    }))
  };
}
