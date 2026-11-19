# Homologação e limitações

**Estado:** entrega integrada de código-fonte, candidata a homologação, não versão testada em produção. O ambiente de geração não dispõe de Docker e não resolve registry.npmjs.org (`EAI_AGAIN`), impedindo npm install, Prisma validate/generate, TypeScript typecheck com dependências, builds, emulador e integração. Foi executada análise sintática dos 32 arquivos TypeScript/TSX (zero erros sintáticos), leitura dos 20 arquivos JSON e dos 3 YAML de infraestrutura/OpenAPI, checagem de sintaxe JavaScript do script de smoke e configs Expo, conferência estática de 67 operações HTTP (todas presentes no OpenAPI) e empacotamento. O schema possui 27 modelos Prisma. Nenhuma execução real de API ou interface é alegada.

## Checklist de aceite (execute na sua máquina)

- [ ] Copiar `.env`, `docker compose up --build -d`, todos os serviços saudáveis.
- [ ] `npm install`, `npm run typecheck`, `npm run lint`, `npm run build` e `npx expo install --check` de cada app. Corrigir incompatibilidades; versionar lockfile.
- [ ] Logins admin web e mobile, cidadão mobile, cadastro, refresh, logout, recuperação por MailHog. Login cidadão no painel deve falhar.
- [ ] Cidadão cria ocorrência com foto (GPS ou coordenadas), protocolo, categoria e validação pendente.
- [ ] E-mail automático chega a destinatário ativo e confirmado, com foto e descrição. Log de envio visível.
- [ ] Admin altera status, secretaria e prioridade; notificação interna. Testar push com dispositivo/EAS; mesma gestão em web/mobile.
- [ ] Mapa com chave válida, filtros, busca e concentração; relatórios CSV/PDF exibem dados corretos.
- [ ] +10 uma vez na validação e +20 na resolução; repetir PATCH e criar duplicata; bônus, medalhas e ranking por bairro/período.
- [ ] Advertência/suspensão/banimento, recurso com foto, aceitação/negação, confirmação da restrição e crédito compensatório.
- [ ] Reset revoga sessões; exclusão por senha/código anonimiza e mantém histórico; banimento não permite recadastro.
- [ ] CRUD categorias/secretarias/destinatários, teste/confirmação de e-mail e avisos. Swagger acessível e coerente.
- [ ] Revisão de segurança, privacidade, retenção, acessibilidade e carga; não usar dados reais antes.

## Lacunas conhecidas

- Sem lockfile gerado na entrega devido ao bloqueio npm. Dockerfiles seletivos usam `npm install`. A instalação real pode exigir ajustes nas versões Expo/React/Prisma; nenhuma compilação confirmada.
- Google Maps e Expo push dependem de credenciais e build/dispositivo. Mapa de calor web é uma aproximação por círculos; no mobile o suporte depende do Google provider. Gráficos mobile são barras para as mesmas séries, não cópia visual do Recharts.
- OpenAPI cobre rotas e exemplos selecionados, não todas as respostas com schema rigoroso. A estrutura back-end agrupa controller/serviço em módulos, não camadas totalmente separadas.
- Política de progressão de sanções manual e casos complexos de estornos, metas alteradas, rejeição do original de duplicatas exigem refinamento e testes. Validação das imagens por assinatura inicial/MIME, sem antivírus ou remoção EXIF. Rate limit em memória, sem persistência distribuída. Outbox entrega ao menos uma vez.
- Tema inspirado no template, logo SVG recriado, ilustração inicial simplificada. Avatar editável e perfil por foto não implementados. Admin global, não multitenant; exclusão administrativa de outros admins não implementada. Sem IA. Não é APK pronto.
- LGPD exige definição legal e política de retenção, expurgo e revisão de textos/fotos; anonimização não resolve todos os dados residuais. Push de sessão em dispositivo compartilhado deve passar revisão.
