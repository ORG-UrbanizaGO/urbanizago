# Rastreabilidade de requisitos

Legenda: **Código** = implementado em fonte, não homologado. Parcial = diferença ou pendência conhecida. Fonte: [prompt](referencias/PROMPT.md), [PDF funcional](referencias/projeto.pdf), [template](referencias/template.png).

| Requisito | Estado | Arquivos principais |
|---|---|---|
| Três clientes e REST versionada | Código | `apps/*`, `packages/app-ui/src/` |
| Login, cadastro cidadão, reset, sessão e RBAC | Código | `auth.ts`, `middlewares/auth.ts`, `core.tsx` |
| Fotos, descrição, GPS, categorias, protocolo | Código | `citizen.tsx`, `occurrences.ts`, `storage.ts` |
| Mapa, filtros, busca, calor | Parcial | `App.tsx` web, `native.tsx`; calor web aproximado; requer chave |
| Status, histórico, avaliações | Código | `occurrences.ts`, `citizen.tsx`, `admin.tsx` |
| Dashboard, relatórios CSV/PDF, distribuição | Código | `analytics.ts`, `admin.tsx`, web `App.tsx` |
| Usuários, secretarias, categorias, destinatários e log | Código | `management.ts`, `admin.tsx` |
| Notificações e SMTP outbox | Código | `worker.ts`, `occurrences.ts`, `core.tsx`; push depende de credenciais |
| Ranking, pontos, medalhas, duplicatas | Código | `gamification.ts`, `analytics.ts`, `citizen.tsx`, `admin.tsx` |
| Sanções e recursos com anexos | Parcial | `moderation.ts`; progressão decidida manualmente; sem gatilho automático |
| Exclusão com confirmação e anonimização | Código | `moderation.ts`, `core.tsx`; sem arrependimento opcional |
| Notícias e avisos | Código | `management.ts`, `admin.tsx`, `citizen.tsx` |
| SVG e identidade visual | Código | `packages/icons`, `ui-tokens`; template interpretado, não pixel-perfect |
| Swagger | Parcial | `docs/api/openapi.yaml`; contrato de endpoints e exemplos selecionados, não schema exaustivo de todas as respostas |
| Camadas controller/service/repository | Parcial | módulos de rota e serviços comuns; separação total não feita |
| Docker e documentação | Código | `docker-compose.yml`, `docs/`, READMEs; builds não executados |
| IA | Fora do escopo | explicitamente não implementada |

Todos os critérios exigem homologação local antes de produção. Consulte [validação](validacao.md).
