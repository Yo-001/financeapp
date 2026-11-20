import { generateKeyPairSync } from "node:crypto";
import { mergeTransactions } from "../src/services/categories.js";
import {
  enableBanking,
  extractAuthCode,
  getConnections,
  getWeekForDate,
  mapEnableBankingTx,
  syncBankTransactions,
} from "../src/services/enableBanking.js";

let failures = 0;
function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

// 1. extractAuthCode
check(
  "extractAuthCode: URL HTTPS padrão",
  extractAuthCode("https://enablebanking.com/?code=abc123&state=xyz") === "abc123"
);
check(
  "extractAuthCode: deep link capacitor",
  extractAuthCode("financeapp://auth?code=deep_456&state=1") === "deep_456"
);
check(
  "extractAuthCode: hash fragment",
  extractAuthCode("https://enablebanking.com/#code=hash_789") === "hash_789"
);
check(
  "extractAuthCode: query param URL-encoded",
  extractAuthCode("https://enablebanking.com/?code=encoded%2B123%3D") === "encoded+123="
);
check(
  "extractAuthCode: query relativa",
  extractAuthCode("?code=query_only&state=s") === "query_only"
);
check(
  "extractAuthCode: código puro",
  extractAuthCode("  raw_code_only  ") === "raw_code_only"
);
check(
  "extractAuthCode: URL sem code retorna vazio",
  extractAuthCode("https://enablebanking.com/?error=access_denied") === ""
);
check(
  "extractAuthCode: vazio/null retorna vazio",
  extractAuthCode("") === "" && extractAuthCode(null) === ""
);

// 2. mergeTransactions (duplicatas e merchantRules)
const existing = [
  { id: "eb:acc1:tx1", name: "MERCADONA MADRID", value: 42.5, date: "2026-10-01" },
];
const incoming = [
  { id: "eb:acc1:tx1", name: "MERCADONA MADRID", value: 42.5, date: "2026-10-01" },
  { id: "eb:acc1:tx2", name: "LIDL VALENCIA", value: 18.2, date: "2026-10-02" },
  { id: "eb:acc1:tx2", name: "LIDL VALENCIA", value: 18.2, date: "2026-10-02" },
  { id: "eb:acc1:tx3", name: "Padaria Central", value: 4.5, date: "2026-10-03" },
];
const merged = mergeTransactions(existing, incoming, {
  "PADARIA CENTRAL": "Alimentação",
});
check("mergeTransactions: adiciona apenas 2 novos", merged.added.length === 2, `got ${merged.added.length}`);
check("mergeTransactions: conta 2 duplicatas", merged.duplicates === 2, `got ${merged.duplicates}`);
check(
  "mergeTransactions: aplica regra existente de merchant",
  merged.added[1]?.category === "Alimentação",
  merged.added[1]?.category
);
check(
  "mergeTransactions: aprende nova regra de keyword",
  merged.merchantRules.LIDL === "Alimentação",
  JSON.stringify(merged.merchantRules)
);

// 3. listAccounts e syncBankTransactions sem sessão
const originalFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), method: init?.method || "GET" });
  throw new Error(`Unexpected fetch to ${url}`);
};

const noSessionAccounts = await enableBanking.listAccounts("app-1", "key-1", null);
check("listAccounts sem sessionId retorna []", Array.isArray(noSessionAccounts) && noSessionAccounts.length === 0);
check("listAccounts sem sessionId não chama rede/GET /accounts", calls.length === 0);

let missingSessionErr = null;
try {
  await syncBankTransactions({ ebApplicationId: "app-1", ebPrivateKey: "key-1" }, [], {});
} catch (err) {
  missingSessionErr = err;
}
check(
  "syncBankTransactions sem sessionId lança erro amigável",
  missingSessionErr instanceof Error && missingSessionErr.message.includes("Sessão bancária ausente")
);
check("syncBankTransactions sem sessionId não chama rede", calls.length === 0);

