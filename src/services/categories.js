import {
  BookOpen,
  Car,
  CircleQuestionMark,
  Fuel,
  Gamepad2,
  GraduationCap,
  Heart,
  Home,
  Landmark,
  PiggyBank,
  Plane,
  Receipt,
  Repeat,
  ShoppingBag,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

const EUR_FORMATTER = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatCurrency(value) {
  return EUR_FORMATTER.format(Number(value) || 0);
}

export const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const CATEGORIES = [
  { id: "Alimentação", icon: UtensilsCrossed },
  { id: "Mensalidades", icon: Receipt },
  { id: "Moradia", icon: Home },
  { id: "Transporte", icon: Car },
  { id: "Combustível", icon: Fuel },
  { id: "Compras", icon: ShoppingBag },
  { id: "Assinaturas", icon: Repeat },
  { id: "Lazer", icon: Gamepad2 },
  { id: "Saúde", icon: Heart },
  { id: "Viagem", icon: Plane },
  { id: "Educação", icon: GraduationCap },
  { id: "Estudo", icon: BookOpen },
  { id: "Poupança", icon: PiggyBank },
  { id: "Banco", icon: Landmark },
  { id: "Outros", icon: Wallet },
];

export function getCategoryIcon(categoryId) {
  return (CATEGORIES.find((cat) => cat.id === categoryId) || CircleQuestionMark).icon || CircleQuestionMark;
}

export const KEYWORD_RULES = [
  ["Mensalidades", ["CONTAS CASA", "CARTAO", "CARTÃO", "PRESTACAO", "MENSALIDADE", "PLANO", "SEGURO", "RECIBO AYUNTAMIENTO", "AYUNTAMIENTO", "AJUNTAMENT"]],
  ["Alimentação", ["MERCADONA", "CARREFOUR", "LIDL", "ALDI", "ALCAMPO", "EROSKI", "FROIZ", "CONSUM", "DIA ", "BONPREU", "SUPERCOR", "HIPERCOR", "CAPRABO", "SUPER", "MERCADO", "RESTAUR", "CAFETER", "PIZZA", "MCDONALD", "BURGER", "KEBAB", "SUSHI", "TACO", "BAR ", "PANADER", "HORNO", "BODEGA", "TAVERNA", "GLOVO", "UBER EATS", "JUST EAT"]],
  ["Combustível", ["SHELL", "REPSOL", "CEPSA", "BP ", "PLENITUDE", "GALP", "BALLENOIL", "PETROPRIX", "PETRONOR", "AVIA", "GASOLINA", "GASOLIN", "PETROL", "COMBUSTI"]],
  ["Transporte", ["RENFE", "METRO", "BUS ", "EMT", "TAXI", "CABIFY", "BOLT", "UBER", "PARKING", "ESTACIO", "TALLER", "ITV", "SEGURO AUTO", "TUISS", "MOVO", "LIME", "BICING"]],
  ["Moradia", ["ALQUILER", "RENTE", "HIPOTECA", "COMUNIDAD", "IBERDROLA", "ENDESA", "NATURGY", "GAS NATURAL", "ELECTRIC", "AGUA", "CANAL ISABEL", "MOVISTAR", "VODAFONE", "ORANGE", "JAZZTEL", "DIGI", "ADSL", "FIBRA", "IMU", "IBI "]],
  ["Saúde", ["FARMACIA", "PHARMACY", "PARAPHARM", "DENTISTA", "DENTAL", "OPTICA", "CLINIC", "HOSPITAL", "VETERINAR", "SANITAT", "CONSULTA", "LABORATORIO"]],
  ["Assinaturas", ["NETFLIX", "SPOTIFY", "HBO", "MAX ", "DISNEY", "PRIME VIDEO", "AMAZON PRIME", "AMZN PRIME", "AMAZON DIGITAL", "AMAZON MEDIA", "APPLE.COM", "APPLE BILL", "GOOGLE ONE", "ICLOUD", "YOUTUBE", "DAZN", "MUBI", "CRUNCHYROLL", "NOTION", "CHATGPT", "OPENAI", "CANVA", "DROPBOX", "ADOBE"]],
  ["Banco", ["COMISION", "COMISSAO", "INTERESE", "INTERESSES", "MANTENIMIENTO", "CUOTA", "LIBRANZA", "DEVOLUCION DE COMISION", "GASTOS BANCARIOS", "TARJETA DE CREDITO", "INGRESO DE NOMINA"]],
  ["Compras", ["AMAZON", "ALIEXPRESS", "ELCORTEINGLES", "CORTE INGLES", "ZARA", "H&M", "DECATHLON", "IKEA", "LERoy", "MERLIN", "WALLAPO", "PCOMPONENTES", "PCBOX", "MEDIA MARKT", "MEDIAMARKT", "WORTEN", "APPLE STORE", "FNAC", "TEMU", "SHEIN", "EBAY"]],
  ["Lazer", ["CINE", "CINEMA", "YOIGO", "STEAM", "PLAYSTATION", "XBOX", "NINTENDO", "GIMNASIO", "GYM", "TEATRO", "MUSEO", "CONCIERTO", "TICKETMASTER", "BILLAR", "BOLERA", "PISCINA", "PADDEL", "PADEL", "FOOTBALL", "FUTBOL"]],
  ["Viagem", ["RYANAIR", "VUELING", "IBERIA", "AIR EUROPA", "EASYJET", "BOOKING", "AIRBNB", "HOTEL", "HOSTEL", "RENFE AVLO", "OUIGO", "ALSA", "FlixBUS", "SEUR", "AVIS", "HERTZ", "EUROPCAR", "SIXT", "BOLSA DE VIAJE"]],
  ["Educação", ["ESCUELA", "ESCOLA", "COLEGIO", "UNIVERSIDAD", "UNIVERSIDADE", "MENSUALIDAD ESC", "MATRICULA", "LIBRERIA", "PAPELERIA", "UDEMY", "COURSERA", "CAMPUS"]],
];

export function normalizeText(str) {
  return String(str || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function guessCategory(name, merchantRules = {}) {
  const normalized = normalizeText(name);
  if (!normalized) return "Outros";

  for (const [merchant, category] of Object.entries(merchantRules)) {
    if (normalized.includes(normalizeText(merchant))) return category;
  }
  if (isPrimeTransaction(normalized)) return "Assinaturas";
  for (const [category, keywords] of KEYWORD_RULES) {
    if (keywords.some((kw) => normalized.includes(normalizeText(kw)))) return category;
  }
  return "Outros";
}

export function matchCategoryRule(name, merchantRules = {}) {
  const normalized = normalizeText(name);
  if (!normalized) return { category: "Outros" };

  for (const [merchant, category] of Object.entries(merchantRules)) {
    if (normalized.includes(normalizeText(merchant))) {
      return { category, rule: merchant };
    }
  }
  if (isPrimeTransaction(normalized)) {
    const matchedPrime =
      PRIME_KEYWORDS.find((kw) => normalized.includes(kw)) || "PRIME";
    return { category: "Assinaturas", rule: matchedPrime };
  }
  for (const [category, keywords] of KEYWORD_RULES) {
    const matched = keywords.find((kw) => normalized.includes(normalizeText(kw)));
    if (matched) return { category, rule: matched.trim() };
  }
  return { category: "Outros" };
}

export function getWeekForDate(date) {
  const match = String(date || "").match(/^\d{4}-\d{2}-(\d{2})/);
  let day = match ? Number(match[1]) : NaN;
  if (!Number.isFinite(day)) {
    const parsed = new Date(date);
    day = Number.isNaN(parsed.getTime()) ? 1 : parsed.getDate();
  }
  if (day <= 7) return "1";
  if (day <= 14) return "2";
  if (day <= 21) return "3";
  return "4";
}

function getExpenseMonth(expense) {
  return String(expense?.date || "").slice(0, 7);
}

function getExpenseWeek(expense) {
  return String(expense?.week || getWeekForDate(expense?.date));
}

function isPlannedExpense(expense) {
  return expense && expense.source !== "bank" && expense.source !== "import";
}

function applyDeduction(list, index, txValue) {
  if (index < 0) return false;
  const target = list[index];
  const remaining = Math.round(((Number(target.value) || 0) - txValue) * 100) / 100;
  if (remaining <= 0) {
    list.splice(index, 1);
  } else {
    list[index] = { ...target, value: remaining };
  }
  return true;
}

const PRIME_KEYWORDS = [
  "AMAZON PRIME",
  "AMZN PRIME",
  "PRIME VIDEO",
  "AMAZON DIGITAL",
  "AMAZON MEDIA",
];

function isPrimeTransaction(normTx) {
  return (
    PRIME_KEYWORDS.some((kw) => normTx.includes(kw)) ||
    /\bPRIME\b/.test(normTx)
  );
}

function isPrimePlannedExpense(normName) {
  const trimmed = String(normName || "").trim();
  return (
    trimmed === "PRIME" ||
    trimmed === "PRIME VIDEO" ||
    trimmed.includes("PRIME VIDEO") ||
    /\bPRIME\b/.test(trimmed)
  );
}

function parseDateMs(dateStr) {
  const match = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const parsed = Date.parse(String(dateStr || ""));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function isCloseDate(dateA, dateB, maxDays = 2) {
  const msA = parseDateMs(dateA);
  const msB = parseDateMs(dateB);
  if (!Number.isFinite(msA) || !Number.isFinite(msB)) {
    return String(dateA || "").slice(0, 10) === String(dateB || "").slice(0, 10);
  }
  return Math.abs(msA - msB) <= maxDays * 86400 * 1000;
}

function cleanTxName(name) {
  return normalizeText(name)
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function isSimilarTxName(nameA, nameB) {
  const a = cleanTxName(nameA);
  const b = cleanTxName(nameB);
  if (!a || !b) return false;
  if (a === b) return true;
  const prefixA = a.slice(0, 15);
  const prefixB = b.slice(0, 15);
  if (prefixA.length >= 4 && prefixA === prefixB) return true;
  if (a.length >= 4 && b.includes(a)) return true;
  if (b.length >= 4 && a.includes(b)) return true;
  const firstA = a.split(" ")[0];
  const firstB = b.split(" ")[0];
  if (firstA.length >= 4 && firstA === firstB) return true;
  return false;
}

function isSyncedTransaction(item) {
  return Boolean(
    item &&
      (!isPlannedExpense(item) ||
        String(item.id || "").startsWith("eb:") ||
        item.fingerprint)
  );
}

function findSemanticMatch(tx, candidates) {
  const txValue = Number(tx?.value) || 0;
  return candidates.find((prev) => {
    const prevValue = Number(prev?.value) || 0;
    if (Math.abs(prevValue - txValue) >= 0.01) return false;
    if (!isCloseDate(prev?.date, tx?.date, 2)) return false;
    return isSimilarTxName(prev?.name, tx?.name);
  });
}

/**
 * Reconcilia despesas previstas (não bancárias) com transações bancárias recebidas,
 * abatendo ou substituindo previsões de Mercado semanal, Combustível, Natação, Prime e compras específicas.
 */
export function reconcileExpensesWithIncoming(existingExpenses = [], incomingTransactions = []) {
  const working = existingExpenses.map((e) => ({ ...e }));
  const seenIds = new Set(
    working.filter((e) => e?.id != null).map((e) => String(e.id))
  );
  const seenFingerprints = new Set(
    working.filter((e) => e?.fingerprint).map((e) => String(e.fingerprint))
  );
  const seenBankTxs = working.filter(isSyncedTransaction);
  const appended = [];

  for (const tx of incomingTransactions) {
    if (!tx) continue;
    const txId = tx.id != null ? String(tx.id) : null;
    const txFp = tx.fingerprint ? String(tx.fingerprint) : null;

    if (txId && seenIds.has(txId)) continue;
    if (txFp && seenFingerprints.has(txFp)) continue;
    const semanticMatch = findSemanticMatch(tx, seenBankTxs);
    if (semanticMatch) {
      if (semanticMatch.source === "bank" && (tx.paid || tx.source === "bank")) {
        semanticMatch.paid = true;
      }
      continue;
    }

    if (txId) seenIds.add(txId);
    if (txFp) seenFingerprints.add(txFp);

    const normTx = normalizeText(tx.name).trim();
    const isPrime = isPrimeTransaction(normTx);
    const rawGuessedCategory = tx.category || guessCategory(tx.name);
    const txCategory =
      isPrime &&
      (!tx.category ||
        rawGuessedCategory === "Outros" ||
        rawGuessedCategory === "Compras")
        ? "Assinaturas"
        : rawGuessedCategory;
    const txMonth = getExpenseMonth(tx);
    const txWeek = getExpenseWeek(tx);
    const txValue = Number(tx.value) || 0;

    let matched = false;

    if (txValue > 0 && txMonth) {
      if (isPrime) {
        const idx = working.findIndex(
          (e) =>
            isPlannedExpense(e) &&
            getExpenseMonth(e) === txMonth &&
            isPrimePlannedExpense(normalizeText(e.name))
        );
        if (idx >= 0) {
          working.splice(idx, 1);
          matched = true;
        }
      }

      if (!matched && (normTx.includes("AYUNTAMIENTO") || normTx.includes("AJUNTAMENT"))) {
        const idx = working.findIndex(
          (e) =>
            isPlannedExpense(e) &&
            getExpenseMonth(e) === txMonth &&
            normalizeText(e.name).includes("NATACAO")
        );
        if (idx >= 0) {
          working.splice(idx, 1);
          matched = true;
        }
      }

      if (!matched && txCategory === "Alimentação") {
        const idx = working.findIndex(
          (e) =>
            isPlannedExpense(e) &&
            getExpenseMonth(e) === txMonth &&
            getExpenseWeek(e) === txWeek &&
            normalizeText(e.name).includes("MERCADO")
        );
        matched = applyDeduction(working, idx, txValue);
      }

      if (!matched && txCategory === "Combustível") {
        let idx = working.findIndex(
          (e) =>
            isPlannedExpense(e) &&
            getExpenseMonth(e) === txMonth &&
            getExpenseWeek(e) === txWeek &&
            normalizeText(e.name).includes("COMBUSTIVEL")
        );
        if (idx < 0) {
          idx = working.findIndex(
            (e) =>
              isPlannedExpense(e) &&
              getExpenseMonth(e) === txMonth &&
              normalizeText(e.name).includes("COMBUSTIVEL")
          );
        }
        matched = applyDeduction(working, idx, txValue);
      }

      if (!matched && normTx.length >= 3) {
        const idx = working.findIndex((e) => {
          if (!isPlannedExpense(e) || getExpenseMonth(e) !== txMonth) return false;
          const normPred = normalizeText(e.name).trim();
          if (normPred.length < 3) return false;
          if (
            normPred.includes("MERCADO") ||
            normPred.includes("COMBUSTIVEL") ||
            normPred.includes("NATACAO")
          ) {
            return false;
          }
          return normTx.includes(normPred) || normPred.includes(normTx);
        });
        matched = applyDeduction(working, idx, txValue);
      }
    }

    const reconciledTx = {
      ...tx,
      category: txCategory,
      week: txWeek,
      paid: isPrime || tx.source === "bank" ? true : Boolean(tx.paid),
    };
    seenBankTxs.push(reconciledTx);
    appended.push(reconciledTx);
  }

  return [...working, ...appended];
}

export function mergeTransactions(existing, incoming, merchantRules = {}) {
  const workingExisting = existing.map((item) => ({ ...item }));
  const seenIds = new Set(
    workingExisting.filter((item) => item?.id != null).map((item) => String(item.id))
  );
  const seenFingerprints = new Set(
    workingExisting.filter((item) => item?.fingerprint).map((item) => String(item.fingerprint))
  );
  const seenBankTxs = workingExisting.filter(isSyncedTransaction);
  const nextRules = { ...merchantRules };
  const added = [];
  let duplicates = 0;

  for (const tx of incoming) {
    if (!tx || tx.id == null) continue;
    const txId = String(tx.id);
    const txFp = tx.fingerprint ? String(tx.fingerprint) : null;

    if (seenIds.has(txId)) {
      duplicates += 1;
      continue;
    }
    if (txFp && seenFingerprints.has(txFp)) {
      duplicates += 1;
      continue;
    }
    const semanticMatch = findSemanticMatch(tx, seenBankTxs);
    if (semanticMatch) {
      if (semanticMatch.source === "bank" && (tx.paid || tx.source === "bank")) {
        semanticMatch.paid = true;
      }
      duplicates += 1;
      continue;
    }

    seenIds.add(txId);
    if (txFp) seenFingerprints.add(txFp);

    const { category, rule } = matchCategoryRule(tx.name, nextRules);
    const enriched = { ...tx, category };
    seenBankTxs.push(enriched);
    added.push(enriched);
    if (rule && !nextRules[rule]) {
      nextRules[rule] = category;
    }
  }

  const expenses = reconcileExpensesWithIncoming(workingExisting, added);

  return { added, duplicates, merchantRules: nextRules, expenses };
}
