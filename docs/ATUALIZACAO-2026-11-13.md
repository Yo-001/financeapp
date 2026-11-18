# Atualização do repo vs versão instalada no celular (build 2026-11-13)

> Documento de análise e plano. **Nenhum código do app foi alterado.**
> Base: APK `financeapp-novo.apk` (build 13/11/2026 00:08), screenshots de 13/11, dados puxados do celular em 12/11/2026 23:11, e repo em `4aac856` (29/01/2026).
> Verificação web: 18/11/2026.

## TL;DR

1. O app do celular tem **uma tela a mais** (aba *Bancos*) e **um redesign completo** (design system próprio) que **não existem no repo nem no `dist/`**.
2. **O código-fonte dessa versão não está no git.** O `dist/` commitado (29/01) foi gerado do código atual do repo (sem banco). A única fonte da versão instalada é o **bundle minificado dentro do APK** (~13 KB de lógica de app, legível mas sem nomes).
3. Recomendação: **reescrever** as telas a partir desta especificação (barato, ~2 dias) em vez de tentar "desminificar" o bundle. O bundle serve como referência de comportamento, não como fonte.
4. Integração bancária gratuita: **CSV exportado pelo banco é a rota principal** (já implementada no celular, zero dependência, zero custo). Open banking gratuito hoje só via **Enable Banking "restricted production"** (suas próprias contas, non-comercial), com complexidade alta (RSA/JWT, reconsentimento 90 dias). **GoCardless Bank Account Data está fechado para novos cadastros** (confirmado 18/11/2026).
5. Risco real de perda de dados: `fixedExpenses` hoje vive em `localStorage` (some em limpeza de WebView e **não** vai no backup do app novo), e `monthlyHistory` deixa de existir na versão nova.

---

## 1. Evidências inspecionadas

| Artefato | Tamanho / data | O que mostra |
|---|---|---|
| `financeapp-migration/financeapp-novo.apk` | 4,36 MB · 13/11 00:08 | bundle `assets/public/assets/index-DsSZtaJN.js` (567.636 B) + `index-DXoxw-cB.css` + `data.json` embutido |
| `financeapp-migration/CapacitorStorage.xml` | 67.620 B · 12/11 23:11 | storage do celular **antes** do APK novo: `expenses`, `planningItems`, `monthlyHistory` |
| `financeapp-migration/data.json` | 50.861 B · 12/11 23:11 | cópia idêntica do array `expenses` do XML (264 lançamentos) — serve de seed de dev/rollback |
| `financeapp-migration/test-santander.csv` | 85 B · 12/11 23:44 | `Fecha;Concepto;Importe` com `dd/mm/aaaa` e vírgula decimal |
| `financeapp-migration/screenshots/` | 13/11 | 01-04 = UI do APK instalado; 05-11 = **mockups** de tema escuro/gradiente/marrom (não estão no APK) |
| `financeapp/dist/` (gitignored) | 29/01 | bundle antigo (562 KB), **sem** `Bancos`/`CSV`/`merchantRules` → confirma que o repo não tem a versão do celular |

Contagens de strings nos dois bundles (mesma base de código, um evoluiu):

| String | `dist/` do repo | bundle do APK |
|---|---|---|
| `Bancos` | 0 | presente |
| `CSV` | 0 | presente |
| `Santander` | 0 | presente |
| `merchantRules` | 0 | 16 |
| `bankSettings` | 0 | presente |
| `fixedExpenses` | 2 (localStorage) | 5 (Preferences) |

O APK **não** tem `dark:`/`darkMode`/`prefers-color-scheme`: as telas escuras dos screenshots 05-11 são exploração visual, não feature.

---

## 2. Inventário da versão do celular

### 2.1 Navegação
4 abas fixas: **Início · Período · Planos · Bancos** (repo tem 3; `More.jsx` não é aba).

### 2.2 Início (`XI`)
- Cabeçalho do mês com navegação ‹ mês ›.
- Total do mês + variação % vs mês anterior.
- Cartão Pago / Pendente.
- **Últimos meses**: gráfico de barras (recharts) dos 6 meses anteriores.
- **Categorias do mês**: lista com ícone, valor e barra de proporção.
- **Gastos fixos**: total, quanto já foi lançado no mês, lista dos fixos pendentes e botão ▶ que lança todos os fixos pendentes como despesas do mês (idempotente: não duplica se já lançado).
- Rodapé: atalho "insights em Período → resumo".

