# Controle de Gastos — planejamento mensal

Dois projetos dockerizados que sobem juntos:

| Projeto | Stack | Porta |
|---|---|---|
| `backend/` | ASP.NET Core 8 (C#) + EF Core + Npgsql | `8080` |
| `frontend/` | React 18 + TypeScript + Vite, servido por nginx | `3000` |
| banco | PostgreSQL 16 | `5432` |

O nginx do frontend faz proxy de `/api` para a API, então tudo roda na mesma origem —
não há CORS em produção nem URL de API para configurar no build.

## Como rodar

Pré-requisito: Docker Desktop (ou Docker Engine + Compose v2).

```bash
docker compose up --build
```

Depois abra:

- App: <http://localhost:3000>
- Swagger da API: <http://localhost:8080/swagger>

Na primeira subida a API cria o schema e insere categorias e fontes iniciais
(Moradia, Alimentação, Transporte, Saúde, Educação, Lazer, Investimentos, Outros —
cada uma já com algumas fontes de saída).

Para parar e apagar tudo, inclusive o banco:

```bash
docker compose down -v
```

## Configuração (`.env`)

**O projeto sobe sem nenhum `.env`** — todos os valores têm padrão no `docker-compose.yml`
(a sintaxe `${VAR:-padrão}`). O arquivo só é necessário para mudar alguma coisa:

```bash
cp .env.example .env    # Windows: copy .env.example .env
```

O Compose lê o `.env` da raiz do projeto automaticamente. Depois de editar, recrie os
containers com `docker compose up -d` — variáveis de ambiente não são aplicadas a um
container já em execução.

| Variável | Padrão | Para que serve |
|---|---|---|
| `POSTGRES_DB` | `controle_gastos` | Nome do banco |
| `POSTGRES_USER` | `postgres` | Usuário do banco |
| `POSTGRES_PASSWORD` | `postgres` | Senha do banco |
| `DB_PORT` | `5432` | Porta do Postgres no host |
| `API_PORT` | `8080` | Porta da API no host |
| `ASPNETCORE_ENVIRONMENT` | `Production` | `Development` liga logs detalhados de SQL |
| `CORS_ORIGINS` | `http://localhost:3000;http://localhost:5173` | Origens liberadas (só importa no `npm run dev`) |
| `WEB_PORT` | `3000` | Porta do frontend no host |

`POSTGRES_USER`, `POSTGRES_PASSWORD` e `POSTGRES_DB` alimentam os dois lados: o container do
banco e a `ConnectionStrings__Default` que o Compose injeta na API. Mudar num lugar só não
existe — mexa neles e os dois acompanham.

> **Trocando a senha depois da primeira subida:** o Postgres só aplica `POSTGRES_PASSWORD` ao
> criar o cluster. Se o volume já existe, a senha nova é ignorada e a API passa a falhar na
> autenticação. Para valer, apague o volume: `docker compose down -v` (isso apaga os
> planejamentos já cadastrados).

### Segurança

- **`.env` está no `.gitignore` e deve continuar assim.** Ele é o lugar dos valores reais;
  o `.env.example` é o modelo versionado e só carrega padrões de desenvolvimento.
- O `postgres/postgres` que vem de fábrica é conveniência para rodar na sua máquina, **não**
  uma credencial para deixar em pé em qualquer lugar acessível pela rede. Antes de expor a
  porta `5432` ou publicar em servidor, troque a senha e considere remover o mapeamento
  `DB_PORT` do `docker-compose.yml` — a API fala com o banco pela rede interna do Compose e
  não precisa da porta publicada.
- Fora do Docker, a connection string de desenvolvimento fica em
  `backend/src/ControleGastos.Api/appsettings.json` — que **é** versionado. Não coloque
  segredo real ali; use `dotnet user-secrets` ou variáveis de ambiente:

  ```bash
  cd backend/src/ControleGastos.Api
  dotnet user-secrets init
  dotnet user-secrets set "ConnectionStrings:Default" "Host=localhost;..."
  ```

  Qualquer chave do `appsettings.json` também pode ser sobrescrita por variável de ambiente
  trocando `:` por `__` — por exemplo `ConnectionStrings__Default` ou `Cors__Origins`.

## O fluxo do app

O planejamento de cada mês é um assistente de 4 etapas. O progresso fica salvo:
dá para fechar o navegador e voltar depois de onde parou.

1. **Entradas** — você informa quanto espera receber de cada *fonte de entrada*
   (salário, freela, rendimentos…). A soma é o **recebimento planejado do mês**.
2. **Distribuição** — você define a porcentagem da receita destinada a cada
   **categoria**. O gráfico de pizza é redesenhado a cada dígito, e a fatia cinza
   mostra o que ainda não tem destino. A soma não pode passar de 100%.
3. **Gastos previstos** — com o gráfico confirmado, cada categoria vira um bloco
   com o **teto em reais** já calculado. Você lança o valor previsto de cada
   *fonte de saída* e uma barra mostra o quanto do teto já foi comprometido.
   No mesmo bloco aparecem as **metas** daquela categoria, para direcionar quanto
   daquele mês vai para cada uma.
4. **Resumo** — totais do mês, orçamento x previsto por categoria e a sobra.

### Metas

Uma meta tem um **valor a atingir** e um **prazo (mês/ano)**, e pertence a uma
categoria. Ela é cadastrada na aba **Metas** dos Cadastros e reaproveitada em
todos os meses, como as fontes.

O aporte é lançado mês a mês, na etapa 3, e **ocupa o teto da categoria da meta** —
ou seja, guardar dinheiro concorre com gastar, que é o comportamento honesto: o
dinheiro sai do orçamento do mês do mesmo jeito. Por isso o aporte entra no total
de saídas previstas e reduz a sobra.

O progresso é a **soma de todos os aportes já lançados**, em qualquer mês. A partir
dele o app calcula quanto falta, quantos meses restam até o prazo e **quanto seria
preciso guardar por mês** para chegar lá. Metas com prazo vencido e ainda não
atingidas ficam marcadas em vermelho.

Metas que já receberam aporte não são apagadas ao serem removidas: ficam inativas,
para não quebrar o histórico dos meses.

### Resumo anual

A aba **Resumo anual** (tela inicial) junta todos os meses de um ano: quanto está
previsto entrar e sair **no ano inteiro** e a **média por mês**, um gráfico de barras
com entradas x saídas mês a mês, a tabela dos 12 meses e o gasto por categoria no ano.

As médias dividem o total pelos meses que **já têm planejamento** — meses em branco não
entram na conta, senão janeiro planejado sozinho pareceria um ano inteiro barato.

Categorias, fontes e metas são **reutilizáveis**: ficam salvas e aparecem em todos
os meses. Dá para criar novas direto no meio do assistente ou na aba **Cadastros**.

### Planejar um período

No diálogo de novo planejamento existem dois modos. **Um mês** abre o assistente
daquele mês, como sempre. **Intervalo de meses** abre o **assistente do período**:
as mesmas 4 etapas, mas o que você preenche ali é o **padrão do período**.

Acima do indicador de etapa há um seletor **Editando**, que alterna entre:

- **Padrão do período** — vale para todos os meses do intervalo;
- **cada mês do período** — abre aquele mês partindo do padrão, e o que você mudar
  vale só para ele. O mês passa a aparecer como *ajustado* no seletor e deixa de
  acompanhar mudanças posteriores no padrão (o botão *Voltar ao padrão* desfaz).

Meses do intervalo que já têm planejamento aparecem como *já existe* e ficam de
fora — nunca são sobrescritos.

**Nada é gravado até o final.** Todo o período é um rascunho no navegador; os meses
só são criados quando as três etapas de preenchimento do padrão estiverem completas
(entradas, distribuição e gastos previstos). A etapa **Resumo** mostra essa lista de
verificação e só libera o botão de gravar quando ela fecha. Aí os meses são criados
de uma vez, já concluídos, e a partir daí são planejamentos independentes como
qualquer outro — o "padrão" existiu apenas durante a criação.

O intervalo é limitado a **36 meses por vez**, para um clique errado não gerar anos
de dados.

### Ver os planejamentos em lista

A tela de Planejamentos tem dois modos, **Cards** e **Lista** (a escolha fica salva no
navegador). Na lista, cada mês é uma linha com os totais, e o botão de expandir abre
ali mesmo as entradas, o consumo de cada categoria e os aportes em metas — sem
precisar abrir o assistente. O detalhe só é buscado na primeira vez que a linha abre.

### Editar vários meses em conjunto

Nos dois modos (Cards e Lista) cada mês tem uma caixa de seleção. Ao marcar um ou
mais, aparece a barra **"Editar em conjunto"**, que abre o mesmo assistente do
período — agora em modo de edição, só com os meses selecionados.

Vale a mesma mecânica: o seletor **Editando** alterna entre o **padrão** (que vale
para todos os meses marcados) e cada mês isolado. A diferença é o que acontece com
o que já estava gravado:

- o **padrão sobrescreve** todos os meses selecionados;
- um mês que você abriu e ajustou **mantém o que foi definido nele** — o ajuste do
  mês sempre ganha do padrão;
- um mês que você não quer mexer basta não selecionar: ele não é tocado.

Ao abrir, o padrão já vem semeado com os valores do primeiro mês selecionado, e
cada mês guarda os próprios valores atuais — o botão **Manter os valores atuais**
devolve o mês ao que está gravado hoje, e **Voltar ao padrão** o faz seguir o padrão
de novo.

Nada muda até confirmar: a etapa **Resumo** mostra a lista de verificação e a tabela
**"O que será gravado"**, mês a mês, dizendo se ele vai receber o *padrão* ou o
*ajuste do mês*. Só então o lote é aplicado (`PUT /plans/batch`), substituindo as
quatro listas de cada mês de uma vez.

## Modelo de dados

```
categories ──< expense_sources ──< planned_expenses >── monthly_plans
     ├────────< goals ──────────< goal_contributions >──────┤
     └────────< category_allocations >───────────────────────┤
income_sources ──< planned_incomes >───────────────────────────┘
```

- `monthly_plans` — um por (ano, mês), com a etapa atual do assistente.
- `category_allocations` — a porcentagem de cada categoria naquele mês.
- `planned_incomes` / `planned_expenses` — os valores lançados no mês.
- `goals` / `goal_contributions` — metas e quanto de cada mês foi direcionado a elas.
- Fontes, categorias e metas já usadas em algum mês não são apagadas: ficam
  inativas, para não quebrar o histórico.

## API

Base: `http://localhost:8080/api` (documentação completa no Swagger).

| Método | Rota | O que faz |
|---|---|---|
| `GET/POST/PUT/DELETE` | `/categories` | Categorias de gasto |
| `GET/POST/PUT/DELETE` | `/income-sources` | Fontes de entrada |
| `GET/POST/PUT/DELETE` | `/expense-sources` | Fontes de saída (sempre em uma categoria) |
| `GET/POST/PUT/DELETE` | `/goals` | Metas (valor, prazo e categoria), com progresso calculado |
| `GET` | `/overview?year=` | Resumo do ano: totais, médias por mês, quebra por mês e por categoria (sem `year`, usa o ano mais recente com planejamento) |
| `GET` | `/plans` | Lista os meses planejados |
| `POST` | `/plans` | Inicia um mês (`year`, `month`, `copyFromPlanId?`) |
| `POST` | `/plans/batch` | Cria de uma vez os meses de um período, cada um já composto pelo assistente (máx. 36; meses existentes são preservados) |
| `PUT` | `/plans/batch` | Aplica um lote em meses que já existem (edição em conjunto): substitui as quatro listas de cada mês e cria o que faltar (máx. 36) |
| `GET` | `/plans/{id}` | Detalhe com totais e orçamento por categoria |
| `PUT` | `/plans/{id}/incomes` | Etapa 1 |
| `PUT` | `/plans/{id}/allocations` | Etapa 2 (valida a soma ≤ 100%) |
| `PUT` | `/plans/{id}/expenses` | Etapa 3 — fontes de saída |
| `PUT` | `/plans/{id}/goal-contributions` | Etapa 3 — aportes em metas |
| `POST` | `/plans/{id}/step` | Avança/volta a etapa |

Os três `PUT` substituem a lista inteira daquela etapa (valores zerados são
removidos) e devolvem o planejamento já recalculado.

Erros de regra de negócio voltam como `ProblemDetails` com `detail` em português —
é esse texto que o frontend mostra.

## Desenvolvimento fora do Docker

**Banco** (só ele no Docker):

```bash
docker compose up db
```

**API**:

```bash
cd backend
dotnet run --project src/ControleGastos.Api
# http://localhost:8080/swagger
```

**Frontend**:

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173 — o Vite faz proxy de /api para localhost:8080
```

### Sobre o schema do banco

O projeto sobe sem arquivos de migration: na inicialização a API cria o schema a
partir do modelo do EF Core (`EnsureCreated`). Isso mantém o "clone e rode"
simples, mas `EnsureCreated` **não** toca em um banco que já existe.

Para não perder dados quando o modelo ganha uma tabela nova, existe
`backend/src/ControleGastos.Api/Data/SchemaUpdates.cs`: um punhado de comandos
`CREATE TABLE IF NOT EXISTS` rodados logo depois do `EnsureCreated`. Em banco novo
não fazem nada; em banco antigo, completam o que falta sem mexer no que já está lá.
Foi assim que as tabelas `goals` e `goal_contributions` chegaram a quem já tinha
planejamentos — **não é preciso apagar o volume** para atualizar.

Quando quiser versionar o schema de verdade, basta gerar a primeira migration — a
API detecta que existem migrations e passa a usar `Migrate()` automaticamente, sem
mudança de código (e aí o `SchemaUpdates.cs` pode ser apagado):

```bash
cd backend
dotnet tool install --global dotnet-ef
dotnet ef migrations add InitialCreate -p src/ControleGastos.Api -s src/ControleGastos.Api -o Migrations
```

(Se o banco já tiver sido criado pelo `EnsureCreated`, apague o volume antes:
`docker compose down -v`.)

## Cores do gráfico

A paleta das categorias é uma escala categórica verificada para daltonismo
(separação mínima entre fatias vizinhas em protanopia/deuteranopia/tritanopia).
Ela vive em dois lugares e deve ser mantida igual nos dois:

- `backend/src/ControleGastos.Api/Data/DbSeeder.cs` → `Palette`
- `frontend/src/utils/palette.ts` → `CATEGORY_PALETTE`

Como três dessas cores têm contraste baixo sobre o fundo claro, o gráfico nunca
aparece sozinho: sempre há a legenda com nome, porcentagem e valor ao lado.

## Estrutura

```
controle-gastos/
├─ docker-compose.yml
├─ .env.example
├─ backend/
│  ├─ Dockerfile
│  ├─ ControleGastos.sln
│  └─ src/ControleGastos.Api/
│     ├─ Program.cs            # bootstrap, schema, seed, Swagger
│     ├─ Domain/               # entidades
│     ├─ Data/                 # DbContext, seed e SchemaUpdates
│     ├─ Contracts/            # DTOs de entrada e saída
│     ├─ Services/            # PlanService (assistente) e GoalService (metas)
│     └─ Controllers/
└─ frontend/
   ├─ Dockerfile
   ├─ nginx.conf              # SPA + proxy /api
   └─ src/
      ├─ api/client.ts
      ├─ components/          # DonutChart, MonthlyBars, inputs, modal
      ├─ pages/               # resumo anual, lista, assistentes (mês e período), cadastros
      └─ utils/               # formatação pt-BR, paleta e composição do rascunho
```
