# Fluxos principais

## Login e refresh
```mermaid
sequenceDiagram
  participant C as Cliente
  participant A as API
  participant B as PostgreSQL
  C->>A: POST auth/login
  A->>B: Verifica hash, bloqueios e sanções
  A->>B: Cria sessão com hash do refresh
  A-->>C: JWT + refresh (cookie/SecureStore)
  C->>A: Rota protegida (Bearer)
  A->>B: Verifica sessão e papéis
  A-->>C: Resultado
  C->>A: POST auth/refresh (quando sessão expira)
  A->>B: Revoga refresh anterior e cria nova sessão
  A-->>C: Novo access/refresh
```
## Ocorrência e e-mail
```mermaid
sequenceDiagram
  participant C as Cidadão
  participant A as API
  participant S as MinIO
  participant D as PostgreSQL
  participant J as Worker
  participant E as SMTP
  C->>A: POST occurrences multipart
  A->>S: Valida e grava fotos
  A->>D: Transação: ocorrência, protocolo, histórico, duplicata, outbox e notificações
  A-->>C: Protocolo e validação pendente
  J->>D: Reserva item da fila
  J->>S: Lê anexos
  J->>E: Envia e-mail
  J->>D: SENT ou retry
```
## Status e pontos
```mermaid
sequenceDiagram
  participant G as Gestor
  participant A as API
  participant B as Banco
  participant C as Cidadão
  G->>A: PATCH occurrences/id/status
  A->>B: Transação + lock + validação de transição
  A->>B: Histórico, pontos idempotentes, medalhas, notificação
  A-->>G: Status atualizado
  B-->>C: Notificação via consulta/worker Expo
```
## Exclusão de conta
Senha → código único enviado por e-mail → senha + código → anonimização em transação → revogação de sessões → e-mail de conclusão. Sem período de arrependimento. Dados remanescentes e considerações legais: [LGPD](lgpd.md).
