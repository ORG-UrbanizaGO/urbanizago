# Contrato API REST v1

Base local: `http://localhost:3000/api/v1`, health `/health`, Swagger `/docs`, OpenAPI JSON `/openapi.json`. O arquivo [openapi.yaml](openapi.yaml) lista rotas, parâmetros, exemplos de payload/resposta. Os exemplos são ilustrativos e não todos os schemas exaustivos; a validação efetiva é Zod/Prisma. Em produção utilize HTTPS. Respostas JSON de sucesso: `{ "data": ... }`; erros: `{ "code": "VALIDATION_ERROR", "message": "Dados inválidos.", "details": [...] }`. Health, mídia e exportação são exceção.

## Permissões

| Grupo | Público | Cidadão ativo | Cidadão suspenso | Banido | Admin |
|---|---|---|---|---|---|
| Auth cadastro/login/reset | Sim (cadastro cidadão) | Sim | Sim | Login restrito | Sim |
| Próprias sanções/recurso/logout | Não | Sim | Sim | Sim | Sim (próprio) |
| Consultar ocorrências/mapa, perfil, med/avisos, ranking | Não | Sim | Sim | Não | Sim |
| Criar ocorrência/avaliar | Não | Sim | Não | Não | Não |
| Alterar dados/senha/dispositivo/ler notif. | Não | Sim | Não | Não | Sim |
| Gestão, relatórios, status, moderação, distribuição | Não | Não | Não | Não | Sim |
| Exclusão por senha+código | Não | Sim | atendimento humano | atendimento humano | procedimento operacional |
| Foto por link assinado | Link válido | Link válido | Link válido | Link válido | Link válido |

Login retorna access token e, em `client=mobile`, refresh token opaco. Web envia `client=web`; cookie httpOnly para refresh, access em memória. `Authorization: Bearer <accessToken>` em rotas protegidas. JWT referencia sessão no banco. Refresh rotaciona a sessão e invalida a anterior. Login web exige ADMIN. No mobile, o cliente verifica papel correto.

## Exemplos cURL (PowerShell: use curl.exe; exemplos abaixo formato shell)

```bash
curl http://localhost:3000/health
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@urbanizago.local","password":"UrbanizaGO-dev-2026!","client":"mobile"}'
```

Copie `data.accessToken` para `ADMIN_TOKEN`. Registre e autentique um cidadão, copie para `TOKEN`. Os placeholders são valores a substituir.

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/categories
curl -X POST http://localhost:3000/api/v1/occurrences \
  -H "Authorization: Bearer $TOKEN" \
  -F "photos=@foto.jpg;type=image/jpeg" -F "categoryId=$CATEGORY_ID" \
  -F 'description=Buraco na rua' -F 'latitude=-15.1' -F 'longitude=-48.1' \
  -F 'address=Rua Exemplo, 1' -F 'neighborhood=Centro' -F 'city=Cidade Exemplo'
curl -X PATCH http://localhost:3000/api/v1/occurrences/$OCCURRENCE_ID/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"EM_ANALISE","observation":"Vistoria"}'
curl -H "Authorization: Bearer $TOKEN" 'http://localhost:3000/api/v1/occurrences?mine=true&page=1&limit=20'
curl -H "Authorization: Bearer $ADMIN_TOKEN" 'http://localhost:3000/api/v1/reports/export?format=pdf' -o relatorio.pdf
```

Recuperação: `POST /auth/forgot-password {email}`, e-mail no MailHog, `POST /auth/verify-reset {token}`, `POST /auth/reset-password {token,password}`. Solicitante ativo: `POST /account/delete/request {password}`, depois `POST /account/delete {password,token}`. Código único expira. Recursos aceitam JSON sem foto ou multipart com `sanctionId`, `text` e até 3 `attachments`. Admin decide em `PATCH /appeals/:id` (`status=ACEITO|NEGADO`, `response`).

## Paginação e filtros

Listas principais: `page` (1...), `limit` (1–100), envelope `items,total,page,limit`. `occurrences` aceita `status,categoryId,secretariatId,neighborhood,from,to,q,mine,group`; `group=open|resolved` e `mine=true`. Mapa aceita filtros e limita a 5.000 marcadores. Relatórios aceitam status/categoria/secretaria/bairro/período e `format=csv|pdf` na exportação. Ranking aceita `scope=general|neighborhood`, `period=all|monthly`, `neighborhood`, paginação. Algumas listas fixas (categorias, secretarias, destinatários, medalhas, recursos) retornam arrays. Rotas de gravação validam UUIDs, enums, limites e permissões no servidor.

## Erros

| HTTP | Códigos típicos |
|---|---|
| 400 | VALIDATION_ERROR, INVALID_JSON, INVALID_PHOTO, UPLOAD_ERROR, INVALID_CODE |
| 401 | INVALID_CREDENTIALS, INVALID_TOKEN, INVALID_REFRESH, UNAUTHORIZED |
| 403 | FORBIDDEN, BANNED, SUSPENDED, ORIGIN_DENIED, MEDIA_DENIED |
| 404 | NOT_FOUND, MEDIA_NOT_FOUND |
| 409 | CONFLICT, INVALID_TRANSITION, REJECTED, UNCONFIRMED, APPEAL_EXISTS |
| 429 | RATE_LIMIT, LOCKED |
| 500 | INTERNAL_ERROR |

Veja `scripts/smoke.mjs` para teste reproduzível de login, foto, ocorrência, validação, pontos, duplicata, relatório e contestação. Não use em produção.
