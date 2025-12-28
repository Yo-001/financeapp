import React, { useState, useEffect } from "react";
import {
  Plus,
  ShoppingBag,
  X,
  Trash2,
  Check,
  Settings,
  Calendar,
  Filter,
} from "lucide-react";

export default function Transactions({ expenses = [], setExpenses }) {
  const [selectedPeriod, setSelectedPeriod] = useState("mensal");
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString()
  );
  const [selectedMonth, setSelectedMonth] = useState(
    (new Date().getMonth() + 1).toString()
  );
  const [selectedWeek, setSelectedWeek] = useState("todas");
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showFixedExpenses, setShowFixedExpenses] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [swipedItem, setSwipedItem] = useState(null);

  const [newExpense, setNewExpense] = useState({
    name: "",
    value: "",
    paid: "pendente",
    week: "1",
    category: "",
  });

  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [newFixed, setNewFixed] = useState({
    name: "",
    value: "",
    week: "1",
    category: "",
  });

  const categories = [
    "Alimentação",
    "Combustível",
    "Assinaturas",
    "Estudo",
    "Poupança",
    "Mensalidades",
    "Lazer",
    "Compras",
  ];

  const years = ["2023", "2024", "2025", "2026"];
  const months = [
    { value: "1", label: "Janeiro" },
    { value: "2", label: "Fevereiro" },
    { value: "3", label: "Março" },
    { value: "4", label: "Abril" },
    { value: "5", label: "Maio" },
    { value: "6", label: "Junho" },
    { value: "7", label: "Julho" },
    { value: "8", label: "Agosto" },
    { value: "9", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

  // Carregar gastos fixos do localStorage
  useEffect(() => {
    const saved = localStorage.getItem("fixedExpenses");
    if (saved) {
      setFixedExpenses(JSON.parse(saved));
    }
  }, []);

  // Salvar gastos fixos no localStorage
  useEffect(() => {
    localStorage.setItem("fixedExpenses", JSON.stringify(fixedExpenses));
  }, [fixedExpenses]);

  const filteredExpenses = expenses.filter((e) => {
    const expDate = new Date(e.date);
    const expYear = expDate.getFullYear().toString();
    const expMonth = (expDate.getMonth() + 1).toString();

    if (expYear !== selectedYear) return false;
    if (expMonth !== selectedMonth) return false;
    if (selectedWeek !== "todas" && e.week !== selectedWeek) return false;

    return true;
  });

  // Calcular totais do mês
  const totalMonthly = filteredExpenses.reduce((sum, e) => sum + e.value, 0);
  const totalPaid = filteredExpenses
    .filter((e) => e.paid)
    .reduce((sum, e) => sum + e.value, 0);
  const totalPending = filteredExpenses
    .filter((e) => !e.paid)
    .reduce((sum, e) => sum + e.value, 0);

  const weeklyData = [
    { week: "1ª", pago: 0, pendente: 0, total: 0 },
    { week: "2ª", pago: 0, pendente: 0, total: 0 },
    { week: "3ª", pago: 0, pendente: 0, total: 0 },
    { week: "4ª", pago: 0, pendente: 0, total: 0 },
  ];

  filteredExpenses.forEach((expense) => {
    const idx = parseInt(expense.week) - 1;
    if (idx >= 0 && idx < 4) {
      weeklyData[idx].total += expense.value;
      if (expense.paid) weeklyData[idx].pago += expense.value;
      else weeklyData[idx].pendente += expense.value;
    }
  });

  const handleAddExpense = () => {
    if (newExpense.name && newExpense.value) {
      const fixedMonth = selectedMonth.toString().padStart(2, "0");
      const fixedDate = `${selectedYear}-${fixedMonth}-01`;

      setExpenses([
        ...expenses,
        {
          id: Date.now(),
          name: newExpense.name,
          value: parseFloat(newExpense.value),
          date: fixedDate,
          category: newExpense.category || "Outros",
          paid: newExpense.paid === "pago",
          week: newExpense.week,
        },
      ]);
      setNewExpense({
        name: "",
        value: "",
        paid: "pendente",
        week: "1",
        category: "",
      });
      setShowAddExpense(false);
    }
  };

  const handleAddFixedExpense = () => {
    if (newFixed.name && newFixed.value) {
      setFixedExpenses([
        ...fixedExpenses,
        {
          id: Date.now(),
          name: newFixed.name,
          value: parseFloat(newFixed.value),
          week: newFixed.week,
          category: newFixed.category || "Mensalidades",
        },
      ]);
      setNewFixed({ name: "", value: "", week: "1", category: "" });
    }
  };

  const handleRemoveFixedExpense = (id) => {
    setFixedExpenses(fixedExpenses.filter((f) => f.id !== id));
  };

  const handleInitializeMonth = () => {
    if (fixedExpenses.length === 0) {
      alert("Configure os gastos fixos primeiro!");
      setShowFixedExpenses(true);
      return;
    }

    const fixedMonth = selectedMonth.toString().padStart(2, "0");
    const fixedDate = `${selectedYear}-${fixedMonth}-01`;

    const newExpenses = fixedExpenses.map((fixed) => ({
      id: Date.now() + Math.random(),
      name: fixed.name,
      value: fixed.value,
      date: fixedDate,
      category: fixed.category,
      paid: false,
      week: fixed.week,
    }));

    setExpenses([...expenses, ...newExpenses]);
  };

  const handleDelete = (id) => {
    setExpenses(expenses.filter((e) => e.id !== id));
    setSwipedItem(null);
  };

  const handleToggleStatus = (id) => {
    setExpenses(
      expenses.map((e) => (e.id === id ? { ...e, paid: !e.paid } : e))
    );
    setSwipedItem(null);
  };

  const handleTouchStart = (e, id) => {
    const touch = e.touches[0];
    setSwipedItem({ id, startX: touch.clientX, currentX: touch.clientX });
  };

  const handleTouchMove = (e, id) => {
    if (!swipedItem || swipedItem.id !== id) return;
    const touch = e.touches[0];
    setSwipedItem({ ...swipedItem, currentX: touch.clientX });
  };

  const handleTouchEnd = (e, expense) => {
    if (!swipedItem || swipedItem.id !== expense.id) return;
    const diff = swipedItem.currentX - swipedItem.startX;

    if (Math.abs(diff) > 100) {
      if (diff > 0) {
        handleDelete(expense.id);
      } else if (diff < 0) {
        handleToggleStatus(expense.id);
      }
    }

    setSwipedItem(null);
  };

  const getSwipeOffset = (id) => {
    if (!swipedItem || swipedItem.id !== id) return 0;
    const diff = swipedItem.currentX - swipedItem.startX;
    return Math.max(-120, Math.min(120, diff));
  };

  return (
    <div className="flex-1 bg-gray-50 pb-20">
      <div className="bg-white px-4 pt-6 pb-4 border-b">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Período</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(true)}
              className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
            >
              <Filter className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => setShowFixedExpenses(true)}
              className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          {["mensal", "semanal"].map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`flex-1 py-3 rounded-2xl text-sm font-semibold transition ${
                selectedPeriod === period
                  ? "bg-teal-600 text-white shadow-lg"
                  : "bg-gray-100 text-gray-600 active:bg-gray-200"
              }`}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {selectedPeriod === "semanal" ? (
          <div className="space-y-3">
            {weeklyData.map((week, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-gray-900">
                    {week.week} Semana
                  </h4>
                  <span className="text-2xl font-bold text-teal-600">
                    €{week.total}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-teal-600 h-2 rounded-full"
                    style={{ width: `${(week.pago / week.total) * 100 || 0}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-green-600">Pago: €{week.pago}</span>
                  <span className="text-orange-500">
                    Pendente: €{week.pendente}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Resumo do Mês */}
            <div className="bg-gradient-to-r from-teal-600 to-teal-500 rounded-3xl p-5 mb-4 text-white shadow-lg">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <p className="text-teal-100 text-xs mb-1">
                    {months.find((m) => m.value === selectedMonth)?.label}{" "}
                    {selectedYear}
                  </p>
                  <h3 className="text-3xl font-bold">€{totalMonthly}</h3>
                </div>
                <button
                  onClick={() => setShowFilters(true)}
                  className="p-2 bg-white bg-opacity-20 rounded-xl hover:bg-opacity-30 transition"
                >
                  <Filter className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-white bg-opacity-20 rounded-xl p-3">
                  <p className="text-teal-100 text-xs mb-1">Pago</p>
                  <p className="text-2xl font-bold">€{totalPaid}</p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-xl p-3">
                  <p className="text-teal-100 text-xs mb-1">Pendente</p>
                  <p className="text-2xl font-bold">€{totalPending}</p>
                </div>
              </div>
            </div>

            {filteredExpenses.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Mês Vazio
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  Nenhum gasto registrado para este período
                </p>
                <button
                  onClick={handleInitializeMonth}
                  className="w-full py-4 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-2xl font-bold text-lg shadow-lg active:scale-98 transition"
                >
                  🚀 Iniciar Mês com Gastos Fixos
                </button>
                <p className="text-xs text-gray-400 mt-3">
                  {fixedExpenses.length > 0
                    ? `${fixedExpenses.length} gasto(s) fixo(s) configurado(s)`
                    : "Configure gastos fixos no ⚙️"}
                </p>
              </div>
            ) : (
              <div className="space-y-0 bg-white rounded-2xl overflow-hidden shadow-sm">
                {filteredExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="relative overflow-hidden border-b border-gray-100 last:border-0"
                  >
                    <div className="absolute inset-0 flex">
                      <div className="flex-1 bg-red-500 flex items-center justify-start px-6">
                        <Trash2 className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 bg-green-500 flex items-center justify-end px-6">
                        <Check className="w-6 h-6 text-white" />
                      </div>
                    </div>

                    <div
                      className="bg-white p-4 flex items-center relative"
                      style={{
                        transform: `translateX(${getSwipeOffset(
                          expense.id
                        )}px)`,
                        transition:
                          swipedItem?.id === expense.id
                            ? "none"
                            : "transform 0.3s ease",
                      }}
                      onTouchStart={(e) => handleTouchStart(e, expense.id)}
                      onTouchMove={(e) => handleTouchMove(e, expense.id)}
                      onTouchEnd={(e) => handleTouchEnd(e, expense)}
                    >
                      <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center mr-3 flex-shrink-0">
                        <ShoppingBag className="w-6 h-6 text-teal-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 truncate">
                          {expense.name}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {expense.category || "Outros"} • Semana {expense.week}
                        </p>
                      </div>
                      <div className="text-right ml-2">
                        <div
                          className={`font-bold text-lg ${
                            expense.paid ? "text-gray-900" : "text-orange-500"
                          }`}
                        >
                          €{expense.value}
                        </div>
                        <div
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            expense.paid
                              ? "bg-green-100 text-green-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {expense.paid ? "✓ Pago" : "Pendente"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <button
        onClick={() => setShowAddExpense(true)}
        className="fixed bottom-24 right-4 w-16 h-16 bg-teal-600 rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition z-40"
      >
        <Plus className="w-8 h-8 text-white" strokeWidth={3} />
      </button>

      {/* Modal Adicionar Gasto */}
      {showAddExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end z-50">
          <div className="bg-white rounded-t-3xl p-6 w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Novo Gasto</h3>
              <button
                onClick={() => setShowAddExpense(false)}
                className="p-2 hover:bg-gray-100 rounded-xl"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={newExpense.name}
                onChange={(e) =>
                  setNewExpense({ ...newExpense, name: e.target.value })
                }
                className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl text-lg focus:border-teal-500 outline-none"
                placeholder="Nome do gasto"
              />
              <input
                type="number"
                value={newExpense.value}
                onChange={(e) =>
                  setNewExpense({ ...newExpense, value: e.target.value })
                }
                className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl text-lg focus:border-teal-500 outline-none"
                placeholder="Valor (€)"
              />
              <select
                value={newExpense.category}
                onChange={(e) =>
                  setNewExpense({ ...newExpense, category: e.target.value })
                }
                className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl bg-white text-base"
              >
                <option value="">Categoria (opcional)</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <select
                value={newExpense.paid}
                onChange={(e) =>
                  setNewExpense({ ...newExpense, paid: e.target.value })
                }
                className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl bg-white"
              >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
              </select>
              <select
                value={newExpense.week}
                onChange={(e) =>
                  setNewExpense({ ...newExpense, week: e.target.value })
                }
                className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl bg-white"
              >
                <option value="1">1ª Semana</option>
                <option value="2">2ª Semana</option>
                <option value="3">3ª Semana</option>
                <option value="4">4ª Semana</option>
              </select>
            </div>

            <button
              onClick={handleAddExpense}
              className="w-full mt-6 py-4 bg-teal-600 text-white rounded-2xl font-bold text-lg active:scale-98 transition shadow-lg"
            >
              Salvar Gasto
            </button>
          </div>
        </div>
      )}

      {/* Modal Filtros */}
      {showFilters && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end z-50">
          <div className="bg-white rounded-t-3xl p-6 w-full max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Filtros</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="p-2 hover:bg-gray-100 rounded-xl"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Ano
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-base"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Mês
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-base"
                >
                  {months.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Semana
                </label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-base"
                >
                  <option value="todas">Todas as Semanas</option>
                  <option value="1">1ª Semana</option>
                  <option value="2">2ª Semana</option>
                  <option value="3">3ª Semana</option>
                  <option value="4">4ª Semana</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => setShowFilters(false)}
              className="w-full mt-6 py-4 bg-teal-600 text-white rounded-2xl font-bold text-lg active:scale-98 transition shadow-lg"
            >
              Aplicar Filtros
            </button>
          </div>
        </div>
      )}

      {/* Modal Gastos Fixos */}
      {showFixedExpenses && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end z-50">
          <div className="bg-white rounded-t-3xl p-6 w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Gastos Fixos Mensais</h3>
              <button
                onClick={() => setShowFixedExpenses(false)}
                className="p-2 hover:bg-gray-100 rounded-xl"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              Configure os gastos que se repetem todo mês. Eles serão
              adicionados automaticamente ao clicar em "Iniciar Mês".
            </p>

            {/* Lista de Gastos Fixos */}
            <div className="space-y-2 mb-6">
              {fixedExpenses.map((fixed) => (
                <div
                  key={fixed.id}
                  className="bg-gray-50 rounded-2xl p-4 flex items-center"
                >
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900">{fixed.name}</h4>
                    <p className="text-xs text-gray-500">
                      {fixed.category} • Semana {fixed.week} • €{fixed.value}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveFixedExpense(fixed.id)}
                    className="p-2 hover:bg-red-100 rounded-xl transition"
                  >
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              ))}
              {fixedExpenses.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Nenhum gasto fixo configurado
                </div>
              )}
            </div>

            {/* Formulário Adicionar Gasto Fixo */}
            <div className="border-t pt-6 space-y-4">
              <h4 className="font-bold text-gray-900">Adicionar Gasto Fixo</h4>
              <input
                type="text"
                value={newFixed.name}
                onChange={(e) =>
                  setNewFixed({ ...newFixed, name: e.target.value })
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:border-teal-500 outline-none"
                placeholder="Nome (ex: Aluguel)"
              />
              <input
                type="number"
                value={newFixed.value}
                onChange={(e) =>
                  setNewFixed({ ...newFixed, value: e.target.value })
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:border-teal-500 outline-none"
                placeholder="Valor (€)"
              />
              <select
                value={newFixed.category}
                onChange={(e) =>
                  setNewFixed({ ...newFixed, category: e.target.value })
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl bg-white"
              >
                <option value="">Categoria</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <select
                value={newFixed.week}
                onChange={(e) =>
                  setNewFixed({ ...newFixed, week: e.target.value })
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl bg-white"
              >
                <option value="1">1ª Semana</option>
                <option value="2">2ª Semana</option>
                <option value="3">3ª Semana</option>
                <option value="4">4ª Semana</option>
              </select>
              <button
                onClick={handleAddFixedExpense}
                className="w-full py-3 bg-teal-600 text-white rounded-2xl font-bold active:scale-98 transition"
              >
                Adicionar à Lista
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