### 2.3 Período (`VI`)
- Alternância **mensal / anual**, seletor de mês/ano.
- Total do período, contagem, filtro por categoria (`todas` + categorias), busca por nome.
- Agrupamento por semana (1-5) ou por dia; "todas as semanas".
- Ações por lançamento: marcar pago/pendente, editar, excluir.
- **Novo gasto** com `date` (ISO), `week` derivada, categoria, pago/pendente.
- **Resumo/insights** (painel `showInsights`), incluindo maiores comerciantes e comparação com o mês anterior.

### 2.4 Planos (`QI`)
- Item de planejamento: `name`, `value`, `paymentMethods: ["à vista" | "parcelado"]`, `installments`, `link` ("Abrir Link").
- Totais: total planejado, por método, parcela/mês (soma `value/installments` dos parcelados).
- Editar/excluir.

### 2.5 Bancos (`aq`) — **novo**
- **Status da conexão**: banco conectado? nº de contas, data do último sync; botões *Sincronizar* e *Desconectar banco* (transações importadas permanecem).
- **Credenciais GoCardless**: campos Secret ID / Secret Key ("salvas neste dispositivo"), botão salvar.
- **Buscar bancos** (`GET /institutions/?country=ES`), lista com logo/nome, botão conectar → abre o link de autorização no navegador do sistema (Capacitor Browser).
- **Importar extrato (CSV)** por banco: presets `["Santander","Revolut","Klarna"]` + arquivo escolhido por `input[type=file]`.
- **Backup**: exportar JSON, importar JSON (com validação), **apagar todos os dados**.

### 2.6 Modelo de dados (Preferences, chaves `rv`)

`["expenses","planningItems","fixedExpenses","merchantRules","bankSettings"]`

- `expenses[]`: `{ id, name, value, category, date: "YYYY-MM-DD", week: 1-5, paid: bool, source?: "csv"|"bank", account?: "Santander"|... }`
  - ids legados são numéricos; importados usam id determinístico (ver 2.8).
- `planningItems[]`: `{ id, name, value, paymentMethods[], installments, link }`
- `fixedExpenses[]`: `{ id, name, value, category: "Mensalidades", day: number|null }` — **agora em Preferences** (repo grava em `localStorage`).
- `merchantRules{}`: mapa `COMERCIANTE → categoria` aprendido nas importações (normaliza maiúsculas/acentos).
- `bankSettings{}`: `{ secretId, secretKey, requisitionId, institutionId, institutionName, accounts[], lastSync }`

### 2.7 Categorias (15, com ícone próprio)
`Alimentação, Mensalidades, Moradia, Transporte, Combustível, Compras, Assinaturas, Lazer, Saúde, Viagem, Educação, Estudo, Poupança, Banco, Outros`

Dicionário de palavras-chave por categoria (`DC`) usado para adivinhar categoria: ex. `MERCADONA/CARREFOUR/LIDL/ALCAMPO/GLOVO/UBER EATS → Alimentação`, `SHELL/REPSOL/CEPSA/BP → Combustível`, `ALQUILER/IBERDROLA/ENDESA/MOVISTAR/IBI → Moradia`, `NETFLIX/SPOTIFY/OPENAI/ADOBE → Assinaturas`, `COMISION/MANTENIMIENTO/CUOTA → Banco`.

### 2.8 Importação CSV (`tq`) — sem dependências
1. Detecta separador (`;` `,` tab).
2. Acha a linha de cabeçalho e as colunas de **data** (dd/mm/aaaa ou ISO), **valor** (com vírgula ou ponto) e **descrição** (a coluna de texto com maior comprimento médio).
3. Ignora valores ≥ 0 (só saídas) e zero.
4. id determinístico `csv:<banco>:<data>:<valor>:<comerciante>:<índice>` → **reimportar o mesmo ficheiro não duplica**.
5. Categoria: `merchantRules` → senão dicionário; grava a regra nova (`{added, merchantRules}`).
6. Resultado reportado: "N novas transações importadas, M duplicadas/entradas ignoradas".

### 2.9 Open banking (GoCardless Bank Account Data)
Cliente `il` sobre `https://bankaccountdata.gocardless.com/api/v2`, via **CapacitorHttp** (evita CORS no Android):
`POST /token/new/` → `GET /institutions/?country=ES` → `POST /requisitions/` (`redirect` = origem atual, `reference: "financeapp"`) → `GET /requisitions/{id}/` (contas) → `GET /accounts/{id}/transactions/?date_from=` .
Filtra `booked`, só negativos, `value = |amount|`, id `gc:...`, `source: "bank"`, `paid: true`. Refresh token **não** é usado (token em memória).

