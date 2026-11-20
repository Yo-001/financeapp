import React, { useCallback, useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import {
  Check,
  ChevronRight,
  Download,
  KeyRound,
  Landmark,
  Link2,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import BottomSheet from "../components/BottomSheet";
import { formatCurrency, mergeTransactions } from "../services/categories";
import { parseCsvTransactions } from "../services/csv";
import {
  enableBanking,
  extractAuthCode,
  getConnections,
  hasCredentials,
  syncBankTransactions,
} from "../services/enableBanking";

const PRESET_BANKS = [
  "Banco Santander (ES)",
  "Santander Totta (PT)",
  "Revolut",
  "Klarna",
];
const CSV_BANKS = ["Santander", "Revolut", "Klarna", "Genérico"];

function getAccountIban(account) {
  return (
    account?.account_id?.iban ||
    account?.iban ||
    account?.account_number ||
    account?.name ||
    (account?.uid ? String(account.uid).slice(0, 12) : "Conta")
  );
}

function getAccountBalance(account) {
  const list = Array.isArray(account?.balances) ? account.balances : [];
  const preferred =
    list.find((b) => b?.balance_type === "CLBD" || b?.balance_type === "ITAV") ||
    list[0];
  const amount = preferred?.balance_amount?.amount;
  if (amount == null || amount === "") return null;
  const currency = preferred?.balance_amount?.currency || "EUR";
  return currency === "EUR"
    ? formatCurrency(amount)
    : `${Number(amount).toFixed(2)} ${currency}`;
}

function upsertConnection(list, nextConn) {
  const idx = list.findIndex(
    (c) =>
      (nextConn.institutionId && c.institutionId === nextConn.institutionId) ||
      c.id === nextConn.id ||
      c.sessionId === nextConn.sessionId
  );
  if (idx >= 0) {
    return list.map((c, i) => (i === idx ? nextConn : c));
  }
  return [...list, nextConn];
}

export default function Banks({
  expenses = [],
  setExpenses,
  bankSettings = {},
  setBankSettings,
  merchantRules = {},
  setMerchantRules,
}) {
  const csvInputRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [appIdInput, setAppIdInput] = useState(
    bankSettings.ebApplicationId || ""
  );
  const [privateKeyInput, setPrivateKeyInput] = useState(
    bankSettings.ebPrivateKey || ""
  );
  const [redirectUrlInput, setRedirectUrlInput] = useState(
    bankSettings.redirectUrl || "https://enablebanking.com/"
  );
  const [institutions, setInstitutions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [csvBank, setCsvBank] = useState("Santander");
  const [csvPreview, setCsvPreview] = useState(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [authCodeInput, setAuthCodeInput] = useState("");
  const [validatingAuth, setValidatingAuth] = useState(false);

  const validatingRef = useRef(false);
  const latestRef = useRef({
    bankSettings,
    expenses,
    merchantRules,
    setBankSettings,
    setExpenses,
    setMerchantRules,
  });

  useEffect(() => {
    latestRef.current = {
      bankSettings,
      expenses,
      merchantRules,
      setBankSettings,
      setExpenses,
      setMerchantRules,
    };
  }, [
    bankSettings,
    expenses,
    merchantRules,
    setBankSettings,
    setExpenses,
    setMerchantRules,
  ]);

  const connections = getConnections(bankSettings);
  const credsConfigured = hasCredentials(bankSettings);
  const connected = Boolean(credsConfigured && connections.length > 0);

  const completeAuth = useCallback(async (rawCodeOrUrl) => {
    const code = extractAuthCode(rawCodeOrUrl);
    if (!code) {
      setStatus({
        type: "error",
        msg: "Código de autorização não encontrado. Cole a URL de retorno ou o código.",
      });
      return;
    }

    if (validatingRef.current) return;
    validatingRef.current = true;
    setValidatingAuth(true);
    setStatus({ type: "info", msg: "Validando autorização e buscando contas…" });

    try {
      const {
        bankSettings: currentSettings,
        expenses: currentExpenses,
        merchantRules: currentRules,
        setBankSettings: updateBankSettings,
        setExpenses: updateExpenses,
        setMerchantRules: updateMerchantRules,
      } = latestRef.current;

      const { session_id, accounts } = await enableBanking.exchangeCodeForSession(
        currentSettings.ebApplicationId,
        currentSettings.ebPrivateKey,
        code
      );

      const normalizedAccounts = (accounts || []).map((acc) =>
        typeof acc === "string" ? { uid: acc } : acc
      );

      const pendingBank = currentSettings.pendingBank || null;
      const newConn = {
        id: pendingBank?.id || session_id,
        institutionId: pendingBank?.id || "",
        institutionName:
          pendingBank?.name ||
          currentSettings.institutionName ||
          "Banco conectado",
        sessionId: session_id,
        accounts: normalizedAccounts,
        lastSync: null,
      };

      updateBankSettings((prev) => {
        const nextConnections = upsertConnection(getConnections(prev), newConn);
        const next = { ...prev, connections: nextConnections };
        delete next.pendingBank;
        delete next.sessionId;
        delete next.accounts;
        delete next.institutionName;
        return next;
      });
      setShowCodeModal(false);
      setAuthCodeInput("");

      setStatus({
        type: "info",
        msg: "Sessão criada! Buscando saldos e transações…",
      });

      const {
        added,
        duplicates,
        expenses: reconciledExpenses,
        merchantRules: updatedRules,
        connections: syncedConnections,
        accounts: syncedAccounts,
        lastSync,
      } = await syncBankTransactions(
        { ...currentSettings, connections: [newConn] },
        currentExpenses,
        currentRules
      );

      const syncedConn = syncedConnections?.[0] || {
        ...newConn,
        accounts: syncedAccounts?.length ? syncedAccounts : normalizedAccounts,
        lastSync,
      };

      if (added.length) {
        updateExpenses(
          Array.isArray(reconciledExpenses)
            ? reconciledExpenses
            : (prev) => [...prev, ...added]
        );
      }
      if (updatedRules && updateMerchantRules) {
        updateMerchantRules(updatedRules);
      }
      updateBankSettings((prev) => {
        const nextConnections = upsertConnection(getConnections(prev), syncedConn);
        const next = {
          ...prev,
          connections: nextConnections,
          lastSync,
        };
        delete next.pendingBank;
        delete next.sessionId;
        delete next.accounts;
        delete next.institutionName;
        return next;
      });

      const totalAccounts =
        syncedConn.accounts?.length || normalizedAccounts.length;
      if (totalAccounts === 0) {
        setStatus({
          type: "error",
          msg: `Autorização validada (${syncedConn.institutionName}), mas 0 contas foram vinculadas. Reautorize e selecione suas contas no banco.`,
        });
      } else {
        setStatus({
          type: "ok",
          msg: `Autorização validada (${syncedConn.institutionName})! ${totalAccounts} conta(s) conectada(s) e ${added.length} novas transações importadas${
            duplicates ? ` (${duplicates} duplicadas ignoradas)` : ""
          }.`,
        });
      }
    } catch (err) {
      setStatus({
        type: "error",
        msg: "Falha ao validar autorização: " + (err.message || err),
      });
    } finally {
      validatingRef.current = false;
      setValidatingAuth(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const webCode = params.get("code");
    if (webCode && hasCredentials(latestRef.current.bankSettings)) {
      const fullUrl = window.location.href;
      window.history.replaceState({}, "", window.location.pathname);
      completeAuth(fullUrl);
    }

    let appListener;
    let browserListener;
    let cancelled = false;

    if (Capacitor.isNativePlatform()) {
      Promise.resolve(
        CapacitorApp?.addListener?.("appUrlOpen", (event) => {
          const url = event?.url;
          if (url && extractAuthCode(url)) {
            Browser?.close?.().catch(() => {});
            completeAuth(url);
          }
        })
      )
        .then((handle) => {
          if (cancelled) handle?.remove?.();
          else appListener = handle;
        })
        .catch(() => {});

      Promise.resolve(
        Browser?.addListener?.("browserPageLoaded", (event) => {
          const url = event?.url;
          if (url && extractAuthCode(url)) {
            Browser?.close?.().catch(() => {});
            completeAuth(url);
          }
        })
      )
        .then((handle) => {
          if (cancelled) handle?.remove?.();
          else browserListener = handle;
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      Promise.resolve(appListener)
        .then((handle) => handle?.remove?.())
        .catch(() => {});
      Promise.resolve(browserListener)
        .then((handle) => handle?.remove?.())
        .catch(() => {});
    };
  }, [completeAuth]);

  const saveCredentials = () => {
    if (!appIdInput.trim() || !privateKeyInput.trim()) return;
    setBankSettings({
      ...bankSettings,
      ebApplicationId: appIdInput.trim(),
      ebPrivateKey: privateKeyInput.trim(),
      redirectUrl: redirectUrlInput.trim() || "https://enablebanking.com/",
    });
    setShowCredsModal(false);
    setStatus({
      type: "ok",
      msg: "Credenciais salvas neste dispositivo.",
    });
  };

  const fetchBanks = async () => {
    setStatus({ type: "info", msg: "Buscando bancos…" });
    try {
      const results = await Promise.allSettled([
        enableBanking.listAspsps(
          bankSettings.ebApplicationId,
          bankSettings.ebPrivateKey,
          "ES"
        ),
        enableBanking.listAspsps(
          bankSettings.ebApplicationId,
          bankSettings.ebPrivateKey,
          "PT"
        ),
      ]);
      const list = results.flatMap((res) =>
        res.status === "fulfilled" ? res.value : []
      );
      if (!list.length && results.every((res) => res.status === "rejected")) {
        throw results[0].reason;
      }
      setInstitutions(list);
      setStatus(null);
    } catch {
      setInstitutions([]);
      setStatus({
        type: "error",
        msg: "Falha ao buscar bancos: verifique as credenciais e sua conexão.",
      });
    }
  };

  const connectBank = async (bank) => {
    setStatus({ type: "info", msg: `Criando autorização para ${bank.name}…` });
    try {
      const authUrl = await enableBanking.startAuth(
        bankSettings.ebApplicationId,
        bankSettings.ebPrivateKey,
        bank.id,
        bankSettings.redirectUrl
      );
      setBankSettings((prev) => ({
        ...prev,
        pendingBank: { id: bank.id, name: bank.name },
      }));
      if (Capacitor.isNativePlatform() && Browser?.open) {
        await Browser.open({ url: authUrl });
      } else {
        window.open(authUrl, "_blank");
      }
      setShowCodeModal(true);
      setStatus({
        type: "info",
        msg: `Autorize ${bank.name} no navegador e cole a URL de retorno caso não redirecione automaticamente.`,
      });
    } catch (err) {
      setStatus({
        type: "error",
        msg: "Falha ao criar autorização: " + (err.message || err),
      });
    }
  };

  const reauthorizeConnection = (conn) => {
    if (conn.institutionId && conn.institutionId.includes("|")) {
      connectBank({
        id: conn.institutionId,
        name: conn.institutionName || conn.institutionId.split("|")[0],
      });
      return;
    }
    fetchBanks();
  };

  const handleSync = async () => {
    setStatus({ type: "info", msg: "Sincronizando todos os bancos…" });
    try {
      const {
        added,
        duplicates,
        expenses: reconciledExpenses,
        merchantRules: updatedRules,
        connections: syncedConnections,
        accounts,
        lastSync,
      } = await syncBankTransactions(bankSettings, expenses, merchantRules);
      if (added.length) {
        setExpenses(
          Array.isArray(reconciledExpenses)
            ? reconciledExpenses
            : (prev) => [...prev, ...added]
        );
      }
      if (updatedRules && setMerchantRules) {
        setMerchantRules(updatedRules);
      }
      setBankSettings((prev) => {
        const next = {
          ...prev,
          connections: syncedConnections,
          lastSync,
        };
        delete next.sessionId;
        delete next.accounts;
        delete next.institutionName;
        return next;
      });
      if (!accounts.length) {
        setStatus({
          type: "error",
          msg: "Nenhuma conta vinculada. Reautorize e selecione suas contas no banco.",
        });
        return;
      }
      setStatus({
        type: "ok",
        msg: `${added.length} novas transações importadas${
          duplicates ? `, ${duplicates} duplicadas ignoradas` : ""
        }.`,
      });
    } catch (err) {
      setStatus({
        type: "error",
        msg: "Falha na sincronização: " + (err.message || err),
      });
    }
  };

  const handleSyncConnection = async (connectionId) => {
    const target = connections.find((c) => c.id === connectionId);
    if (!target) return;
    setStatus({
      type: "info",
      msg: `Sincronizando ${target.institutionName || "banco"}…`,
    });
    try {
      const {
        added,
        duplicates,
        expenses: reconciledExpenses,
        merchantRules: updatedRules,
        connections: syncedConnections,
        accounts,
        lastSync,
      } = await syncBankTransactions(
        { ...bankSettings, connections: [target] },
        expenses,
        merchantRules
      );
      const updatedConn = syncedConnections?.[0] || { ...target, accounts, lastSync };
      if (added.length) {
        setExpenses(
          Array.isArray(reconciledExpenses)
            ? reconciledExpenses
            : (prev) => [...prev, ...added]
        );
      }
      if (updatedRules && setMerchantRules) {
        setMerchantRules(updatedRules);
      }
      setBankSettings((prev) => {
        const nextConnections = upsertConnection(getConnections(prev), updatedConn);
        const next = {
          ...prev,
          connections: nextConnections,
          lastSync,
        };
        delete next.sessionId;
        delete next.accounts;
        delete next.institutionName;
        return next;
      });
      if (!accounts.length) {
        setStatus({
          type: "error",
          msg: "Nenhuma conta vinculada. Reautorize e selecione suas contas no banco.",
        });
        return;
      }
      setStatus({
        type: "ok",
        msg: `${target.institutionName || "Banco"}: ${added.length} novas transações importadas${
          duplicates ? `, ${duplicates} duplicadas ignoradas` : ""
        }.`,
      });
    } catch (err) {
      setStatus({
        type: "error",
        msg: "Falha na sincronização: " + (err.message || err),
      });
    }
  };

  const disconnectBank = (connectionId) => {
    const target = connections.find((c) => c.id === connectionId);
    const label = target?.institutionName || "este banco";
    if (
      !window.confirm(
        `Desconectar ${label}? As transações importadas permanecem.`
      )
    ) {
      return;
    }
    const remaining = connections.filter((c) => c.id !== connectionId);
    const next = { ...bankSettings, connections: remaining };
    delete next.sessionId;
    delete next.accounts;
    delete next.institutionName;
    if (!remaining.length) {
      delete next.lastSync;
    }
    setBankSettings(next);
    setInstitutions([]);
  };

  const handleCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsvTransactions(reader.result, csvBank);
      if (parsed.error) {
        setStatus({ type: "error", msg: parsed.error });
        return;
      }
      if (!parsed.transactions.length) {
        setStatus({
          type: "error",
          msg: "Nenhuma transação reconhecida neste CSV.",
        });
        return;
      }
      setCsvPreview({ bank: csvBank, rows: parsed.transactions });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const confirmCsvImport = () => {
    const {
      added,
      merchantRules: nextRules,
      expenses: reconciledExpenses,
    } = mergeTransactions(
      expenses,
      csvPreview.rows,
      merchantRules
    );
    setExpenses(
      Array.isArray(reconciledExpenses)
        ? reconciledExpenses
        : [...expenses, ...added]
    );
    setMerchantRules(nextRules);
    const skipped = csvPreview.rows.length - added.length;
    setCsvPreview(null);
    setStatus({
      type: "ok",
      msg: `${added.length} transações do CSV adicionadas${
        skipped ? `, ${skipped} duplicadas/entradas ignoradas` : ""
      }.`,
    });
  };

  const exportBackup = () => {
    const payload = JSON.stringify(
      {
        expenses,
        bankSettings,
        merchantRules,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
    const blob = new Blob([payload], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `financeapp-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!Array.isArray(parsed.expenses)) {
          throw new Error("formato inválido");
        }
        const { added, merchantRules: nextRules } = mergeTransactions(
          expenses,
          parsed.expenses,
          merchantRules
        );
        setExpenses([...expenses, ...added]);
        if (parsed.merchantRules) {
          setMerchantRules({ ...merchantRules, ...parsed.merchantRules });
        } else {
          setMerchantRules(nextRules);
        }
        setStatus({
          type: "ok",
          msg: `Backup importado: ${added.length} transações mescladas.`,
        });
      } catch (err) {
        setStatus({
          type: "error",
          msg: "Backup inválido: " + (err.message || err),
        });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const wipeAllData = () => {
    if (
      !window.confirm(
        "Apagar TODOS os dados (gastos, regras, conexão de banco)? Exporte um backup antes."
      )
    ) {
      return;
    }
    setExpenses([]);
    setMerchantRules({});
    setBankSettings({});
  };

  return (
    <div className="page-top">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">Bancos</h1>
        <p className="text-[13px] text-soft mt-0.5">
          Open banking e importação
        </p>
      </div>

      {status && (
        <div
          className={`mt-4 px-4 py-3 rounded-2xl text-[13px] leading-relaxed ${
            status.type === "error"
              ? "bg-danger-soft text-danger"
              : status.type === "ok"
              ? "bg-ok-soft text-ok"
              : "bg-canvas text-soft"
          }`}
        >
          {status.msg}
        </div>
      )}

      {!connected ? (
        <div className="card mt-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-canvas rounded-xl flex items-center justify-center">
              <Landmark className="w-5 h-5 text-faint" strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[15px] font-medium">
                {credsConfigured
                  ? "Autorização pendente"
                  : "Nenhum banco conectado"}
              </h4>
              <p className="text-[12px] text-soft">
                {credsConfigured
                  ? "Credenciais salvas. Autorize o banco abaixo para sincronizar."
                  : "Conecte via open banking (Enable Banking)"}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {connections.map((conn) => (
            <div key={conn.id} className="card px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-canvas rounded-xl flex items-center justify-center">
                  <Landmark
                    className="w-5 h-5 text-accent"
                    strokeWidth={1.8}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[15px] font-medium truncate">
                    {conn.institutionName || "Banco conectado"}
                  </h4>
                  <p className="text-[12px] text-soft">
                    {conn.accounts?.length || 0} conta(s) ·{" "}
                    {conn.lastSync
                      ? "últ. sync " + conn.lastSync.slice(0, 10)
                      : "sem sync"}
                  </p>
                </div>
                <button
                  onClick={() => handleSyncConnection(conn.id)}
                  className="p-2.5 bg-accent-soft rounded-xl text-accent-dark hover:brightness-95 transition"
                  aria-label={`Sincronizar ${conn.institutionName || "banco"}`}
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {Array.isArray(conn.accounts) && conn.accounts.length > 0 ? (
                <div className="mt-3 pt-3 border-t border-hairline space-y-1.5">
                  {conn.accounts.map((acc, idx) => {
                    const balanceText = getAccountBalance(acc);
                    return (
                      <div
                        key={acc.uid || acc.id || idx}
                        className="flex justify-between items-center text-[12px]"
                      >
                        <span className="text-soft truncate mr-2">
                          {getAccountIban(acc)}
                        </span>
                        {balanceText && (
                          <span className="font-semibold tnum flex-shrink-0">
                            {balanceText}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t border-hairline flex items-center justify-between gap-3">
                  <p className="text-[12px] text-danger leading-snug">
                    0 contas vinculadas · selecione suas contas ao autorizar no banco
                  </p>
                  <button
                    onClick={() => reauthorizeConnection(conn)}
                    className="px-3 py-1.5 bg-accent-soft text-accent-dark rounded-xl text-[12px] font-semibold flex-shrink-0 hover:brightness-95 transition"
                  >
                    Reautorizar
                  </button>
                </div>
              )}

              <button
                onClick={() => disconnectBank(conn.id)}
                className="mt-3 text-[12px] text-faint hover:text-danger transition"
              >
                Desconectar banco
              </button>
            </div>
          ))}

          <button
            onClick={handleSync}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Sincronizar todos os bancos
          </button>
        </div>
      )}

      <div className="card mt-4 px-5 py-4">
        <h2 className="text-sm font-semibold tracking-tight mb-1">
          {connected ? "Adicionar outro banco" : "Adicionar banco"}
        </h2>
        <p className="text-[12px] text-soft leading-relaxed">
          Fluxo PSD2: você autoriza no site do banco e as transações entram
          automaticamente. Funciona com Santander (ES/PT) e Revolut, entre
          outros.
        </p>

        {institutions.length === 0 ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              {PRESET_BANKS.map((bank) => (
                <span
                  key={bank}
                  className="px-3 py-1.5 bg-canvas rounded-full text-[12px] text-soft"
                >
                  {bank}
                </span>
              ))}
            </div>
            <button className="btn-secondary" onClick={fetchBanks}>
              Buscar bancos disponíveis
            </button>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                className="text-[12px] text-faint hover:text-soft transition flex items-center gap-1.5"
                onClick={() => setShowCredsModal(true)}
              >
                <KeyRound className="w-3.5 h-3.5" /> Configurar credenciais da
                API
              </button>
              {credsConfigured && (
                <button
                  className="text-[12px] text-faint hover:text-soft transition flex items-center gap-1.5"
                  onClick={() => setShowCodeModal(true)}
                >
                  <Link2 className="w-3.5 h-3.5" /> Colar código / link de
                  retorno
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <input
              className="field"
              placeholder="Buscar banco (ex.: Santander, Revolut)…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="max-h-52 overflow-y-auto -mx-1">
              {institutions
                .filter((inst) => {
                  const label = `${inst.name || ""} (${inst.country || ""})`.toLowerCase();
                  return label.includes(searchQuery.toLowerCase());
                })
                .slice(0, 30)
                .map((inst) => (
                  <button
                    key={inst.id}
                    onClick={() => connectBank(inst)}
                    className="w-full flex justify-between items-center px-1 py-2.5 text-left hover:bg-canvas rounded-xl transition"
                  >
                    <span className="text-sm">
                      {inst.name}
                      {inst.country ? (
                        <span className="text-faint text-xs ml-1.5">
                          ({inst.country})
                        </span>
                      ) : null}
                    </span>
                    <ChevronRight className="w-4 h-4 text-faint" />
                  </button>
                ))}
            </div>
            <div className="flex items-center justify-between">
              <button
                className="text-[12px] text-faint hover:text-soft"
                onClick={() => setInstitutions([])}
              >
                Fechar lista
              </button>
              <button
                className="text-[12px] text-accent hover:underline flex items-center gap-1"
                onClick={() => setShowCodeModal(true)}
              >
                <Link2 className="w-3.5 h-3.5" /> Colar código / link de retorno
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card mt-4 px-5 py-4">
        <h2 className="text-sm font-semibold tracking-tight mb-1">
          Importar extrato CSV
        </h2>
        <p className="text-[12px] text-soft leading-relaxed">
          Para Klarna e outros bancos sem API: exporte o CSV no app do banco e
          importe aqui.
        </p>
        <div className="flex gap-2 mt-3">
          {CSV_BANKS.map((bank) => (
            <button
              key={bank}
              onClick={() => setCsvBank(bank)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition ${
                csvBank === bank
                  ? "bg-accent text-white"
                  : "bg-canvas text-soft"
              }`}
            >
              {bank}
            </button>
          ))}
        </div>
        <button
          className="btn-secondary mt-3 flex items-center justify-center gap-2"
          onClick={() => csvInputRef.current?.click()}
        >
          <Upload className="w-4 h-4" /> Escolher arquivo CSV
        </button>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleCsvFile}
        />
      </div>

      <div className="card mt-4 px-5 py-4">
        <h2 className="text-sm font-semibold tracking-tight mb-3">
          Dados e backup
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="btn-secondary flex items-center justify-center gap-2"
            onClick={exportBackup}
          >
            <Download className="w-4 h-4" /> Exportar
          </button>
          <button
            className="btn-secondary flex items-center justify-center gap-2"
            onClick={() => document.getElementById("backup-import")?.click()}
          >
            <Upload className="w-4 h-4" /> Importar
          </button>
        </div>
        <input
          id="backup-import"
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={importBackup}
        />
        <button
          onClick={wipeAllData}
          className="mt-3 w-full py-2.5 text-[13px] font-semibold text-danger flex items-center justify-center gap-2 hover:bg-danger-soft rounded-xl transition"
        >
          <Trash2 className="w-4 h-4" /> Apagar todos os dados
        </button>
      </div>

      <BottomSheet
        open={!!csvPreview}
        title="Confirmar importação"
        onClose={() => setCsvPreview(null)}
      >
        {csvPreview && (
          <>
            <p className="text-sm text-soft">
              <span className="font-semibold text-ink">
                {csvPreview.rows.length}
              </span>{" "}
              transações encontradas ({csvPreview.bank}). Prévia:
            </p>
            <div className="mt-3 space-y-2">
              {csvPreview.rows.slice(0, 8).map((row, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center bg-canvas rounded-xl px-4 py-2.5"
                >
                  <div className="min-w-0 mr-3">
                    <p className="text-sm font-medium truncate">{row.name}</p>
                    <p className="text-[11px] text-faint tnum">{row.date}</p>
                  </div>
                  <span className="text-sm font-semibold tnum flex-shrink-0">
                    €{Number(row.value).toFixed(2)} ·{" "}
                    {row.paid ? "pago" : "pend."}
                  </span>
                </div>
              ))}
            </div>
            <button
              className="btn-primary mt-4 flex items-center justify-center gap-2"
              onClick={confirmCsvImport}
            >
              <Check className="w-4 h-4" /> Importar tudo
            </button>
          </>
        )}
      </BottomSheet>

      <BottomSheet
        open={showCredsModal}
        title="Credenciais Enable Banking"
        onClose={() => setShowCredsModal(false)}
      >
        <p className="text-[13px] text-soft leading-relaxed">
          No <span className="font-medium">Control Panel</span> da Enable
          Banking, crie um aplicativo (produção) — o navegador gera o{" "}
          <span className="font-medium">Application ID</span> e baixa a{" "}
          <span className="font-medium">chave privada (.pem)</span>. Cole os
          dois aqui. Ficam salvos só neste dispositivo.
        </p>
        <div className="space-y-3 mt-4">
          <input
            className="field"
            placeholder="Application ID (ex.: 8a4b…)"
            value={appIdInput}
            onChange={(e) => setAppIdInput(e.target.value)}
          />
          <textarea
            className="field font-mono text-[11px]"
            rows={5}
            placeholder={"-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----"}
            value={privateKeyInput}
            onChange={(e) => setPrivateKeyInput(e.target.value)}
          />
          <input
            className="field"
            placeholder="https://enablebanking.com/"
            value={redirectUrlInput}
            onChange={(e) => setRedirectUrlInput(e.target.value)}
          />
          <button className="btn-primary" onClick={saveCredentials}>
            Salvar credenciais
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={showCodeModal}
        title="Validar autorização"
        onClose={() => setShowCodeModal(false)}
      >
        <p className="text-[13px] text-soft leading-relaxed">
          Se o navegador não redirecionou automaticamente, cole a URL de retorno
          ou o código de autorização aqui
        </p>
        <div className="space-y-3 mt-4">
          <input
            className="field"
            placeholder="https://enablebanking.com/?code=… ou código"
            value={authCodeInput}
            onChange={(e) => setAuthCodeInput(e.target.value)}
          />
          <button
            className="btn-primary"
            disabled={validatingAuth || !authCodeInput.trim()}
            onClick={() => completeAuth(authCodeInput)}
          >
            {validatingAuth ? "Validando…" : "Validar autorização"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
