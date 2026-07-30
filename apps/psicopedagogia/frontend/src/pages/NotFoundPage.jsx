import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className="public-page">
      <div className="public-page-inner not-found-page">
        <p className="eyebrow">HF Psicopedagogia</p>
        <h1>Pagina nao encontrada</h1>
        <p className="muted">O endereco acessado nao corresponde a uma pagina disponivel.</p>
        <button type="button" className="btn-primary" onClick={() => navigate('/')}>Voltar ao inicio</button>
      </div>
    </main>
  );
}
