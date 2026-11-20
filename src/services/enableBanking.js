import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { getWeekForDate, mergeTransactions } from "./categories.js";

export { getWeekForDate };

const PROD_API_BASE = "https://api.enablebanking.com";
const DEV_PROXY_BASE = "/api-eb";
const REDIRECT_URL = "https://enablebanking.com/";

function getApiBase() {
  if (!Capacitor.isNativePlatform() && import.meta.env?.DEV) {
    return DEV_PROXY_BASE;
  }
  return PROD_API_BASE;
}

function getDefaultRedirectUrl() {
  return REDIRECT_URL;
}

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function pemToArrayBuffer(pem) {
  const cleaned = String(pem)
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s+/g, "");
  const decoded = atob(cleaned);
  return Uint8Array.from(decoded, (ch) => ch.charCodeAt(0)).buffer;
}

async function createJwt(appId, privateKeyPem) {
  if (!appId || !privateKeyPem) {
    throw new Error("Configure as credenciais da API (Application ID / chave privada).");
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const encoder = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: "JWT", alg: "RS256", kid: appId };
  const payload = {
    iss: "enablebanking.com",
    aud: "api.enablebanking.com",
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${toBase64Url(encoder.encode(JSON.stringify(header)))}.${toBase64Url(
    encoder.encode(JSON.stringify(payload))
  )}`;
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    encoder.encode(unsigned)
  );

  return `${unsigned}.${toBase64Url(new Uint8Array(signature))}`;
}

async function ebRequest(method, path, { appId, key, body, headers: extraHeaders } = {}) {
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  if (appId) {
    headers.Authorization = `Bearer ${await createJwt(appId, key)}`;
  }

  const options = {
    url: `${getApiBase()}${path}`,
    method,
    headers,
    ...(body ? { data: body } : {}),
  };

  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.request(options);
    if (res.status >= 400) {
      const msg = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
      throw new Error(`EnableBanking ${res.status}: ${msg.slice(0, 200)}`);
    }
    return res.data;
  }

  const res = await fetch(options.url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const msg = (await res.text()).slice(0, 200);
    throw new Error(`EnableBanking ${res.status}: ${msg}`);
  }
  return res.json();
}

export function mapEnableBankingTx(accountUid, tx, institutionName = "") {
  if (!tx?.transaction_amount) return null;

  const rawAmount = Number(tx.transaction_amount.amount);
  if (Number.isNaN(rawAmount) || rawAmount === 0) return null;

  const indicator = String(tx.credit_debit_indicator || "").trim().toUpperCase();
  const isDebit = indicator ? indicator === "DBIT" : rawAmount < 0;
  if (!isDebit) return null;

  const amount = Math.abs(rawAmount);
  const rawName =
    (Array.isArray(tx.remittance_information)
      ? tx.remittance_information.join(" ")
      : tx.remittance_information) ||
    tx.creditor?.name ||
    tx.debtor?.name ||
    "Transação bancária";
  const rawDate = tx.transaction_date || tx.booking_date;
  const date = rawDate ? String(rawDate).slice(0, 10) : "";

  if (!date || amount <= 0) return null;

  const shortAcc = String(accountUid || "").slice(0, 8);
  const ref =
    tx.entry_reference ||
    tx.transaction_id ||
    `${date}:${amount}:${String(rawName).trim().toLowerCase().slice(0, 16)}`;

  return {
    id: `eb:${shortAcc}:${ref}`,
    name: String(rawName).trim().slice(0, 80),
    value: amount,
    date,
    week: getWeekForDate(date),
    category: null,
    paid: tx.status === "BOOK",
    source: "bank",
    bank: institutionName || "",
    account: shortAcc,
  };
}

export function extractAuthCode(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";

  if (raw.includes("://") || raw.includes("code=") || raw.includes("?") || raw.includes("#")) {
    try {
      const parsed = new URL(raw.startsWith("http") || raw.includes("://") ? raw : `https://localhost/${raw.replace(/^\//, "")}`);
      const fromSearch = parsed.searchParams.get("code");
      if (fromSearch) return fromSearch.trim();

      if (parsed.hash) {
        const hashParams = new URLSearchParams(parsed.hash.replace(/^#\/?/, ""));
        const fromHash = hashParams.get("code");
        if (fromHash) return fromHash.trim();
      }
    } catch {
      // fallback to regex below
    }

    const match = raw.match(/[?&#]code=([^&#\s]+)/);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1]).trim();
      } catch {
        return match[1].trim();
      }
    }
    return "";
  }

  return raw;
}

export const enableBanking = {
  async listAspsps(appId, key, country) {
    const data = await ebRequest("GET", `/aspsps?country=${encodeURIComponent(country)}`, {
      appId,
      key,
    });
    return (data.aspsps || []).map((item) => ({
      id: `${item.name}|${item.country}`,
      name: item.name,
      country: item.country,
    }));
  },

  async startAuth(appId, key, institutionId, redirectUrl) {
    const [name, country] = institutionId.split("|");
    let maxValidity = 180 * 86400;

    try {
      const data = await ebRequest("GET", `/aspsps?country=${encodeURIComponent(country)}`, {
        appId,
        key,
      });
      const list = Array.isArray(data) ? data : data.aspsps || [];
      const found = list.find((item) => item.name === name);
      if (found?.maximum_consent_validity > 0) {
        maxValidity = found.maximum_consent_validity;
      }
    } catch {
      // fallback to 180 days
    }

    const validUntil = new Date(Date.now() + Math.max(maxValidity - 60, 3600) * 1000);
    validUntil.setMilliseconds(0);

    const auth = await ebRequest("POST", "/auth", {
      appId,
      key,
      body: {
        access: {
          valid_until: validUntil,
          balances: true,
          transactions: true,
        },
        aspsp: { name, country },
        state: crypto.randomUUID(),
        redirect_url: redirectUrl || getDefaultRedirectUrl(),
        psu_type: "personal",
      },
    });

    return auth.url;
  },

  async exchangeCodeForSession(appId, key, code) {
    const cleanCode = extractAuthCode(code);
    if (!cleanCode) {
      throw new Error("Código de autorização inválido ou vazio.");
    }

    const data = await ebRequest("POST", "/sessions", {
      appId,
      key,
      body: { code: cleanCode },
    });

    return {
      session_id: data.session_id,
      accounts: data.accounts || [],
    };
  },

  async listAccounts(appId, key, sessionId) {
    if (!sessionId) {
      return [];
    }

    const data = await ebRequest("GET", `/sessions/${encodeURIComponent(sessionId)}`, {
      appId,
      key,
      headers: { "X-Session-Id": sessionId },
    });
    console.log("DEBUG RAW SESSION:", JSON.stringify(data));
    return Array.isArray(data?.accounts) ? data.accounts : [];
  },

  async balances(appId, key, accountUid, sessionId) {
    const data = await ebRequest("GET", `/accounts/${encodeURIComponent(accountUid)}/balances`, {
      appId,
      key,
      ...(sessionId ? { headers: { "X-Session-Id": sessionId } } : {}),
    });
    return data.balances || [];
  },

  async transactions(appId, key, accountUid, sessionId, dateFrom, institutionName = "") {
    const collected = [];
    let continuationKey = null;

    do {
      const params = new URLSearchParams();
      if (dateFrom) {
        params.set("date_from", dateFrom);
      }
      if (continuationKey) {
        params.set("continuation_key", continuationKey);
      }
      const qs = params.toString();
      const query = qs ? `?${qs}` : "";

      const data = await ebRequest(
        "GET",
        `/accounts/${encodeURIComponent(accountUid)}/transactions${query}`,
        {
          appId,
          key,
          ...(sessionId ? { headers: { "X-Session-Id": sessionId } } : {}),
        }
      );

      for (const tx of data.transactions || []) {
        const mapped = mapEnableBankingTx(accountUid, tx, institutionName);
        if (mapped) collected.push(mapped);
      }

      continuationKey = data.continuation_key;
    } while (continuationKey);

    return collected;
  },
};

export function getCredentials(bankSettings = {}) {
  return {
    appId: bankSettings.ebApplicationId || "",
    key: bankSettings.ebPrivateKey || "",
  };
}

export function hasCredentials(bankSettings = {}) {
  const { appId, key } = getCredentials(bankSettings);
  return Boolean(appId && key);
}

export function getConnections(bankSettings = {}) {
  if (Array.isArray(bankSettings.connections) && bankSettings.connections.length > 0) {
    return bankSettings.connections.filter((c) => c && c.sessionId);
  }
  if (bankSettings.sessionId) {
    return [
      {
        id: bankSettings.institutionId || bankSettings.sessionId,
        institutionId: bankSettings.institutionId || "",
        institutionName: bankSettings.institutionName || "",
        sessionId: bankSettings.sessionId,
        accounts: Array.isArray(bankSettings.accounts) ? bankSettings.accounts : [],
        lastSync: bankSettings.lastSync || null,
      },
    ];
  }
  return [];
}

function getDateFrom(lastSync) {
  const lastSyncMs = lastSync ? new Date(lastSync).getTime() : NaN;
  const dateFromMs = Number.isFinite(lastSyncMs)
    ? lastSyncMs - 14 * 86400 * 1000
    : Date.now() - 90 * 86400 * 1000;
  return new Date(dateFromMs).toISOString().slice(0, 10);
}

export async function syncBankTransactions(
  bankSettings = {},
  existingExpenses = [],
  merchantRules = {}
) {
  const { appId, key } = getCredentials(bankSettings);
  if (!appId || !key) {
    throw new Error("Credenciais da API não configuradas.");
  }

  const connections = getConnections(bankSettings);
  if (!connections.length) {
    throw new Error("Sessão bancária ausente. Autorize o banco antes de sincronizar.");
  }

  const incoming = [];
  const updatedConnections = [];
  const syncTimestamp = new Date().toISOString();

  for (const conn of connections) {
    const sessionId = conn.sessionId;
    let accounts = await enableBanking.listAccounts(appId, key, sessionId);
    if (!accounts.length && Array.isArray(conn.accounts) && conn.accounts.length) {
      accounts = conn.accounts;
    }

    const dateFrom = getDateFrom(conn.lastSync || bankSettings.lastSync);
    const enrichedAccounts = [];

    for (const account of accounts) {
      const uid = typeof account === "string" ? account : account?.uid || account?.id;
      if (!uid) continue;
      const accountObj = typeof account === "string" ? { uid: account } : account;

      let accountBalances = accountObj.balances || [];
      try {
        accountBalances = await enableBanking.balances(appId, key, uid, sessionId);
      } catch {
        // keep existing balances if endpoint is unavailable for this account
      }

      const txs = await enableBanking.transactions(
        appId,
        key,
        uid,
        sessionId,
        dateFrom,
        conn.institutionName || ""
      );
      incoming.push(...txs);
      enrichedAccounts.push({ ...accountObj, balances: accountBalances });
    }

    const connBase = { ...conn };
    delete connBase.warning;

    updatedConnections.push({
      ...connBase,
      accounts: enrichedAccounts,
      lastSync: syncTimestamp,
      ...(accounts.length === 0
        ? { warning: "Nenhuma conta foi selecionada no banco" }
        : {}),
    });
  }

  const {
    added,
    duplicates,
    expenses: reconciledExpenses,
    merchantRules: updatedRules,
  } = mergeTransactions(
    existingExpenses,
    incoming,
    merchantRules
  );

  return {
    added,
    duplicates,
    expenses: reconciledExpenses,
    merchantRules: updatedRules,
    connections: updatedConnections,
    accounts: updatedConnections.flatMap((c) => c.accounts || []),
    lastSync: syncTimestamp,
  };
}
