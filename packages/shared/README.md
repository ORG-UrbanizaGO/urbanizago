# Shared

Tipos, enums, validação Zod e cliente REST (fetch) em `src/index.ts`, consumido pelos apps. O cliente resolve envelope/erros e URLs assinadas relativas. `npm run typecheck -w @urbanizago/shared`. Sem variáveis de ambiente próprias; base URL e função de access token são injetadas. Não guardar refresh/segredos aqui.
