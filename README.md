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
4. **Resumo** — totais do mês, orçamento x previsto por categoria e a sobra.

### Resumo anual

A aba **Resumo anual** (tela inicial) junta todos os meses de um ano: quanto está
previsto entrar e sair **no ano inteiro** e a **média por mês**, um gráfico de barras
com entradas x saídas mês a mês, a tabela dos 12 meses e o gasto por categoria no ano.

As médias dividem o total pelos meses que **já têm planejamento** — meses em branco não
entram na conta, senão janeiro planejado sozinho pareceria um ano inteiro barato.

Categorias e fontes são **reutilizáveis**: ficam salvas e aparecem em todos os
meses. Dá para criar novas direto no meio do assistente ou na aba **Cadastros**.
Ao criar um mês, o campo *Copiar de* traz entradas, distribuição e gastos
previstos de outro mês já planejado.

## Modelo de dados

```
categories ──< expense_sources ──< planned_expenses >── monthly_plans
     └────────< category_allocations >───────────────────────┘
income_sources ──< planned_incomes >───────────────────────────┘
```

- `monthly_plans` — um por (ano, mês), com a etapa atual do assistente.
- `category_allocations` — a porcentagem de cada categoria naquele mês.
- `planned_incomes` / `planned_expenses` — os valores lançados no mês.
- Fontes e categorias já usadas em algum mês não são apagadas: ficam inativas,
  para não quebrar o histórico.

## API

Base: `http://localhost:8080/api` (documentação completa no Swagger).

| Método | Rota | O que faz |
|---|---|---|
| `GET/POST/PUT/DELETE` | `/categories` | Categorias de gasto |
| `GET/POST/PUT/DELETE` | `/income-sources` | Fontes de entrada |
| `GET/POST/PUT/DELETE` | `/expense-sources` | Fontes de saída (sempre em uma categoria) |
| `GET` | `/overview?year=` | Resumo do ano: totais, médias por mês, quebra por mês e por categoria (sem `year`, usa o ano mais recente com planejamento) |
| `GET` | `/plans` | Lista os meses planejados |
| `POST` | `/plans` | Inicia um mês (`year`, `month`, `copyFromPlanId?`) |
| `GET` | `/plans/{id}` | Detalhe com totais e orçamento por categoria |
| `PUT` | `/plans/{id}/incomes` | Etapa 1 |
| `PUT` | `/plans/{id}/allocations` | Etapa 2 (valida a soma ≤ 100%) |
| `PUT` | `/plans/{id}/expenses` | Etapa 3 |
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
simples, mas **não** aplica mudanças de modelo em um banco já criado.

Quando quiser versionar o schema, basta gerar a primeira migration — a API
detecta que existem migrations e passa a usar `Migrate()` automaticamente, sem
mudança de código:

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
│     ├─ Data/                 # DbContext + seed
│     ├─ Contracts/            # DTOs de entrada e saída
│     ├─ Services/PlanService.cs   # regras do assistente
│     └─ Controllers/
└─ frontend/
   ├─ Dockerfile
   ├─ nginx.conf              # SPA + proxy /api
   └─ src/
      ├─ api/client.ts
      ├─ components/          # DonutChart, MonthlyBars, inputs, modal
      ├─ pages/               # resumo anual, lista, assistente, cadastros
      └─ utils/               # formatação pt-BR e paleta
```
