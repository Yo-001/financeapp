import React, { useState } from "react";
import { TrendingUp } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
  LabelList,
} from "recharts";

export default function Home({ expenses, setShowInsights, monthlyHistory }) {
  const [activeIndex, setActiveIndex] = useState(null);

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

  const monthNamesShort = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
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

  // Gráfico dinâmico baseado no histórico real
  const monthlyData = monthlyHistory
    .slice(-7) // Últimos 7 meses
    .map((item) => ({
      month: monthNamesShort[item.month],
      value: item.total,
      year: item.year,
      fullMonth: monthNames[item.month],
    }));

  // Se não houver dados suficientes, mostra mensagem
  const hasHistoryData = monthlyData.length > 0;

  return (
    <div className="flex-1 bg-gradient-to-b from-teal-50 to-gray-50 pb-20">
      {/* CSS global para remover TODOS os contornos e highlights */}
      <style>{`
        .recharts-surface:focus, 
        .recharts-wrapper:focus, 
        .recharts-rectangle:focus, 
        .recharts-sector:focus,
        .recharts-bar:focus,
        .recharts-bar-rectangle:focus,
        path:focus,
        rect:focus,
        svg:focus,
        g:focus {
          outline: none !important;
          outline-width: 0 !important;
          outline-offset: 0 !important;
        }

        * {
          -webkit-tap-highlight-color: transparent !important;
          -webkit-touch-callout: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
        }

        .recharts-wrapper,
        .recharts-surface,
        .recharts-bar,
        .recharts-rectangle {
          outline: none !important;
          border: none !important;
        }

        .recharts-wrapper *:focus {
          outline: none !important;
        }
      `}</style>

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
                  stroke="none"
                  isAnimationActive={false}
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

          {hasHistoryData ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={monthlyData}
                  margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#999", fontSize: 11 }}
                  />

                  <Bar
                    dataKey="value"
                    fill="#14b8a6"
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={false}
                    onClick={(data, index) => {
                      setActiveIndex(activeIndex === index ? null : index);
                    }}
                  >
                    <LabelList
                      dataKey="value"
                      position="top"
                      content={(props) => {
                        const { x, y, width, value, index } = props;
                        if (index !== activeIndex) return null;
                        return (
                          <g>
                            <rect
                              x={x + width / 2 - 30}
                              y={y - 30}
                              width="60"
                              height="24"
                              fill="#14b8a6"
                              rx="12"
                              opacity="0.95"
                            />
                            <text
                              x={x + width / 2}
                              y={y - 13}
                              fill="white"
                              textAnchor="middle"
                              fontSize="13"
                              fontWeight="bold"
                            >
                              €{value}
                            </text>
                          </g>
                        );
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-400 text-center mt-2">
                💡 Clique nas barras para ver o valor
              </p>
            </>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <TrendingUp className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 mb-1">Sem histórico ainda</p>
              <p className="text-xs text-gray-400">
                Inicie meses na aba Período para ver o gráfico
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
