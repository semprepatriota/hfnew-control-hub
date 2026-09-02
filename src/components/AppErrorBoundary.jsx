import React from 'react';
import { LogOut, RefreshCw, ShieldAlert } from 'lucide-react';


const AUTH_TOKEN_KEY = 'alliance_dark_auth_token';
const RECENT_AUTH_KEY = 'alliance_dark_recent_auth_at';


class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('Falha protegida na interface do HUB:', error?.name || 'InterfaceError');
  }

  reload = () => {
    window.location.reload();
  };

  endSession = () => {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(RECENT_AUTH_KEY);
    window.localStorage.removeItem('alliance_dark_pending_auth_flow');
    window.location.assign('/painel');
  };

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="app-recovery-screen" role="alert">
        <section className="app-recovery-panel">
          <ShieldAlert size={34} />
          <div>
            <span>Proteção da interface</span>
            <h1>Esta tela encontrou um erro</h1>
            <p>O restante do HUB continua protegido. Recarregue a interface ou encerre esta sessão.</p>
          </div>
          <div className="app-recovery-actions">
            <button type="button" onClick={this.reload}><RefreshCw size={17} /> Recarregar</button>
            <button type="button" className="secondary" onClick={this.endSession}><LogOut size={17} /> Encerrar sessão</button>
          </div>
        </section>
      </main>
    );
  }
}


export default AppErrorBoundary;
