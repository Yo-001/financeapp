import React, { useMemo, useState, useEffect } from "react";
import Home from "./pages/Home";
import Transactions from "./pages/Transactions";
import Plans from "./pages/Plans";
import BottomNav from "./components/BottomNav";
import More from "./pages/More";
import { KEYS, loadAll, save } from "./services/storage";
import { historyFromExpenses } from "./services/history";
import { migrateStorage } from "./services/migrate";

function App() {
  const [activeTab, setActiveTab] = useState("inicio");
  const [showInsights, setShowInsights] = useState(false);

  const [expenses, setExpenses] = useState([]);
  const [planningItems, setPlanningItems] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);

  const [storageLoaded, setStorageLoaded] = useState(false);

  /* ==========================
     LOAD STORAGE (ON START)
  =========================== */
  useEffect(() => {
    const loadData = async () => {
      try {
        const report = await migrateStorage();
        if (report.historyCheck?.mismatches?.length) {
          console.warn(
            "⚠️ monthlyHistory legado difere do derivado:",
            report.historyCheck.mismatches
          );
        }

        const data = await loadAll();
        setExpenses(data.expenses);
        setPlanningItems(data.planningItems);
        setFixedExpenses(data.fixedExpenses);
      } catch (err) {
        console.error("❌ Erro ao carregar storage:", err);
      } finally {
        setStorageLoaded(true);
      }
    };

    loadData();
  }, []);

  /* ==========================
     SAVE (storage único, só depois do load)
  =========================== */
  useEffect(() => {
    if (!storageLoaded) return;
    save(KEYS.expenses, expenses);
  }, [expenses, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded) return;
    save(KEYS.planningItems, planningItems);
  }, [planningItems, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded) return;
    save(KEYS.fixedExpenses, fixedExpenses);
  }, [fixedExpenses, storageLoaded]);

  // monthlyHistory é derivado — não é mais gravado. A chave legada fica intacta
  // e é comparada com este resultado na migração.
  const monthlyHistory = useMemo(
    () => historyFromExpenses(expenses, 15),
    [expenses]
  );

  return (
    <div className="w-full h-screen bg-canvas flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {!showInsights && activeTab === "inicio" && (
          <Home
            expenses={expenses}
            setShowInsights={setShowInsights}
            monthlyHistory={monthlyHistory}
          />
        )}
        {!showInsights && activeTab === "periodo" && (
          <Transactions
            expenses={expenses}
            setExpenses={setExpenses}
            fixedExpenses={fixedExpenses}
            setFixedExpenses={setFixedExpenses}
          />
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
