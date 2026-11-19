# PROMPT — UrbanizaGO: Desenvolvimento Full Stack Completo

> **Anexos que acompanham este prompt:**
> 1. Documento funcional do aplicativo (PDF "Projeto: UrbanizaGO").
> 2. Template visual das telas (mobile cidadão, mobile administrador e painel web).
>
> Use os anexos como **fonte da verdade** para funcionalidades, textos, fluxos e identidade visual (verde, cards arredondados, ícones de linha).

---

## 1. PAPEL

Você é um **time sênior full stack** (arquiteto de software, engenheiro back-end, engenheiro front-end/mobile, DBA e DevOps), com foco em TypeScript, React e PostgreSQL. Entregue um projeto **completo, executável, organizado e totalmente documentado**, pronto para subir com um único comando via Docker.

---

## 2. CONTEXTO DO PRODUTO

**UrbanizaGO – Plataforma Colaborativa para Cidades Inteligentes.**

Muitas cidades têm dificuldade para identificar e resolver problemas urbanos (buracos, falhas de iluminação, descarte irregular de lixo, vazamentos de água). Os cidadãos não têm um canal simples para comunicar essas ocorrências aos órgãos responsáveis.

O UrbanizaGO aproxima a população da gestão pública, permitindo registrar problemas com **foto, descrição e localização geográfica**, acompanhar o andamento e dar transparência à gestão.

**Objetivo geral:** plataforma digital colaborativa para o cidadão registrar, acompanhar e consultar ocorrências urbanas, facilitando a comunicação com os órgãos responsáveis.

**Objetivos específicos:**
- Cadastro de ocorrências com foto, descrição e localização.
- Categorização dos problemas.
- Mapa interativo com as ocorrências.
- Acompanhamento de status pelo cidadão.
- Informações para gestores priorizarem demandas.
- Incentivo à participação cidadã.

---

## 3. ESCOPO — O QUE DEVE SER ENTREGUE

Entregue **tudo**: front-end, API, back-end, banco de dados, Docker e documentação.

### 3.1 Três aplicações cliente

| App | Plataforma | Público | Observação |
|---|---|---|---|
| **Mobile Cidadão** | React Native (Expo) + TypeScript | Cidadãos | Registrar, acompanhar e consultar ocorrências |
| **Mobile Administrador** | React Native (Expo) + TypeScript | Empresas / órgãos responsáveis | **Mesmas funções do web admin** |
| **Web Administrador** | React + Vite + TypeScript (TSX) | Empresas / gestores | Uso **exclusivo de administradores** |

> O app mobile do administrador e o web do administrador têm **exatamente as mesmas funcionalidades**. Reaproveite ao máximo: tipos, cliente de API, validações e regras compartilhadas em um pacote comum.
> O app mobile do cidadão e o do administrador podem ser **dois apps separados** (dois projetos Expo) ou **um app com perfis**. Escolha a opção mais simples de manter e justifique no `docs/decisoes-arquitetura.md`.

### 3.2 Backend

API REST em **Node.js + Express + TypeScript**, com **Prisma ORM** sobre **PostgreSQL**.

### 3.3 Infraestrutura

`docker-compose` com: PostgreSQL, API, Web Admin, MinIO (fotos, compatível com S3), MailHog (captura de e-mails em desenvolvimento) e, opcionalmente, pgAdmin.

---

## 4. REQUISITOS FUNCIONAIS

### 4.1 Autenticação (todos os apps)

- Cadastro, login por **e-mail e senha** e **recuperação de senha** (token com expiração enviado por e-mail).
- **Senhas sempre criptografadas** (hash com `argon2` ou `bcrypt`, nunca em texto puro, nunca retornadas pela API).
- **JWT** com *access token* de curta duração e *refresh token* com rotação e revogação (armazenado com hash no banco).
- Perfis (*roles*): `CITIZEN` e `ADMIN`. Autorização por perfil em todas as rotas.
- No mobile, armazenar tokens com `expo-secure-store`. No web, preferir cookie `httpOnly` ou estratégia equivalente e documentada.
- Proteções: rate limit no login, bloqueio temporário após tentativas falhas, `helmet`, CORS restrito, validação de entrada com **Zod** em todas as rotas, sanitização, logs sem dados sensíveis.
- O cadastro público cria **apenas** `CITIZEN`. Contas `ADMIN` são criadas por seed inicial ou por outro admin.

