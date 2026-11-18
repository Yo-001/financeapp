/**
 * monthlyHistory é derivado de expenses — não é mais persistido.
 * Mesmo agrupamento/arredondamento do código antigo, para que a comparação com
 * a chave legada "monthlyHistory" seja exata.
 */
export function historyFromExpenses(expenses, months = 15) {
  const groups = new Map();

  for (const expense of Array.isArray(expenses) ? expenses : []) {
    const value = Number(expense?.value);
    const date = new Date(expense?.date);
    if (!Number.isFinite(value) || Number.isNaN(date.getTime())) continue;

    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${month}`;
    const entry = groups.get(key) ?? { year, month, total: 0, paid: 0, pending: 0 };

    entry.total += value;
    if (expense.paid) entry.paid += value;
    else entry.pending += value;
    groups.set(key, entry);
  }

  return [...groups.values()]
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .slice(-Math.max(months, 1))
    .map((item) => ({
      year: item.year,
      month: item.month,
      total: Math.round(item.total),
      paid: Math.round(item.paid),
      pending: Math.round(item.pending),
    }));
}
