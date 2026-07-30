# HF Psicopedagogia

Aplicativo isolado para `psi.hfnew.com.br`, mantido dentro do repositório do Projeto 2 apenas para organização e versionamento. Ele não usa APIs, cookies, tokens ou sessão do HF New Control Hub.

## Acesso

O fluxo de login foi removido por solicitação. O aplicativo abre diretamente na área de trabalho.

Os registros ficam no `localStorage` do navegador em `psi.hfnew.com.br`. Como o app contém informações sensíveis, use somente em computador controlado e mantenha cópias seguras dos relatórios exportados.

## Páginas

- `/`: visão geral.
- `/adolescentes`: cadastro e ficha de adolescentes.
- `/instrumentos`: biblioteca de instrumentos.
- `/aplicacoes`: aplicações e revisão.
- `/integracao`: integração de evidências.
- `/ram`: relatórios.
- `/perfil`: dados da profissional.
- `/privacidade` e `/termos`: páginas públicas.

## Build

```powershell
cd "E:\ALLIANCE DARK\hfnew-control-hub\apps\psicopedagogia\frontend"
npm install
npm run build
```
