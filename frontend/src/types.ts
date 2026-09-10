export type PlanStep = 'Entradas' | 'Alocacao' | 'Saidas' | 'Concluido';

export const STEP_ORDER: PlanStep[] = ['Entradas', 'Alocacao', 'Saidas', 'Concluido'];

export const STEP_NUMBER: Record<PlanStep, number> = {
  Entradas: 1,
  Alocacao: 2,
  Saidas: 3,
  Concluido: 4
};

export const STEP_LABEL: Record<PlanStep, string> = {
  Entradas: 'Entradas',
  Alocacao: 'Distribuição',
  Saidas: 'Gastos previstos',
  Concluido: 'Resumo'
};

export interface Category {
  id: number;
  name: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  expenseSourceCount: number;
}

export interface IncomeSource {
  id: number;
  name: string;
  isActive: boolean;
}

export interface ExpenseSource {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  isActive: boolean;
}

export interface Goal {
  id: number;
  name: string;
  targetAmount: number;
  targetYear: number;
  targetMonth: number;
  targetLabel: string;
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  isActive: boolean;
  /** Soma de todos os aportes já lançados para a meta. */
  contributedAmount: number;
  remainingAmount: number;
  progressPercent: number;
  /** Meses até o prazo, contando o atual. Zero quando o prazo já passou. */
  monthsRemaining: number;
  suggestedMonthlyAmount: number;
  isAchieved: boolean;
  isLate: boolean;
}

export interface GoalInput {
  name: string;
  targetAmount: number;
  targetYear: number;
  targetMonth: number;
  categoryId: number;
  isActive?: boolean;
}

export interface PlannedGoal {
  goalId: number;
  goalName: string;
  categoryId: number;
  amount: number;
  targetAmount: number;
  targetLabel: string;
  contributedAmount: number;
  progressPercent: number;
}

/** Um mês já composto (padrão do período + ajustes daquele mês) pronto para gravar. */
export interface BatchMonthPayload {
  year: number;
  month: number;
  incomes: { incomeSourceId: number; amount: number }[];
  allocations: { categoryId: number; percentage: number }[];
  expenses: { expenseSourceId: number; amount: number }[];
  goalContributions: { goalId: number; amount: number }[];
}

export interface ApplyPlanBatchResult {
  updatedCount: number;
  createdCount: number;
  plans: PlanSummary[];
}

export interface CreatePlanRangeResult {
  createdCount: number;
  skippedCount: number;
  created: PlanSummary[];
  /** Meses do intervalo que já tinham planejamento e foram preservados. */
  skippedMonths: string[];
}

export interface PlanSummary {
  id: number;
  year: number;
  month: number;
  label: string;
  step: PlanStep;
  totalIncome: number;
  totalAllocatedPercentage: number;
  totalPlannedExpense: number;
  balance: number;
  updatedAt: string;
}

export interface PlannedIncome {
  incomeSourceId: number;
  incomeSourceName: string;
  amount: number;
}

export interface PlannedExpense {
  expenseSourceId: number;
  expenseSourceName: string;
  categoryId: number;
  categoryName: string;
  amount: number;
}

export interface CategoryBreakdown {
  categoryId: number;
  categoryName: string;
  color: string;
  percentage: number;
  budget: number;
  /** Total comprometido: fontes de saída + aportes em metas. */
  plannedExpense: number;
  /** Só a parte dos aportes em metas. */
  plannedGoals: number;
  difference: number;
  expenses: PlannedExpense[];
  goals: PlannedGoal[];
}

export interface MonthOverview {
  month: number;
  monthName: string;
  shortName: string;
  hasPlan: boolean;
  planId: number | null;
  step: PlanStep | null;
  plannedIncome: number;
  /** Já inclui os aportes em metas. */
  plannedExpense: number;
  goalContribution: number;
  balance: number;
}

export interface CategoryYearTotal {
  categoryId: number;
  categoryName: string;
  color: string;
  plannedExpense: number;
  shareOfExpense: number;
  monthlyAverage: number;
}

export interface YearOverview {
  year: number;
  availableYears: number[];
  plannedMonths: number;
  totalIncome: number;
  totalExpense: number;
  totalBalance: number;
  averageMonthlyIncome: number;
  averageMonthlyExpense: number;
  averageMonthlyBalance: number;
  highestExpenseMonthAmount: number;
  highestExpenseMonthName: string | null;
  totalGoalContribution: number;
  months: MonthOverview[];
  categories: CategoryYearTotal[];
  goals: Goal[];
}

export interface PlanDetail {
  id: number;
  year: number;
  month: number;
  label: string;
  step: PlanStep;
  notes?: string | null;
  incomes: PlannedIncome[];
  totalIncome: number;
  categories: CategoryBreakdown[];
  totalAllocatedPercentage: number;
  unallocatedPercentage: number;
  unallocatedAmount: number;
  totalPlannedExpense: number;
  totalGoalContribution: number;
  balance: number;
  createdAt: string;
  updatedAt: string;
}
