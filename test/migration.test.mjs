/**
 * Prova da migração (Fase 2), sem dependências novas.
 *   node test/migration.test.mjs
 *
 * Usa o plugin real @capacitor/preferences com um localStorage em memória,
 * exatamente como o browser. O objetivo é provar:
 *   1. fixedExpenses em localStorage é copiado uma vez para Preferences;
 *   2. o original em localStorage não é apagado;
 *   3. backupBeforeMigrate é criado uma única vez;
 *   4. a segunda execução é no-op (idempotência);
 *   5. escritas do app depois da migração não são perdidas por uma re-execução;
 *   6. a comparação monthlyHistory detecta diferenças reais.
 */

class MemoryStorage {
  data = new Map();
  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }
  setItem(key, value) {
    this.data.set(key, String(value));
  }
  removeItem(key) {
    this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
  key(i) {
    return [...this.data.keys()][i] ?? null;
  }
  get length() {
    return this.data.size;
  }
}

globalThis.localStorage = new MemoryStorage();
globalThis.window = globalThis;

const { KEYS, readRaw, writeRaw, save } = await import("../src/services/storage.js");
const { migrateStorage, SCHEMA_VERSION } = await import("../src/services/migrate.js");
const { historyFromExpenses } = await import("../src/services/history.js");

let failures = 0;
function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const expenses = [
  { id: 1, name: "Mercado", value: 42.4, date: "2026-09-02", category: "Alimentação", paid: true, week: "1" },
  { id: 2, name: "Combustível", value: 60.1, date: "2026-09-18", category: "Combustível", paid: false, week: "3" },
  { id: 3, name: "Mercado", value: 55, date: "2026-10-05", category: "Alimentação", paid: true, week: "1" },
  { id: 4, name: "Netflix", value: 15.99, date: "2026-10-20", category: "Assinaturas", paid: true, week: "3" },
  { id: 5, name: "Farmácia", value: 12.35, date: "2026-11-07", category: "Saúde", paid: false, week: "1" },
];

const legacyFixed = [
  { id: 10, name: "Renda", value: 900, week: "1", category: "Mensalidades" },
  { id: 11, name: "Luz", value: 65.4, week: "2", category: "Casa" },
  { id: 12, name: "Internet", value: 39.9, week: "2", category: "Casa" },
];

// ---- Cenário A: app antigo (fixedExpenses só em localStorage) ----------------
await writeRaw(KEYS.expenses, JSON.stringify(expenses));
await writeRaw("monthlyHistory", JSON.stringify(historyFromExpenses(expenses, 15)));
globalThis.localStorage.setItem("fixedExpenses", JSON.stringify(legacyFixed));

const first = await migrateStorage();
console.log("relatório 1:", JSON.stringify({ ...first, historyCheck: { ...first.historyCheck, mismatches: first.historyCheck.mismatches.length } }));

check("1ª execução correu", first.ran === true);
check("criou backup", first.backupCreated === true);
check("copiou fixedExpenses", first.fixedExpenses === "copied", first.fixedExpenses);
check(
  "fixedExpenses agora em Preferences",
  JSON.stringify(JSON.parse(await readRaw(KEYS.fixedExpenses))) === JSON.stringify(legacyFixed)
);
check("localStorage original preservado", globalThis.localStorage.getItem("fixedExpenses") !== null);
check("schemaVersion gravada", (await readRaw(KEYS.schemaVersion)) === String(SCHEMA_VERSION));

const backup = JSON.parse(await readRaw(KEYS.backupBeforeMigrate));
check("backup tem as chaves originais", backup.keys.expenses === JSON.stringify(expenses));
check("backup tem o legado do localStorage", backup.legacyLocalStorage.fixedExpenses === JSON.stringify(legacyFixed));
check("backup guarda monthlyHistory legado", typeof backup.keys.monthlyHistory === "string");
const backupCreatedAt = backup.createdAt;
const legacyFixedBefore = globalThis.localStorage.getItem("fixedExpenses");

// ---- Cenário B: aplicação usa o app e depois reabre --------------------------
const edited = [...legacyFixed, { id: 13, name: "Água", value: 22, week: "3", category: "Casa" }];
await save(KEYS.fixedExpenses, edited);

const second = await migrateStorage();
console.log("relatório 2:", JSON.stringify(second));
check("2ª execução é no-op", second.ran === false);
check("backup não foi substituído", JSON.parse(await readRaw(KEYS.backupBeforeMigrate)).createdAt === backupCreatedAt);
check(
  "fixedExpenses editado depois da migração sobrevive",
  JSON.stringify(JSON.parse(await readRaw(KEYS.fixedExpenses))) === JSON.stringify(edited)
);
check("localStorage legado continua igual", globalThis.localStorage.getItem("fixedExpenses") === legacyFixedBefore);

// ---- Cenário C: comparador de monthlyHistory detecta divergência ------------
await writeRaw(KEYS.schemaVersion, "0");
const tampered = historyFromExpenses(expenses, 15);
tampered[0] = { ...tampered[0], total: tampered[0].total + 1 };
await writeRaw("monthlyHistory", JSON.stringify(tampered));
const third = await migrateStorage();
check("3ª execução correu (versão reposta a 0)", third.ran === true);
check(
  "comparador aponta 1 mês divergente",
  third.historyCheck.compared === true && third.historyCheck.mismatches.length === 1,
  JSON.stringify(third.historyCheck.mismatches.map((m) => m.month))
);
check("não reescreveu fixedExpenses", third.fixedExpenses === "already-in-preferences", third.fixedExpenses);

// ---- Cenário D: primeira instalação (sem dados e sem legado) ----------------
globalThis.localStorage.clear();
const fresh = await migrateStorage();
check("instalação limpa não cria backup", fresh.backupCreated === false);
check("instalação limpa não inventa fixedExpenses", (await readRaw(KEYS.fixedExpenses)) === null);
check("instalação limpa grava versão", (await readRaw(KEYS.schemaVersion)) === String(SCHEMA_VERSION));

console.log(failures === 0 ? "\nTODOS OS CHECKS PASSARAM" : `\n${failures} CHECK(S) FALHARAM`);
process.exit(failures === 0 ? 0 : 1);
