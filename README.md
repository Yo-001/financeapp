# financeapp — finanças pessoais no celular

App Android (React + **Capacitor**) para acompanhar despesas do mês: lançamentos, planejamento de
compras, gastos fixos e gráficos por categoria. Roda 100% no dispositivo — nenhum dado sai do
telemóvel, nenhum servidor, nenhuma conta.

- **Pacote**: `com.finance.app` · **web dir**: `dist` (Capacitor).
- **Build do site**: React 19 + Vite 7 + TailwindCSS, ícones `lucide-react`, gráficos `recharts`.
- **Armazenamento**: `@capacitor/preferences` (no browser cai em `localStorage`), com **schema
  versionado** e migração idempotente.

## Correr

```bash
npm install
npm run dev        # Vite em http://localhost:5173
npm run build      # gera dist/ (é o que o Capacitor empacota)
npm run preview    # serve o build
```

Android (requer Android Studio / SDK):

```bash
npx cap sync android
npx cap open android       # build e instalar daí
```

## Testes

```bash
npm run test:migration     # prova da migração de storage (idempotência, backup, casos de borda)
```

O teste corre em Node puro (`test/migration.test.mjs`), simula um `localStorage` legado e verifica:
1ª execução migra e cria `backupBeforeMigrate`; 2ª é no-op; instalação limpa não inventa dados;
`fixedExpenses` editado depois da migração sobrevive; 3ª execução com versão reposta volta a correr.

## Armazenamento

| Chave (`@capacitor/preferences`) | Conteúdo |
|---|---|
| `expenses` | `Array<{id, name, value, date, category, paid, week}>` |
| `planningItems` | compras planejadas (`value`, `paymentMethods[]`, `installments`, `link`) |
| `fixedExpenses` | gastos fixos mensais |
| `merchantRules` | regras comerciante → categoria |
| `bankSettings` | configuração da importação bancária |
| `schemaVersion` | versão do formato (atual: **1**, em `src/services/migrate.js`) |
| `backupBeforeMigrate` | cópia do legado, criada uma única vez antes da 1ª migração |

O `monthlyHistory` **deixou de ser persistido**: passou a ser derivado de `expenses` por
`historyFromExpenses()` (`src/services/history.js`), com janela de **15 meses** — o mesmo
agrupamento da chave legada, para a comparação da migração ser exata.

Histórico de decisões e rastreio completo da migração: [`docs/STORAGE-MIGRACAO.md`](docs/STORAGE-MIGRACAO.md)
e [`docs/ATUALIZACAO-2026-11-13.md`](docs/ATUALIZACAO-2026-11-13.md).

## Estrutura

```
src/App.jsx                  dono do storage e do estado da app
src/pages/Home.jsx           resumo do mês + gráficos
src/pages/Transactions.jsx   lançamentos
src/pages/Plans.jsx          planejamento de compras
src/pages/More.jsx           ajustes, regras de comerciante, banco
src/services/storage.js      serviço único de leitura/escrita (Preferences + fallback localStorage)
src/services/migrate.js      migração versionada (backup, idempotência)
src/services/history.js      monthlyHistory derivado de expenses (15 meses)
android/                     projeto Capacitor Android
docs/                        decisões e rastreio da atualização de 2026-11
test/migration.test.mjs      prova da migração
```

## Estado conhecido

- `npm run lint` reporta ~506 erros, quase todos da regra `react-hooks/purity` do
  `eslint-plugin-react-hooks` v7 (chamadas impuras dentro de render). **Não bloqueia** `build` nem
  os testes; fica registado como dívida a limpar antes de reativar o lint em CI.
- Bundle principal ~565 kB (173 kB gzip); o aviso de chunk grande do Vite é esperado até se fazer
  code-splitting das páginas.
- `expo`, `react-native-gesture-handler`, `nativewind` ainda estão nas dependências do protótipo
  original e não são usados pelo app Vite/Capacitor — remover quando o Android estiver estável.