### 2.10 Design system (o que mais muda visualmente)
Tailwind com tokens semânticos (não é o `teal-600` cru do repo):

| token | valor |
|---|---|
| `canvas` | `#F6F6F4` |
| `hairline` | `#E8E9E6` |
| `ink` | `#1A1C1A` |
| `soft` | `#6F7671` |
| `faint` | `#A3A9A5` |
| `accent` | `#0F766E` / `accent-soft` `#E7F2F0` |
| `ok` | `#3E7A46` |
| `danger` | `#B3402F` |

Componentes: `.card` (raio 1rem, borda 1px hairline, fundo branco), `.field`, `.btn-primary` (desabilitado = 40% opacidade), `.chip`. Fonte **Inter**. Números: `Intl.NumberFormat("es-ES", {currency:"EUR"})`.

---

## 3. O que falta no repo

| Recurso | Repo (`4aac856`) | Celular (APK 13/11) |
|---|---|---|
| Aba **Bancos** | não existe | status, conectar, sincronizar, desconectar |
| Importação **CSV** | não existe | 3 presets + parser genérico + dedupe |
| Aprendizado de categoria | não existe | `merchantRules` + dicionário de 15 categorias |
| **Open banking** | não existe | GoCardless (token/instituições/requisições/transações) |
| **Backup / restaurar / apagar tudo** | não existe | export/import JSON validado + wipe |
| Gastos fixos | em `localStorage` (⚠️) | em Preferences, com `day` |
| Histórico mensal | chave `monthlyHistory` persistida | derivado de `expenses` (sem chave) |
| Design system | Tailwind default, `bg-white`, `text-teal-600` | tokens + `.card`/`.field`/`.btn-primary` |
| Home | total, pizza "Distribuição", "Últimos Meses" (7), Insights | total + variação %, 6 barras, categorias com barra, gastos fixos com lançamento |
| Insights | parcialmente **hardcoded** (`Alimentação - €570`) | calculado dos dados |
| Navegação | 3 abas | 4 abas |
| Storage | `storage.js` só `expenses`; resto inline no `App.jsx` | serviço único `loadAll/save/get` |

**Diagnóstico:** a versão do celular é um avanço de produto (importação + open banking + redesign), mas o repo ficou para trás e a fonte se perdeu. Não é "um commit de diferença": é um conjunto de ~6 arquivos novos e 4 reescritos.

---

## 4. Plano de atualização (ordenado, revisável antes de codar)

### Fase 0 — Salvaguarda (30 min)
- Branch `feat/parity-2026-11`; tag do estado atual.
- Copiar `data.json` para `dev-fixtures/expenses-2026-11-12.json` (dados reais, **não** commitar se preferir privacidade — decidir).
- Confirmar `appId` do APK = `appId` do `capacitor.config`; **mesmo appId é o que preserva o storage** na instalação por cima (`adb install -r`).
- Antes de qualquer build: exportar backup do app atual pelo próprio botão do celular (se existir) ou `adb` pull do `CapacitorStorage.xml`.

### Fase 1 — Design system (0,5 dia)
`tailwind.config.js` (tokens), `src/index.css` (`.card`, `.field`, `.btn-primary`, `.chip`, fundo canvas), `index.html` (Inter). Nenhuma lógica.
**Aceite:** app atual com mesmas telas, visual novo, zero mudança de dados.

### Fase 2 — Camada de dados e migração (1 dia)
- `src/services/storage.js`: `KEYS`, `loadAll()`, `save(key, value)`, `get(key)` com try/catch (substitui os `useState` + `Preferences.get` espalhados no `App.jsx`).
- `src/services/migrate.js`: `schemaVersion` + migrações idempotentes:
  1. `fixedExpenses`: ler `localStorage.fixedExpenses` → gravar em Preferences → **não apagar** o original na v1.
  2. `monthlyHistory`: **não migrar**; passar a derivar de `expenses` (função pura `historyFromExpenses(expenses, 15)`). Manter a chave antiga intacta até validar que os totais batem com os 15 meses gravados.
  3. `backup:auto`: gravar um snapshot único (chave `backupBeforeMigrate`) antes da primeira escrita.
- `src/services/backup.js`: export `{ version, exportedAt, expenses, planningItems, fixedExpenses, merchantRules, bankSettings }`; import com validação de shape (rejeitar arquivo inválido sem tocar nos dados).
**Aceite:** abrir app antigo → atualizar → 264 lançamentos, planejamento e fixos idênticos; `monthlyHistory` antigo confere com o derivado.

