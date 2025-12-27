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

  const [newExpense, setNewExpense] = useState({
    name: "",
    value: "",
    paid: "pendente",
    week: "1",
    category: "",
  });

  const filteredExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    return (
      d.getFullYear().toString() === selectedYear &&
      (d.getMonth() + 1).toString() === selectedMonth &&
      (selectedWeek === "todas" || e.week === selectedWeek)
    );
  });

  /* ===== AÇÕES ===== */

  const togglePaid = (id) => {
    setExpenses(
      expenses.map((e) => (e.id === id ? { ...e, paid: !e.paid } : e))
    );
    setSwipedItem(null);
  };

  const deleteExpense = (id) => {
    setExpenses(expenses.filter((e) => e.id !== id));
    setSwipedItem(null);
  };

  /* ===== SWIPE ===== */

  const handleTouchStart = (e, id) => {
    const x = e.touches[0].clientX;
    setSwipedItem({ id, startX: x, currentX: x });
  };

  const handleTouchMove = (e, id) => {
    if (!swipedItem || swipedItem.id !== id) return;
    setSwipedItem({
      ...swipedItem,
      currentX: e.touches[0].clientX,
    });
  };

  const handleTouchEnd = (expense) => {
    if (!swipedItem) return;
    const diff = swipedItem.currentX - swipedItem.startX;

    if (diff > 100) deleteExpense(expense.id);
    if (diff < -100) togglePaid(expense.id);

    setSwipedItem(null);
  };

  const getSwipeOffset = (id) => {
    if (!swipedItem || swipedItem.id !== id) return 0;
    return Math.max(
      -120,
      Math.min(120, swipedItem.currentX - swipedItem.startX)
    );
  };

  /* ===== ADD ===== */

  const handleAddExpense = () => {
    if (!newExpense.name || !newExpense.value) return;

    setExpenses([
      ...expenses,
      {
        id: Date.now(),
        name: newExpense.name,
        value: parseFloat(newExpense.value),
        paid: newExpense.paid === "pago",
        week: newExpense.week,
        category: newExpense.category || "Outros",
        date: new Date(
          parseInt(selectedYear),
          parseInt(selectedMonth) - 1,
          1
        ).toISOString(),
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

  /* ===== UI ===== */

  return (
    <div className="flex-1 bg-gray-50 pb-20 px-4 pt-4 space-y-2">
      {filteredExpenses.map((expense) => (
        <div key={expense.id} className="relative overflow-hidden">
          <div className="absolute inset-0 flex">
            <div className="flex-1 bg-green-500 flex items-center pl-6">
              <Check className="text-white" />
            </div>
            <div className="flex-1 bg-red-500 flex items-center justify-end pr-6">
              <Trash2 className="text-white" />
            </div>
          </div>

          <div
            className="bg-white rounded-2xl p-4 shadow-sm flex items-center relative"
            style={{
              transform: `translateX(${getSwipeOffset(expense.id)}px)`,
              transition:
                swipedItem?.id === expense.id ? "none" : "transform 0.3s ease",
            }}
            onTouchStart={(e) => handleTouchStart(e, expense.id)}
            onTouchMove={(e) => handleTouchMove(e, expense.id)}
            onTouchEnd={() => handleTouchEnd(expense)}
          >
            <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center mr-3">
              <ShoppingBag className="text-teal-600" />
            </div>

            <div className="flex-1">
              <h4 className="font-bold">{expense.name}</h4>
              <p className="text-xs text-gray-500">
                {expense.category} • Semana {expense.week}
              </p>
            </div>

            <div className="text-right">
              <p className="font-bold">€{expense.value}</p>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  expense.paid
                    ? "bg-green-100 text-green-700"
                    : "bg-orange-100 text-orange-700"
                }`}
              >
                {expense.paid ? "Pago" : "Pendente"}
              </span>
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={() => setShowAddExpense(true)}
        className="fixed bottom-24 right-4 w-16 h-16 bg-teal-600 rounded-full shadow-xl flex items-center justify-center"
      >
        <Plus className="text-white" />
      </button>

      {showAddExpense && (
        <div className="fixed inset-0 bg-black/60 flex items-end">
          <div className="bg-white rounded-t-3xl p-6 w-full">
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
              className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold"
            >
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
