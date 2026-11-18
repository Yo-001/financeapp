import { Preferences } from "@capacitor/preferences";

/**
 * Única porta de entrada do storage do app.
 *
 * Nativo (Android): Capacitor Preferences.
 * Browser: o plugin Preferences já grava em localStorage; quando o plugin não
 * existe (ambiente sem Capacitor, testes em Node) cai para localStorage cru.
 *
 * Nenhuma migração apaga a chave antiga do localStorage nesta versão.
 */
export const KEYS = {
  expenses: "expenses",
  planningItems: "planningItems",
  fixedExpenses: "fixedExpenses",
  merchantRules: "merchantRules",
  bankSettings: "bankSettings",
  schemaVersion: "schemaVersion",
  backupBeforeMigrate: "backupBeforeMigrate",
};

const DEFAULTS = {
  [KEYS.expenses]: [],
  [KEYS.planningItems]: [],
  [KEYS.fixedExpenses]: [],
  [KEYS.merchantRules]: {},
  [KEYS.bankSettings]: {},
};

function localStore() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Valor cru apenas do Preferences; null se a chave não existe ou o plugin não está disponível. */
export async function readPreferences(key) {
  try {
    const { value } = await Preferences.get({ key });
    return value ?? null;
  } catch (err) {
    console.warn(`storage: Preferences indisponível para "${key}", tentando localStorage`, err);
    return null;
  }
}

/** Valor cru de uma chave, ou null. */
export async function readRaw(key) {
  const fromPreferences = await readPreferences(key);
  if (fromPreferences !== null) return fromPreferences;

  const ls = localStore();
  if (!ls) return null;
  try {
    return ls.getItem(key);
  } catch {
    return null;
  }
}

/** Grava um valor cru. Devolve true se persistiu. */
export async function writeRaw(key, value) {
  try {
    await Preferences.set({ key, value });
    return true;
  } catch (err) {
    console.warn(`storage: falha ao gravar "${key}" em Preferences, tentando localStorage`, err);
    const ls = localStore();
    if (!ls) return false;
    try {
      ls.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
}

/** Valor de uma chave legada, lida direto do localStorage (sem Preferences). */
export function readLegacyLocal(key) {
  const ls = localStore();
  if (!ls) return null;
  try {
    return ls.getItem(key);
  } catch {
    return null;
  }
}

/** JSON tolerante: ausente/corrompido devolve o fallback em vez de lançar. */
export async function readJSON(key, fallback) {
  const raw = await readRaw(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`storage: "${key}" contém JSON inválido, usando valor por defeito`, err);
    return fallback;
  }
}

/** Estado completo do app. */
export async function loadAll() {
  const keys = Object.keys(DEFAULTS);
  const values = await Promise.all(keys.map((key) => readJSON(key, DEFAULTS[key])));
  return keys.reduce((acc, key, i) => ({ ...acc, [key]: values[i] }), {});
}

/** Persiste um valor JSON. */
export async function save(key, value) {
  return writeRaw(key, JSON.stringify(value));
}