### 4.2 Cidadão (mobile)

1. **Tela inicial** com acesso rápido (Nova Ocorrência, Mapa, Minhas Solicitações, Notícias/Avisos).
2. **Nova ocorrência** em etapas: foto (câmera ou galeria) → descrição → categoria → confirmação de localização (GPS automático, ajustável no mapa) → protocolo gerado (ex.: `#OG2026-000123`).
3. **Categorias:** Buracos em vias públicas, Falhas na iluminação pública, Descarte irregular de lixo, Vazamentos de água, Queda de árvores, Problemas de sinalização, Outros.
4. **Mapa interativo** (Google Maps): marcadores por categoria, filtro por categoria, busca por endereço/bairro e **mapa de calor**.
5. **Detalhes da ocorrência** com foto, descrição, endereço e **histórico de status**.
6. **Minhas solicitações** com abas Todas / Abertas / Resolvidas.
7. **Notificações** (push + lista no app) quando a ocorrência for analisada, a manutenção iniciar e o problema for resolvido.
8. **Avaliação do atendimento** após a resolução.
9. **Ranking Cidadão** (geral/bairro, mensal/histórico), **Medalhas** com progresso e níveis (ver 4.5).
10. **Perfil** (dados pessoais, ocorrências registradas, resolvidas, pontos, medalhas) e **Configurações** (preferências de notificação, ocultar nome no ranking, alterar senha, **excluir minha conta**).
11. **Esqueci a senha** (ver 4.7), **avisos de advertência/suspensão/banimento** e **contestação de penalidade** (ver 4.6).
12. Ao registrar, mostrar status de validação da ocorrência (Pendente de validação / Validada / Rejeitada com motivo) e pontos ganhos.

**Status da ocorrência:** `ABERTO` → `EM_ANALISE` → `EM_ATENDIMENTO` → `RESOLVIDO`, sempre registrando histórico (quem alterou, quando, observação).

### 4.3 Administrador (web + mobile, mesmas funções)

1. **Dashboard** com indicadores: total, em aberto, em atendimento, resolvidas, tempo médio de resolução, ocorrências por categoria (pizza), por bairro (mapa de calor), ao longo do tempo (linha), recentes e distribuição por secretaria.
2. **Gestão de ocorrências:** listagem com filtros (status, categoria, bairro, período, secretaria), detalhes, **alteração de status**, **priorização** (baixa/média/alta/urgente), **distribuição para secretaria/equipe responsável** e comentários internos.
3. **Mapa** com todas as ocorrências e mapa de calor.
4. **Relatórios estatísticos** com filtros e exportação (CSV e PDF).
5. **Gestão de usuários** (listar, bloquear/desbloquear, criar admins) e **gestão de secretarias/empresas**.
6. **Aba "E-mails de recebimento" (obrigatória):**
   - Cadastrar, editar, ativar/desativar e remover **e-mails de destino**.
   - Cada e-mail pode ser vinculado a **uma ou mais categorias** e/ou secretaria.
   - **Toda ocorrência recebida dispara e-mail** automático aos destinatários correspondentes (foto, descrição, categoria, endereço, link do mapa e protocolo).
   - Envio **assíncrono** (fila/outbox no banco, com reenvio e registro de falhas) e **log de envios** visível no painel.
   - Validação e confirmação de e-mail (e-mail de teste ao cadastrar).
