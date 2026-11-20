import React, { useMemo, useState } from "react";
import {
  Check,
  Hand,
  Plus,
  Repeat,
  Rocket,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import BottomSheet from "../components/BottomSheet";
import {
  CATEGORIES,
  formatCurrency,
  getCategoryIcon,
  guessCategory,
  MONTHS,
} from "../services/categories";
import { getWeekForDate } from "../services/enableBanking";

const now = new Date();
const nextId = () => Date.now();

export default function Transactions({
  expenses = [],
  setExpenses,
  fixedExpenses = [],
  setFixedExpenses,
  merchantRules = {},
  setMerchantRules,
}) {
  const [viewMode, setViewMode] = useState("mensal");
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(
    String(now.getMonth() + 1)
  );
  const [selectedWeek, setSelectedWeek] = useState("todas");
  const [showFilters, setShowFilters] = useState(false);
  const [showFixedModal, setShowFixedModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [swipeState, setSwipeState] = useState(null);

  const [newForm, setNewForm] = useState({
    name: "",
    value: "",
    paid: "pendente",
    week: "1",
    category: "",
    date: "",
  });

  const [fixedForm, setFixedForm] = useState({
    name: "",
    value: "",
    week: "1",
    category: "",
  });

  const availableYears = useMemo(() => {
    const years = new Set(expenses.map((e) => e.date.slice(0, 4)));
    years.add(String(now.getFullYear()));
    return [...years].sort();
  }, [expenses]);

  const yearMonthKey = `${selectedYear}-${selectedMonth.padStart(2, "0")}`;

  const filteredExpenses = useMemo(
    () =>
      expenses
        .filter(
          (e) =>
            (e.date || "").startsWith(yearMonthKey) &&
            (selectedWeek === "todas" ||
              (e.week || getWeekForDate(e.date)) === selectedWeek)
        )
        .sort((a, b) => (a.date || "").localeCompare(b.date || "")),
    [expenses, yearMonthKey, selectedWeek]
  );

  const totalAmount = filteredExpenses.reduce(
    (sum, e) => sum + Number(e.value || 0),
    0
  );
  const paidAmount = filteredExpenses
    .filter((e) => e.paid)
    .reduce((sum, e) => sum + Number(e.value || 0), 0);
  const pendingAmount = totalAmount - paidAmount;

  const weeklySummary = useMemo(() => {
    const weeks = [1, 2, 3, 4].map((w) => ({
      week: w,
      pago: 0,
      pendente: 0,
      total: 0,
    }));
    filteredExpenses.forEach((e) => {
      const idx = parseInt(e.week || getWeekForDate(e.date), 10) - 1;
      if (idx >= 0 && idx < 4) {
        const val = Number(e.value || 0);
        weeks[idx].total += val;
        if (e.paid) {
          weeks[idx].pago += val;
        } else {
          weeks[idx].pendente += val;
        }
      }
    });
    return weeks;
  }, [filteredExpenses]);

  const suggestCategory = (name) =>
    name.trim().length > 2 ? guessCategory(name, merchantRules) : "";

  const openAddModal = () => {
    setNewForm({
      name: "",
      value: "",
      paid: "pendente",
      week: "1",
      category: "",
      date: "",
    });
    setShowAddModal(true);
  };

  const addExpense = () => {
    const val = parseFloat(String(newForm.value).replace(",", "."));
    if (!newForm.name.trim() || Number.isNaN(val) || val <= 0) return;

    const category =
      newForm.category || suggestCategory(newForm.name) || "Outros";

    setExpenses([
      ...expenses,
      {
        id: nextId(),
        name: newForm.name.trim(),
        value: val,
        date: newForm.date || `${yearMonthKey}-01`,
        category,
        paid: newForm.paid === "pago",
        week: newForm.week,
        source: "manual",
      },
    ]);
    setShowAddModal(false);
  };

  const openEditModal = (expense) => {
    setEditingExpense({
      ...expense,
      value: String(expense.value),
    });
  };

  const saveEditExpense = () => {
    const val = parseFloat(String(editingExpense.value).replace(",", "."));
    if (!editingExpense.name.trim() || Number.isNaN(val) || val <= 0) return;

    const original = expenses.find((item) => item.id === editingExpense.id);
    const categoryChanged = editingExpense.category !== original?.category;
    const isImported =
      editingExpense.source === "bank" || editingExpense.source === "import";

    if (categoryChanged && isImported && editingExpense.name.trim()) {
      setMerchantRules({
        ...merchantRules,
        [editingExpense.name.trim()]: editingExpense.category || "Outros",
      });
    }

    setExpenses(
      expenses.map((item) =>
        item.id === editingExpense.id
          ? {
              ...editingExpense,
              value: val,
              paid:
                editingExpense.paid === true || editingExpense.paid === "pago",
            }
          : item
      )
    );
    setEditingExpense(null);
  };

  const addFixedExpense = () => {
    const val = parseFloat(String(fixedForm.value).replace(",", "."));
    if (!fixedForm.name.trim() || Number.isNaN(val) || val <= 0) return;

    setFixedExpenses([
      ...fixedExpenses,
      {
        id: nextId(),
        name: fixedForm.name.trim(),
        value: val,
        week: fixedForm.week,
        category: fixedForm.category || "Mensalidades",
      },
    ]);
    setFixedForm({ name: "", value: "", week: "1", category: "" });
  };

  const launchFixedForMonth = () => {
    if (fixedExpenses.length === 0) {
      setShowFixedModal(true);
      return;
    }

    const candidates = fixedExpenses.map((item) => ({
      id: `${nextId()}-${Math.random().toString(36).slice(2, 7)}`,
      name: item.name,
      value: Number(item.value),
      date: `${yearMonthKey}-01`,
      category: item.category || "Mensalidades",
      paid: false,
      week: item.week || "1",
      source: "manual",
    }));

    const existingNames = new Set(
      expenses
        .filter((e) => e.date.startsWith(yearMonthKey))
        .map((e) => e.name.trim().toLowerCase())
    );

    const toAdd = candidates.filter(
      (item) => !existingNames.has(item.name.toLowerCase())
    );
    if (toAdd.length !== 0) {
      setExpenses([...expenses, ...toAdd]);
    }
  };

  const deleteExpense = (id) => {
    setExpenses(expenses.filter((e) => e.id !== id));
    setSwipeState(null);
  };

  const togglePaid = (id) => {
    setExpenses(
      expenses.map((e) => (e.id === id ? { ...e, paid: !e.paid } : e))
    );
    setSwipeState(null);
  };

  const onTouchStart = (e, id) => {
    const touch = e.touches[0];
    setSwipeState({ id, startX: touch.clientX, currentX: touch.clientX });
  };

  const onTouchMove = (e, id) => {
    if (!swipeState || swipeState.id !== id) return;
    const touch = e.touches[0];
    setSwipeState({ ...swipeState, currentX: touch.clientX });
  };

  const onTouchEnd = (_, expense) => {
    if (!swipeState || swipeState.id !== expense.id) return;
    const delta = swipeState.currentX - swipeState.startX;
    if (Math.abs(delta) > 100) {
      if (delta > 0) {
        deleteExpense(expense.id);
      } else {
        togglePaid(expense.id);
      }
    }
    setSwipeState(null);
  };

  const getSwipeOffset = (id) => {
    if (!swipeState || swipeState.id !== id) return 0;
    return Math.max(-120, Math.min(120, swipeState.currentX - swipeState.startX));
  };

  const periodLabel = `${MONTHS[parseInt(selectedMonth, 10) - 1]} ${selectedYear}`;

  return (
    <div className="page-top">
      <div className="flex justify-between items-center">
        <h1 className="text-[22px] font-semibold tracking-tight">Período</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(true)}
            className="p-2.5 bg-raised border border-hairline rounded-full transition hover:bg-accent-soft"
            aria-label="Filtros"
          >
            <SlidersHorizontal className="w-4 h-4 text-soft" />
          </button>
          <button
            onClick={() => setShowFixedModal(true)}
            className="p-2.5 bg-raised border border-hairline rounded-full transition hover:bg-accent-soft"
            aria-label="Gastos fixos"
          >
            <Repeat className="w-4 h-4 text-soft" />
          </button>
        </div>
      </div>

      <div className="flex bg-hairline/60 rounded-2xl p-1 mt-4">
        {["mensal", "semanal"].map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`seg ${
              viewMode === mode ? "bg-raised text-ink" : "text-soft"
            }`}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      {viewMode === "semanal" ? (
        <div className="mt-5 space-y-3">
          {weeklySummary.map((w) => {
            const pct = w.total > 0 ? (w.pago / w.total) * 100 : 0;
            return (
              <div key={w.week} className="card px-5 py-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold">{w.week}ª semana</h4>
                  <span className="text-lg font-semibold tnum">
                    {formatCurrency(w.total)}
                  </span>
                </div>
                <div className="h-1 bg-canvas rounded-full mt-3 overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{
                      width: `${Math.max(pct, w.pago > 0 ? 3 : 0)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-[12px] text-soft">
                  <span>Pago {formatCurrency(w.pago)}</span>
                  <span>Pendente {formatCurrency(w.pendente)}</span>
                </div>
              </div>
            );
          })}
          <p className="text-center text-[12px] text-faint flex items-center justify-center gap-1.5 pt-1">
            <Hand className="w-3.5 h-3.5" /> deslize um gasto à direita para
            apagar, à esquerda para marcar pago
          </p>
        </div>
      ) : (
        <>
          <div className="card mt-5 px-5 py-5">
            <p className="text-[13px] text-soft font-medium">{periodLabel}</p>
            <h3 className="text-[30px] font-semibold tracking-tight tnum mt-0.5">
              {formatCurrency(totalAmount)}
            </h3>
            <div className="flex gap-6 mt-3">
              <div>
                <p className="text-[12px] text-soft">Pago</p>
                <p className="text-sm font-semibold tnum">
                  {formatCurrency(paidAmount)}
                </p>
              </div>
              <div className="w-px bg-hairline" />
              <div>
                <p className="text-[12px] text-soft">Pendente</p>
                <p className="text-sm font-semibold tnum">
                  {formatCurrency(pendingAmount)}
                </p>
              </div>
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="card mt-4 px-6 py-10 text-center">
              <h3 className="font-semibold tracking-tight">
                Nada em {periodLabel}
              </h3>
              <p className="text-sm text-soft mt-1.5 mb-5">
                Lance os gastos fixos ou adicione manualmente.
              </p>
              {fixedExpenses.length > 0 && (
                <button
                  onClick={launchFixedForMonth}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  <Rocket className="w-4 h-4" /> Iniciar mês com gastos fixos (
                  {fixedExpenses.length})
                </button>
              )}
              {fixedExpenses.length === 0 && (
                <button
                  onClick={() => setShowFixedModal(true)}
                  className="btn-secondary"
                >
                  Configurar gastos fixos
                </button>
              )}
            </div>
          ) : (
            <div className="card mt-4 overflow-hidden">
              {filteredExpenses.map((expense) => {
                const Icon = getCategoryIcon(expense.category);
                return (
                  <div
                    key={expense.id}
                    className="relative overflow-hidden border-b border-hairline last:border-0"
                  >
                    <div className="absolute inset-0 flex">
                      <div className="flex-1 bg-danger/90 flex items-center justify-start px-6">
                        <Trash2 className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 bg-ok/90 flex items-center justify-end px-6">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    </div>

                    <div
                      className="bg-surface px-5 py-3.5 flex items-center relative"
                      style={{
                        transform: `translateX(${getSwipeOffset(expense.id)}px)`,
                        transition:
                          swipeState?.id === expense.id
                            ? "none"
                            : "transform 0.25s ease",
                      }}
                      onTouchStart={(e) => onTouchStart(e, expense.id)}
                      onTouchMove={(e) => onTouchMove(e, expense.id)}
                      onTouchEnd={(e) => onTouchEnd(e, expense)}
                      onClick={() => openEditModal(expense)}
                    >
                      <div className="w-10 h-10 bg-canvas rounded-xl flex items-center justify-center mr-3.5 flex-shrink-0">
                        <Icon
                          className="w-[18px] h-[18px] text-soft"
                          strokeWidth={1.8}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[15px] font-medium truncate">
                          {expense.name}
                        </h4>
                        <p className="text-[12px] text-soft">
                          {expense.category || "Outros"}
                          {expense.source === "bank" && " · banco"}
                          {expense.bank && <span> · {expense.bank}</span>}
                          {expense.source === "import" && " · CSV"}
                        </p>
                      </div>
                      <div className="text-right ml-2">
                        <div
                          className={`text-[15px] font-semibold tnum ${
                            expense.paid ? "" : "text-warn"
                          }`}
                        >
                          {formatCurrency(expense.value)}
                        </div>
                        <div className="flex items-center justify-end gap-1 text-[11px] mt-0.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              expense.paid ? "bg-ok" : "bg-warn"
                            }`}
                          />
                          <span className="text-soft">
                            {expense.paid ? "Pago" : "Pendente"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <button
        onClick={openAddModal}
        className="fixed bottom-24 right-5 w-14 h-14 bg-accent rounded-full shadow-lg flex items-center justify-center active:scale-95 transition z-40"
        aria-label="Adicionar gasto"
      >
        <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
      </button>

      <BottomSheet
        open={showAddModal}
        title="Novo gasto"
        onClose={() => setShowAddModal(false)}
      >
        <div className="space-y-3">
          <input
            className="field"
            placeholder="Nome do gasto"
            value={newForm.name}
            onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
          />
          <input
            className="field"
            type="number"
            inputMode="decimal"
            placeholder="Valor (€)"
            value={newForm.value}
            onChange={(e) => setNewForm({ ...newForm, value: e.target.value })}
          />
          <input
            className="field"
            type="date"
            value={newForm.date}
            onChange={(e) => setNewForm({ ...newForm, date: e.target.value })}
          />
          <select
            className="field"
            value={newForm.category}
            onChange={(e) =>
              setNewForm({ ...newForm, category: e.target.value })
            }
          >
            <option value="">
              Categoria
              {suggestCategory(newForm.name)
                ? ` (sugestão: ${suggestCategory(newForm.name)})`
                : ""}
            </option>
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.id}
              </option>
            ))}
          </select>
          <div className="flex gap-3">
            <select
              className="field"
              value={newForm.paid}
              onChange={(e) => setNewForm({ ...newForm, paid: e.target.value })}
            >
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
            </select>
            <select
              className="field"
              value={newForm.week}
              onChange={(e) => setNewForm({ ...newForm, week: e.target.value })}
            >
              {[1, 2, 3, 4].map((w) => (
                <option key={w} value={String(w)}>
                  {w}ª semana
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary mt-2" onClick={addExpense}>
            Salvar gasto
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={!!editingExpense}
        title="Editar gasto"
        onClose={() => setEditingExpense(null)}
      >
        {editingExpense && (
          <div className="space-y-3">
            <input
              className="field"
              placeholder="Nome do gasto"
              value={editingExpense.name}
              onChange={(e) =>
                setEditingExpense({ ...editingExpense, name: e.target.value })
              }
            />
            <input
              className="field"
              type="number"
              inputMode="decimal"
              placeholder="Valor (€)"
              value={editingExpense.value}
              onChange={(e) =>
                setEditingExpense({ ...editingExpense, value: e.target.value })
              }
            />
            <input
              className="field"
              type="date"
              value={editingExpense.date}
              onChange={(e) =>
                setEditingExpense({ ...editingExpense, date: e.target.value })
              }
            />
            <select
              className="field"
              value={editingExpense.category || ""}
              onChange={(e) =>
                setEditingExpense({
                  ...editingExpense,
                  category: e.target.value,
                })
              }
            >
              <option value="">Sem categoria</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.id}
                </option>
              ))}
            </select>
            <div className="flex gap-3">
              <select
                className="field"
                value={
                  editingExpense.paid === true || editingExpense.paid === "pago"
                    ? "pago"
                    : "pendente"
                }
                onChange={(e) =>
                  setEditingExpense({ ...editingExpense, paid: e.target.value })
                }
              >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
              </select>
              <select
                className="field"
                value={editingExpense.week || "1"}
                onChange={(e) =>
                  setEditingExpense({ ...editingExpense, week: e.target.value })
                }
              >
                {[1, 2, 3, 4].map((w) => (
                  <option key={w} value={String(w)}>
                    {w}ª semana
                  </option>
                ))}
              </select>
            </div>
            {(editingExpense.source === "bank" ||
              editingExpense.source === "import") && (
              <p className="text-[12px] text-soft leading-relaxed">
                Ao mudar a categoria deste gasto bancário, a regra é memorizada
                para próximos lançamentos do mesmo comerciante.
              </p>
            )}
            <div className="flex gap-3 mt-2">
              <button
                className="btn-secondary !text-danger flex-1"
                onClick={() => {
                  if (window.confirm("Eliminar este gasto?")) {
                    deleteExpense(editingExpense.id);
                    setEditingExpense(null);
                  }
                }}
              >
                Eliminar
              </button>
              <button className="btn-primary flex-1" onClick={saveEditExpense}>
                Salvar
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        open={showFilters}
        title="Filtros"
        onClose={() => setShowFilters(false)}
      >
        <div className="space-y-4">
          <div>
            <label className="text-[13px] font-medium text-soft mb-1.5 block">
              Ano
            </label>
            <select
              className="field"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[13px] font-medium text-soft mb-1.5 block">
              Mês
            </label>
            <select
              className="field"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {MONTHS.map((label, idx) => (
                <option key={label} value={String(idx + 1)}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[13px] font-medium text-soft mb-1.5 block">
              Semana
            </label>
            <select
              className="field"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
            >
              <option value="todas">Todas as semanas</option>
              {[1, 2, 3, 4].map((w) => (
                <option key={w} value={String(w)}>
                  {w}ª semana
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn-primary"
            onClick={() => setShowFilters(false)}
          >
            Aplicar
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={showFixedModal}
        title="Gastos fixos mensais"
        onClose={() => setShowFixedModal(false)}
      >
        <p className="text-[13px] text-soft leading-relaxed">
          Repetem todo mês. Use &quot;Iniciar mês&quot; no resumo para
          lançá-los de uma vez.
        </p>
        <div className="mt-4">
          {fixedExpenses.map((item) => (
            <div
              key={item.id}
              className="flex items-center py-3 border-b border-hairline last:border-0"
            >
              <div className="flex-1">
                <h4 className="text-sm font-medium">{item.name}</h4>
                <p className="text-[12px] text-soft tnum">
                  {item.category} · {item.week}ª semana ·{" "}
                  {formatCurrency(item.value)}
                </p>
              </div>
              <button
                onClick={() =>
                  setFixedExpenses(
                    fixedExpenses.filter((x) => x.id !== item.id)
                  )
                }
                className="p-2.5 rounded-xl bg-canvas text-faint hover:text-danger transition"
                aria-label="Remover"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {fixedExpenses.length === 0 && (
            <p className="text-center text-sm text-faint py-6">
              Nenhum gasto fixo configurado
            </p>
          )}
        </div>
        <div className="border-t border-hairline mt-2 pt-4 space-y-3">
          <input
            className="field"
            placeholder="Nome (ex.: Aluguel)"
            value={fixedForm.name}
            onChange={(e) =>
              setFixedForm({ ...fixedForm, name: e.target.value })
            }
          />
          <input
            className="field"
            type="number"
            inputMode="decimal"
            placeholder="Valor (€)"
            value={fixedForm.value}
            onChange={(e) =>
              setFixedForm({ ...fixedForm, value: e.target.value })
            }
          />
          <div className="flex gap-3">
            <select
              className="field"
              value={fixedForm.category}
              onChange={(e) =>
                setFixedForm({ ...fixedForm, category: e.target.value })
              }
            >
              <option value="">Categoria</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.id}
                </option>
              ))}
            </select>
            <select
              className="field"
              value={fixedForm.week}
              onChange={(e) =>
                setFixedForm({ ...fixedForm, week: e.target.value })
              }
            >
              {[1, 2, 3, 4].map((w) => (
                <option key={w} value={String(w)}>
                  {w}ª semana
                </option>
              ))}
            </select>
          </div>
          <button className="btn-secondary" onClick={addFixedExpense}>
            Adicionar à lista
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
