import React, { useMemo, useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronRight,
  Plus,
  Repeat,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  XAxis,
} from "recharts";
import BottomSheet from "../components/BottomSheet";
import {
  formatCurrency,
  getCategoryIcon,
  MONTHS,
} from "../services/categories";

const now = new Date();
const normalizeName = (str) => (str || "").trim().toLowerCase();
const nextId = () => Date.now();

export default function Home({
  expenses = [],
  fixedExpenses = [],
  setFixedExpenses,
  setActiveTab,
}) {
  const [showManageFixed, setShowManageFixed] = useState(false);
  const [fixedModalMode, setFixedModalMode] = useState(null);
  const [editingFixedId, setEditingFixedId] = useState(null);
  const [fixedName, setFixedName] = useState("");
  const [fixedValue, setFixedValue] = useState("");
  const [fixedDay, setFixedDay] = useState("");

  const currentMonthKey = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;

  const monthExpenses = useMemo(
    () => expenses.filter((e) => e.date.startsWith(currentMonthKey)),
    [expenses, currentMonthKey]
  );

  const monthTotal = monthExpenses.reduce(
    (sum, e) => sum + Number(e.value || 0),
    0
  );
  const monthPaid = monthExpenses
    .filter((e) => e.paid)
    .reduce((sum, e) => sum + Number(e.value || 0), 0);
  const monthPending = monthTotal - monthPaid;

  const last6Months = useMemo(() => {
    const data = [];
    const base = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let offset = 5; offset >= 0; offset--) {
      const d = new Date(base.getFullYear(), base.getMonth() - offset, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      const total = expenses
        .filter((e) => e.date.startsWith(key))
        .reduce((sum, e) => sum + Number(e.value || 0), 0);
      data.push({
        name: MONTHS[d.getMonth()].slice(0, 3),
        label: `${MONTHS[d.getMonth()]} de ${d.getFullYear()}`,
        value: total,
      });
    }
    return data;
  }, [expenses]);

  const [selectedBarIndex, setSelectedBarIndex] = useState(5);

  const topCategories = useMemo(() => {
    const totals = {};
    monthExpenses.forEach((e) => {
      const cat = e.category || "Outros";
      totals[cat] = (totals[cat] || 0) + Number(e.value || 0);
    });
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, value]) => ({
        id,
        value,
        pct: monthTotal ? (value / monthTotal) * 100 : 0,
      }));
  }, [monthExpenses, monthTotal]);

  const { fixedTotal, fixedPaid } = useMemo(() => {
    let total = 0;
    let paid = 0;
    fixedExpenses.forEach((f) => {
      const val = Number(f.value || 0);
      total += val;
      if (
        monthExpenses.find(
          (e) => normalizeName(e.name) === normalizeName(f.name)
        )?.paid
      ) {
        paid += val;
      }
    });
    return { fixedTotal: total, fixedPaid: paid };
  }, [fixedExpenses, monthExpenses]);

  const prevMonthKey = (() => {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
  })();

  const prevMonthTotal = expenses
    .filter((e) => e.date.startsWith(prevMonthKey))
    .reduce((sum, e) => sum + Number(e.value || 0), 0);

  const pctDiff =
    prevMonthTotal > 0
      ? ((monthTotal - prevMonthTotal) / prevMonthTotal) * 100
      : null;

  const openFixedEditor = (item) => {
    setEditingFixedId(item?.id ?? null);
    setFixedModalMode(item ? "edit" : "add");
    setFixedName(item?.name || "");
    setFixedValue(item ? String(item.value) : "");
    setFixedDay(item?.day ? String(item.day) : "");
  };

  const saveFixed = () => {
    const val = parseFloat(fixedValue.replace(",", "."));
    if (!fixedName.trim() || Number.isNaN(val) || val <= 0) return;

    setFixedExpenses(
      editingFixedId
        ? fixedExpenses.map((item) =>
            item.id === editingFixedId
              ? {
                  ...item,
                  name: fixedName.trim(),
                  value: val,
                  day: fixedDay ? parseInt(fixedDay, 10) : null,
                }
              : item
          )
        : [
            ...fixedExpenses,
            {
              id: nextId(),
              name: fixedName.trim(),
              value: val,
              category: "Mensalidades",
              day: fixedDay ? parseInt(fixedDay, 10) : null,
            },
          ]
    );
    setFixedModalMode(null);
  };

  return (
    <div className="page-top">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] text-soft font-medium">
            {MONTHS[now.getMonth()]} de {now.getFullYear()}
          </p>
          <h1 className="text-[34px] leading-tight font-bold tracking-tight tnum mt-1">
            {formatCurrency(monthTotal)}
          </h1>
          <p className="text-[13px] text-soft mt-0.5">
            gastos no mês
            {pctDiff !== null && (
              <span className={pctDiff > 0 ? " text-danger" : " text-ok"}>
                {" "}
                · {pctDiff > 0 ? "↑" : "↓"} {Math.abs(pctDiff).toFixed(0)}% vs.
                mês anterior
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setActiveTab("periodo")}
          className="mt-1 p-2.5 bg-raised border border-hairline rounded-full hover:bg-accent-soft transition"
          aria-label="Ver transações"
        >
          <ChevronRight className="w-4 h-4 text-soft" />
        </button>
      </div>

      <div className="card mt-5 px-5 py-4">
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-soft flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" /> Pago
          </span>
          <span className="text-sm font-semibold tnum">
            {formatCurrency(monthPaid)}
          </span>
        </div>
        <div className="h-px bg-hairline" />
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-soft flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-hairline ring-1 ring-faint" />{" "}
            Pendente
          </span>
          <span className="text-sm font-semibold tnum">
            {formatCurrency(monthPending)}
          </span>
        </div>
      </div>

      <div className="card mt-4 px-5 py-4">
        <h2 className="text-sm font-semibold tracking-tight">Últimos meses</h2>
        <div className="h-36 mt-3 -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last6Months} barCategoryGap="30%">
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#A99A87" }}
              />
              <defs>
                <linearGradient id="barActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFA33D" />
                  <stop offset="100%" stopColor="#8A4A15" />
                </linearGradient>
              </defs>
              <Bar
                dataKey="value"
                radius={[6, 6, 0, 0]}
                maxBarSize={26}
                style={{ cursor: "pointer" }}
                onClick={(_, index) => setSelectedBarIndex(index)}
              >
                {last6Months.map((_, index) => (
                  <Cell
                    key={index}
                    fill={
                      index === selectedBarIndex ? "url(#barActive)" : "#443627"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p
          className="text-[12px] text-soft mt-2.5 tnum"
          aria-live="polite"
        >
          {last6Months[selectedBarIndex].label} ·{" "}
          <span className="text-ink font-semibold">
            {formatCurrency(last6Months[selectedBarIndex].value)}
          </span>
        </p>
      </div>

      <div className="card mt-4 px-5 py-4">
        <h2 className="text-sm font-semibold tracking-tight mb-2">
          Categorias do mês
        </h2>
        {topCategories.length === 0 && (
          <p className="text-sm text-faint py-3">
            Sem gastos registrados este mês.
          </p>
        )}
        {topCategories.map(({ id, value, pct }) => {
          const Icon = getCategoryIcon(id);
          return (
            <div key={id} className="py-2.5">
              <div className="flex justify-between items-center">
                <span className="text-sm flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-soft" strokeWidth={1.8} />
                  {id}
                </span>
                <span className="text-sm font-semibold tnum">
                  {formatCurrency(value)}
                </span>
              </div>
              <div className="h-1 bg-canvas rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="card mt-4 px-5 py-4">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-semibold tracking-tight">
            Despesas fixas
          </h2>
          <span className="text-[13px] tnum text-soft">
            {formatCurrency(fixedPaid)} / {formatCurrency(fixedTotal)}
          </span>
        </div>
        <div className="h-1.5 bg-canvas rounded-full mt-3 overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all"
            style={{
              width: `${fixedTotal ? (fixedPaid / fixedTotal) * 100 : 0}%`,
            }}
          />
        </div>
        <div className="mt-3 -mx-2">
          {fixedExpenses.slice(0, 4).map((item) => {
            const isPaid = monthExpenses.some(
              (e) => normalizeName(e.name) === normalizeName(item.name) && e.paid
            );
            return (
              <button
                key={item.id}
                onClick={() => openFixedEditor(item)}
                className="w-full flex justify-between items-center px-2 py-2.5 text-left hover:bg-canvas rounded-xl transition"
              >
                <span className="text-sm text-soft flex items-center gap-2.5">
                  {isPaid ? (
                    <Check className="w-4 h-4 text-ok" strokeWidth={2.5} />
                  ) : (
                    <CalendarClock
                      className="w-4 h-4 text-faint"
                      strokeWidth={1.8}
                    />
                  )}
                  {item.name}
                </span>
                <span className="text-sm font-medium tnum">
                  {formatCurrency(item.value)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setShowManageFixed(true)}
            className="flex-1 py-2.5 border border-hairline rounded-xl text-[13px] font-semibold text-soft flex items-center justify-center gap-1.5 hover:bg-canvas transition"
          >
            <Repeat className="w-3.5 h-3.5" /> Gerenciar ({fixedExpenses.length})
          </button>
          <button
            onClick={() => openFixedEditor(null)}
            className="flex-1 py-2.5 bg-accent-soft rounded-xl text-[13px] font-semibold text-accent-dark flex items-center justify-center gap-1.5 hover:brightness-95 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        </div>
      </div>

      <BottomSheet
        open={fixedModalMode !== null}
        title={
          fixedModalMode === "edit"
            ? "Editar despesa fixa"
            : "Nova despesa fixa"
        }
        onClose={() => setFixedModalMode(null)}
      >
        <div className="space-y-3">
          <input
            className="field"
            placeholder="Nome (ex.: Aluguel)"
            value={fixedName}
            onChange={(e) => setFixedName(e.target.value)}
          />
          <input
            className="field"
            type="number"
            inputMode="decimal"
            placeholder="Valor (€)"
            value={fixedValue}
            onChange={(e) => setFixedValue(e.target.value)}
          />
          <input
            className="field"
            type="number"
            inputMode="numeric"
            placeholder="Dia do mês (opcional)"
            value={fixedDay}
            onChange={(e) => setFixedDay(e.target.value)}
          />
          <button className="btn-primary mt-2" onClick={saveFixed}>
            Salvar
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={showManageFixed}
        title={`Despesas fixas (${fixedExpenses.length})`}
        onClose={() => setShowManageFixed(false)}
      >
        {fixedExpenses.length === 0 && (
          <p className="text-sm text-faint py-4 text-center">
            Nenhuma despesa fixa. Adicione aluguel, assinaturas, etc.
          </p>
        )}
        {fixedExpenses.map((item) => (
          <div
            key={item.id}
            className="flex justify-between items-center py-3 border-b border-hairline last:border-0"
          >
            <button
              className="flex-1 text-left"
              onClick={() => {
                setShowManageFixed(false);
                openFixedEditor(item);
              }}
            >
              <p className="text-sm font-medium">
                {item.name}{" "}
                {item.day ? (
                  <span className="text-faint">· dia {item.day}</span>
                ) : null}
              </p>
              <p className="text-[13px] tnum text-soft">
                {formatCurrency(item.value)}
              </p>
            </button>
            <button
              onClick={() =>
                setFixedExpenses(fixedExpenses.filter((x) => x.id !== item.id))
              }
              className="p-2.5 rounded-xl bg-canvas text-faint hover:text-danger transition"
              aria-label="Remover"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </BottomSheet>

      <p className="text-center text-[12px] text-faint mt-6 flex items-center justify-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5" /> insights em Período → resumo
      </p>
    </div>
  );
}
