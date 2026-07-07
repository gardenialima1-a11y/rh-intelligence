# Plataforma de People Analytics & RH BI

Plataforma corporativa de gestão estratégica de RH — Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui (componentes locais) + Prisma ORM + PostgreSQL + NextAuth v5 + Recharts + React Query + React Hook Form + Zod.

20 módulos completos: Dashboard Executivo, Headcount, Turnover, Admissões, Desligamentos, Recrutamento & Seleção, Jornada/Ponto/HE, Absenteísmo, Catraca, Treinamento & Desenvolvimento, Avaliação de Desempenho, Liderança e Gestão, Clima Organizacional/eNPS, Diversidade & Inclusão, SST, Custos de Pessoal, Benefícios, Compliance Trabalhista, People Analytics (Insights e IA) e Administração.

## Capacidades estratégicas de People Analytics

Além dos indicadores operacionais de cada módulo, a plataforma inclui capacidades de RH estratégico usadas por consultorias como Mercer, Gartner e WTW:

- **Flight Risk (People Analytics)** — modelo preditivo baseado em regras explicáveis (não é um "black box" de ML) que sinaliza colaboradores com maior probabilidade de saída, sempre exibindo os fatores que compõem o score.
- **Workforce Planning (Headcount e Turnover)** — projeção de 3 meses por regressão linear sobre os últimos 6 meses, com tendência (crescimento/estável/queda) para apoiar planejamento de contratações e retenção.
- **Equidade Salarial de Gênero (Diversidade & Inclusão)** — gender pay gap por cargo, com limiar de atenção de mercado (5%), relevante inclusive para a Lei 14.611/2023.
- **Human Capital ROI e Receita por Colaborador (Dashboard Executivo)** — indicadores clássicos Saratoga de eficiência de capital humano.
- **Bradford Factor (Absenteísmo)** — métrica CIPD/Bradford University que penaliza faltas curtas e frequentes mais do que um único afastamento longo.
- **Custo de Vacância (Recrutamento)** — estimativa de produtividade perdida por posição em aberto (metodologia SHRM/Bersin).
- **Taxa de Mobilidade Interna (Liderança e Gestão)** — promoções e transferências sobre headcount médio, indicador de desenvolvimento de carreira.

## Pré-requisitos

- Node.js 20+
- Um banco PostgreSQL acessível (local, Docker, Supabase, Neon, RDS, etc.)

## Configuração

1. Instale as dependências (isso também roda `prisma generate` automaticamente via `postinstall`):

   ```bash
   npm install
   ```

2. Copie o arquivo de ambiente e ajuste `DATABASE_URL` para o seu banco:

   ```bash
   cp .env.example .env
   ```

   Gere um valor seguro para `AUTH_SECRET`:

   ```bash
   openssl rand -base64 32
   ```

3. Crie as tabelas no banco (aplica o schema em `prisma/schema.prisma`):

   ```bash
   npm run db:migrate
   ```

4. Popule o banco com dados de demonstração realistas (colaboradores, movimentações, ponto, clima, folha, etc.):

   ```bash
   npm run db:seed
   ```

5. Rode a aplicação:

   ```bash
   npm run dev
   ```

   Acesse `http://localhost:3000` e entre com um dos usuários criados pelo seed:

   | Perfil        | E-mail                              | Senha      |
   |---------------|--------------------------------------|------------|
   | Administrador | admin@gostomineiro.com.br            | senha123   |
   | RH            | gardenia@gostomineiro.com.br         | senha123   |
   | Diretoria     | diretoria@gostomineiro.com.br        | senha123   |
   | Gestor        | gestor.producao@gostomineiro.com.br  | senha123   |

## Scripts disponíveis

