import React from 'react';
import { Mail, ShieldCheck } from 'lucide-react';
import './PublicPages.css';

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'contato@hfnew.com.br';

function PublicPageShell({ badge, title, lead, sections, footerTitle, footerBody, actions }) {
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

        {(footerTitle || footerBody || supportEmail) && (
          <footer className="public-page-shell__footer">
            {footerTitle && <h3>{footerTitle}</h3>}
            {footerBody && <p>{footerBody}</p>}
            {actions?.length ? (
              <div className="public-page-shell__actions">
                {actions.map((action) => action)}
              </div>
            ) : null}
            {supportEmail && (
              <a className="public-page-shell__contact" href={`mailto:${supportEmail}`}>
                <Mail size={16} />
                {supportEmail}
              </a>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}

export default PublicPageShell;
