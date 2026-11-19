# Web Admin

React + Vite/TypeScript, React Router e UI compartilhada via React Native Web. `npm run dev:web` na raiz, ou Docker Compose. URL padrão http://localhost:5173, exclusivo ADMIN. `src/App.tsx`: adaptador web, mapas, Recharts, exportação. `src/styles.css`: estilos web. A API é acessada pelo proxy. `VITE_GOOGLE_MAPS_API_KEY` é a chave pública restrita. `npm run build -w @urbanizago/web-admin`. Detalhes em [guia web](../../docs/guia-web.md); modifique as telas em `packages/app-ui/src/admin.tsx` para que web/mobile mantenham paridade.
