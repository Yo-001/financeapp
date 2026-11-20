import { generateKeyPairSync } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appEntry = path.resolve(__dirname, "../src/App.jsx");

let failures = 0;
function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function createHarness() {
  let hooks = [];
  let hookIndex = 0;
  let pendingEffects = [];
  let cleanups = [];
  let renderScheduled = false;
  let currentComponent = null;
  let lastTree = null;

  function depsChanged(prevDeps, nextDeps) {
    if (!prevDeps || !nextDeps) return true;
    if (prevDeps.length !== nextDeps.length) return true;
    for (let i = 0; i < prevDeps.length; i += 1) {
      if (!Object.is(prevDeps[i], nextDeps[i])) return true;
    }
    return false;
  }

  const reactShim = {
    default: {
      createElement: (type, props, ...children) => ({
        type,
        props: { ...(props || {}), children },
      }),
    },
    useState(initial) {
      const idx = hookIndex++;
      if (!(idx in hooks)) {
        hooks[idx] = typeof initial === "function" ? initial() : initial;
      }
      const setState = (updater) => {
        const next =
          typeof updater === "function" ? updater(hooks[idx]) : updater;
        if (!Object.is(hooks[idx], next)) {
          hooks[idx] = next;
          scheduleRender();
        }
      };
      return [hooks[idx], setState];
    },
    useRef(initial) {
      const idx = hookIndex++;
      if (!(idx in hooks)) {
        hooks[idx] = { current: initial };
      }
      return hooks[idx];
    },
    useCallback(fn, deps) {
      const idx = hookIndex++;
      const prev = hooks[idx];
      if (!prev || depsChanged(prev.deps, deps)) {
        hooks[idx] = { fn, deps };
      }
      return hooks[idx].fn;
    },
    useMemo(fn, deps) {
      const idx = hookIndex++;
      const prev = hooks[idx];
      if (!prev || depsChanged(prev.deps, deps)) {
        hooks[idx] = { value: fn(), deps };
      }
      return hooks[idx].value;
    },
    useEffect(fn, deps) {
      const idx = hookIndex++;
      const prev = hooks[idx];
      if (!prev || depsChanged(prev.deps, deps)) {
        hooks[idx] = { deps };
        pendingEffects.push({ idx, fn });
      }
    },
  };

  function render() {
    renderScheduled = false;
    hookIndex = 0;
    pendingEffects = [];
    lastTree = currentComponent();
    const effectsToRun = pendingEffects;
    pendingEffects = [];
    for (const { idx, fn } of effectsToRun) {
      if (typeof cleanups[idx] === "function") {
        cleanups[idx]();
      }
      const cleanup = fn();
      cleanups[idx] = typeof cleanup === "function" ? cleanup : null;
    }
  }

  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    queueMicrotask(() => {
      if (renderScheduled && currentComponent) {
        render();
      }
    });
  }

  async function flush(turns = 12) {
    for (let i = 0; i < turns; i += 1) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  function mount(Component) {
    hooks = [];
    cleanups = [];
    currentComponent = Component;
    render();
  }

  function unmount() {
    for (const cleanup of cleanups) {
      if (typeof cleanup === "function") cleanup();
    }
    cleanups = [];
    currentComponent = null;
  }

  return {
    reactShim,
    mount,
    unmount,
    flush,
    getTree: () => lastTree,
  };
}

