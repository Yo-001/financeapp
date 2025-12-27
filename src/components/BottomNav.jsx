import React from "react";
import { Home, Calendar, Target } from "lucide-react";

export default function BottomNav({ activeTab, setActiveTab }) {
  const tabs = [
    { id: "inicio", icon: Home, label: "Início" },
    { id: "periodo", icon: Calendar, label: "Período" },
    { id: "planejamento", icon: Target, label: "Planos" },
  ];

  return (
    <div className="bg-white border-t py-2 px-6 pb-6 flex justify-between z-40">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex flex-col items-center gap-1 min-w-[64px] ${
            activeTab === tab.id ? "text-teal-600" : "text-gray-400"
          }`}
        >
          <tab.icon
            className={`w-6 h-6 transition ${
              activeTab === tab.id ? "scale-110" : ""
            }`}
            strokeWidth={activeTab === tab.id ? 2.5 : 2}
          />
          <span className="text-[10px] font-medium">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
