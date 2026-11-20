import React from "react";
import { CalendarRange, Home, Landmark, Target } from "lucide-react";

export default function BottomNav({ activeTab, setActiveTab }) {
  const tabs = [
    { id: "inicio", icon: Home, label: "Início" },
    { id: "periodo", icon: CalendarRange, label: "Período" },
    { id: "planos", icon: Target, label: "Planos" },
    { id: "bancos", icon: Landmark, label: "Bancos" },
  ];

  return (
    <nav className="px-4 pt-2 pb-5 bg-canvas z-40">
      <div className="flex items-center justify-between px-3 py-2 rounded-full bg-surface border border-hairline shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-label={tab.label}
              title={tab.label}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
                isActive
                  ? "bg-white/10 ring-1 ring-accent text-accent"
                  : "text-faint active:bg-white/5"
              }`}
            >
              <Icon
                className="w-[21px] h-[21px]"
                strokeWidth={isActive ? 2.2 : 1.8}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