7. Notificações para o administrador (nova ocorrência, urgentes, novos recursos de penalidade) via push no mobile e lista no web.
8. **Moderação de usuários:** ver perfil e histórico do usuário (ocorrências, pontos, sanções), aplicar advertência, suspensão ou banimento com motivo, reverter sanção, **excluir/anonimizar conta**.
9. **Fila de recursos (contestações):** analisar, aceitar ou negar com justificativa.
10. **Validação de ocorrências:** rejeitar com motivo, marcar duplicatas (vincular à ocorrência original) e ver pontos gerados.
11. **Gamificação:** configurar metas das medalhas, parâmetros anti-duplicata e visualizar o ranking e o livro-razão de pontos de qualquer usuário.

### 4.4 Fora do escopo desta versão (deixar o código preparado, sem implementar)

- Inteligência Artificial (classificação por foto, descrições automáticas, detecção de duplicados).
- Testes automatizados e CI são **opcionais**: se sobrar tempo, adicione testes de unidade nas regras de negócio mais críticas (autenticação e mudança de status).

### 4.5 Gamificação: pontos, medalhas e ranking (INCLUÍDO)

Implemente as telas **Ranking Cidadão**, **Medalhas** e os cards de pontos do **Perfil**, conforme o template.

**Validação automática da ocorrência**
- Uma ocorrência é considerada **validada** automaticamente quando o administrador a move de `ABERTO` para qualquer status seguinte (`EM_ANALISE`, `EM_ATENDIMENTO` ou `RESOLVIDO`).
- O admin pode **rejeitar** a ocorrência (spam, falsa, fora de escopo), informando o motivo. Ocorrência rejeitada **nunca pontua** e conta como infração para o módulo de moderação (4.6).
- **Bloqueio de duplicatas (anti-fraude):** não pontuar ocorrência da mesma categoria registrada pelo mesmo usuário a menos de **X metros** (padrão 50 m) e dentro de **Y horas** (padrão 72 h) de outra já existente. Para ocorrências de outros usuários no mesmo ponto, vincular como "duplicata de" e pontuar apenas a primeira. Parâmetros configuráveis por variável de ambiente ou tela de configurações do admin.

**Pontuação** (registrada em livro-razão imutável, nunca apenas um contador):
| Evento | Pontos |
|---|---|
| Registro validado | +10 |
| Ocorrência resolvida | +20 |
| Participação contínua (ao menos 1 registro validado no mês) | bônus mensal (padrão +15) |
| Ocorrência rejeitada após ter sido validada ou conta com penalidade | pontos estornados (lançamento negativo) |

**Medalhas com níveis** (Bronze / Prata / Ouro; metas configuráveis em tabela, não fixas no código):
- **Fiscal da Cidade:** quantidade de ocorrências validadas (ex.: 5 / 25 / 100).
- **Guardião do Bairro:** quantidade de ocorrências validadas **no mesmo bairro** (ex.: 5 / 20 / 50).
- **Agente Ambiental:** ocorrências validadas das categorias lixo, queda de árvores e vazamentos de água (ex.: 5 / 20 / 50).
- Ao conquistar uma medalha ou subir de nível: criar notificação (push + interna) e registrar a data.
- Mostrar no app o progresso até o próximo nível.

**Ranking**
- **Geral (municipal)** e **por bairro**, com filtros **mensal** e **histórico geral**.
- Mostrar a posição do usuário logado, o nível dele (ex.: "Nível 2 – Guardião do Bairro"), os pontos e as medalhas.
- Privacidade: exibir apenas nome + inicial do sobrenome e avatar; permitir que o usuário **oculte seu nome do ranking** nas configurações (aparece como "Cidadão anônimo").
- Contas banidas, suspensas ou excluídas **não aparecem** no ranking.
- Ranking mensal calculado por consulta agregada ou tabela materializada atualizada por job; documentar a escolha.

### 4.6 Moderação: advertências, suspensão, banimento e contestação (INCLUÍDO)

