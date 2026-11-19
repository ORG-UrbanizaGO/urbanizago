# Guia de deploy

## Desenvolvimento (Docker Compose)

1. Copie `.env.example` para `.env`. 2. `docker compose up --build -d`. 3. `docker compose ps`, `docker compose logs -f api`. 4. Acesse web 5173, health 3000, MailHog 8025, MinIO 9001. PostgreSQL e MinIO armazenam dados em volumes Docker. `docker compose down` para sem remover volumes. **`docker compose down -v` apaga definitivamente os dados locais.**

## Variáveis

| Variáveis | Finalidade |
|---|---|
| `API_PORT`, `WEB_PORT`, `CORS_ORIGINS`, `NODE_ENV` | portas, origens e ambiente |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `DATABASE_URL` | PostgreSQL; Compose monta URL interna |
| `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_PORT`, `MINIO_CONSOLE_PORT`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | bucket S3 privado e administração local |
| `S3_PUBLIC_ENDPOINT` | legado de compatibilidade; não é usado para links assinados atuais |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `MAILHOG_UI_PORT` | transporte de e-mail; Compose local força MailHog |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_DAYS`, `COOKIE_SECURE` | segurança e vida útil da sessão |
| `PASSWORD_RESET_TTL_MINUTES`, `BANNED_EMAIL_PEPPER` | recuperação e bloqueio de e-mail por HMAC |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SEED_DEMO` | seed de admin e demonstração |
| `VITE_GOOGLE_MAPS_API_KEY` | chave pública web |
| `GOOGLE_MAPS_API_KEY` | reservado para futura integração server-side |
| `EXPO_ACCESS_TOKEN` | autenticação opcional do serviço de push |
| `DUPLICATE_RADIUS_METERS`, `DUPLICATE_WINDOW_HOURS`, `MONTHLY_BONUS_POINTS` | regras iniciais de gamificação |
| `MAX_UPLOAD_MB` | tamanho máximo por foto |
| `ACCOUNT_DELETION_GRACE_DAYS` | reservado, use 0; anonimização imediata |
| `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, `EXPO_PUBLIC_EAS_PROJECT_ID` | `.env.local` de cada app mobile |

## Produção: checklist obrigatório

- Configure servidor/serviço com DNS, TLS/HTTPS, reverse proxy e backups. GitHub é versionamento, não banco/hosting do backend.
- Gere segredos criptograficamente fortes e únicos, exemplo: `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`. Troque senha PostgreSQL/S3/admin; `SEED_DEMO=false`, `COOKIE_SECURE=true`; configure origens CORS exatas do web. Não altere `BANNED_EMAIL_PEPPER` sem estratégia de migração.
- Crie override Compose próprio ou infraestrutura gerenciada para SMTP real (o compose de desenvolvimento força MailHog), armazenamento privado e banco. Não exponha PostgreSQL, S3, Swagger e console MinIO à internet sem controle. Use usuário S3 dedicado com menor privilégio; MinIO atual usa credenciais dev.
- Configure HTTPS também nos apps; remova `usesCleartextTraffic` no plugin de Android. Restrinja chaves Google. Exponha apenas o proxy; habilite logs, métricas, alertas, proteção de brute force e rate limiting distribuído.
- Homologue a checklist completa, avalie segurança (uploads, auth/CSRF, segredos, privacidade, rate limiting, dependências), limites, licenças e LGPD com responsáveis antes de liberar dados reais. Não use este compose local como produção sem revisão.

## Backup

```powershell
# Exemplo local; use um caminho protegido e valide restauração
 docker compose exec -T postgres pg_dump -U urbanizago -d urbanizago -Fc -f /tmp/urbanizago.dump
 docker compose cp postgres:/tmp/urbanizago.dump ./urbanizago.dump
```

Backups do banco e bucket devem ser coordenados e protegidos; não commit arquivos de dados. Rotação de segredos invalida sessões e pode tornar mensagens de recuperação ainda na fila indecifráveis; drene a fila primeiro. Teste recuperação em ambiente isolado. O deploy de produção exige estratégia explícita para migrations e rollback.
