# Checklist de publicacao

1. Usar a VPS com Nginx para servir `frontend/dist` e encaminhar `/api/` para o backend em `127.0.0.1:4100`.
2. Configurar o comando de build `npm run build` dentro de `frontend`.
3. Configurar `backend/.env` fora do Git, com `PSI_AUTH_EMAIL`, `PSI_AUTH_PASSWORD_HASH`, `APP_ORIGINS` e `COOKIE_SECURE=true`.
4. Gerar o hash com `npm run hash-password` dentro de `backend`; nunca salvar senha em texto ou no frontend.
5. Executar o backend com usuário de serviço sem acesso de escrita ao `frontend/dist`.
6. Testar login, logout, sessão após refresh, expiração, rotas internas, pagina 404 e exportacao do RAM.
7. Confirmar politica de privacidade, termos de uso, controle de acesso e rotina de backup.
8. Nao publicar dados reais de adolescentes no ambiente de teste.

## Limite atual

Os dados de pacientes, aplicacoes e relatorios ainda sao salvos no `localStorage` do dominio do app. A autenticação agora e real e separada do dashboard, mas a persistencia clinica multiusuario, auditoria e backup de dados ainda exigem uma etapa posterior de backend/banco.