**Advertências progressivas** (tudo registrado em histórico e com motivo obrigatório):
1. **Advertência 1 e 2:** aviso ao usuário, com motivo.
2. **Suspensão temporária** (ex.: 7 dias, depois 30 dias): não consegue registrar ocorrências; consegue logar e ver o aviso e a contestação.
3. **Banimento permanente:** não consegue logar nem registrar; vê somente a tela de aviso, com motivo e botão de contestação.

- O admin pode aplicar **qualquer etapa diretamente** em casos graves e **reverter** uma sanção, informando justificativa.
- Gatilhos sugeridos (configuráveis): rejeição de ocorrência por spam/falsa, reincidência de duplicatas e denúncias abusivas.
- Toda sanção tem: tipo, motivo, autor (admin), data de início, data de término (quando temporária) e status (`ATIVA`, `EXPIRADA`, `REVERTIDA`).
- **Ao ser sancionado, o usuário é notificado** (push, notificação interna e e-mail) com o motivo e como contestar.

**Contestação (recurso) dentro do app**
- Tela **"Contestar penalidade"** acessível mesmo com conta suspensa ou banida: texto explicativo obrigatório e, opcionalmente, anexos (fotos).
- Um recurso por sanção; status `PENDENTE`, `ACEITO`, `NEGADO`, com resposta do admin e histórico.
- Admin (web e mobile) tem fila de recursos para analisar: aceitar (reverte a sanção e restaura pontos) ou negar (com justificativa). O usuário é notificado da decisão.
- Limitar tentativas (rate limit) e evitar spam de recursos.

### 4.7 Conta do usuário: esqueci a senha e exclusão de conta

**Esqueci a senha (todos os apps)**
- Fluxo: informar e-mail → e-mail com link/código de uso único e expiração curta (ex.: 30 min) → definir nova senha → todos os *refresh tokens* são revogados.
- Resposta **genérica** sempre ("se o e-mail existir, enviaremos instruções") para não revelar quais e-mails estão cadastrados; rate limit por IP e por e-mail.
- Tokens guardados apenas com **hash** no banco, uso único.
- Telas completas no mobile e no web (solicitar, verificar código e redefinir).

**Exclusão de conta (LGPD)**
- O **próprio usuário** pode excluir a conta em *Configurações → Excluir minha conta*, com confirmação por senha (e e-mail de confirmação) e aviso claro das consequências.
- O **administrador** pode excluir contas de usuários (com motivo registrado em log de auditoria).
- **Estratégia: anonimização.** Dados pessoais (nome, e-mail, telefone, avatar, tokens de push, preferências) são apagados ou substituídos por valores irreversíveis; as ocorrências permanecem no sistema como **"Usuário removido"**, preservando o histórico público e as estatísticas.
- Pontos, medalhas e posição no ranking são removidos. Tokens e sessões, revogados.
- Opcional: período de arrependimento de **7 dias** em que a conta fica desativada e pode ser restaurada antes da anonimização definitiva (job agendado). Documentar a decisão.
- Registrar auditoria sem guardar dado pessoal em claro. Banimento **não** pode ser burlado por exclusão e recadastro: manter hash do e-mail em lista de bloqueio para contas banidas permanentemente, documentando a base legal.
- Documentar tudo em `docs/lgpd.md` (dados coletados, finalidade, retenção, direitos do titular).

---

## 5. REQUISITOS TÉCNICOS

### 5.1 Stack obrigatória

- **Linguagens:** TypeScript, TSX, JavaScript (apenas onde TS não se aplicar, como configs), SQL.
- **Front web:** React 18+, Vite, React Router, TanStack Query, React Hook Form + Zod, gráficos com Recharts (ou similar), mapas com Google Maps JS API.
- **Mobile:** React Native + Expo (TypeScript), React Navigation, TanStack Query, `react-native-maps`, `expo-location`, `expo-image-picker`, `expo-notifications`, `expo-secure-store`.
- **Back:** Node.js 20+, Express, Prisma, Zod, `argon2`/`bcrypt`, `jsonwebtoken`, `multer` (upload), `nodemailer`, `pino` (logs), `swagger-ui-express` (OpenAPI), `node-cron` (ou `bullmq`, se justificar) para jobs agendados.
- **Banco:** PostgreSQL 16 (usar índices geoespaciais por lat/long ou PostGIS, se justificar).
- **Armazenamento de fotos:** MinIO (API S3) via SDK `@aws-sdk/client-s3`, com URLs assinadas.
- **Mapas:** Google Maps API (chave via variável de ambiente; documentar como obtê-la).
- **Push:** Expo Push Notifications.
- **E-mail:** SMTP via Nodemailer (MailHog em desenvolvimento; documentar configuração para produção).

