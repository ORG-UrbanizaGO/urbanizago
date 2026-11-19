# Guia Web Administrador

O painel é React + Vite, TypeScript, React Router, TanStack Query, React Hook Form/Zod, Recharts e React Native Web. O compartilhamento de UI evita divergência de regras/fluxos com o mobile administrativo.

Acesse `http://localhost:5173` após `docker compose up --build -d`. Apenas administradores entram. Em desenvolvimento local: `npm run dev:web` (API em :3000; proxy configurado em `apps/web-admin/vite.config.ts`). `npm run build -w @urbanizago/web-admin` verifica tipos e empacota em `apps/web-admin/dist`.

## Arquivos

- `apps/web-admin/src/App.tsx`: rotas por página, autenticação, Google Maps JS, gráficos e download de relatórios (token Bearer).
- `apps/web-admin/src/styles.css`: estilos web específicos e foco.
- `packages/app-ui/src/admin.tsx`: páginas administrativas compartilhadas; dashboard, ocorrências, mapa, relatórios, usuários, secretarias, destinatários, recursos, game, avisos, notificações e perfil.
- `packages/app-ui/src/core.tsx`: cliente de sessão, campos, cards, listas, cores, tratamento de consultas e mutações.
- `docker/nginx/default.conf`: SPA fallback e proxy `/api`, `/health`, `/docs`, `/openapi.json`.

## Mapas e relatórios

Crie chave Google Cloud restrita por referer, habilite Maps JavaScript API e configure `VITE_GOOGLE_MAPS_API_KEY` no `.env`. O Vite incorpora esta chave no build; recrie a imagem com `docker compose up --build -d web-admin`. A chave é pública por natureza; restrinja seu uso. O mapa de calor web utiliza sobreposição de círculos de densidade. Relatórios vêm do banco, aceitam filtros e baixam CSV/PDF pela API.

## Sessão

Refresh cookie httpOnly, access token somente em memória. Proxy de mesma origem preserva cookie e evita CORS desnecessário. Faça login novamente se a sessão expirar ou for revogada. Um admin pode criar outros admins, gerenciar cidadãos e configurar categorias e secretarias; não há cadastro administrativo público.
