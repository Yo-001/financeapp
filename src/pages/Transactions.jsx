import React, { useState } from "react";
import { Plus, ShoppingBag, X, Trash2, Check } from "lucide-react";

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
  const [swipedItem, setSwipedItem] = useState(null);
  const [swipeDirection, setSwipeDirection] = useState(null);

  const [newExpense, setNewExpense] = useState({
    name: "",
    value: "",
    paid: "pendente",
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

  const filteredExpenses = expenses.filter((e) => {
    const expDate = new Date(e.date);
    const expYear = expDate.getFullYear().toString();
    const expMonth = (expDate.getMonth() + 1).toString();

    if (expYear !== selectedYear) return false;
    if (expMonth !== selectedMonth) return false;
    if (selectedWeek !== "todas" && e.week !== selectedWeek) return false;

    return true;
  });

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
      // FIX: Criar a string de data manualmente baseada nos filtros selecionados.
      // Isso evita problemas de fuso horário que poderiam jogar a data para o mês anterior.
      const fixedMonth = selectedMonth.toString().padStart(2, "0");
      const fixedDate = `${selectedYear}-${fixedMonth}-01`;

      setExpenses([
        ...expenses,
        {
          id: Date.now(),
          name: newExpense.name,
          value: parseFloat(newExpense.value),
          date: fixedDate, // Usa a data vinculada aos filtros
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
    const diff = touch.clientX - swipedItem.startX;

    if (Math.abs(diff) > 20) {
      setSwipeDirection(diff > 0 ? "right" : "left");
    }

    setSwipedItem({ ...swipedItem, currentX: touch.clientX });
  };

  const handleTouchEnd = (e, expense) => {
    if (!swipedItem || swipedItem.id !== expense.id) return;

    const diff = swipedItem.currentX - swipedItem.startX;

    if (Math.abs(diff) > 100) {
      if (diff > 0) {
        // Deslizar para Direita -> Deletar
        handleDelete(expense.id);
      } else if (diff < 0) {
        // Deslizar para Esquerda -> Alternar Status
        handleToggleStatus(expense.id);
      }
    }

    setSwipedItem(null);
    setSwipeDirection(null);
  };

  const getSwipeOffset = (id) => {
    if (!swipedItem || swipedItem.id !== id) return 0;
    const diff = swipedItem.currentX - swipedItem.startX;
    return Math.max(-120, Math.min(120, diff));
  };

  return (
    <div className="flex-1 bg-gray-50 pb-20">
      <div className="bg-white px-4 pt-6 pb-4 border-b">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Período</h1>
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
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full mb-3 px-4 py-3 bg-white border-0 rounded-2xl shadow-sm text-sm font-medium"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  📅 Ano {year}
                </option>
              ))}
            </select>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full mb-3 px-4 py-3 bg-white border-0 rounded-2xl shadow-sm text-sm font-medium"
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  🗓️ {month.label}
                </option>
              ))}
            </select>

            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="w-full mb-3 px-4 py-3 bg-white border-0 rounded-2xl shadow-sm text-sm font-medium"
            >
              <option value="todas">📋 Todas as Semanas</option>
              <option value="1">1ª Semana</option>
              <option value="2">2ª Semana</option>
              <option value="3">3ª Semana</option>
              <option value="4">4ª Semana</option>
            </select>

            <div className="space-y-0 bg-white rounded-2xl overflow-hidden shadow-sm">
              {filteredExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="relative overflow-hidden border-b border-gray-100 last:border-0"
                >
                  <div className="absolute inset-0 flex">
                    {/* Deslize direita -> Deletar (Vermelho) */}
                    <div className="flex-1 bg-red-500 flex items-center justify-start px-6">
                      <Trash2 className="w-6 h-6 text-white" />
                    </div>
                    {/* Deslize esquerda -> Alternar Status (Verde) */}
                    <div className="flex-1 bg-green-500 flex items-center justify-end px-6">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                  </div>

                  <div
                    className="bg-white p-4 flex items-center relative"
                    style={{
                      transform: `translateX(${getSwipeOffset(expense.id)}px)`,
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

              {filteredExpenses.length === 0 && (
                <div className="p-8 text-center">
                  <p className="text-gray-400 text-sm">
                    Nenhum gasto registrado neste período
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <button
        onClick={() => setShowAddExpense(true)}
        className="fixed bottom-24 right-4 w-16 h-16 bg-teal-600 rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition z-40"
      >
        <Plus className="w-8 h-8 text-white" strokeWidth={3} />
      </button>

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
    </div>
  );
}