### 5.2 Ícones

- **Todos os ícones devem ser SVG**, nunca PNG nem fonte de ícones.
- Criar uma biblioteca própria de componentes de ícone (`<Icon name="..." />`) com SVGs inline/otimizados, incluindo ao menos: câmera, mapa/pin, lista/prancheta, troféu, medalhas (Bronze/Prata/Ouro, uma por tipo), ranking, aviso/advertência, banimento, escudo, lixeira de conta, sino, usuário, configurações, ajuda, check, seta, filtro, busca, buraco, lâmpada, lixeira, gota, árvore, sinalização, três pontos, e-mail, dashboard, relatório, usuários.
- Mobile: `react-native-svg`. Web: SVG como componentes React tipados.
- Cores via `currentColor`/tokens do tema, com suporte a tamanho e cor por prop.
- Logo do UrbanizaGO também em SVG.

### 5.3 Design

- Seguir **fielmente o template anexado**: paleta verde, tipografia, cards arredondados, botões primários verdes, cabeçalho verde nas telas internas, tab bar inferior no mobile, sidebar escura no web.
- Criar **design tokens** (cores, espaçamentos, raios, sombras, tipografia) em um pacote compartilhado e usá-los em todos os apps.
- Acessibilidade básica (contraste, `accessibilityLabel`, foco por teclado no web).
- Estados de **loading, vazio, erro e sucesso** em todas as telas.
- Interface 100% em **português do Brasil**.

---

## 6. ESTRUTURA DO REPOSITÓRIO (MONOREPO)

Use **npm workspaces** ou **pnpm workspaces**. Estrutura esperada:

```
urbanizago/
├── apps/
│   ├── api/                  # Node + Express + Prisma
│   │   ├── prisma/           # schema.prisma, migrations, seed.ts
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── modules/      # auth, users, occurrences, categories, map,
│   │   │   │                 # notifications, recipients(e-mails), reports,
│   │   │   │                 # secretariats, uploads, dashboard
│   │   │   ├── middlewares/
│   │   │   ├── jobs/         # fila de e-mails e push
│   │   │   ├── lib/
│   │   │   └── server.ts
│   │   ├── Dockerfile
│   │   └── README.md
│   ├── web-admin/            # React + Vite + TSX
│   │   ├── src/ (pages, components, features, routes, hooks, services)
│   │   ├── Dockerfile
│   │   └── README.md
│   ├── mobile-citizen/       # Expo + TSX
│   │   └── README.md
│   └── mobile-admin/         # Expo + TSX
│       └── README.md
├── packages/
│   ├── shared/               # tipos, schemas Zod, enums, constantes, cliente de API
│   ├── ui-tokens/            # design tokens
│   └── icons/                # biblioteca de ícones SVG
├── docs/
│   ├── README.md             # índice da documentação
│   ├── visao-geral.md
│   ├── decisoes-arquitetura.md
│   ├── requisitos.md
│   ├── modelagem-banco.md    # + diagrama ER (Mermaid)
│   ├── api/                  # openapi.yaml + guia de endpoints
│   ├── seguranca.md
│   ├── fluxos.md             # diagramas de sequência (Mermaid)
│   ├── gamificacao.md        # pontos, medalhas, níveis, ranking, anti-duplicata
│   ├── moderacao.md          # advertências, suspensão, banimento, recursos
│   ├── lgpd.md               # dados, retenção, anonimização, direitos do titular
│   ├── guia-mobile.md
│   ├── guia-web.md
│   ├── guia-deploy.md
│   ├── guia-contribuicao.md
│   └── manual-usuario.md
├── docker/                   # configs auxiliares (minio, nginx etc.)
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example              # TODAS as variáveis documentadas
├── .gitignore
├── .editorconfig
├── README.md                 # README principal
└── package.json
```

