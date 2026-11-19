# Contribuição e Git

Crie repositório vazio na organização GitHub. Convenção sugerida: `main` protegida, branches `feat/...`, `fix/...`, `docs/...`, PR revisado. Commit Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`). `npm install` cria lockfile: versione. Nunca adicione `.env`, segredos, credenciais, dumps, builds e `node_modules`.

Para alterar apenas uma funcionalidade, localize o domínio correto e modifique o arquivo existente. Exemplos: cor primária `packages/ui-tokens/src/index.ts`; gestão administrativa `packages/app-ui/src/admin.tsx`; criação de ocorrência `packages/app-ui/src/citizen.tsx` + `apps/api/src/modules/occurrences.ts`; banco `apps/api/prisma/schema.prisma` + nova migration; endpoints `docs/api/openapi.yaml`. Atualize READMEs/contratos relacionados. Não recrie o monorepo a cada mudança.

```powershell
git switch -c feat/minha-alteracao
npm run typecheck
npm run lint
npm run format:check
# Teste manual e smoke quando pertinente
 git add caminho/do/arquivo
 git commit -m "feat: minha alteracao"
 git push -u origin feat/minha-alteracao
```

Abra PR no GitHub, descreva alterações, como testar, impacto no banco e limitações. Proteja `main` e evite publicar antes da homologação. CI não configurado por padrão (opcional no escopo).
