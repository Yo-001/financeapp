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

  const [storageLoaded, setStorageLoaded] = useState(false);

  /* ==========================
     LOAD STORAGE (ON START)
  =========================== */
  useEffect(() => {
    const loadData = async () => {
      try {
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
      } catch (err) {
        console.error("Erro ao carregar storage:", err);
      } finally {
        setStorageLoaded(true); // 🔑 MUITO IMPORTANTE
      }
    };

    loadData();
  }, []);

  /* ==========================
     SAVE STORAGE (AUTO)
     Só salva após load
  =========================== */
  useEffect(() => {
    if (!storageLoaded) return;
    Preferences.set({
      key: "expenses",
      value: JSON.stringify(expenses),
    });
  }, [expenses, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded) return;
    Preferences.set({
      key: "planningItems",
      value: JSON.stringify(planningItems),
    });
  }, [planningItems, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded) return;
    Preferences.set({
      key: "monthlyHistory",
      value: JSON.stringify(monthlyHistory),
    });
  }, [monthlyHistory, storageLoaded]);

  /* ==========================
     UPDATE MONTHLY HISTORY
  =========================== */
  useEffect(() => {
    if (!storageLoaded) return;
    updateMonthlyHistory();
  }, [expenses, storageLoaded]);

  const updateMonthlyHistory = () => {
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
      expense.paid
        ? (groupedByMonth[key].paid += expense.value)
        : (groupedByMonth[key].pending += expense.value);
    });

    const historyArray = Object.values(groupedByMonth)
      .sort((a, b) => a.year - b.year || a.month - b.month)
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
