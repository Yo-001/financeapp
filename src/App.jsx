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
        console.log("📂 Carregando dados do storage...");

        const { value: savedExpenses } = await Preferences.get({
          key: "expenses",
        });
        const { value: savedPlanning } = await Preferences.get({
          key: "planningItems",
        });
        const { value: savedHistory } = await Preferences.get({
          key: "monthlyHistory",
        });

        if (savedExpenses) {
          const parsed = JSON.parse(savedExpenses);
          setExpenses(parsed);
          console.log("✅ Expenses carregados:", parsed.length);
        }

        if (savedPlanning) {
          const parsed = JSON.parse(savedPlanning);
          setPlanningItems(parsed);
          console.log("✅ Planning carregados:", parsed.length);
        } else {
          console.log("ℹ️ Nenhum planning salvo (primeira vez)");
        }

        if (savedHistory) {
          const parsed = JSON.parse(savedHistory);
          setMonthlyHistory(parsed);
          console.log("✅ History carregado:", parsed.length);
        }
      } catch (err) {
        console.error("❌ Erro ao carregar storage:", err);
      } finally {
        setStorageLoaded(true);
        console.log("✅ Storage carregado com sucesso!");
      }
    };

    loadData();
  }, []);

  /* ==========================
     SAVE EXPENSES
  =========================== */
  useEffect(() => {
    if (!storageLoaded) return;

    const saveExpenses = async () => {
      try {
        await Preferences.set({
          key: "expenses",
          value: JSON.stringify(expenses),
        });
        console.log("💾 Expenses salvos:", expenses.length);
      } catch (err) {
        console.error("❌ Erro ao salvar expenses:", err);
      }
    };

    saveExpenses();
  }, [expenses, storageLoaded]);

  /* ==========================
     SAVE PLANNING ITEMS
     🔑 CORREÇÃO PRINCIPAL AQUI
  =========================== */
  useEffect(() => {
    if (!storageLoaded) return;

    const savePlanning = async () => {
      try {
        await Preferences.set({
          key: "planningItems",
          value: JSON.stringify(planningItems),
        });
        console.log("💾 Planning salvos:", planningItems.length);
      } catch (err) {
        console.error("❌ Erro ao salvar planning:", err);
      }
    };

    savePlanning();
  }, [planningItems, storageLoaded]);

  /* ==========================
     SAVE MONTHLY HISTORY
  =========================== */
  useEffect(() => {
    if (!storageLoaded) return;

    const saveHistory = async () => {
      try {
        await Preferences.set({
          key: "monthlyHistory",
          value: JSON.stringify(monthlyHistory),
        });
        console.log("💾 History salvos:", monthlyHistory.length);
      } catch (err) {
        console.error("❌ Erro ao salvar history:", err);
      }
    };

    saveHistory();
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