| Comando               | Descrição                                              |
|------------------------|---------------------------------------------------------|
| `npm run dev`          | Sobe o servidor de desenvolvimento                      |
| `npm run build`        | Build de produção                                       |
| `npm run start`        | Sobe o servidor a partir do build de produção           |
| `npm run lint`         | ESLint                                                   |
| `npm run db:migrate`   | Cria/atualiza as tabelas a partir do schema Prisma       |
| `npm run db:deploy`    | Aplica migrations em produção (sem gerar novas)          |
| `npm run db:seed`      | Popula o banco com dados de demonstração                 |
| `npm run db:studio`    | Abre o Prisma Studio para inspecionar os dados           |
| `npm run db:generate`  | Gera o Prisma Client a partir do schema                  |

## Arquitetura

- `src/app/(app)` — shell autenticado (sidebar, header, footer) e as páginas de cada módulo em `modulos/<slug>`.
- `src/app/login` — tela de autenticação.
- `src/services` — camada de acesso a dados (uma função por indicador/KPI); toda a lógica de negócio fica aqui, isolada das páginas.
- `src/components/ui` — componentes base no padrão shadcn/ui, escritos localmente.
- `src/components/dashboard` — componentes de visualização reutilizados entre os 20 módulos (KpiCard, TrendChart, RankingBarChart etc.).
- `src/components/layout` — sidebar, header, busca global, filtros globais, menu do usuário, navegação mobile.
- `src/lib/modules.ts` — registro central dos 20 módulos (usado pela sidebar, navegação mobile e busca global).
- `src/lib/auth.ts` / `src/lib/auth.config.ts` — configuração do NextAuth v5; `auth.config.ts` é seguro para rodar no Edge Runtime (usado pelo `proxy.ts`), enquanto `auth.ts` contém o provider de credenciais com acesso ao Prisma (roda em Node.js).
- `src/proxy.ts` — proteção de rotas e controle de acesso por perfil (convenção do Next.js 16, antigo `middleware.ts`).
- `prisma/schema.prisma` — modelo dimensional completo (dimensões compartilhadas + uma tabela fato por processo de RH).
- `prisma/seed.ts` — gera dados realistas para todos os 20 módulos.

## Perfis de acesso (RBAC)

`ADMINISTRADOR`, `RH`, `DIRETORIA`, `GESTOR`, `SUPERVISOR`, `LIDER`, `USUARIO`. O módulo "Administração e Configurações" é restrito a `ADMINISTRADOR` (aplicado tanto no `proxy.ts` quanto na sidebar).

## Deploy com Docker

```bash
cp .env.example .env   # ajuste AUTH_SECRET
docker compose up --build
```

Isso sobe o PostgreSQL e a aplicação (build multi-stage, imagem `standalone` do Next.js, com health check em `/api/health`). Depois do primeiro `up`, rode as migrations e o seed dentro do container da aplicação:

```bash
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
```

## Testes

```bash
npm test          # roda a suíte de testes uma vez (Vitest)
npm run test:watch
```

A suíte cobre a lógica de negócio pura da plataforma (cálculo de período, forecast, Bradford Factor, correlação de Pearson, pareamento de catraca, proteção contra open-redirect, rate limiter de login, exportação CSV) — funções sem dependência de banco de dados, extraídas para `src/lib/analytics/` e `src/lib/` justamente para permitir teste unitário isolado.

## CI/CD

`.github/workflows/ci.yml` roda lint, type-check, testes e build a cada push/PR, usando um PostgreSQL efêmero via GitHub Actions services.

## Migrations

Este repositório ainda não contém a migration inicial (`prisma/migrations/`), pois ela precisa ser gerada uma vez com acesso normal à internet (o Prisma CLI baixa binários de `binaries.prisma.sh` na primeira execução). Rode `npm run db:migrate` no seu ambiente — isso cria e aplica a migration inicial automaticamente e a partir daí ela deve ser commitada no repositório. O CI usa `prisma db push` até que a migration inicial exista.

## Notas

- Os filtros globais de unidade e período ficam sincronizados via query string (`?unidade=...&periodo=...`) e são lidos por todos os módulos.
- O KPI "Custo de Pessoal / Receita" depende da tabela `RevenueEntry`; sem receita cadastrada, o indicador exibe "sem receita" em vez de um valor incorreto.
