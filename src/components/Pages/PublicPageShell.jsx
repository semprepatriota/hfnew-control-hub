import React from 'react';
import { Mail, ShieldCheck } from 'lucide-react';
import './PublicPages.css';

const defaultSupportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'contato@hfnew.com.br';

function PublicPageShell({
  badge,
  title,
  lead,
  sections,
  footerTitle,
  footerBody,
  actions,
  contactHref,
  contactLabel,
  supportEmail = defaultSupportEmail
}) {
  const finalContactHref = contactHref || (supportEmail ? `mailto:${supportEmail}` : '');
  const finalContactLabel = contactLabel || supportEmail;

  return (
    <div className="public-page-shell">
      <div className="public-page-shell__inner">
        <header className="public-page-shell__header">
          <div className="public-page-shell__badge">
            <ShieldCheck size={14} />
            {badge}
          </div>
          <h1 className="public-page-shell__title">{title}</h1>
          <p className="public-page-shell__lead">{lead}</p>
        </header>

        <div className="public-page-shell__grid">
          {sections.map((section) => (
            <section key={section.title} className="public-page-shell__card">
              <h2>{section.title}</h2>
              <p>{section.body}</p>
              {section.items?.length ? (
                <ul className="public-page-shell__list">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        {(footerTitle || footerBody || finalContactHref) && (
          <footer className="public-page-shell__footer">
            {footerTitle && <h3>{footerTitle}</h3>}
            {footerBody && <p>{footerBody}</p>}
            {actions?.length ? (
              <div className="public-page-shell__actions">
                {actions.map((action) => action)}
              </div>
            ) : null}
            {finalContactHref && finalContactLabel && (
              <a className="public-page-shell__contact" href={finalContactHref}>
                <Mail size={16} />
                {finalContactLabel}
              </a>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}

export default PublicPageShell;
