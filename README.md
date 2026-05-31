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

- `VITE_SUPPORT_EMAIL`
- `VITE_SHOW_LOCAL_LOGIN`

## Deploy

Arquivos de suporte ja incluidos:

- `public/CNAME` com `app.hfnew.com.br`
- `public/_redirects`
- `404.html`
- `vercel.json`