### Fase 3 — Telas (2 dias)
`Home.jsx`, `Transactions.jsx`, `Plans.jsx` reescritos no design novo mantendo a lógica atual; `BottomNav.jsx` com 4ª aba; `App.jsx` como shell (tabs + estado + storage service). Insights calculados de verdade (remover `€570` fixo).
**Aceite:** paridade visual com screenshots 01-03; mesmas ações de antes.

### Fase 4 — Bancos + CSV (1 dia)
- `src/services/csv.js` (parser puro: separador, cabeçalho, colunas, datas, valores, dedupe) — sem libs.
- `src/services/categories.js` (`CATEGORIES` com ícones + dicionário de palavras-chave + `guessCategory`).
- `src/pages/Banks.jsx`: importar CSV por banco, resultado da importação, credenciais, backup.
**Aceite:** importar `test-santander.csv` 2× → 2ª vez 0 novas; categorias plausíveis; nada duplicado.

### Fase 5 — Backup/wipe (0,5 dia)
Exportar → arquivo JSON; importar → confirmação + validação; apagar tudo → dupla confirmação. **Incluir `fixedExpenses` no backup** (o app novo esqueceu).

### Fase 6 — Open banking (1-2 dias, **condicional**)
Só se Leonardo já tiver credenciais GoCardless ativas (ver §5). Caso contrário, **não implementar**: produto fechado a novos cadastros.

### Riscos de perda de dados no celular

| Risco | Impacto | Mitigação |
|---|---|---|
| `fixedExpenses` em `localStorage` | limpeza de WebView/atualização pode zerar | migrar para Preferences na Fase 2, mantendo o original |
| `monthlyHistory` deixa de existir | histórico "desaparece" se derivado errado | derivar e comparar com a chave antiga antes de remover |
| Instalar APK com `appId` diferente | **apaga tudo** (novo sandbox) | manter `appId`; `adb install -r`, nunca `-uninstall` primeiro |
| Import de backup do app novo **substitui** tudo | perda do que foi lançado depois | confirmação explícita + `backup:auto` antes |
| ids legados numéricos vs `csv:`/`gc:` | duplicação ao reimportar | dedupe por id **e** por (data, valor, comerciante) na 1ª importação |
| Reimportar CSV antigo após mudar preset de banco | ids diferentes → duplicatas | id sem o nome do banco, ou detectar por (data, valor, comerciante) |

**Estratégia de storage:** chaves aditivas + nunca destrutivas na v1; `schemaVersion` em chave própria; leitura tolerante (`null` → default); toda escrita passa pelo `storage.js`; backup automático antes da primeira migração.

---

## 5. Integração bancária gratuita (verificado em 18/11/2026)

| Rota | Custo | Esforço | Limitações | Veredito |
|---|---|---|---|---|
| **CSV exportado pelo banco** | €0 | baixo (já existe no APK) | manual; Santander ES só exporta **Excel/PDF** → passo "guardar como CSV" | ✅ **recomendado** |
| OFX | €0 | baixo/médio | Santander ES não oferece; N26/Revolut usam CSV | ⏸ só se aparecer banco com OFX |
| Norma 43 (AEB) | €0 | médio (posicional) | formato empresarial; não disponível a particulares no Santander | ❌ pouco útil |
| Notificações push (`NotificationListenerService`) | €0 | médio/alto (plugin nativo) | só compras futuras, só com notificações ativas, formato varia por banco, frágil | 🟡 opcional, experimental |
| E-mail de extrato | €0 (Gmail API sem custo, com quotas) | médio (OAuth) | Santander não envia extrato parseável por e-mail; risco de quebra | ❌ baixo valor |
| Open banking GoCardless (ex-Nordigen) | — | baixo (já implementado) | **novos cadastros desativados** | ⚠️ legado |
| Open banking Enable Banking | €0 em modo *restricted* | alto (RSA/JWT, app próprio, reconsentimento 90 dias) | não é "free tier" comercial; uso pessoal não-comercial | 🟡 só se quiser automatizar |
| Plaid / Tink / Salt Edge / TrueLayer / finAPI | pagos | — | contrato B2B | ❌ descartado |

