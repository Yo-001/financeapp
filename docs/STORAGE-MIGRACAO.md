# Storage e migração — estado atual e plano (Fase 0–2)

> Documento de rastreio e decisões da atualização de 2026-11 iniciada em `feat/atualizacao-2026-11`.
> Complementa `docs/ATUALIZACAO-2026-11-13.md` (que descreve a versão instalada no celular).
> Rastreio feito **antes** de qualquer alteração de código, sobre o commit `3752d1e`.

## 1. Comportamento atual (pré-atualização)

### 1.1 Chaves e onde vivem

| Chave | Onde é gravada hoje | Quem grava | Quem lê | Formato |
|---|---|---|---|---|
| `expenses` | Capacitor Preferences | `src/App.jsx` (effect em `[expenses, storageLoaded]`) | `src/App.jsx` no arranque | `Array<{ id:number, name:string, value:number, date:"YYYY-MM-DD", category:string, paid:boolean, week:string }>` |
| `planningItems` | Capacitor Preferences | `src/App.jsx` | `src/App.jsx` | `Array<{ id:number, name:string, value:number, paymentMethods:string[], installments:number\|null, link:string }>` |
| `monthlyHistory` | Capacitor Preferences | `src/App.jsx` (recalculado de `expenses` e regravado a cada mudança) | `src/App.jsx` → `Home` | `Array<{ year:number, month:0-11, total:number, paid:number, pending:number }>` (valores arredondados com `Math.round`) |
| `fixedExpenses` | **`localStorage` cru** | `src/pages/Transactions.jsx` | `src/pages/Transactions.jsx` | `Array<{ id:number, name:string, value:number, week:string, category:string }>` |

Dados reais do celular (export de 12/11/2026, `CapacitorStorage.xml`): `expenses` (264), `planningItems` (17), `monthlyHistory` (15 meses, 2025-10 → 2026-12). **Não há `fixedExpenses` no export** — ou não estava configurado, ou o `localStorage` da WebView já tinha sido limpo (exatamente o risco apontado no doc de atualização). A migração continua a cobrir a chave.

### 1.2 Detalhes que a migração precisa respeitar

- **`week` é string** (`"1"`…`"4"`) nos dados reais, não número. Nada de normalizar o shape na migração: os ecrãs comparam `e.week !== selectedWeek` com strings.
- **ids numéricos** (`Date.now()`), únicos por lançamento. A Fase 4 introduz ids `csv:`/`gc:`; a migração não toca em ids.
- **`planningItems.installments`** pode ser `null`/ausente (itens "à vista").
- **`src/services/storage.js`** existe mas é código morto: exporta `StorageService.getExpenses/setExpenses` e nenhum módulo o importa. As leituras/escritas reais estão inline no `App.jsx` + `Transactions.jsx`.
- **Hazard de escrita no arranque**: o effect de gravação de `fixedExpenses` corre no mount com o estado inicial `[]` e grava antes do load terminar. Hoje o load é síncrono (`localStorage.getItem`), então o valor certo é regravado logo a seguir; ao passar a assíncrono (Preferences) isso viraria perda de dados. O novo código só grava depois de marcado `loaded`.
- **`monthlyHistory` é derivado**, mas persistido. O doc da versão do celular remove a chave e deriva em memória; aqui a chave antiga fica intacta (só leitura) para comparação.
- **`appId`**: `com.finance.app` em `capacitor.config.json`, igual ao APK. **Não foi alterado** (mudar apaga o sandbox do app na instalação).

### 1.3 Invariantes

1. Nenhum dado do utilizador é apagado por migração. Escritas são aditivas; a chave antiga `fixedExpenses` do `localStorage` **não** é removida nesta versão.
2. `monthlyHistory` antigo nunca é apagado nem reescrito; passa a ser **lido** e comparado.
3. Antes da primeira escrita de uma migração é gravado um snapshot completo do storage (`backupBeforeMigrate`), **uma única vez** — reexecutar não o substitui.
4. `schemaVersion` só é escrito no fim, depois de todas as etapas. Se o app morrer a meio, a próxima abertura repete as etapas (todas idempotentes).
5. Toda escrita passa por `src/services/storage.js`.

## 2. Camada de dados (implementada)

`src/services/storage.js`

- `KEYS` — nomes de chave num só lugar (`expenses`, `planningItems`, `fixedExpenses`, `merchantRules`, `bankSettings`, `schemaVersion`, `backupBeforeMigrate`, `legacyMonthlyHistory`).
- `readRaw(key)` → string ou `null`: tenta `Preferences.get`; se o plugin não estiver disponível (browser sem Capacitor, testes em Node) cai para `localStorage.getItem(key)`.
- `writeRaw(key, value)` / `removeRaw` — mesma estratégia (Preferences, fallback `localStorage`).
- `readJSON(key, fallback)` — leitura tolerante: JSON inválido ou ausente devolve o default e regista um aviso, nunca lança no arranque.
- `loadAll()` → `{ expenses, planningItems, fixedExpenses, merchantRules, bankSettings }` com defaults (`[]`/`[]`/`[]`/`{}`/`{}`).
- `save(key, value)` → serializa e grava; devolve `true/false` (erro é logado, não propaga para a UI).

`src/services/history.js`

- `historyFromExpenses(expenses, months = 15)` — função pura, mesmo agrupamento/arredondamento do código antigo (`year`, `month` 0-11, `total`, `paid`, `pending`), ordenado asc, cortado aos últimos `months`. Datas inválidas são ignoradas.

## 3. Migração (implementada)

`src/services/migrate.js` — `SCHEMA_VERSION = 1`, `migrateStorage()`.

| Passo | Condição | Efeito |
|---|---|---|
| 0. snapshot | `backupBeforeMigrate` ausente **e** (há dados em qualquer chave **ou** versão < 1) | grava `{ version, createdAt, keys:{...raw}, legacyLocalStorage:{fixedExpenses, monthlyHistory} }` |
| 1. `fixedExpenses` | Preferences sem `fixedExpenses` válido e `localStorage.fixedExpenses` é array não vazio | copia para Preferences; original **mantido** |
| 2. `monthlyHistory` | chave legada presente | compara `historyFromExpenses(expenses, 15)` com a chave; devolve `{ compared, identical, mismatches }`; **não** grava nada |
| 3. `schemaVersion` | sempre no fim | grava `"1"` |

Reexecução: com `schemaVersion = "1"` a função devolve `{ ran: false }` sem escrever. Se a versão for apagada/antiga mas os dados já estiverem migrados, o passo 1 vê `fixedExpenses` já em Preferences e não reescreve; o passo 0 não recria o snapshot.

**Rollback**: `backupBeforeMigrate.keys` contém os valores originais de todas as chaves no momento da migração; restaurar = escrever esses valores de volta (Preferences) e, se necessário, apagar `schemaVersion`. O `localStorage.fixedExpenses` original nunca foi tocado.

`monthlyHistory` deixa de ser escrita: `App.jsx` deriva-a com `historyFromExpenses(expenses, 15)` a cada render.

## 4. Fora do escopo desta fase (continua como no plano)

- `src/services/backup.js` (export/import JSON + validação) — Fase 5, junto da UI de backup/wipe. O snapshot automático acima é o mecanismo de segurança da migração.
- "Lançar gastos fixos do mês" idempotente e campos `day` dos fixos — Fase 3 (o shape atual `week` é preservado).
- Aba Bancos, CSV, `merchantRules`/categorias, open banking — Fases 4–6.