// 4. listAccounts e syncBankTransactions com mock de resposta + paginação + date_from + PDNG/BOOK
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const requestedUrls = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  requestedUrls.push({ url: u, method: init?.method || "GET", headers: init?.headers || {} });

  if (u.endsWith("/sessions/sess-123")) {
    return new Response(
      JSON.stringify({
        session_id: "sess-123",
        accounts: [{ uid: "acc-99990000", name: "Conta Principal" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (u.endsWith("/accounts/acc-99990000/balances")) {
    return new Response(
      JSON.stringify({
        balances: [{ balance_amount: { amount: "1250.40", currency: "EUR" } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (u.includes("/accounts/acc-99990000/transactions")) {
    const parsed = new URL(u);
    const cont = parsed.searchParams.get("continuation_key");
    if (!cont) {
      return new Response(
        JSON.stringify({
          continuation_key: "page-2",
          transactions: [
            {
              transaction_id: "tx-shared-1",
              credit_debit_indicator: "DBIT",
              transaction_amount: { amount: "25.00" },
              remittance_information: ["MERCADONA"],
              transaction_date: "2026-11-10",
              status: "PDNG",
            },
            {
              transaction_id: "tx-shared-1",
              credit_debit_indicator: "DBIT",
              transaction_amount: { amount: "25.00" },
              remittance_information: ["MERCADONA"],
              booking_date: "2026-11-10",
              status: "BOOK",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({
        transactions: [
          {
            entry_reference: "ref-netflix-1",
            credit_debit_indicator: "DBIT",
            transaction_amount: { amount: "15.99" },
            creditor: { name: "NETFLIX.COM" },
            transaction_date: "2026-11-11",
            status: "BOOK",
          },
          {
            entry_reference: "ref-credit-ignored",
            credit_debit_indicator: "CRDT",
            transaction_amount: { amount: "1000.00" },
            remittance_information: ["SALARIO"],
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

const accountsWithSession = await enableBanking.listAccounts("app-1", privateKey, "sess-123");
check(
  "listAccounts com sessionId retorna contas de /sessions/{id}",
  accountsWithSession.length === 1 && accountsWithSession[0].uid === "acc-99990000"
);
check(
  "nenhuma chamada a GET /accounts foi feita",
  requestedUrls.every((r) => !new URL(r.url).pathname.endsWith("/accounts"))
);

requestedUrls.length = 0;
const syncResult = await syncBankTransactions(
  {
    ebApplicationId: "app-1",
    ebPrivateKey: privateKey,
    sessionId: "sess-123",
    lastSync: "2026-11-15T10:00:00.000Z",
  },
  [{ id: "eb:acc-9999:ref-netflix-1", name: "NETFLIX.COM", value: 15.99, date: "2026-11-11" }],
  {}
);

const txRequests = requestedUrls.filter((r) => r.url.includes("/transactions"));
const firstTxUrl = new URL(txRequests[0].url);
const secondTxUrl = new URL(txRequests[1].url);

check(
  "date_from calculado como 14 dias antes de lastSync (2026-11-01)",
  firstTxUrl.searchParams.get("date_from") === "2026-11-01",
  firstTxUrl.searchParams.get("date_from")
);
check(
  "paginação envia continuation_key e preserva date_from via URLSearchParams",
  secondTxUrl.searchParams.get("continuation_key") === "page-2" &&
    secondTxUrl.searchParams.get("date_from") === "2026-11-01"
);
check(
  "syncBankTransactions adiciona 1 nova transação (PDNG+BOOK unificadas + 1 já existente)",
  syncResult.added.length === 1 && syncResult.added[0].id === "eb:acc-9999:tx-shared-1",
  JSON.stringify(syncResult.added)
);
check(
  "syncBankTransactions retorna contagem real de duplicatas (2)",
  syncResult.duplicates === 2,
  `got ${syncResult.duplicates}`
);
check(
  "syncBankTransactions retorna merchantRules atualizadas",
  syncResult.merchantRules?.MERCADONA === "Alimentação",
  JSON.stringify(syncResult.merchantRules)
);
check(
  "syncBankTransactions enriquece saldos e retorna lastSync",
  syncResult.accounts[0]?.balances?.length === 1 && Boolean(syncResult.lastSync)
);
check(
  "syncBankTransactions legado preenche week e retorna connections",
  syncResult.added[0]?.week === "2" &&
    Array.isArray(syncResult.connections) &&
    syncResult.connections.length === 1
);

// 5. getWeekForDate e mapEnableBankingTx
check(
  "getWeekForDate calcula semanas 1-4 corretamente",
  getWeekForDate("2026-11-01") === "1" &&
    getWeekForDate("2026-11-07") === "1" &&
    getWeekForDate("2026-11-08") === "2" &&
    getWeekForDate("2026-11-14") === "2" &&
    getWeekForDate("2026-11-15") === "3" &&
    getWeekForDate("2026-11-21") === "3" &&
    getWeekForDate("2026-11-22") === "4" &&
    getWeekForDate("2026-11-30") === "4"
);

const txLowerDbit = mapEnableBankingTx(
  "acc-sant-1",
  {
    entry_reference: "tx-lower",
    credit_debit_indicator: "dbit",
    transaction_amount: { amount: "19.90" },
    remittance_information: ["SPOTIFY"],
    transaction_date: "2026-11-03",
    status: "BOOK",
  },
  "Santander"
);
check(
  "mapEnableBankingTx aceita indicator 'dbit' minúsculo e atribui week e bank",
  txLowerDbit?.value === 19.9 &&
    txLowerDbit?.week === "1" &&
    txLowerDbit?.bank === "Santander" &&
    txLowerDbit?.source === "bank"
);

const txNegNoIndicator = mapEnableBankingTx(
  "acc-revo-1",
  {
    entry_reference: "tx-neg",
    transaction_amount: { amount: "-34.50" },
    creditor: { name: "UBER TRIP" },
    transaction_date: "2026-11-25",
    status: "BOOK",
  },
  "Revolut"
);
check(
  "mapEnableBankingTx aceita valor negativo sem indicator",
  txNegNoIndicator?.value === 34.5 &&
    txNegNoIndicator?.week === "4" &&
    txNegNoIndicator?.bank === "Revolut"
);

const txPosNoIndicator = mapEnableBankingTx(
  "acc-revo-1",
  {
    entry_reference: "tx-pos",
    transaction_amount: { amount: "50.00" },
    remittance_information: ["TRANSFERENCIA RECEBIDA"],
    transaction_date: "2026-11-25",
    status: "BOOK",
  },
  "Revolut"
);
check(
  "mapEnableBankingTx ignora valor positivo sem indicator",
  txPosNoIndicator === null
);

// 6. Suporte a múltiplas conexões simultâneas em syncBankTransactions e getConnections
const legacyConverted = getConnections({
  sessionId: "sess-legacy",
  institutionName: "Santander",
  accounts: [{ uid: "acc-leg" }],
});
check(
  "getConnections converte sessionId legado automaticamente",
  legacyConverted.length === 1 &&
    legacyConverted[0].sessionId === "sess-legacy" &&
    legacyConverted[0].institutionName === "Santander"
);

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.endsWith("/sessions/sess-santander")) {
    return new Response(
      JSON.stringify({
        session_id: "sess-santander",
        accounts: [{ uid: "acc-santander-1", account_id: { iban: "ES12004900001111" } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  if (u.endsWith("/sessions/sess-revolut")) {
    return new Response(
      JSON.stringify({
        session_id: "sess-revolut",
        accounts: [{ uid: "acc-revolut-1", account_id: { iban: "LT99325000002222" } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  if (u.endsWith("/accounts/acc-santander-1/balances")) {
    return new Response(
      JSON.stringify({ balances: [{ balance_amount: { amount: "500.00", currency: "EUR" } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  if (u.endsWith("/accounts/acc-revolut-1/balances")) {
    return new Response(
      JSON.stringify({ balances: [{ balance_amount: { amount: "210.25", currency: "EUR" } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  if (u.includes("/accounts/acc-santander-1/transactions")) {
    return new Response(
      JSON.stringify({
        transactions: [
          {
            entry_reference: "sant-tx-1",
            credit_debit_indicator: "DBIT",
            transaction_amount: { amount: "45.00" },
            remittance_information: ["MERCADONA"],
            transaction_date: "2026-11-05",
            status: "BOOK",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  if (u.includes("/accounts/acc-revolut-1/transactions")) {
    return new Response(
      JSON.stringify({
        transactions: [
          {
            entry_reference: "revo-tx-1",
            transaction_amount: { amount: "-12.80" },
            creditor: { name: "UBER EATS" },
            transaction_date: "2026-11-18",
            status: "BOOK",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response("Not found", { status: 404 });
};

const multiResult = await syncBankTransactions(
  {
    ebApplicationId: "app-1",
    ebPrivateKey: privateKey,
    connections: [
      {
        id: "Santander|ES",
        institutionId: "Santander|ES",
        institutionName: "Santander",
        sessionId: "sess-santander",
        accounts: [],
        lastSync: null,
      },
      {
        id: "Revolut|ES",
        institutionId: "Revolut|ES",
        institutionName: "Revolut",
        sessionId: "sess-revolut",
        accounts: [],
        lastSync: null,
      },
    ],
  },
  [],
  {}
);

check(
  "syncBankTransactions com múltiplos bancos importa de todas as conexões",
  multiResult.added.length === 2,
  `got ${multiResult.added.length}`
);
check(
  "syncBankTransactions atribui nome do banco e week em cada transação",
  multiResult.added[0]?.bank === "Santander" &&
    multiResult.added[0]?.week === "1" &&
    multiResult.added[1]?.bank === "Revolut" &&
    multiResult.added[1]?.week === "3",
  JSON.stringify(multiResult.added)
);
check(
  "syncBankTransactions atualiza accounts e lastSync em cada conexão",
  multiResult.connections.length === 2 &&
    multiResult.connections[0].accounts[0]?.balances?.length === 1 &&
    Boolean(multiResult.connections[0].lastSync) &&
    multiResult.connections[1].accounts[0]?.balances?.length === 1 &&
    Boolean(multiResult.connections[1].lastSync)
);

// 7. Contas retornadas como array de strings UUIDs (formato real da Enable Banking)
const realAccountUid = "180abe10-60ca-4bbf-9ad3-64ce0b869cc7";
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.endsWith("/sessions/sess-string-uids")) {
    return new Response(
      JSON.stringify({
        session_id: "sess-string-uids",
        accounts: [realAccountUid],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  if (u.endsWith(`/accounts/${realAccountUid}/balances`)) {
    return new Response(
      JSON.stringify({
        balances: [{ balance_amount: { amount: "340.15", currency: "EUR" } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  if (u.includes(`/accounts/${realAccountUid}/transactions`)) {
    return new Response(
      JSON.stringify({
        transactions: [
          {
            entry_reference: "klarna-tx-1",
            credit_debit_indicator: "DBIT",
            transaction_amount: { amount: "29.90" },
            creditor: { name: "AMAZON EU" },
            transaction_date: "2026-11-19",
            status: "BOOK",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response("Not found", { status: 404 });
};

const stringAccountsList = await enableBanking.listAccounts("app-1", privateKey, "sess-string-uids");
check(
  "listAccounts preserva array de strings UUIDs de /sessions/{id}",
  Array.isArray(stringAccountsList) && stringAccountsList[0] === realAccountUid
);

const stringUidResult = await syncBankTransactions(
  {
    ebApplicationId: "app-1",
    ebPrivateKey: privateKey,
    connections: [
      {
        id: "Klarna|ES",
        institutionId: "Klarna|ES",
        institutionName: "Klarna",
        sessionId: "sess-string-uids",
        accounts: [],
        lastSync: null,
      },
    ],
  },
  [],
  {}
);

check(
  "syncBankTransactions importa transações quando accounts é array de strings UUIDs",
  stringUidResult.added.length === 1 &&
    stringUidResult.added[0]?.id === "eb:180abe10:klarna-tx-1" &&
    stringUidResult.added[0]?.bank === "Klarna" &&
    stringUidResult.added[0]?.account === "180abe10",
  JSON.stringify(stringUidResult.added)
);
check(
  "syncBankTransactions normaliza account string para { uid, balances }",
  stringUidResult.connections[0]?.accounts[0]?.uid === realAccountUid &&
    stringUidResult.connections[0]?.accounts[0]?.balances?.length === 1 &&
    stringUidResult.connections[0]?.accounts[0]?.["0"] === undefined,
  JSON.stringify(stringUidResult.connections[0]?.accounts)
);

// 8. startAuth inclui balances: true e transactions: true no access
let capturedAuthBody = null;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("/aspsps")) {
    return new Response(
      JSON.stringify({ aspsps: [{ name: "Santander", country: "ES", maximum_consent_validity: 7776000 }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  if (u.endsWith("/auth")) {
    capturedAuthBody = JSON.parse(init.body);
    return new Response(
      JSON.stringify({ url: "https://auth.enablebanking.com/mock" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  if (u.endsWith("/sessions/sess-zero")) {
    return new Response(
      JSON.stringify({ session_id: "sess-zero", accounts: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response("Not found", { status: 404 });
};

const authUrl = await enableBanking.startAuth("app-1", privateKey, "Santander|ES", "https://enablebanking.com/");
check(
  "startAuth inclui balances: true e transactions: true em access",
  authUrl === "https://auth.enablebanking.com/mock" &&
    capturedAuthBody?.access?.balances === true &&
    capturedAuthBody?.access?.transactions === true &&
    Boolean(capturedAuthBody?.access?.valid_until),
  JSON.stringify(capturedAuthBody?.access)
);

// 9. syncBankTransactions salva warning quando conexão retorna 0 contas
const zeroAccountsResult = await syncBankTransactions(
  {
    ebApplicationId: "app-1",
    ebPrivateKey: privateKey,
    connections: [
      {
        id: "Santander|ES",
        institutionId: "Santander|ES",
        institutionName: "Santander",
        sessionId: "sess-zero",
        accounts: [],
        lastSync: null,
      },
    ],
  },
  [],
  {}
);
check(
  "syncBankTransactions salva warning quando accounts.length === 0",
  zeroAccountsResult.connections[0]?.accounts.length === 0 &&
    zeroAccountsResult.connections[0]?.warning === "Nenhuma conta foi selecionada no banco",
  JSON.stringify(zeroAccountsResult.connections[0])
);

globalThis.fetch = originalFetch;

console.log(failures === 0 ? "\nTODOS OS CHECKS DE SYNC PASSARAM" : `\n${failures} CHECK(S) FALHARAM`);
process.exit(failures === 0 ? 0 : 1);
