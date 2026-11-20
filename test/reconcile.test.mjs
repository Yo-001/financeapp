import { generateKeyPairSync } from "node:crypto";
import {
  deduplicateAndSanitizeExpenses,
  guessCategory,
  mergeTransactions,
  reconcileExpensesWithIncoming,
} from "../src/services/categories.js";
import { mapEnableBankingTx, syncBankTransactions } from "../src/services/enableBanking.js";

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
  ["PLENITUDE ENERGIA", "PLENERGY MADRID", "GALP ESTACION", "BALLENOIL", "PETROPRIX", "PETRONOR", "AVIA"].every(
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

// 9. Deduplicação semântica quando ID muda entre PDNG (provisório) e BOOK (entry_reference)
{
  const pdngMapped = mapEnableBankingTx(
    "acc-dup-1234",
    {
      credit_debit_indicator: "DBIT",
      transaction_amount: { amount: "5.00" },
      remittance_information: ["AMAZON PRIME"],
      transaction_date: "2026-11-04",
      status: "PDNG",
    },
    "Santander"
  );

  check(
    "mapEnableBankingTx marca débito PDNG como paid: true e gera fingerprint",
    pdngMapped?.paid === true &&
      pdngMapped?.fingerprint === "fp:acc-dup-:5:2026-11-04:AMAZON PRIME",
    JSON.stringify(pdngMapped)
  );

  const bookMapped = mapEnableBankingTx(
    "acc-dup-1234",
    {
      entry_reference: "eb-ref-999",
      credit_debit_indicator: "DBIT",
      transaction_amount: { amount: "5.00" },
      remittance_information: ["AMAZON PRIME*2X9K"],
      transaction_date: "2026-11-06",
      status: "BOOK",
    },
    "Santander"
  );

  const mergedDup = mergeTransactions([pdngMapped], [bookMapped], {});
  check(
    "Deduplicação semântica: não duplica quando ID muda de PDNG provisório para BOOK com entry_reference (±2 dias)",
    mergedDup.added.length === 0 &&
      mergedDup.duplicates === 1 &&
      mergedDup.expenses.length === 1,
    JSON.stringify({ added: mergedDup.added.length, duplicates: mergedDup.duplicates, expenses: mergedDup.expenses })
  );
}

// 10. Conciliação da Prime (5 €) eliminando previsão pendente e mantendo paga
{
  const variants = [
    { incomingName: "PRIME VIDEO", plannedName: "Prime" },
    { incomingName: "AMAZON PRIME", plannedName: "PRIME VIDEO" },
    { incomingName: "AMZN PRIME", plannedName: "Prime Video" },
    { incomingName: "AMAZON DIGITAL", plannedName: "Prime" },
    { incomingName: "AMAZON MEDIA", plannedName: "PRIME" },
  ];

  for (const { incomingName, plannedName } of variants) {
    const existing = [
      {
        id: "plan-prime",
        name: plannedName,
        value: 5,
        date: "2026-11-01",
        week: "1",
        category: "Assinaturas",
        paid: false,
        source: "manual",
      },
    ];
    const tx = mapEnableBankingTx(
      "acc-prime-1",
      {
        entry_reference: `ref-${incomingName}`,
        credit_debit_indicator: "DBIT",
        transaction_amount: { amount: "5.00" },
        remittance_information: [incomingName],
        transaction_date: "2026-11-05",
        status: "PDNG",
      },
      "Santander"
    );

    const merged = mergeTransactions(existing, [tx], {});
    check(
      `Prime (${incomingName}): elimina previsão '${plannedName}' e mantém transação paga (paid: true)`,
      merged.expenses.length === 1 &&
        !merged.expenses.some((e) => e.id === "plan-prime") &&
        merged.expenses[0].paid === true &&
        merged.expenses[0].category === "Assinaturas" &&
        merged.expenses[0].value === 5,
      JSON.stringify(merged.expenses)
    );
  }
}

// 11. Deduplicação cross-account (Santander 2 contas: eb:9b90ac68 vs eb:de9535a3) em mergeTransactions e reconcileExpensesWithIncoming
{
  const acc1Tx = {
    id: "eb:9b90ac68:tx-1",
    fingerprint: "fp:9b90ac68:40:2026-11-10:COMPRA PLENERGY",
    name: "COMPRA PLENERGY MADRID",
    value: 40,
    date: "2026-11-10",
    week: "2",
    paid: true,
    source: "bank",
    bank: "Santander",
    account: "9b90ac68",
  };
  const acc2DupSameDay = {
    id: "eb:de9535a3:tx-2",
    fingerprint: "fp:de9535a3:40:2026-11-11:PAGO EN PLENERG",
    name: "PAGO EN PLENERGY",
    value: 40,
    date: "2026-11-11",
    week: "2",
    paid: true,
    source: "bank",
    bank: "Santander",
    account: "de9535a3",
  };
  const acc2DifferentDate = {
    id: "eb:de9535a3:tx-3",
    name: "PAGO EN PLENERGY",
    value: 40,
    date: "2026-11-12",
    week: "2",
    paid: true,
    source: "bank",
    bank: "Santander",
    account: "de9535a3",
  };

  const mergedCross = mergeTransactions([acc1Tx], [acc2DupSameDay], {});
  check(
    "mergeTransactions: deduplicação cross-account ignora duplicata (±1 dia, mesmo valor, nome similar)",
    mergedCross.added.length === 0 &&
      mergedCross.duplicates === 1 &&
      mergedCross.expenses.length === 1,
    JSON.stringify(mergedCross)
  );

  const reconciledCross = reconcileExpensesWithIncoming([acc1Tx], [acc2DupSameDay]);
  check(
    "reconcileExpensesWithIncoming: deduplicação cross-account não duplica transação de outra conta",
    reconciledCross.length === 1 && reconciledCross[0].id === "eb:9b90ac68:tx-1",
    JSON.stringify(reconciledCross)
  );

  const mergedFarDate = mergeTransactions([acc1Tx], [acc2DifferentDate], {});
  check(
    "mergeTransactions: cross-account com diferença >= 2 dias não é considerado duplicata",
    mergedFarDate.added.length === 1 && mergedFarDate.expenses.length === 2,
    JSON.stringify(mergedFarDate)
  );
}

// 12. deduplicateAndSanitizeExpenses: limpa duplicatas antigas, recategoriza 'Outros' e reconcilia retroativamente (idempotente)
{
  const dirtyExpenses = [
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
      id: "plan-fuel",
      name: "Combustível",
      value: 100,
      date: "2026-11-01",
      week: "1",
      category: "Combustível",
      paid: false,
      source: "manual",
    },
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
    {
      id: "eb:9b90ac68:pl1",
      name: "PLENERGY",
      value: 40,
      date: "2026-11-05",
      category: "Outros",
      paid: true,
      source: "bank",
      bank: "Santander",
      account: "9b90ac68",
    },
    {
      id: "eb:de9535a3:pl2",
      name: "PLENERGY",
      value: 40,
      date: "2026-11-06",
      category: "Outros",
      paid: true,
      source: "bank",
      bank: "Santander",
      account: "de9535a3",
    },
    {
      id: "eb:9b90ac68:ay1",
      name: "AYUNTAMIENTO",
      value: 35,
      date: "2026-11-04",
      category: "Outros",
      paid: true,
      source: "bank",
      bank: "Santander",
      account: "9b90ac68",
    },
    {
      id: "eb:9b90ac68:er1",
      name: "EROSKI CENTER",
      value: 45,
      date: "2026-11-03",
      category: "Outros",
      paid: true,
      source: "bank",
      bank: "Santander",
      account: "9b90ac68",
    },
  ];

  const sanitizedOnce = deduplicateAndSanitizeExpenses(dirtyExpenses);
  const sanitizedTwice = deduplicateAndSanitizeExpenses(sanitizedOnce);

  const plenergy = sanitizedOnce.find((e) => e.name === "PLENERGY");
  const ayto = sanitizedOnce.find((e) => e.name === "AYUNTAMIENTO");
  const eroski = sanitizedOnce.find((e) => e.name === "EROSKI CENTER");
  const fuelPlan = sanitizedOnce.find((e) => e.id === "plan-fuel");
  const m1Plan = sanitizedOnce.find((e) => e.id === "plan-m1");

  check(
    "deduplicateAndSanitizeExpenses: remove duplicata cross-account, recategoriza 'Outros' e reconcilia previsões",
    sanitizedOnce.filter((e) => e.name === "PLENERGY").length === 1 &&
      plenergy?.category === "Combustível" &&
      ayto?.category === "Mensalidades" &&
      eroski?.category === "Alimentação" &&
      fuelPlan?.value === 60 &&
      m1Plan?.value === 45 &&
      !sanitizedOnce.some((e) => e.id === "plan-nat"),
    JSON.stringify(sanitizedOnce)
  );

  check(
    "deduplicateAndSanitizeExpenses: execução repetida é idempotente (não abate duas vezes)",
    sanitizedTwice.length === sanitizedOnce.length &&
      sanitizedTwice.find((e) => e.id === "plan-fuel")?.value === 60 &&
      sanitizedTwice.find((e) => e.id === "plan-m1")?.value === 45,
    JSON.stringify(sanitizedTwice)
  );
}

