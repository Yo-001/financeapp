import { generateKeyPairSync } from "node:crypto";
import {
  guessCategory,
  mergeTransactions,
  reconcileExpensesWithIncoming,
} from "../src/services/categories.js";
import { syncBankTransactions } from "../src/services/enableBanking.js";

let failures = 0;
function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

// 1. KEYWORD_RULES novas regras
check(
  "KEYWORD_RULES: supermercados espanhóis como Alimentação",
  ["EROSKI", "FROIZ", "CONSUM", "DIA CENTRO", "BONPREU", "SUPERCOR", "HIPERCOR", "CAPRABO"].every(
    (name) => guessCategory(name) === "Alimentação"
  )
);
check(
  "KEYWORD_RULES: postos como Combustível",
  ["PLENITUDE ENERGIA", "GALP ESTACION", "BALLENOIL", "PETROPRIX", "PETRONOR", "AVIA"].every(
    (name) => guessCategory(name) === "Combustível"
  )
);
check(
  "KEYWORD_RULES: Ayuntamiento/Ajuntament como Mensalidades",
  ["RECIBO AYUNTAMIENTO", "AYUNTAMIENTO MADRID", "AJUNTAMENT BARCELONA"].every(
    (name) => guessCategory(name) === "Mensalidades"
  )
);

// 2. Abatimento semanal de Mercado (90€ previsto -> 45€ Eroski -> 45€ previsto restante)
{
  const existing = [
    {
      id: "plan-m1",
      name: "Mercado 1",
      value: 90,
      date: "2026-11-01",
      week: "1",
      category: "Alimentação",
      paid: false,
      source: "manual",
    },
    {
      id: "plan-m2",
      name: "Mercado 2",
      value: 90,
      date: "2026-11-01",
      week: "2",
      category: "Alimentação",
      paid: false,
      source: "manual",
    },
  ];
  const incoming = [
    {
      id: "eb:acc1:eroski-1",
      name: "EROSKI CENTER",
      value: 45,
      date: "2026-11-05",
      week: "1",
      paid: true,
      source: "bank",
    },
  ];

  const result = reconcileExpensesWithIncoming(existing, incoming);
  const m1 = result.find((e) => e.id === "plan-m1");
  const m2 = result.find((e) => e.id === "plan-m2");
  const tx = result.find((e) => e.id === "eb:acc1:eroski-1");

  check(
    "Mercado semanal: 90€ previsto - 45€ Eroski reduz previsão da semana 1 para 45€",
    m1?.value === 45 && m2?.value === 90 && tx?.category === "Alimentação",
    JSON.stringify({ m1, m2, tx })
  );
}

// 3. Eliminação quando valor real >= previsão (90€ previsto -> 90€ Mercadona -> eliminada)
{
  const existing = [
    {
      id: "plan-m1",
      name: "Mercado 1",
      value: 90,
      date: "2026-11-01",
      week: "1",
      category: "Alimentação",
      paid: false,
      source: "manual",
    },
  ];
  const incoming = [
    {
      id: "eb:acc1:merc-1",
      name: "MERCADONA",
      value: 90,
      date: "2026-11-03",
      week: "1",
      paid: true,
      source: "bank",
    },
  ];

  const result = reconcileExpensesWithIncoming(existing, incoming);
  check(
    "Mercado semanal: gasto >= previsão elimina previsão e mantém transação bancária",
    result.length === 1 && result[0].id === "eb:acc1:merc-1",
    JSON.stringify(result)
  );
}

// 4. Abatimento parcial seguido de quitação na mesma semana
{
  const existing = [
    {
      id: "plan-m1",
      name: "Mercado",
      value: 90,
      date: "2026-11-01",
      week: "1",
      category: "Alimentação",
      paid: false,
      source: "manual",
    },
  ];
  const incoming = [
    {
      id: "eb:acc1:eroski-a",
      name: "EROSKI",
      value: 45,
      date: "2026-11-02",
      week: "1",
      source: "bank",
    },
    {
      id: "eb:acc1:mercadona-b",
      name: "MERCADONA",
      value: 50,
      date: "2026-11-06",
      week: "1",
      source: "bank",
    },
  ];

  const result = reconcileExpensesWithIncoming(existing, incoming);
  check(
    "Mercado semanal: dois gastos na semana (45 + 50) eliminam previsão de 90€",
    !result.some((e) => e.id === "plan-m1") && result.length === 2,
    JSON.stringify(result)
  );
}

// 5. Combustível Plenitude abatendo previsão de combustível
{
  const existing = [
    {
      id: "plan-fuel",
      name: "Combustível",
      value: 100,
      date: "2026-11-01",
      week: "1",
      category: "Combustível",
      paid: false,
      source: "manual",
    },
  ];
  const incoming = [
    {
      id: "eb:acc1:plenitude-1",
      name: "PLENITUDE GASOLINERA",
      value: 38.45,
      date: "2026-11-12",
      week: "2",
      paid: true,
      source: "bank",
    },
  ];

  const result = reconcileExpensesWithIncoming(existing, incoming);
  const fuelPlan = result.find((e) => e.id === "plan-fuel");
  const fuelTx = result.find((e) => e.id === "eb:acc1:plenitude-1");

  check(
    "Combustível: Plenitude abate previsão de combustível no mesmo mês (100 - 38.45 = 61.55)",
    fuelPlan?.value === 61.55 && fuelTx?.category === "Combustível",
    JSON.stringify({ fuelPlan, fuelTx })
  );
}

