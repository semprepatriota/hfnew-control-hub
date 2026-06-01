# HF New Control Hub

Aplicacao separada do funil existente, criada para o subdominio `app.hfnew.com.br`.

## Desenvolvimento

- App local: `http://localhost:3002`
- Dashboard atual existente: `http://localhost:3001`

## Rotas publicas

- `/`
- `/sobre-dashboard`
- `/politica-de-privacidade`
- `/termos-de-uso`
- `/revogar-acesso`

## Variaveis

- `.env.local` para valores reais locais.
- `.env.example` e `.env.local.example` como template.
- `VITE_SUPPORT_EMAIL`
- `VITE_SHOW_LOCAL_LOGIN`
- `VITE_GOOGLE_LOGIN_URL`

## Seguranca

- Nao commitar credenciais, tokens ou arquivos de chave.
- Manter valores reais somente em `.env.local`.
- O repositório do app pode ficar privado sem quebrar a auditoria; o que precisa ser publico sao a home, a politica de privacidade, os termos e a tela de revogacao.

## Deploy

Arquivos de suporte ja incluidos:

- `public/CNAME` com `app.hfnew.com.br`
- `public/_redirects`
- `404.html`
- `vercel.json`