---

## 7. BANCO DE DADOS

Modele em **Prisma** (`schema.prisma`), com migrations e seed.

**Entidades mínimas:**
- `User` (id, nome, e-mail único, senha hash, role, telefone, avatar, status, timestamps)
- `RefreshToken` (hash, usuário, expiração, revogado, dispositivo)
- `PasswordResetToken`
- `Category` (nome, ícone, cor, ativa)
- `Secretariat` (nome, descrição, ativa) e vínculo categoria ↔ secretaria
- `Occurrence` (protocolo único, usuário, categoria, descrição, latitude, longitude, endereço, bairro, cidade, status, prioridade, secretaria, timestamps)
- `OccurrencePhoto` (ocorrência, chave no storage, ordem)
- `OccurrenceStatusHistory` (ocorrência, status anterior/novo, autor, observação, data)
- `OccurrenceComment` (comentários internos)
- `OccurrenceRating` (nota e comentário do cidadão)
- `NotificationRecipient` (e-mail de destino, nome, ativo, secretaria opcional) e vínculo com categorias
- `EmailOutbox` (destinatário, assunto, corpo, ocorrência, status, tentativas, erro, enviado em)
- `Notification` (usuário, tipo, título, mensagem, lida, ocorrência)
- `DeviceToken` (usuário, token de push, plataforma)
- `AuditLog` (ação, autor, entidade, detalhes)
- `PointsLedger` (usuário, ocorrência opcional, tipo de evento, pontos positivos/negativos, motivo, data; imutável)
- `MedalDefinition` (código, nome, descrição, categorias elegíveis, metas Bronze/Prata/Ouro configuráveis)
- `UserMedal` (usuário, medalha, nível, data de conquista)
- `Sanction` (usuário, tipo `ADVERTENCIA` | `SUSPENSAO` | `BANIMENTO`, motivo, autor, início, fim, status `ATIVA` | `EXPIRADA` | `REVERTIDA`, justificativa de reversão)
- `SanctionAppeal` (sanção, usuário, texto, anexos, status `PENDENTE` | `ACEITO` | `NEGADO`, resposta do admin, datas)
- `AccountDeletionRequest` (usuário, solicitado por, data, data de efetivação, status `PENDENTE` | `CONCLUIDA` | `CANCELADA`)
- `BannedEmailHash` (hash do e-mail de contas banidas permanentemente)
- Campos adicionais em `Occurrence`: `validationStatus` (`PENDENTE` | `VALIDADA` | `REJEITADA`), `rejectionReason`, `duplicateOfId`, `validatedAt`.
- Campos adicionais em `User`: `hideFromRanking`, `anonymizedAt`, `deletedAt`, `neighborhoodId`/bairro principal.

**Exigências:** chaves e índices adequados (status, categoria, bairro, data, geolocalização), soft delete onde fizer sentido, seed com categorias, secretarias, um admin padrão e dados de demonstração. Documentar o diagrama ER em Mermaid.

---

## 8. API

