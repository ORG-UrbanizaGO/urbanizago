# Moderação

Gestores acessam usuário e histórico para advertir, suspender (dias configurados no ato) ou banir, com motivo obrigatório. A sequência recomendada é advertências 1/2, suspensão 7/30 dias e banimento para reincidência ou casos graves; decisão humana, não gatilho automático. Ocorrências rejeitadas e duplicadas ficam registradas para análise. Admin pode escolher qualquer etapa conforme gravidade e reverter com justificativa. Worker expira suspensões.

- Advertência: mantém acesso e informa motivo.
- Suspensão: mantém leitura, bloqueia escrita normal do cidadão; recurso permitido.
- Banimento: sessão restrita para consultar a própria penalidade e contestar, sem navegação normal. Hash do e-mail bloqueia recadastro.
- Bloqueio administrativo: status BLOCKED impede login; deve ser usado separadamente de sanções quando não se deseja fluxo de contestação.

Recurso: um por sanção, texto e até 3 fotos opcionais, limite de tentativas. Admin aceita (reverte sanção e crédito compensatório) ou nega, com justificativa. Notificação interna e push conforme configuração, e-mail na aplicação de sanção. Os meios de contato e política de revisão deverão ser definidos pelo operador público. Anexos não ficam acessíveis na listagem pública de ocorrências.
