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

  const [expenses, setExpenses] = useState([
    {
      id: 1,
      name: "Supermercado",
      value: 450,
      date: "2025-11-20",
      category: "Alimentação",
      paid: true,
      week: "3",
    },
    {
      id: 2,
      name: "Restaurante",
      value: 120,
      date: "2025-11-18",
      category: "Alimentação",
      paid: true,
      week: "3",
    },
    {
      id: 3,
      name: "Gasolina",
      value: 200,
      date: "2025-11-15",
      category: "Transporte",
      paid: true,
      week: "2",
    },
    {
      id: 4,
      name: "Farmácia",
      value: 85,
      date: "2025-11-12",
      category: "Saúde",
      paid: true,
      week: "2",
    },
    {
      id: 5,
      name: "Cinema",
      value: 60,
      date: "2025-11-10",
      category: "Lazer",
      paid: false,
      week: "2",
    },
    {
      id: 6,
      name: "Conta de Luz",
      value: 180,
      date: "2025-11-05",
      category: "Moradia",
      paid: true,
      week: "1",
    },
  ]);

  const [planningItems, setPlanningItems] = useState([
    {
      id: 1,
      name: "Notebook Gamer",
      value: 2500,
      paymentMethods: ["parcelado"],
      installments: 10,
      link: "https://amazon.com",
    },
    {
      id: 2,
      name: "Celular",
      value: 1500,
      paymentMethods: ["parcelado"],
      installments: 5,
      link: "",
    },
  ]);

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

      if (savedExpenses) setExpenses(JSON.parse(savedExpenses));
      if (savedPlanning) setPlanningItems(JSON.parse(savedPlanning));
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

  return (
    <div className="w-full h-screen bg-gray-50 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {!showInsights && activeTab === "inicio" && (
          <Home expenses={expenses} setShowInsights={setShowInsights} />
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