// 13. Resiliência a erro 429 (RateLimitException) em syncBankTransactions
{
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.endsWith("/sessions/sess-sant")) {
      return new Response(
        JSON.stringify({
          session_id: "sess-sant",
          accounts: [{ uid: "acc-sant-1" }, { uid: "acc-sant-2" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (u.endsWith("/sessions/sess-revo")) {
      return new Response(
        JSON.stringify({
          session_id: "sess-revo",
          accounts: [{ uid: "acc-revo-1" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (u.endsWith("/accounts/acc-sant-1/balances")) {
      return new Response(
        JSON.stringify({ error: "RateLimitException", message: "Daily quota exceeded" }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
    if (u.includes("/accounts/acc-sant-1/transactions")) {
      return new Response(
        JSON.stringify({ error: "RateLimitException", message: "Daily quota exceeded" }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
    if (u.endsWith("/accounts/acc-sant-2/balances") || u.endsWith("/accounts/acc-revo-1/balances")) {
      return new Response(JSON.stringify({ balances: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (u.includes("/accounts/acc-sant-2/transactions")) {
      return new Response(
        JSON.stringify({
          transactions: [
            {
              entry_reference: "tx-sant2",
              credit_debit_indicator: "DBIT",
              transaction_amount: { amount: "20.00" },
              remittance_information: ["PLENERGY"],
              transaction_date: "2026-11-10",
              status: "BOOK",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (u.includes("/accounts/acc-revo-1/transactions")) {
      return new Response(
        JSON.stringify({
          transactions: [
            {
              entry_reference: "tx-revo1",
              credit_debit_indicator: "DBIT",
              transaction_amount: { amount: "15.00" },
              remittance_information: ["EROSKI"],
              transaction_date: "2026-11-11",
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
    const res429 = await syncBankTransactions(
      {
        ebApplicationId: "app-429",
        ebPrivateKey: privateKey,
        connections: [
          {
            id: "Santander|ES",
            institutionName: "Santander",
            sessionId: "sess-sant",
            accounts: [],
          },
          {
            id: "Revolut|ES",
            institutionName: "Revolut",
            sessionId: "sess-revo",
            accounts: [],
          },
        ],
      },
      [
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
      ],
      {}
    );

    const expectedWarn =
      "Limite diário de consultas atingido pelo banco. Reconecte o banco na aba Bancos para atualizar agora.";
    const santConn = res429.connections.find((c) => c.id === "Santander|ES");
    const revoConn = res429.connections.find((c) => c.id === "Revolut|ES");

    check(
      "syncBankTransactions: erro 429 define warning amigável sem interromper outras contas/bancos nem a reconciliação",
      santConn?.warning === expectedWarn &&
        !revoConn?.warning &&
        res429.added.length === 2 &&
        res429.expenses.find((e) => e.id === "plan-fuel")?.value === 80,
      JSON.stringify({ santConn, revoConn, added: res429.added, expenses: res429.expenses })
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
