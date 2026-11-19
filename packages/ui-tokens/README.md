# Design tokens

`src/index.ts` exporta paleta (verde principal, sidebar, status), espaçamentos, raios, tipografia e sombras. Usado nos três clientes. Alterar tokens centralmente, não repetir cores em cada tela; algumas ilustrações e gráficos usam sua própria paleta de categoria. `npm run typecheck -w @urbanizago/ui-tokens`. Não possui variáveis de ambiente nem execução isolada.
