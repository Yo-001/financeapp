import React from "react";
import { X, DollarSign, TrendingUp, AlertCircle } from "lucide-react";

export default function More({ expenses, setShowInsights }) {
  const currentMonthExpenses = expenses.filter(
    (e) => new Date(e.date).getMonth() === new Date().getMonth()
  );
  const totalMonth = currentMonthExpenses.reduce((sum, e) => sum + e.value, 0);

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto pb-6">
      <div className="p-4">
        <button
          onClick={() => setShowInsights(false)}
          className="mb-4 p-2 hover:bg-gray-100 rounded-xl"
        >
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold mb-6">Insights</h2>

        <div className="space-y-3">
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-3xl p-5 text-white">
            <DollarSign className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-sm opacity-90 mb-1">Gasto Total</p>
            <p className="text-3xl font-bold">€{totalMonth}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-3xl p-5 text-white">
            <TrendingUp className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-sm opacity-90 mb-1">Média Diária</p>
            <p className="text-3xl font-bold">
              €{(totalMonth / new Date().getDate()).toFixed(2)}
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-400 to-orange-500 rounded-3xl p-5 text-white">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p className="text-sm mb-2">Categoria Principal</p>
            <p className="text-xl font-bold">Alimentação - €570</p>
          </div>
        </div>
      </div>
    </div>
  );
}
