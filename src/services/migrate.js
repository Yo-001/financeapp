import { KEYS, readRaw, readPreferences, writeRaw, readLegacyLocal } from "./storage.js";
import { historyFromExpenses } from "./history.js";

export const SCHEMA_VERSION = 1;

// Chaves fotografadas antes da primeira escrita de migração.
const SNAPSHOT_KEYS = [
  KEYS.expenses,
  KEYS.planningItems,
  KEYS.fixedExpenses,
  KEYS.merchantRules,
  KEYS.bankSettings,
  KEYS.schemaVersion,
  "monthlyHistory",
];

// Chaves legadas que só existiam em localStorage.
const SNAPSHOT_LOCAL_KEYS = ["fixedExpenses", "monthlyHistory"];

const EMPTY_REPORT = { ran: false, version: SCHEMA_VERSION, backupCreated: false };
let inFlight = null;

function parseArray(raw) {
  if (raw === null || raw === undefined) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Snapshot completo do storage, criado uma única vez.
 * Nunca substitui um backup anterior (reexecuções não perdem o original).
 */
async function ensureSnapshot(fromVersion) {
  if (await readRaw(KEYS.backupBeforeMigrate)) return false;

  const keys = {};
  for (const key of SNAPSHOT_KEYS) keys[key] = await readRaw(key);

  const legacyLocalStorage = {};
  for (const key of SNAPSHOT_LOCAL_KEYS) legacyLocalStorage[key] = readLegacyLocal(key);

  const hasData =
    Object.values(keys).some((value) => value !== null && value !== undefined) ||
    Object.values(legacyLocalStorage).some((value) => value !== null);
  if (!hasData) return false;

  return writeRaw(
    KEYS.backupBeforeMigrate,
    JSON.stringify({
      version: SCHEMA_VERSION,
      fromVersion,
      createdAt: new Date().toISOString(),
      keys,
      legacyLocalStorage,
    })
  );
}

/** fixedExpenses: localStorage -> Preferences, sem apagar o original. */
async function migrateFixedExpenses() {
  const current = await readPreferences(KEYS.fixedExpenses);
  if (current !== null) {
    const parsed = parseArray(current);
    if (parsed === null) return "existing-unreadable";
    if (parsed.length > 0) return "already-in-preferences";
  }

  const legacyRaw = readLegacyLocal("fixedExpenses");
  if (legacyRaw === null) return "no-legacy";

  const legacy = parseArray(legacyRaw);
  if (legacy === null) return "legacy-invalid";
  if (legacy.length === 0) return "legacy-empty";

  return (await writeRaw(KEYS.fixedExpenses, JSON.stringify(legacy)))
    ? "copied"
    : "write-failed";
}

/** Compara a chave legada monthlyHistory com o histórico derivado. Não grava nada. */
async function compareMonthlyHistory(expenses) {
  const legacyRaw = (await readRaw("monthlyHistory")) ?? readLegacyLocal("monthlyHistory");
  if (legacyRaw === null) return { compared: false, reason: "absent" };

  const legacy = parseArray(legacyRaw);
  if (legacy === null) return { compared: false, reason: "invalid" };

  const derived = historyFromExpenses(expenses, 15);
  const derivedByMonth = new Map(derived.map((item) => [`${item.year}-${item.month}`, item]));
  const mismatches = [];

  for (const stored of legacy) {
    const month = `${stored.year}-${stored.month}`;
    const calculated = derivedByMonth.get(month);
    if (
      !calculated ||
      calculated.total !== stored.total ||
      calculated.paid !== stored.paid ||
      calculated.pending !== stored.pending
    ) {
      mismatches.push({ month, stored, derived: calculated ?? null });
    }
  }

  return {
    compared: true,
    storedMonths: legacy.length,
    derivedMonths: derived.length,
    mismatches,
  };
}

async function runMigration() {
  const versionRaw = await readRaw(KEYS.schemaVersion);
  const version = Number(versionRaw) || 0;
  if (version >= SCHEMA_VERSION) return { ...EMPTY_REPORT, version };

  const backupCreated = await ensureSnapshot(version);
  const fixedExpenses = await migrateFixedExpenses();
  const expenses = parseArray(await readRaw(KEYS.expenses)) ?? [];
  const historyCheck = await compareMonthlyHistory(expenses);

  // Último passo: se algo falhar antes, a próxima abertura repete as etapas.
  const versionSaved = await writeRaw(KEYS.schemaVersion, String(SCHEMA_VERSION));

  return {
    ran: true,
    version: SCHEMA_VERSION,
    backupCreated,
    fixedExpenses,
    historyCheck,
    versionSaved,
  };
}

/**
 * Migração idempotente. Chamadas concorrentes (ex.: StrictMode) partilham a
 * mesma execução; uma segunda execução depois da versão gravada é no-op.
 */
export function migrateStorage() {
  if (!inFlight) {
    inFlight = runMigration().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