### CSV (rota principal)
O banco exporta, o utilizador importa o ficheiro. Zero custo, zero dependência, zero credenciais. Já está implementado no APK (`test-santander.csv`: `Fecha;Concepto;Importe`, `dd/mm/aaaa`, vírgula decimal — exatamente o Excel do Santander ES guardado como CSV).
Fonte: FAQ oficial do Santander ES — movimentos disponíveis para descarregar em **Excel ou PDF** (não CSV/OFX): <https://www.bancosantander.es/faqs/particulares/operativa-banca-digital/como-consultar-descargar-movimientos-cuenta> (consultado 18/11/2026).
Consequência prática: manter o passo "abrir Excel → Guardar como CSV" **ou** (fase futura) ler `.xlsx` — mas isso exigiria dependência nova; não agora.

### Notificações push do banco (Android)
- Viável em Capacitor **só com plugin nativo**: `@posx/capacitor-notifications-listener` v5.0.7 (Capacitor 7, Android 12-15; última publicação há ~1 ano; o autor avisa que está "em desenvolvimento ativo" e que há bugs esperados, sobretudo no serviço em background) — a alternativa `Alone2/capacitor-notificationlistener` foi arquivada por falta de manutenção.
- Custo: permissão especial "Acesso a notificações" concedida manualmente nas definições (não é diálogo runtime); parser por banco (o texto da notificação muda sem aviso); só captura o **futuro** (sem histórico); exige app vivo/notificações ativas.
- Play Store: irrelevante aqui — distribuição é APK pessoal, sem revisão. Se algum dia publicar, "notification access" é permissão sensível que exige divulgação clara e justificação de uso (`NotificationListenerService`, docs Android).
- **Veredito:** bom complemento opcional ao CSV, nunca substituto.

### E-mail de extrato
Gmail API é gratuita (só quotas por minuto/projeto — <https://developers.google.com/workspace/gmail/api/reference/quota>, consultado 18/11/2026), mas o Santander não envia extrato em anexo parseável; implicaria OAuth + parsing frágil de HTML. **Não recomendo.**

### Open banking
- **GoCardless Bank Account Data (ex-Nordigen):** a página oficial devolve *"New signups for Bank Account Data are currently disabled."* — <https://bankaccountdata.gocardless.com/new-signups-disabled> (consultado 18/11/2026). O tier gratuito histórico (limites documentados: 4 chamadas por conta por dia, acesso contínuo de 90 dias, histórico até 24 meses — <https://docs.gocardless.com/docs/bank-account-data>) **não está disponível para novas contas**. Se Leonardo já tem `secretId`/`secretKey` válidos, a integração do APK continua a funcionar — tratar como **legado**, sem construir nada novo em cima.
- **Enable Banking:** "restricted production" permite ligar **as próprias contas** para uso pessoal não-comercial, sem contrato comercial; produção normal é cobrada por volume com faturação mínima (FAQ/knowledge base, consultado 18/11/2026). Custo real: chave RSA + JWT assinado, aplicação registada, reconsentimento SCA a cada **90 dias**, e fragilidade de agregador.
- **AISP licenciado PSD2 (ser o próprio agregador):** **inviável para pessoa física** — exige sociedade, capital mínimo, supervisão do regulador (Banco de España/BdP), auditoria e seguro. Não é caminho.
- **Pagos, descartados:** Plaid, Tink, Salt Edge, TrueLayer, finAPI.

### Recomendação
1. **CSV como fonte oficial** (custo €0, já validado com o extrato real do Santander).
2. **Notificações** apenas como experiência opcional, depois da paridade.
3. **Open banking**: manter o código do APK só se as credenciais GoCardless existentes funcionarem; não investir. Enable Banking só se o CSV se tornar incómodo.

---

## 6. Decisões pendentes (para o Leonardo)

1. **Reescrever do zero (recomendado) ou tentar recuperar o bundle?** O bundle tem a lógica mas sem nomes; reescrever 4 telas a partir desta spec é mais rápido e limpo.
2. **Backup do app novo deve incluir `fixedExpenses`?** (recomendo sim — hoje não inclui).
3. **Credenciais GoCardless ainda válidas?** Se não, a Fase 6 sai do plano.
4. **Aceita o passo manual "Excel → CSV" no Santander**, ou quer suporte a `.xlsx` (nova dependência, ex. SheetJS)?
5. **Commitar os dados reais** (`dev-fixtures`) ou manter fora do git?

## 7. Ordem de execução sugerida

`Fase 0 → 1 → 2 (com teste de migração nos dados reais) → 3 → 4 → 5`, cada fase num commit próprio, build + instalar por cima (`adb install -r`) e conferir dados. Fase 6 só depois de responder ao ponto 3.