async function loadAppWithMocks() {
  const virtualModulesPlugin = {
    name: "test-mocks",
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: /^react$/ }, () => ({
        path: "react",
        namespace: "virtual-react",
      }));
      pluginBuild.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({
        path: "react/jsx-runtime",
        namespace: "virtual-jsx",
      }));
      pluginBuild.onResolve({ filter: /^@capacitor\/app$/ }, () => ({
        path: "@capacitor/app",
        namespace: "virtual-cap-app",
      }));
      pluginBuild.onResolve({ filter: /\/services\/migrate$/ }, () => ({
        path: "migrate",
        namespace: "virtual-migrate",
      }));
      pluginBuild.onResolve({ filter: /\/services\/storage$/ }, () => ({
        path: "storage",
        namespace: "virtual-storage",
      }));
      pluginBuild.onResolve(
        { filter: /\/(components|pages)\// },
        (args) => ({
          path: args.path,
          namespace: "virtual-ui",
        })
      );

      pluginBuild.onLoad({ filter: /.*/, namespace: "virtual-react" }, () => ({
        contents: `
          export default {
            createElement: (...args) => globalThis.__TEST_REACT__.default.createElement(...args),
          };
          export const useState = (...args) => globalThis.__TEST_REACT__.useState(...args);
          export const useRef = (...args) => globalThis.__TEST_REACT__.useRef(...args);
          export const useCallback = (...args) => globalThis.__TEST_REACT__.useCallback(...args);
          export const useMemo = (...args) => globalThis.__TEST_REACT__.useMemo(...args);
          export const useEffect = (...args) => globalThis.__TEST_REACT__.useEffect(...args);
        `,
        loader: "js",
      }));

      pluginBuild.onLoad({ filter: /.*/, namespace: "virtual-jsx" }, () => ({
        contents: `
          export const Fragment = Symbol.for("react.fragment");
          export function jsx(type, props) { return { type, props }; }
          export const jsxs = jsx;
        `,
        loader: "js",
      }));

      pluginBuild.onLoad(
        { filter: /.*/, namespace: "virtual-cap-app" },
        () => ({
          contents: `
            export const App = {
              addListener: (...args) => globalThis.__TEST_CAP_APP__.addListener(...args),
            };
          `,
          loader: "js",
        })
      );

      pluginBuild.onLoad(
        { filter: /.*/, namespace: "virtual-migrate" },
        () => ({
          contents: `export async function migrateStorage() {}`,
          loader: "js",
        })
      );

      pluginBuild.onLoad(
        { filter: /.*/, namespace: "virtual-storage" },
        () => ({
          contents: `
            export const KEYS = {
              expenses: "expenses",
              planningItems: "planningItems",
              fixedExpenses: "fixedExpenses",
              merchantRules: "merchantRules",
              bankSettings: "bankSettings",
            };
            export const loadAll = (...args) => globalThis.__TEST_STORAGE__.loadAll(...args);
            export const save = (...args) => globalThis.__TEST_STORAGE__.save(...args);
          `,
          loader: "js",
        })
      );

      pluginBuild.onLoad({ filter: /.*/, namespace: "virtual-ui" }, (args) => ({
        contents: `export default function Stub(props) { return { component: ${JSON.stringify(args.path)}, props }; }`,
        loader: "js",
      }));
    },
  };

  const result = await build({
    entryPoints: [appEntry],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    plugins: [virtualModulesPlugin],
  });

  const code = result.outputFiles[0].text;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  const mod = await import(dataUrl);
  return mod.default;
}

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const originalFetch = globalThis.fetch;
const originalDateNow = Date.now;
const originalConsoleLog = console.log;

