import { Link } from 'react-router-dom';

export default function PublicPageShell({ eyebrow, title, children }) {
  return (
    <main className="public-page">
      <div className="public-page-inner">
        <Link className="public-brand" to="/">HF Psicopedagogia</Link>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <div className="public-content">{children}</div>
        <div className="public-links">
          <Link to="/privacidade">Privacidade</Link>
          <Link to="/termos">Termos de uso</Link>
          <Link to="/">Voltar ao login</Link>
        </div>
      </div>
    </main>
  );
}
