import React from "react";
import { TrendingUp, ShoppingBag } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
} from "recharts";

export default function Home({ expenses, setShowInsights }) {
  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  const currentMonthName = monthNames[new Date().getMonth()];

  const currentMonthExpenses = expenses.filter(
    (e) => new Date(e.date).getMonth() === new Date().getMonth()
  );
  const totalPaid = currentMonthExpenses
    .filter((e) => e.paid)
    .reduce((sum, e) => sum + e.value, 0);
  const totalPending = currentMonthExpenses
    .filter((e) => !e.paid)
    .reduce((sum, e) => sum + e.value, 0);
  const totalMonth = totalPaid + totalPending;

  const pieData = [
    { name: "Pago", value: totalPaid, color: "#14b8a6" },
    { name: "Restante", value: totalPending, color: "#d1d5db" },
  ];

  const monthlyData = [
    { month: "Mai", value: 876 },
    { month: "Jun", value: 1050 },
    { month: "Jul", value: 1110 },
    { month: "Ago", value: 876 },
    { month: "Set", value: 1476 },
    { month: "Out", value: 1276 },
    { month: "Nov", value: 1194 },
  ];

  return (
    <div className="flex-1 bg-gradient-to-b from-teal-50 to-gray-50 pb-20">
      <div className="bg-gradient-to-br from-teal-600 to-teal-500 px-4 pt-6 pb-8 rounded-b-3xl shadow-lg">
        <h1 className="text-white text-2xl font-bold mb-2">Olá! 👋</h1>
        <p className="text-teal-100 text-sm">Seu resumo financeiro</p>
      </div>

      <div className="px-4 -mt-6">
        <div className="bg-white rounded-3xl p-6 shadow-xl mb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">
                Saldo {currentMonthName}
              </p>
              <h2 className="text-4xl font-bold text-gray-900">
                €{totalMonth}
              </h2>
            </div>
            <button
              onClick={() => setShowInsights(true)}
              className="bg-teal-100 p-3 rounded-2xl active:scale-95 transition"
            >
              <TrendingUp className="w-5 h-5 text-teal-600" />
            </button>
          </div>

          <div className="flex gap-3 mt-4">
            <div className="flex-1 bg-green-50 rounded-2xl p-3">
              <p className="text-green-600 text-xs font-medium mb-1">Pago</p>
              <p className="text-green-900 text-lg font-bold">€{totalPaid}</p>
            </div>
            <div className="flex-1 bg-orange-50 rounded-2xl p-3">
              <p className="text-orange-600 text-xs font-medium mb-1">
                Pendente
              </p>
              <p className="text-orange-900 text-lg font-bold">
                €{totalPending}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-lg mb-4">
          <h3 className="text-gray-900 font-bold mb-3 text-lg">Distribuição</h3>
          <div className="relative" style={{ height: "180px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-2xl font-bold text-gray-900">€{totalMonth}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-lg mb-4">
          <h3 className="text-gray-900 font-bold mb-3 text-lg">
            Últimos Meses
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyData}>
              <XAxis dataKey="month" tick={{ fill: "#999", fontSize: 11 }} />
              <Bar dataKey="value" fill="#14b8a6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
