import React, { useState, useMemo } from "react";
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

  // 🔹 Gastos do mês (ignora semana)
  const monthlyExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const d = new Date(e.date);
      return (
        d.getFullYear().toString() === selectedYear &&
        (d.getMonth() + 1).toString() === selectedMonth
      );
    });
  }, [expenses, selectedYear, selectedMonth]);

  const isNewMonth = monthlyExpenses.length === 0;

  // 🔹 Filtro completo (com semana)
  const filteredExpenses = monthlyExpenses.filter((e) => {
    if (selectedWeek !== "todas" && e.week !== selectedWeek) return false;
    return true;
  });

  const handleAddExpense = () => {
    if (!newExpense.name || !newExpense.value) return;

    const fixedMonth = selectedMonth.padStart(2, "0");
    const date = `${selectedYear}-${fixedMonth}-01`;

    setExpenses([
      ...expenses,
      {
        id: Date.now(),
        name: newExpense.name,
        value: parseFloat(newExpense.value),
        date,
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
  };

  // 🔹 Iniciar mês com gastos fixos
  const handleStartMonth = () => {
    const fixedExpenses =
      JSON.parse(localStorage.getItem("fixedExpenses")) || [];

    if (fixedExpenses.length === 0) return;

    const fixedMonth = selectedMonth.padStart(2, "0");
    const date = `${selectedYear}-${fixedMonth}-01`;

    const generated = fixedExpenses.map((item) => ({
      id: Date.now() + Math.random(),
      name: item.name,
      value: item.value,
      category: item.category || "Outros",
      week: item.week,
      paid: false,
      date,
    }));

    setExpenses([...expenses, ...generated]);
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
    setSwipedItem({ id, startX: e.touches[0].clientX });
  };

  const handleTouchEnd = (e, expense) => {
    if (!swipedItem) return;
    const diff = e.changedTouches[0].clientX - swipedItem.startX;

    if (Math.abs(diff) > 100) {
      diff > 0 ? handleDelete(expense.id) : handleToggleStatus(expense.id);
    }

    setSwipedItem(null);
  };

  return (
    <div className="flex-1 bg-gray-50 pb-20 px-4 pt-4">
      {isNewMonth ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <h3 className="text-xl font-bold mb-2">Novo mês iniciado</h3>
          <p className="text-gray-500 mb-6">Nenhum gasto registrado ainda</p>
          <button
            onClick={handleStartMonth}
            className="w-full py-4 bg-teal-600 text-white rounded-2xl font-bold text-lg"
          >
            Iniciar Mês
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          {filteredExpenses.map((expense) => (
            <div
              key={expense.id}
              className="p-4 flex items-center border-b last:border-0"
              onTouchStart={(e) => handleTouchStart(e, expense.id)}
              onTouchEnd={(e) => handleTouchEnd(e, expense)}
            >
              <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center mr-3">
                <ShoppingBag className="w-6 h-6 text-teal-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold">{expense.name}</h4>
                <p className="text-xs text-gray-500">
                  {expense.category} • Semana {expense.week}
                </p>
              </div>
              <div className="text-right">
                <div className="font-bold">€{expense.value}</div>
                <div className="text-xs">
                  {expense.paid ? "✓ Pago" : "Pendente"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setShowAddExpense(true)}
        className="fixed bottom-24 right-4 w-16 h-16 bg-teal-600 rounded-full shadow-xl flex items-center justify-center"
      >
        <Plus className="w-8 h-8 text-white" />
      </button>

      {showAddExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end z-50">
          <div className="bg-white rounded-t-3xl p-6 w-full">
            <button onClick={() => setShowAddExpense(false)} className="mb-4">
              <X />
            </button>

            <input
              className="w-full mb-3 p-3 border rounded-xl"
              placeholder="Nome"
              value={newExpense.name}
              onChange={(e) =>
                setNewExpense({ ...newExpense, name: e.target.value })
              }
            />

            <input
              className="w-full mb-3 p-3 border rounded-xl"
              type="number"
              placeholder="Valor"
              value={newExpense.value}
              onChange={(e) =>
                setNewExpense({ ...newExpense, value: e.target.value })
              }
            />

            <button
              onClick={handleAddExpense}
              className="w-full py-4 bg-teal-600 text-white rounded-2xl font-bold"
            >
              Salvar Gasto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
