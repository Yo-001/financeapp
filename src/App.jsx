import { App as CapacitorApp } from "@capacitor/app";
import React, { useCallback, useEffect, useRef, useState } from "react";
import BottomNav from "./components/BottomNav";
import Banks from "./pages/Banks";
import Home from "./pages/Home";
import Plans from "./pages/Plans";
import Transactions from "./pages/Transactions";
import {
  getConnections,
  hasCredentials,
  syncBankTransactions,
} from "./services/enableBanking";
import { migrateStorage } from "./services/migrate";
import { KEYS, loadAll, save } from "./services/storage";

const AUTO_SYNC_THROTTLE_MS = 60_000;

function runAutoSync({
  storageLoaded,
  bankSettings,
  expenses,
  merchantRules,
  setExpenses,
  setMerchantRules,
  setBankSettings,
  syncStateRef,
  now = Date.now(),
  syncFn = syncBankTransactions,
}) {
  const activeConnections = getConnections(bankSettings);
  if (
    !storageLoaded ||
    !hasCredentials(bankSettings) ||
    !activeConnections.length
  ) {
    return Promise.resolve(false);
  }

  if (syncStateRef.current.inFlight) {
    return Promise.resolve(false);
  }

  if (now - syncStateRef.current.lastAttemptAt < AUTO_SYNC_THROTTLE_MS) {
    return Promise.resolve(false);
  }

  syncStateRef.current.inFlight = true;
  syncStateRef.current.lastAttemptAt = now;

  return syncFn(bankSettings, expenses, merchantRules)
    .then(
      ({
        added,
        expenses: reconciledExpenses,
        merchantRules: updatedRules,
        connections: updatedConnections,
        lastSync,
      }) => {
        if (Array.isArray(reconciledExpenses)) {
          setExpenses(reconciledExpenses);
        } else if (added?.length) {
          setExpenses((prev) => [...prev, ...added]);
        }
        if (updatedRules) {
          setMerchantRules(updatedRules);
        }
        if (updatedConnections?.length || lastSync) {
          setBankSettings((prev) => {
            const next = {
              ...prev,
              ...(updatedConnections?.length
                ? { connections: updatedConnections }
                : {}),
              ...(lastSync ? { lastSync } : {}),
            };
            delete next.sessionId;
            delete next.accounts;
            delete next.institutionName;
            return next;
          });
        }
        return true;
      }
    )
    .catch((err) => {
      console.log("Auto-sync notice:", err?.message ?? err);
      return false;
    })
    .finally(() => {
      syncStateRef.current.inFlight = false;
    });
}

export default function App() {
  const [activeTab, setActiveTab] = useState("inicio");
  const [storageLoaded, setStorageLoaded] = useState(false);

  const [expenses, setExpenses] = useState([]);
  const [planningItems, setPlanningItems] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [merchantRules, setMerchantRules] = useState({});
  const [bankSettings, setBankSettings] = useState({});

  useEffect(() => {
    const loadData = async () => {
      try {
        await migrateStorage();
        const data = await loadAll();
        if (Array.isArray(data.expenses)) setExpenses(data.expenses);
        if (Array.isArray(data.planningItems))
          setPlanningItems(data.planningItems);
        if (Array.isArray(data.fixedExpenses))
          setFixedExpenses(data.fixedExpenses);
        if (data.merchantRules && typeof data.merchantRules === "object")
          setMerchantRules(data.merchantRules);
        if (data.bankSettings && typeof data.bankSettings === "object")
          setBankSettings(data.bankSettings);
      } catch (err) {
        console.error("Erro ao carregar storage:", err);
      } finally {
        setStorageLoaded(true);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (storageLoaded) save(KEYS.expenses, expenses);
  }, [expenses, storageLoaded]);

  useEffect(() => {
    if (storageLoaded) save(KEYS.planningItems, planningItems);
  }, [planningItems, storageLoaded]);

  useEffect(() => {
    if (storageLoaded) save(KEYS.fixedExpenses, fixedExpenses);
  }, [fixedExpenses, storageLoaded]);

  useEffect(() => {
    if (storageLoaded) save(KEYS.merchantRules, merchantRules);
  }, [merchantRules, storageLoaded]);

  useEffect(() => {
    if (storageLoaded) save(KEYS.bankSettings, bankSettings);
  }, [bankSettings, storageLoaded]);

  const storageLoadedRef = useRef(storageLoaded);
  const expensesRef = useRef(expenses);
  const merchantRulesRef = useRef(merchantRules);
  const bankSettingsRef = useRef(bankSettings);
  const syncStateRef = useRef({ inFlight: false, lastAttemptAt: 0 });
  const initialAutoSyncedRef = useRef(false);

  useEffect(() => {
    storageLoadedRef.current = storageLoaded;
  }, [storageLoaded]);

  useEffect(() => {
    expensesRef.current = expenses;
  }, [expenses]);

  useEffect(() => {
    merchantRulesRef.current = merchantRules;
  }, [merchantRules]);

  useEffect(() => {
    bankSettingsRef.current = bankSettings;
  }, [bankSettings]);

  const triggerAutoSync = useCallback(() => {
    return runAutoSync({
      storageLoaded: storageLoadedRef.current,
      bankSettings: bankSettingsRef.current,
      expenses: expensesRef.current,
      merchantRules: merchantRulesRef.current,
      setExpenses,
      setMerchantRules,
      setBankSettings,
      syncStateRef,
    });
  }, []);

  useEffect(() => {
    if (!storageLoaded || initialAutoSyncedRef.current) return;
    initialAutoSyncedRef.current = true;
    triggerAutoSync();
  }, [storageLoaded, triggerAutoSync]);

  useEffect(() => {
    if (!storageLoaded) return;

    let cancelled = false;
    let listenerHandle = null;

    Promise.resolve(
      CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          triggerAutoSync();
        }
      })
    )
      .then((handle) => {
        if (cancelled) {
          handle?.remove?.();
        } else {
          listenerHandle = handle;
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      listenerHandle?.remove?.();
    };
  }, [storageLoaded, triggerAutoSync]);

  if (!storageLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="w-6 h-6 border-2 border-hairline border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-canvas flex flex-col max-w-lg mx-auto">
      <main className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === "inicio" && (
          <Home
            expenses={expenses}
            fixedExpenses={fixedExpenses}
            setFixedExpenses={setFixedExpenses}
            setActiveTab={setActiveTab}
          />
        )}
        {activeTab === "periodo" && (
          <Transactions
            expenses={expenses}
            setExpenses={setExpenses}
            fixedExpenses={fixedExpenses}
            setFixedExpenses={setFixedExpenses}
            merchantRules={merchantRules}
            setMerchantRules={setMerchantRules}
          />
        )}
        {activeTab === "planos" && (
          <Plans
            planningItems={planningItems}
            setPlanningItems={setPlanningItems}
          />
        )}
        {activeTab === "bancos" && (
          <Banks
            expenses={expenses}
            setExpenses={setExpenses}
            bankSettings={bankSettings}
            setBankSettings={setBankSettings}
            merchantRules={merchantRules}
            setMerchantRules={setMerchantRules}
          />
        )}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
