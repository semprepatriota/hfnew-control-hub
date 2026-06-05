import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiUrl } from '../../config/api';

const AUTH_TOKEN_KEY = 'alliance_dark_auth_token';
const PENDING_AUTH_FLOW_KEY = 'alliance_dark_pending_auth_flow';
const OAUTH_ERROR_KEY = 'alliance_dark_oauth_error';
const OAUTH_CALLBACK_URL_KEY = 'alliance_dark_oauth_callback_url';

function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState('Processando autorização...');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const storedCallbackUrl = window.sessionStorage.getItem(OAUTH_CALLBACK_URL_KEY) || '';
    let fallbackParams = null;

    if (storedCallbackUrl) {
      try {
        fallbackParams = new URL(storedCallbackUrl).searchParams;
      } catch (error) {
        window.sessionStorage.removeItem(OAUTH_CALLBACK_URL_KEY);
      }
    }

    const getParam = (key, fallbackValue = '') => searchParams.get(key) || fallbackParams?.get(key) || fallbackValue;
    const code = getParam('code');
    const state = getParam('state');
    const googleError = getParam('error');
    const googleErrorDescription = getParam('error_description');
    const provider = getParam('provider', 'youtube');
    const pendingFlow = window.localStorage.getItem(PENDING_AUTH_FLOW_KEY) || '';
    const authFlow = pendingFlow || provider;
    const processedFlowKey = provider === 'instagram' || provider === 'facebook' ? provider : 'google';
    const processedKey = code && state
      ? `alliance_dark_oauth_processed:${processedFlowKey}:${state}:${code}`
      : '';

    if (processedKey && window.sessionStorage.getItem(processedKey)) {
      return;
    }

    if (googleError) {
      const detail = googleErrorDescription
        ? `${googleError}: ${googleErrorDescription}`
        : `Google retornou erro OAuth: ${googleError}`;
      setErrorMessage(detail);
      window.localStorage.setItem(OAUTH_ERROR_KEY, detail);
      window.localStorage.removeItem(PENDING_AUTH_FLOW_KEY);
      window.sessionStorage.removeItem(OAUTH_CALLBACK_URL_KEY);
      setTimeout(() => {
        window.location.href = authFlow === 'dashboard' ? '/acesso-negado' : '/conexoes?oauth_error=1';
      }, 2500);
      return;
    }

    if (code && state) {
      if (processedKey) {
        window.sessionStorage.setItem(processedKey, '1');
      }
      setMessage('Validando retorno do Google...');
      let callbackPath = `/api/conexoes/youtube/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
      if (provider === 'instagram') {
        callbackPath = `/api/instagram/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
      } else if (provider === 'facebook') {
        callbackPath = `/api/facebook/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
      }

      fetch(apiUrl(callbackPath), {
        method: 'POST'
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            const error = new Error(data?.detail || 'Erro no callback');
            error.status = res.status;
            error.data = data;
            throw error;
          }
          return data;
        })
        .then(data => {
          console.log('Callback response:', data);
          setMessage('Autorização concluída. Redirecionando...');
          const responseFlow = data?.flow_type || authFlow;
          if (responseFlow === 'dashboard') {
            if (data?.auth_token) {
              window.localStorage.setItem(AUTH_TOKEN_KEY, data.auth_token);
            }
            window.localStorage.removeItem(PENDING_AUTH_FLOW_KEY);
            window.sessionStorage.removeItem(OAUTH_CALLBACK_URL_KEY);
            setTimeout(() => {
              window.location.href = '/painel';
            }, 1200);
            return;
          }

          if (responseFlow === 'youtube_connection' || provider === 'youtube') {
            if (data?.dashboard_auth_token) {
              window.localStorage.setItem(AUTH_TOKEN_KEY, data.dashboard_auth_token);
            }
            window.localStorage.removeItem(PENDING_AUTH_FLOW_KEY);
            window.sessionStorage.removeItem(OAUTH_CALLBACK_URL_KEY);
            setTimeout(() => {
              window.location.href = '/conexoes';
            }, 1200);
            return;
          }

          // Aguardar 2 segundos antes de redirecionar
          window.sessionStorage.removeItem(OAUTH_CALLBACK_URL_KEY);
          setTimeout(() => {
            window.location.href = '/conexoes';
          }, 2000);
        })
        .catch(err => {
          console.error('Erro no callback:', err);
          const detail = err?.data?.detail || err?.message || 'Erro desconhecido no callback OAuth';
          setErrorMessage(detail);
          window.localStorage.setItem(OAUTH_ERROR_KEY, detail);
          window.sessionStorage.removeItem(OAUTH_CALLBACK_URL_KEY);
          if (authFlow === 'dashboard') {
            window.localStorage.removeItem(AUTH_TOKEN_KEY);
            window.localStorage.removeItem(PENDING_AUTH_FLOW_KEY);
            if (err.status === 403) {
              window.location.href = '/acesso-negado';
              return;
            }
            setTimeout(() => {
              window.location.href = '/acesso-negado';
            }, 1200);
            return;
          }
          if (provider === 'youtube') {
            window.localStorage.removeItem(PENDING_AUTH_FLOW_KEY);
            setTimeout(() => {
              window.location.href = '/conexoes?oauth_error=1';
            }, 2500);
            return;
          }
          setTimeout(() => {
            window.location.href = '/conexoes?oauth_error=1';
          }, 2500);
        });
      return;
    }

    const missingCallbackData = 'Callback OAuth sem code/state. Inicie a conexão novamente.';
    setErrorMessage(missingCallbackData);
    window.localStorage.setItem(OAUTH_ERROR_KEY, missingCallbackData);
    window.sessionStorage.removeItem(OAUTH_CALLBACK_URL_KEY);
    setTimeout(() => {
      window.location.href = '/conexoes?oauth_error=1';
    }, 2500);
  }, [searchParams]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#070708',
      color: '#00FF41',
      fontSize: '24px',
      fontFamily: 'monospace'
    }}>
      <div style={{ textAlign: 'center', maxWidth: '680px', padding: '24px' }}>
        <div>{errorMessage ? 'Falha na autorização' : message}</div>
        {errorMessage && (
          <div style={{
            marginTop: '14px',
            color: '#ff4d4d',
            fontSize: '15px',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap'
          }}>
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}

export default OAuthCallback;
