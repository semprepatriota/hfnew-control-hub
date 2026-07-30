# HF Psicopedagogia

Aplicativo isolado para `psi.hfnew.com.br`, mantido dentro do repositório do Projeto 2 apenas para organização e versionamento. Ele não usa APIs, cookies, tokens ou sessão do HF New Control Hub.

## Acesso

O fluxo de login foi removido por solicitação. O aplicativo abre diretamente na área de trabalho.

Os registros ficam no `localStorage` do navegador em `psi.hfnew.com.br`. Como o app contém informações sensíveis, use somente em computador controlado e mantenha cópias seguras dos relatórios exportados.

## Importação assistida

Na tela inicial, o botão `Importar documentos` abre a leitura local de até cinco arquivos por vez: PDF, Word `.docx`, texto, JPG, PNG ou WEBP. A extração ocorre no navegador e apenas preenche um rascunho revisável da ficha; os anexos não são enviados nem armazenados no servidor. Para documentos Word antigos, converta `.doc` para `.docx` ou PDF antes da importação.

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