- REST, versionada (`/api/v1`), padronizada: envelope de resposta, paginação, ordenação, filtros e códigos HTTP corretos.
- Erros padronizados (`code`, `message`, `details`) e tratamento centralizado.
- **Documentação OpenAPI/Swagger** disponível em `/docs` e também em `docs/api/openapi.yaml`.
- Endpoints mínimos (agrupe por módulo e documente todos com exemplos de requisição/resposta):
  - **Auth:** registrar, login, refresh, logout, esqueci a senha, redefinir senha.
  - **Usuários:** perfil (ver/editar), alterar senha, preferências, registro de token de push; admin: listar, bloquear, criar admin.
  - **Categorias e secretarias:** listar; admin: CRUD.
  - **Ocorrências:** criar (multipart com fotos), listar (filtros), detalhes, minhas ocorrências, mapa (marcadores e pontos para heatmap), alterar status, priorizar, distribuir, comentar, avaliar.
  - **Destinatários de e-mail:** CRUD, ativar/desativar, enviar e-mail de teste, log de envios.
  - **Notificações:** listar, marcar como lida (uma e todas).
  - **Dashboard e relatórios:** indicadores, séries temporais, por categoria/bairro/secretaria, exportação CSV/PDF.
  - **Gamificação:** ranking (geral/bairro, mensal/histórico), minha posição, minhas medalhas e progresso, extrato de pontos; admin: configurar medalhas e parâmetros anti-duplicata.
  - **Moderação:** admin: aplicar/reverter sanção, histórico de sanções do usuário, rejeitar ocorrência, marcar duplicata; usuário: ver minhas sanções.
  - **Recursos:** usuário: abrir recurso; admin: listar, aceitar, negar.
  - **Conta:** solicitar exclusão, cancelar exclusão (período de arrependimento), exclusão/anonimização por admin; esqueci/redefinir senha.
  - **Health check:** `/health`.
- Regras de negócio no back (nunca confiar no cliente): validação de transições de status, geração de protocolo, escopo de acesso por perfil.
- Upload seguro: limite de tamanho, validação de tipo MIME, geração de miniaturas (opcional) e URLs assinadas.
- Ao criar ocorrência: persistir → gravar histórico → enfileirar e-mails para destinatários elegíveis → notificar admins (push).
- Ao mudar status: gravar histórico → notificar o cidadão (push + notificação interna).
- Ao sair de `ABERTO` pela primeira vez: marcar como validada → checar duplicatas → lançar pontos → recalcular medalhas → notificar o cidadão. Tudo em **transação** e **idempotente** (nunca pontuar duas vezes).
- Toda rota de escrita do cidadão deve **bloquear usuários suspensos ou banidos**; login de banido permitido apenas para ver o aviso e contestar.
- Jobs agendados: expiração de sanções temporárias, bônus mensal de participação, efetivação de exclusões de conta após o período de arrependimento, recálculo do ranking mensal e limpeza de tokens expirados.

---

## 9. DOCKER E EXECUÇÃO

- `docker compose up --build` deve subir **todo o ambiente** (banco, MinIO, MailHog, API com migrations e seed automáticos, web admin).
- Dockerfiles **multi-stage**, usuário não-root, `healthcheck` e volumes persistentes.
- `docker-compose.dev.yml` com hot reload.
- Variáveis de ambiente documentadas em `.env.example` (nenhum segredo real no repositório).
- Scripts no `package.json` raiz: `dev`, `build`, `lint`, `db:migrate`, `db:seed`, `docker:up`, `docker:down`.
- Documentar como rodar os apps Expo apontando para a API local (IP da máquina, Expo Go e build de desenvolvimento).

---

## 10. DOCUMENTAÇÃO (OBRIGATÓRIA E COMPLETA)

**Tudo deve estar documentado**, inclusive os READMEs.