// 6. Recibo Ayuntamiento conciliando Natação
{
  const existing = [
    {
      id: "plan-nat",
      name: "Natação",
      value: 35,
      date: "2026-11-01",
      week: "1",
      category: "Lazer",
      paid: false,
      source: "manual",
    },
  ];
  const incoming = [
    {
      id: "eb:acc1:ayto-1",
      name: "RECIBO AYUNTAMIENTO",
      value: 35,
      date: "2026-11-04",
      week: "1",
      paid: true,
      source: "bank",
    },
  ];

  const result = reconcileExpensesWithIncoming(existing, incoming);
  check(
    "Ayuntamiento: substitui previsão Natação pela transação bancária em Mensalidades",
    result.length === 1 &&
      !result.some((e) => e.id === "plan-nat") &&
      result[0].id === "eb:acc1:ayto-1" &&
      result[0].category === "Mensalidades",
    JSON.stringify(result)
  );
}

// 7. Compra específica (Decathlon) abate/substitui previsão com mesmo estabelecimento no mês
{
  const existing = [
    {
      id: "plan-dec",
      name: "Decathlon",
      value: 80,
      date: "2026-11-01",
      week: "1",
      category: "Compras",
      paid: false,
      source: "manual",
    },
  ];
  const incoming = [
    {
      id: "eb:acc1:dec-1",
      name: "DECATHLON ALCORCON",
      value: 55,
      date: "2026-11-18",
      week: "3",
      paid: true,
      source: "bank",
    },
  ];

  const result = reconcileExpensesWithIncoming(existing, incoming);
  const decPlan = result.find((e) => e.id === "plan-dec");
  check(
    "Compras específicas: Decathlon abate previsão de Decathlon no mês (80 - 55 = 25)",
    decPlan?.value === 25 && result.length === 2,
    JSON.stringify(result)
  );
}

// 8. Integração em mergeTransactions e syncBankTransactions retornando expenses reconciliado
{
  const existing = [
    {
      id: "plan-m1",
      name: "Mercado 1",
      value: 90,
      date: "2026-11-01",
      week: "1",
      category: "Alimentação",
      paid: false,
      source: "manual",
    },
    {
      id: "plan-nat",
      name: "Natacao",
      value: 40,
      date: "2026-11-01",
      week: "1",
      category: "Mensalidades",
      paid: false,
      source: "manual",
    },
  ];

  const merged = mergeTransactions(existing, [
    {
      id: "eb:acc1:eroski-m",
      name: "EROSKI",
      value: 45,
      date: "2026-11-04",
      week: "1",
      source: "bank",
    },
  ]);
  check(
    "mergeTransactions retorna expenses reconciliado",
    merged.expenses.find((e) => e.id === "plan-m1")?.value === 45 &&
      merged.expenses.some((e) => e.id === "eb:acc1:eroski-m"),
    JSON.stringify(merged.expenses)
  );

  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.endsWith("/sessions/sess-rec")) {
      return new Response(
        JSON.stringify({
          session_id: "sess-rec",
          accounts: [{ uid: "acc-rec-1" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (u.endsWith("/accounts/acc-rec-1/balances")) {
      return new Response(
        JSON.stringify({ balances: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (u.includes("/accounts/acc-rec-1/transactions")) {
      return new Response(
        JSON.stringify({
          transactions: [
            {
              entry_reference: "tx-eroski",
              credit_debit_indicator: "DBIT",
              transaction_amount: { amount: "45.00" },
              remittance_information: ["EROSKI"],
              transaction_date: "2026-11-04",
              status: "BOOK",
            },
            {
              entry_reference: "tx-ayto",
              credit_debit_indicator: "DBIT",
              transaction_amount: { amount: "40.00" },
              remittance_information: ["RECIBO AYUNTAMIENTO"],
              transaction_date: "2026-11-05",
              status: "BOOK",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("Not found", { status: 404 });
  };

  try {
    const syncRes = await syncBankTransactions(
      {
        ebApplicationId: "app-1",
        ebPrivateKey: privateKey,
        sessionId: "sess-rec",
      },
      existing,
      {}
    );
    check(
      "syncBankTransactions retorna expenses reconciliado (Mercado abatido e Natação substituída)",
      Array.isArray(syncRes.expenses) &&
        syncRes.expenses.find((e) => e.id === "plan-m1")?.value === 45 &&
        !syncRes.expenses.some((e) => e.id === "plan-nat") &&
        syncRes.expenses.some((e) => e.id === "eb:acc-rec-:tx-eroski") &&
        syncRes.expenses.some((e) => e.id === "eb:acc-rec-:tx-ayto"),
      JSON.stringify(syncRes.expenses)
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log(
  failures === 0
    ? "\nTODOS OS CHECKS DE RECONCILIACAO PASSARAM"
    : `\n${failures} CHECK(S) FALHARAM`
);
process.exit(failures === 0 ? 0 : 1);
