import React, { useState, useEffect } from "react";
import Home from "./pages/Home";
import Transactions from "./pages/Transactions";
import Plans from "./pages/Plans";
import BottomNav from "./components/BottomNav";
import More from "./pages/More";
import { Preferences } from "@capacitor/preferences";

function App() {
  const [activeTab, setActiveTab] = useState("inicio");
  const [showInsights, setShowInsights] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [planningItems, setPlanningItems] = useState([]);
  const [monthlyHistory, setMonthlyHistory] = useState([]);

  /* ==========================
     LOAD STORAGE (ON START)
  =========================== */
  useEffect(() => {
    const loadData = async () => {
      const { value: savedExpenses } = await Preferences.get({
        key: "expenses",
      });
      const { value: savedPlanning } = await Preferences.get({
        key: "planningItems",
      });
      const { value: savedHistory } = await Preferences.get({
        key: "monthlyHistory",
      });

      if (savedExpenses) setExpenses(JSON.parse(savedExpenses));
      if (savedPlanning) setPlanningItems(JSON.parse(savedPlanning));
      if (savedHistory) setMonthlyHistory(JSON.parse(savedHistory));
    };
    loadData();
  }, []);

  /* ==========================
     SAVE STORAGE (AUTO)
  =========================== */
  useEffect(() => {
    Preferences.set({
      key: "expenses",
      value: JSON.stringify(expenses),
    });
  }, [expenses]);

  useEffect(() => {
    Preferences.set({
      key: "planningItems",
      value: JSON.stringify(planningItems),
    });
  }, [planningItems]);

  useEffect(() => {
    Preferences.set({
      key: "monthlyHistory",
      value: JSON.stringify(monthlyHistory),
    });
  }, [monthlyHistory]);

  /* ==========================
     UPDATE MONTHLY HISTORY
     Atualiza automaticamente quando expenses mudam
  =========================== */
  useEffect(() => {
    updateMonthlyHistory();
  }, [expenses]);

  const updateMonthlyHistory = () => {
    // Agrupa gastos por mês/ano
    const groupedByMonth = {};

    expenses.forEach((expense) => {
      const date = new Date(expense.date);
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${month}`;

      if (!groupedByMonth[key]) {
        groupedByMonth[key] = {
          year,
          month,
          total: 0,
          paid: 0,
          pending: 0,
        };
      }

      groupedByMonth[key].total += expense.value;
      if (expense.paid) {
        groupedByMonth[key].paid += expense.value;
      } else {
        groupedByMonth[key].pending += expense.value;
      }
    });

    // Converte para array e ordena por data
    const historyArray = Object.values(groupedByMonth)
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      })
      .map((item) => ({
        ...item,
        total: Math.round(item.total),
        paid: Math.round(item.paid),
        pending: Math.round(item.pending),
      }));

    setMonthlyHistory(historyArray);
  };

  return (
    <div className="w-full h-screen bg-gray-50 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {!showInsights && activeTab === "inicio" && (
          <Home
            expenses={expenses}
            setShowInsights={setShowInsights}
            monthlyHistory={monthlyHistory}
          />
        )}
        {!showInsights && activeTab === "periodo" && (
          <Transactions expenses={expenses} setExpenses={setExpenses} />
        )}
        {!showInsights && activeTab === "planejamento" && (
          <Plans
            planningItems={planningItems}
            setPlanningItems={setPlanningItems}
          />
        )}
        {showInsights && (
          <More expenses={expenses} setShowInsights={setShowInsights} />
        )}
      </div>
      {!showInsights && (
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
    </div>
  );
}

export default App;