- **README.md principal:** visão geral, funcionalidades, arquitetura (diagrama), stack, pré-requisitos, início rápido (passo a passo), credenciais de demonstração, estrutura de pastas, scripts, solução de problemas e licença.
- **Um README.md por aplicação/pacote** (`api`, `web-admin`, `mobile-citizen`, `mobile-admin`, `shared`, `ui-tokens`, `icons`) com: propósito, como rodar, variáveis de ambiente, estrutura interna, convenções e comandos.
- **docs/**: todos os arquivos listados na seção 6, com diagramas Mermaid (ER, sequência dos fluxos de login, criação de ocorrência, envio de e-mail e mudança de status).
- **Código comentado** onde a lógica não for óbvia (JSDoc/TSDoc nas funções públicas e nos serviços).
- **Documentação para o time de back-end e API:** contratos (OpenAPI), exemplos de chamadas (curl), códigos de erro, regras de negócio e matriz de permissões por perfil.
- **CHANGELOG.md** e **CONTRIBUTING.md** (padrão de commits, branches, lint e formatação).

---

## 11. QUALIDADE DE CÓDIGO

- TypeScript em modo `strict`, **sem `any`** desnecessário.
- ESLint + Prettier configurados em todo o monorepo.
- Arquitetura em camadas no back (rota → controller → service → repository), com injeção simples e funções puras onde possível.
- Componentes React pequenos, reutilizáveis e tipados; hooks para lógica; sem duplicação entre web e mobile (usar `packages/shared`).
- Tratamento de erros consistente em todas as camadas.
- Nomes de arquivos e variáveis em inglês no código; textos de interface e documentação em português (pt-BR).

---

## 12. ORDEM DE ENTREGA (FASES)

Entregue por fases, **indicando ao final de cada uma o que foi criado e como validar**:

1. **Fundação:** monorepo, configs, `.env.example`, Docker base, design tokens, biblioteca de ícones SVG.
2. **Banco e API:** schema Prisma, migrations, seed, autenticação, módulos principais, upload, e-mails, notificações, Swagger.
3. **Web Admin:** login, dashboard, ocorrências, mapa, relatórios, usuários, moderação e recursos, gamificação, secretarias, aba de e-mails de recebimento.
4. **Mobile Admin:** mesmas funções do web, adaptadas ao mobile.
5. **Mobile Cidadão:** fluxo completo de ocorrência, mapa, solicitações, notificações, ranking, medalhas, perfil, contestação e exclusão de conta.
6. **Documentação final:** revisão de todos os READMEs e da pasta `docs/`, checklist de aceite.

---

## 13. CRITÉRIOS DE ACEITE

- [ ] `docker compose up --build` sobe o ambiente completo sem passos manuais além de copiar o `.env`.
- [ ] Login funciona nos três apps, com senha criptografada, refresh token e logout.
- [ ] Cidadão registra uma ocorrência com foto, categoria e GPS e recebe o número de protocolo.
- [ ] Ao registrar, o e-mail chega no MailHog para os destinatários vinculados à categoria.
- [ ] Admin altera o status e o cidadão recebe notificação.
- [ ] Mapa e mapa de calor exibem as ocorrências com filtros.
- [ ] Dashboard e relatórios mostram dados reais do banco.
- [ ] Ocorrência validada ao sair de Aberto gera +10 pontos uma única vez; duplicata não pontua.
- [ ] Medalhas sobem de nível automaticamente e geram notificação; ranking geral, por bairro e mensal funcionam.
- [ ] Admin aplica advertência, suspensão e banimento; usuário sancionado é notificado e consegue contestar pelo app.
- [ ] Recurso aceito reverte a sanção e restaura pontos; recurso negado notifica o usuário.
- [ ] "Esqueci a senha" funciona nos três apps e revoga as sessões antigas.
- [ ] Exclusão de conta anonimiza dados pessoais, mantém as ocorrências como "Usuário removido" e remove o usuário do ranking.
- [ ] Todos os ícones são SVG.
- [ ] Swagger acessível e coerente com a API.
- [ ] Todos os READMEs e a pasta `docs/` completos e atualizados.

---

## 14. FORMATO DA RESPOSTA

- Entregue **todos os arquivos completos**, cada um precedido pelo caminho (ex.: `apps/api/src/server.ts`). **Não use "..." nem trechos omitidos.**
- Se a resposta ficar longa, divida por fase e peça confirmação para continuar, sem pular nenhum arquivo.
- Ao final, forneça um **resumo**: o que foi entregue, como rodar, credenciais de demonstração, limitações conhecidas e próximos passos sugeridos.
- Se alguma informação do anexo estiver ambígua, **faça suposições razoáveis, registre-as em `docs/decisoes-arquitetura.md`** e siga em frente.