try {
  // Teste 1: Cold start + appStateChange resume + throttle + reconciliação + erro silencioso
  {
    const harness = createHarness();
    let fakeNow = 1_700_000_000_000;
    Date.now = () => fakeNow;

    const saved = {};
    const listeners = {};
    let fetchCalls = 0;
    let shouldFailFetch = false;
    let txPhase = 1;

    globalThis.__TEST_REACT__ = harness.reactShim;
    globalThis.__TEST_CAP_APP__ = {
      addListener(event, cb) {
        listeners[event] = cb;
        return Promise.resolve({
          remove() {
            delete listeners[event];
          },
        });
      },
    };
    globalThis.__TEST_STORAGE__ = {
      async loadAll() {
        return {
          expenses: [
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
          ],
          planningItems: [],
          fixedExpenses: [],
          merchantRules: {},
          bankSettings: {
            ebApplicationId: "app-auto-1",
            ebPrivateKey: privateKey,
            connections: [
              {
                id: "Santander|ES",
                institutionId: "Santander|ES",
                institutionName: "Santander",
                sessionId: "sess-auto-1",
                accounts: [{ uid: "acc-auto-1" }],
              },
            ],
          },
        };
      },
      async save(key, value) {
        saved[key] = value;
      },
    };

    globalThis.fetch = async (url) => {
      fetchCalls += 1;
      if (shouldFailFetch) {
        throw new Error("Network down");
      }
      const u = String(url);
      if (u.endsWith("/sessions/sess-auto-1")) {
        return new Response(
          JSON.stringify({
            session_id: "sess-auto-1",
            accounts: [{ uid: "acc-auto-1" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (u.endsWith("/accounts/acc-auto-1/balances")) {
        return new Response(JSON.stringify({ balances: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (u.includes("/accounts/acc-auto-1/transactions")) {
        const transactions =
          txPhase === 1
            ? [
                {
                  entry_reference: "tx-eroski-1",
                  credit_debit_indicator: "DBIT",
                  transaction_amount: { amount: "45.00" },
                  remittance_information: ["EROSKI CENTER"],
                  transaction_date: "2026-11-04",
                  status: "BOOK",
                },
              ]
            : [
                {
                  entry_reference: "tx-eroski-1",
                  credit_debit_indicator: "DBIT",
                  transaction_amount: { amount: "45.00" },
                  remittance_information: ["EROSKI CENTER"],
                  transaction_date: "2026-11-04",
                  status: "BOOK",
                },
                {
                  entry_reference: "tx-lidl-2",
                  credit_debit_indicator: "DBIT",
                  transaction_amount: { amount: "15.00" },
                  remittance_information: ["LIDL MADRID"],
                  transaction_date: "2026-11-05",
                  status: "BOOK",
                },
              ];
        return new Response(JSON.stringify({ transactions }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    };

    const App = await loadAppWithMocks();
    harness.mount(App);
    await harness.flush();

    const firstExpenses = saved.expenses || [];
    const firstMercado = firstExpenses.find((e) => e.id === "plan-m1");
    const firstLastSync = saved.bankSettings?.lastSync;

    check(
      "Cold start: executa auto-sync e atualiza expenses com reconciledExpenses",
      fetchCalls > 0 &&
        firstMercado?.value === 45 &&
        firstExpenses.some((e) => e.id === "eb:acc-auto:tx-eroski-1"),
      JSON.stringify(firstExpenses)
    );
    check(
      "Cold start: atualiza bankSettings.lastSync e merchantRules",
      Boolean(firstLastSync) &&
        Boolean(saved.bankSettings?.connections?.[0]?.lastSync) &&
        saved.merchantRules?.EROSKI === "Alimentação",
      JSON.stringify({ lastSync: firstLastSync, rules: saved.merchantRules })
    );
    check(
      "Listener appStateChange registado após storageLoaded",
      typeof listeners.appStateChange === "function"
    );

    // Background (isActive: false) não sincroniza
    const callsBeforeBg = fetchCalls;
    listeners.appStateChange({ isActive: false });
    await harness.flush();
    check(
      "appStateChange com isActive: false não dispara sync",
      fetchCalls === callsBeforeBg
    );

    // Resume imediato (< 60s) é bloqueado pelo throttle
    fakeNow += 10_000;
    listeners.appStateChange({ isActive: true });
    await harness.flush();
    check(
      "Throttle (< 60s) impede re-sincronização imediata ao voltar do background",
      fetchCalls === callsBeforeBg,
      `calls=${fetchCalls}`
    );

    // Resume após >= 60s sincroniza novamente com nova transação e atualiza lastSync
    txPhase = 2;
    fakeNow += 60_000;
    // pequeno delay real para garantir lastSync ISO timestamp diferente
    await new Promise((r) => setTimeout(r, 15));
    listeners.appStateChange({ isActive: true });
    await harness.flush();

    const secondExpenses = saved.expenses || [];
    const secondMercado = secondExpenses.find((e) => e.id === "plan-m1");
    const secondLastSync = saved.bankSettings?.lastSync;

    check(
      "Resume (>= 60s): re-sincroniza ao voltar do background e aplica reconciledExpenses",
      fetchCalls > callsBeforeBg &&
        secondMercado?.value === 30 &&
        secondExpenses.some((e) => e.id === "eb:acc-auto:tx-lidl-2"),
      JSON.stringify(secondExpenses)
    );
    check(
      "Resume (>= 60s): atualiza lastSync para novo timestamp",
      Boolean(secondLastSync) && secondLastSync !== firstLastSync,
      `${firstLastSync} -> ${secondLastSync}`
    );

    // Erro de rede/API é capturado silenciosamente sem quebrar o app
    fakeNow += 61_000;
    shouldFailFetch = true;
    const noticeLogs = [];
    console.log = (...args) => {
      noticeLogs.push(args.join(" "));
    };
    listeners.appStateChange({ isActive: true });
    await harness.flush();
    console.log = originalConsoleLog;

    check(
      "Erro de rede é capturado silenciosamente com console.log('Auto-sync notice:', ...)",
      noticeLogs.some((line) => line.includes("Auto-sync notice: Network down")),
      JSON.stringify(noticeLogs)
    );
    check(
      "Expenses permanecem intactos após erro de rede",
      saved.expenses?.find((e) => e.id === "plan-m1")?.value === 30
    );

    harness.unmount();
    check(
      "Unmount remove listener appStateChange",
      listeners.appStateChange === undefined
    );
  }

  // Teste 2: Sem credenciais ou conexões ativas não chama sync
  {
    const harness = createHarness();
    let fetchCalls = 0;

    globalThis.__TEST_REACT__ = harness.reactShim;
    globalThis.__TEST_CAP_APP__ = {
      addListener() {
        return Promise.resolve({ remove() {} });
      },
    };
    globalThis.__TEST_STORAGE__ = {
      async loadAll() {
        return {
          expenses: [],
          planningItems: [],
          fixedExpenses: [],
          merchantRules: {},
          bankSettings: {},
        };
      },
      async save() {},
    };
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return new Response("{}", { status: 200 });
    };

    const App = await loadAppWithMocks();
    harness.mount(App);
    await harness.flush();

    check(
      "Sem credenciais/conexões ativas não dispara auto-sync",
      fetchCalls === 0
    );
    harness.unmount();
  }

  // Teste 3: Auto-sync dispara quando bankSettings com conexões é carregado/atualizado após storageLoaded
  {
    const harness = createHarness();
    let fakeNow = 1_700_000_500_000;
    Date.now = () => fakeNow;
    let fetchCalls = 0;
    let savedExpenses = [];

    globalThis.__TEST_REACT__ = harness.reactShim;
    globalThis.__TEST_CAP_APP__ = {
      addListener() {
        return Promise.resolve({ remove() {} });
      },
    };
    globalThis.__TEST_STORAGE__ = {
      async loadAll() {
        // Simula storageLoaded sendo concluído primeiro e bankSettings sendo preenchido depois
        return {
          expenses: [
            {
              id: "plan-prime",
              name: "Prime Video",
              value: 5,
              date: "2026-11-01",
              week: "1",
              category: "Assinaturas",
              paid: false,
              source: "manual",
            },
          ],
          planningItems: [],
          fixedExpenses: [],
          merchantRules: {},
          bankSettings: {},
        };
      },
      async save(key, value) {
        if (key === "expenses") savedExpenses = value;
      },
    };
    globalThis.fetch = async (url) => {
      fetchCalls += 1;
      const u = String(url);
      if (u.endsWith("/sessions/sess-late-1")) {
        return new Response(
          JSON.stringify({ session_id: "sess-late-1", accounts: [{ uid: "acc-late-1" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (u.endsWith("/accounts/acc-late-1/balances")) {
        return new Response(JSON.stringify({ balances: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (u.includes("/accounts/acc-late-1/transactions")) {
        return new Response(
          JSON.stringify({
            transactions: [
              {
                entry_reference: "tx-prime-1",
                credit_debit_indicator: "DBIT",
                transaction_amount: { amount: "5.00" },
                remittance_information: ["AMAZON PRIME"],
                transaction_date: "2026-11-05",
                status: "PDNG",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not found", { status: 404 });
    };

    const App = await loadAppWithMocks();
    harness.mount(App);
    await harness.flush();

    check(
      "Antes de bankSettings ter conexões, auto-sync não inicia nem trava initialAutoSyncedRef",
      fetchCalls === 0
    );

    const banksTree = (() => {
      // Simula atualização de bankSettings como ocorreria ao carregar/salvar conexões
      const tree = harness.getTree();
      return tree;
    })();
    void banksTree;

    // Muda para aba bancos para acessar setBankSettings e simular carregamento assíncrono de bankSettings
    const bottomNavProps = harness.getTree().props.children[1].props;
    bottomNavProps.setActiveTab("bancos");
    await harness.flush();

    const banksStubProps = harness.getTree().props.children[0].props.children[3].props;
    banksStubProps.setBankSettings({
      ebApplicationId: "app-late-1",
      ebPrivateKey: privateKey,
      connections: [
        {
          id: "Santander|ES",
          institutionId: "Santander|ES",
          institutionName: "Santander",
          sessionId: "sess-late-1",
          accounts: [{ uid: "acc-late-1" }],
        },
      ],
    });
    await harness.flush();

    check(
      "Auto-sync dispara quando bankSettings passa a ter conexões válidas após storageLoaded",
      fetchCalls > 0 &&
        savedExpenses.length === 1 &&
        savedExpenses[0].paid === true &&
        !savedExpenses.some((e) => e.id === "plan-prime"),
      JSON.stringify({ fetchCalls, savedExpenses })
    );
    harness.unmount();
  }

  // Teste 4: loadData executa deduplicateAndSanitizeExpenses ao carregar storage
  {
    const harness = createHarness();
    let savedExpenses = [];

    globalThis.__TEST_REACT__ = harness.reactShim;
    globalThis.__TEST_CAP_APP__ = {
      addListener() {
        return Promise.resolve({ remove() {} });
      },
    };
    globalThis.__TEST_STORAGE__ = {
      async loadAll() {
        return {
          expenses: [
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
              date: "2026-11-05",
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
          ],
          planningItems: [],
          fixedExpenses: [],
          merchantRules: {},
          bankSettings: {},
        };
      },
      async save(key, value) {
        if (key === "expenses") savedExpenses = value;
      },
    };

    const App = await loadAppWithMocks();
    harness.mount(App);
    await harness.flush();

    check(
      "App loadData sanitiza duplicatas cross-account, recategoriza PLENERGY/AYUNTAMIENTO e reconcilia previsões",
      savedExpenses.filter((e) => e.name === "PLENERGY").length === 1 &&
        savedExpenses.find((e) => e.name === "PLENERGY")?.category === "Combustível" &&
        savedExpenses.find((e) => e.name === "AYUNTAMIENTO")?.category === "Mensalidades" &&
        savedExpenses.find((e) => e.id === "plan-fuel")?.value === 60 &&
        !savedExpenses.some((e) => e.id === "plan-nat"),
      JSON.stringify(savedExpenses)
    );
    harness.unmount();
  }

  // Teste 5: Transactions.jsx ordena filteredExpenses por data crescente (antigas em cima, recentes embaixo)
  {
    const txEntry = path.resolve(__dirname, "../src/pages/Transactions.jsx");
    const txBuild = await build({
      entryPoints: [txEntry],
      bundle: true,
      write: false,
      format: "esm",
      platform: "node",
      plugins: [
        {
          name: "tx-mocks",
          setup(pluginBuild) {
            pluginBuild.onResolve({ filter: /^react$/ }, () => ({
              path: "react",
              namespace: "virtual-react",
            }));
            pluginBuild.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({
              path: "react/jsx-runtime",
              namespace: "virtual-jsx",
            }));
            pluginBuild.onResolve({ filter: /^lucide-react$/ }, () => ({
              path: "lucide-react",
              namespace: "virtual-lucide",
            }));
            pluginBuild.onResolve({ filter: /\/components\/BottomSheet/ }, () => ({
              path: "BottomSheet",
              namespace: "virtual-sheet",
            }));
            pluginBuild.onLoad({ filter: /.*/, namespace: "virtual-react" }, () => ({
              contents: `
                export default { createElement: (...args) => globalThis.__TEST_REACT__.default.createElement(...args) };
                export const useState = (...args) => globalThis.__TEST_REACT__.useState(...args);
                export const useMemo = (...args) => globalThis.__TEST_REACT__.useMemo(...args);
              `,
              loader: "js",
            }));
            pluginBuild.onLoad({ filter: /.*/, namespace: "virtual-jsx" }, () => ({
              contents: `
                export const Fragment = Symbol.for("react.fragment");
                export function jsx(type, props) { return { type, props }; }
                export const jsxs = jsx;
              `,
              loader: "js",
            }));
            pluginBuild.onLoad({ filter: /.*/, namespace: "virtual-lucide" }, () => ({
              contents: `
                const Icon = () => null;
                export const BookOpen = Icon;
                export const Car = Icon;
                export const Check = Icon;
                export const CircleQuestionMark = Icon;
                export const Fuel = Icon;
                export const Gamepad2 = Icon;
                export const GraduationCap = Icon;
                export const Hand = Icon;
                export const Heart = Icon;
                export const Home = Icon;
                export const Landmark = Icon;
                export const PiggyBank = Icon;
                export const Plane = Icon;
                export const Plus = Icon;
                export const Receipt = Icon;
                export const Repeat = Icon;
                export const Rocket = Icon;
                export const ShoppingBag = Icon;
                export const SlidersHorizontal = Icon;
                export const Trash2 = Icon;
                export const UtensilsCrossed = Icon;
                export const Wallet = Icon;
              `,
              loader: "js",
            }));
            pluginBuild.onLoad({ filter: /.*/, namespace: "virtual-sheet" }, () => ({
              contents: `export default function BottomSheet() { return null; }`,
              loader: "js",
            }));
          },
        },
      ],
    });
    const txUrl = `data:text/javascript;base64,${Buffer.from(
      txBuild.outputFiles[0].text
    ).toString("base64")}`;
    const Transactions = (await import(txUrl)).default;

    const harness = createHarness();
    globalThis.__TEST_REACT__ = harness.reactShim;

    const nowDate = new Date();
    const ym = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}`;
    const sampleExpenses = [
      { id: "t3", name: "MAIS RECENTE", value: 30, date: `${ym}-20`, category: "Compras", paid: true },
      { id: "t1", name: "MAIS ANTIGA", value: 10, date: `${ym}-02`, category: "Compras", paid: true },
      { id: "t2", name: "INTERMEDIARIA", value: 20, date: `${ym}-10`, category: "Compras", paid: true },
    ];

    harness.mount(() =>
      Transactions({
        expenses: sampleExpenses,
        setExpenses: () => {},
        fixedExpenses: [],
        setFixedExpenses: () => {},
        merchantRules: {},
        setMerchantRules: () => {},
      })
    );

    const renderedNames = [];
    function collectText(node) {
      if (typeof node === "string") {
        if (["MAIS ANTIGA", "INTERMEDIARIA", "MAIS RECENTE"].includes(node)) {
          renderedNames.push(node);
        }
        return;
      }
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.forEach(collectText);
        return;
      }
      if (node.props?.children !== undefined) collectText(node.props.children);
    }
    collectText(harness.getTree());

    check(
      "Transactions.jsx: ordena transações do mês por data crescente (antigas em cima, recentes embaixo)",
      renderedNames.join(",") === "MAIS ANTIGA,INTERMEDIARIA,MAIS RECENTE",
      JSON.stringify({ renderedNames, ym })
    );
    harness.unmount();
  }
} finally {
  console.log = originalConsoleLog;
  Date.now = originalDateNow;
  globalThis.fetch = originalFetch;
  delete globalThis.__TEST_REACT__;
  delete globalThis.__TEST_CAP_APP__;
  delete globalThis.__TEST_STORAGE__;
}

console.log(
  failures === 0
    ? "\nTODOS OS CHECKS DE AUTO-SYNC PASSARAM"
    : `\n${failures} CHECK(S) FALHARAM`
);
process.exit(failures === 0 ? 0 : 1);
