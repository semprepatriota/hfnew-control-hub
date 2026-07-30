import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { DataProvider } from './contexts/DataContext';
import { useData } from './hooks/useData';
import { APP_ROUTES, PUBLIC_ROUTES, getViewFromPath } from './routes';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import NotFoundPage from './pages/NotFoundPage';
import {
  INTEGRATION_DOMAINS,
  INVESTIGATIVE_HYPOTHESES,
} from './services/instruments';
import { importPatientDocuments } from './services/patientDocumentImport';
import './styles/global.css';

const today = new Date().toISOString().slice(0, 10);

const emptyPatient = {
  name: '',
  birthDate: '',
  schoolYear: '',
  school: '',
  guardian: '',
  guardianPhone: '',
  mainConcern: '',
  evaluationReason: '',
  schoolHistory: '',
  developmentHistory: '',
  socioemotionalNotes: '',
  documents: '',
  observations: '',
};

const emptyApplication = {
  patientId: '',
  testId: '',
  applicationDate: today,
  informant: '',
  professional: '',
  version: '',
  conditions: '',
  duration: '',
  behaviorObservations: '',
  quantitativeAnalysis: '',
  qualitativeAnalysis: '',
  attentionItems: '',
  preservedSkills: '',
  difficulties: '',
  limitations: '',
  reviewConfirmed: false,
};

const makeResult = () => ({
  id: `result-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  area: '',
  score: '',
  maximum: '',
  percentage: '',
  classification: 'Inconclusivo',
  observation: '',
});

const formatDate = (value) => {
  if (!value) return 'Nao informado';
  const parsedDate = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? 'Nao informado' : parsedDate.toLocaleDateString('pt-BR');
};

const calculateAge = (birthDate) => {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  const now = new Date();
  if (Number.isNaN(birth.getTime()) || birth > now) return null;

  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) years -= 1;
  return { years };
};

const getEligibility = (test, patient) => {
  if (!test || !patient) return { blocked: false, warning: '' };
  const age = calculateAge(patient.birthDate);

  if (test.agePolicy === 'blocked-for-adolescents' && age && age.years >= 11) {
    return {
      blocked: true,
      warning: 'Este instrumento esta bloqueado para adolescentes neste aplicativo.',
    };
  }

  if (!age) {
    return {
      blocked: false,
      warning: 'Informe a data de nascimento para validar a faixa etaria.',
    };
  }

  if (test.agePolicy === 'manual-confirmation' && age.years < 11) {
    return {
      blocked: false,
      warning: 'A idade esta fora do foco principal deste app. Confirme a faixa no manual antes de continuar.',
    };
  }

  return { blocked: false, warning: '' };
};

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/\n/g, '<br />');

const safeFileName = (value) => String(value || 'adolescente')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-|-$/g, '')
  .toLowerCase();

const downloadRamWord = (patient, professionalProfile, patientApplications, patientHypotheses, conclusion, recommendations, limitations) => {
  const completedApplications = patientApplications.filter((application) => application.status === 'completed');
  const applicationSections = completedApplications.map((application) => {
    const resultRows = (application.results || []).map((result) => `<tr><td>${escapeHtml(result.area)}</td><td>${escapeHtml(result.score)}</td><td>${escapeHtml(result.maximum)}</td><td>${escapeHtml(result.percentage ? `${result.percentage}%` : '-')}</td><td>${escapeHtml(result.classification)}</td><td>${escapeHtml(result.observation)}</td></tr>`).join('');
    return `<h2>${escapeHtml(application.instrumentName)}</h2><p><strong>Data:</strong> ${escapeHtml(formatDate(application.applicationDate))} | <strong>Informante:</strong> ${escapeHtml(application.informant)} | <strong>Versao:</strong> ${escapeHtml(application.version)}</p><p><strong>Observacoes comportamentais:</strong><br />${escapeHtml(application.behaviorObservations || 'Nao informado')}</p><table><thead><tr><th>Area</th><th>Pontuacao</th><th>Maximo</th><th>Porcentagem</th><th>Classificacao</th><th>Observacao</th></tr></thead><tbody>${resultRows || '<tr><td colspan="6">Nenhum resultado registrado.</td></tr>'}</tbody></table><p><strong>Analise quantitativa:</strong><br />${escapeHtml(application.quantitativeAnalysis || 'Nao informado')}</p><p><strong>Analise qualitativa:</strong><br />${escapeHtml(application.qualitativeAnalysis || 'Nao informado')}</p>`;
  }).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>RAM - ${escapeHtml(patient.name)}</title><style>body{font-family:Arial,sans-serif;color:#17365D;line-height:1.45;margin:36px}h1{color:#17365D;border-bottom:2px solid #2E75B6;padding-bottom:8px}h2{color:#2E75B6;margin-top:28px}table{width:100%;border-collapse:collapse;margin:12px 0 18px}th{background:#17365D;color:white}th,td{border:1px solid #B7C9D6;padding:7px;text-align:left;vertical-align:top}.meta{background:#DDEBF7;padding:12px;border-left:4px solid #168B8C}.professional{background:#F7FAFC;padding:12px;border-left:4px solid #5B7F2B;margin-bottom:18px}</style></head><body><h1>Relatorio de Avaliacao Multidimensional</h1><div class="professional"><strong>${escapeHtml(professionalProfile.name || 'Profissional nao informado')}</strong><br />${escapeHtml(professionalProfile.formation)}${professionalProfile.cbo ? ` | CBO ${escapeHtml(professionalProfile.cbo)}` : ''}<br />${escapeHtml(professionalProfile.phone)}${professionalProfile.email ? ` | ${escapeHtml(professionalProfile.email)}` : ''}</div><div class="meta"><strong>Identificacao</strong><br />Nome: ${escapeHtml(patient.name)}<br />Data de nascimento: ${escapeHtml(formatDate(patient.birthDate))}<br />Escola: ${escapeHtml(patient.school)}<br />Serie/ano: ${escapeHtml(patient.schoolYear)}<br />Responsavel: ${escapeHtml(patient.guardian)}</div><h2>Motivo da avaliacao</h2><p>${escapeHtml(patient.evaluationReason || patient.mainConcern || 'Nao informado')}</p><h2>Instrumentos e resultados</h2>${applicationSections || '<p>Nenhuma aplicacao concluida.</p>'}<h2>Hipoteses investigativas</h2><p>${escapeHtml(patientHypotheses?.selected?.join(', ') || 'Nenhuma hipotese selecionada.')}</p><h2>Conclusao</h2><p>${escapeHtml(conclusion || 'Nao informado')}</p><h2>Recomendacoes e encaminhamentos</h2><p>${escapeHtml(recommendations || 'Nao informado')}</p><h2>Limitacoes</h2><p>${escapeHtml(limitations || 'Nao informado')}</p><p><strong>Observacao tecnica:</strong> Este documento organiza registros para revisao profissional. Resultados de instrumentos nao confirmam diagnostico isoladamente.</p></body></html>`;
  const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `RAM-${safeFileName(patient.name)}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const patientSheetHtml = (patient) => `<!doctype html><html><head><meta charset="utf-8"><title>Ficha - ${escapeHtml(patient.name)}</title><style>body{font-family:Arial,sans-serif;color:#17365D;line-height:1.48;margin:36px}h1{color:#17365D;border-bottom:2px solid #2E75B6;padding-bottom:8px}h2{color:#2E75B6;margin-top:24px;font-size:18px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.field{padding:10px;background:#F7FAFC;border:1px solid #D9E5EF}.field strong{display:block;color:#17365D;font-size:12px;text-transform:uppercase}.block{margin:12px 0;padding:12px;background:#F7FAFC;border-left:4px solid #168B8C;white-space:normal}</style></head><body><h1>Ficha de cadastro</h1><div class="grid"><div class="field"><strong>Nome completo</strong>${escapeHtml(patient.name)}</div><div class="field"><strong>Data de nascimento</strong>${escapeHtml(formatDate(patient.birthDate))}</div><div class="field"><strong>Escola</strong>${escapeHtml(patient.school || 'Nao informado')}</div><div class="field"><strong>Serie ou ano escolar</strong>${escapeHtml(patient.schoolYear || 'Nao informado')}</div><div class="field"><strong>Responsavel</strong>${escapeHtml(patient.guardian || 'Nao informado')}</div><div class="field"><strong>Telefone</strong>${escapeHtml(patient.guardianPhone || 'Nao informado')}</div></div><h2>Queixa principal</h2><div class="block">${escapeHtml(patient.mainConcern || 'Nao informado')}</div><h2>Motivo da avaliacao</h2><div class="block">${escapeHtml(patient.evaluationReason || 'Nao informado')}</div><h2>Historico escolar</h2><div class="block">${escapeHtml(patient.schoolHistory || 'Nao informado')}</div><h2>Historico do desenvolvimento</h2><div class="block">${escapeHtml(patient.developmentHistory || 'Nao informado')}</div><h2>Observacoes socioemocionais</h2><div class="block">${escapeHtml(patient.socioemotionalNotes || 'Nao informado')}</div><h2>Documentos e anexos</h2><div class="block">${escapeHtml(patient.documents || 'Nenhum registro')}</div><h2>Observacoes da profissional</h2><div class="block">${escapeHtml(patient.observations || 'Nao informado')}</div><p><strong>Nota:</strong> ficha para organizacao e revisao profissional.</p></body></html>`;

const downloadPatientWord = (patient) => {
  const blob = new Blob([patientSheetHtml(patient)], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Ficha-${safeFileName(patient.name)}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const printPatientSheet = (patient) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.opener = null;
  printWindow.document.write(patientSheetHtml(patient));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

function Header({ activeView, onNavigate }) {
  const navigation = [
    ['dashboard', 'Visao geral', APP_ROUTES.dashboard],
    ['patients', 'Adolescentes', APP_ROUTES.patients],
    ['instruments', 'Instrumentos', APP_ROUTES.instruments],
    ['applications', 'Aplicacoes', APP_ROUTES.applications],
    ['integration', 'Integracao', APP_ROUTES.integration],
    ['reports', 'RAM', APP_ROUTES.reports],
    ['profile', 'Perfil', APP_ROUTES.profile],
  ];

  return (
    <header className="app-header">
      <div className="header-brand">
        <p className="eyebrow">HF Psicopedagogia</p>
        <h1>Area de avaliacao</h1>
      </div>
      <nav className="main-nav" aria-label="Navegacao principal">
        {navigation.map(([view, label]) => (
          <button key={view} type="button" className={activeView === view ? 'nav-button active' : 'nav-button'} onClick={() => onNavigate(view)}>
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}

function DashboardCards() {
  const { patients, instruments, applications, reports } = useData();
  const completedApplications = applications.filter((application) => application.status === 'completed');
  const latest = applications.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];

  return (
    <section className="metrics-grid" aria-label="Resumo do trabalho">
      <article className="metric-card"><span>Adolescentes</span><strong>{patients.length}</strong><small>fichas cadastradas</small></article>
      <article className="metric-card"><span>Instrumentos</span><strong>{instruments.length}</strong><small>biblioteca configurada</small></article>
      <article className="metric-card"><span>Aplicacoes concluidas</span><strong>{completedApplications.length}</strong><small>com revisao registrada</small></article>
      <article className="metric-card"><span>RAMs em preparo</span><strong>{reports.length}</strong><small>{latest ? `Ultima aplicacao em ${formatDate(latest.updatedAt)}` : 'Nenhuma aplicacao ainda'}</small></article>
    </section>
  );
}

function SourceSafetyNotice() {
  return <aside className="legal-notice" aria-label="Aviso sobre materiais dos instrumentos"><strong>Importante:</strong> o aplicativo organiza respostas e registros, mas nao substitui manuais oficiais. Itens, estimulos, gabaritos e tabelas normativas devem ser utilizados somente conforme a fonte autorizada e a qualificacao profissional. O sistema nao gera diagnostico automatico.</aside>;
}

function ProfessionalProfileForm() {
  const { professionalProfile, saveProfessionalProfile } = useData();
  const [form, setForm] = useState(professionalProfile);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm({ ...professionalProfile });
  }, [professionalProfile]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setSaved(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    saveProfessionalProfile(Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])));
    setSaved(true);
  };

  return (
    <section className="panel professional-profile" aria-labelledby="professional-profile-title">
      <div className="panel-heading">
        <div><p className="eyebrow">Cabecalho dos modelos</p><h2 id="professional-profile-title">Dados da profissional</h2><p className="muted">Essas informacoes aparecem nas aplicacoes e no RAM.</p></div>
      </div>
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="form-group"><label htmlFor="profile-name">Nome profissional</label><input id="profile-name" name="name" value={form.name} onChange={handleChange} placeholder="Nome completo" /></div>
        <div className="form-group"><label htmlFor="profile-formation">Formacao</label><input id="profile-formation" name="formation" value={form.formation} onChange={handleChange} placeholder="Formacao e especializacao" /></div>
        <div className="form-group"><label htmlFor="profile-cbo">CBO</label><input id="profile-cbo" name="cbo" value={form.cbo} onChange={handleChange} placeholder="Codigo profissional" /></div>
        <div className="form-group"><label htmlFor="profile-phone">Telefone</label><input id="profile-phone" name="phone" value={form.phone} onChange={handleChange} /></div>
        <div className="form-group span-2"><label htmlFor="profile-email">E-mail</label><input id="profile-email" name="email" type="email" value={form.email} onChange={handleChange} /></div>
        <div className="form-actions span-2"><button type="submit" className="btn-primary">Salvar cabecalho</button>{saved && <div className="success-message compact-message">Cabecalho salvo.</div>}</div>
      </form>
    </section>
  );
}

function PatientDocumentImport({ onDraftReady, onClose }) {
  const [files, setFiles] = useState([]);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);

  const handleFiles = (event) => {
    setFiles(Array.from(event.target.files || []));
    setStatus('');
    setError('');
  };

  const handleImport = async () => {
    setError('');
    setStatus('');
    setReading(true);
    try {
      const result = await importPatientDocuments(files, setStatus);
      const documentNote = `Leitura local de: ${result.documents}. Revise as informacoes antes de salvar.`;
      onDraftReady({
        ...result.extracted,
        documents: documentNote,
      });
      setFiles([]);
      setStatus(`Rascunho preenchido com base em ${result.textLength} caracteres identificados. Revise todos os campos abaixo.`);
    } catch (importError) {
      setError(importError.message || 'Nao foi possivel ler os arquivos selecionados.');
    } finally {
      setReading(false);
    }
  };

  return (
    <section className="panel patient-import-panel" aria-labelledby="patient-import-title">
      <div className="panel-heading">
        <div><p className="eyebrow">Cadastro assistido</p><h2 id="patient-import-title">Importar dados do futuro paciente</h2><p className="muted">PDF, Word .docx, imagem ou texto. A leitura acontece neste navegador e preenche apenas um rascunho da ficha.</p></div>
        <button type="button" className="btn-secondary" onClick={onClose}>Fechar importacao</button>
      </div>
      {error && <div className="error-message">{error}</div>}
      {status && <div className="info-box import-progress">{status}</div>}
      <div className="import-layout">
        <label className="file-import-zone" htmlFor="patient-document-import">
          <input id="patient-document-import" type="file" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/png,image/webp" multiple onChange={handleFiles} disabled={reading} />
          <strong>{files.length ? `${files.length} arquivo(s) selecionado(s)` : 'Selecionar arquivos'}</strong>
          <span>Use PDF, Word .docx, JPG, PNG, WEBP ou TXT. Ate 5 arquivos de 12 MB cada.</span>
        </label>
        <div className="import-file-list" aria-live="polite">
          {files.length ? files.map((file) => <span key={`${file.name}-${file.size}`}>{file.name}</span>) : <span>Nenhum arquivo selecionado.</span>}
        </div>
      </div>
      <label className="checkbox-row import-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={reading} />Confirmo que tenho autorizacao para tratar esses dados e que vou revisar a ficha antes de salvar.</label>
      <div className="form-actions"><button type="button" className="btn-primary" onClick={handleImport} disabled={!files.length || !consent || reading}>{reading ? 'Lendo documentos...' : 'Ler e preencher ficha'}</button></div>
    </section>
  );
}

function PatientForm({ editingPatient, importDraft, onImportDraftConsumed, onSaved, onCancel }) {
  const { addPatient, updatePatient } = useData();
  const [form, setForm] = useState(emptyPatient);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(editingPatient ? { ...emptyPatient, ...editingPatient } : emptyPatient);
    setError('');
  }, [editingPatient]);

  useEffect(() => {
    if (!importDraft) return;
    setForm({ ...emptyPatient, ...importDraft });
    setError('Revise os campos preenchidos pela leitura antes de salvar a ficha.');
    onImportDraftConsumed?.();
  }, [importDraft, onImportDraftConsumed]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.birthDate || !form.guardian.trim()) {
      setError('Nome, data de nascimento e responsavel sao obrigatorios.');
      return;
    }
    const data = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
    if (editingPatient) updatePatient(editingPatient.id, data);
    else addPatient(data);
    setForm(emptyPatient);
    setError('');
    onSaved?.();
  };

  return (
    <section className="panel" aria-labelledby="patient-form-title">
      <div className="panel-heading">
        <div><p className="eyebrow">Etapa 1</p><h2 id="patient-form-title">{editingPatient ? 'Editar adolescente' : 'Novo adolescente'}</h2></div>
        {editingPatient && <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>}
      </div>
      {error && <div className="error-message">{error}</div>}
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="form-group span-2"><label htmlFor="name">Nome completo</label><input id="name" name="name" value={form.name} onChange={handleChange} required /></div>
        <div className="form-group"><label htmlFor="birthDate">Data de nascimento</label><input id="birthDate" name="birthDate" type="date" value={form.birthDate} onChange={handleChange} required /></div>
        <div className="form-group"><label htmlFor="schoolYear">Serie ou ano escolar</label><input id="schoolYear" name="schoolYear" value={form.schoolYear} onChange={handleChange} /></div>
        <div className="form-group"><label htmlFor="school">Escola</label><input id="school" name="school" value={form.school} onChange={handleChange} /></div>
        <div className="form-group"><label htmlFor="guardian">Responsavel</label><input id="guardian" name="guardian" value={form.guardian} onChange={handleChange} required /></div>
        <div className="form-group"><label htmlFor="guardianPhone">Telefone do responsavel</label><input id="guardianPhone" name="guardianPhone" value={form.guardianPhone} onChange={handleChange} /></div>
        <div className="form-group span-2"><label htmlFor="mainConcern">Queixa principal</label><textarea id="mainConcern" name="mainConcern" rows="3" value={form.mainConcern} onChange={handleChange} /></div>
        <div className="form-group span-2"><label htmlFor="evaluationReason">Motivo da avaliacao</label><textarea id="evaluationReason" name="evaluationReason" rows="3" value={form.evaluationReason} onChange={handleChange} /></div>
        <div className="form-group"><label htmlFor="schoolHistory">Historico escolar</label><textarea id="schoolHistory" name="schoolHistory" rows="4" value={form.schoolHistory} onChange={handleChange} /></div>
        <div className="form-group"><label htmlFor="developmentHistory">Historico do desenvolvimento</label><textarea id="developmentHistory" name="developmentHistory" rows="4" value={form.developmentHistory} onChange={handleChange} /></div>
        <div className="form-group"><label htmlFor="socioemotionalNotes">Observacoes socioemocionais</label><textarea id="socioemotionalNotes" name="socioemotionalNotes" rows="4" value={form.socioemotionalNotes} onChange={handleChange} /></div>
        <div className="form-group"><label htmlFor="documents">Documentos e anexos</label><textarea id="documents" name="documents" rows="4" placeholder="Descreva os documentos recebidos." value={form.documents} onChange={handleChange} /></div>
        <div className="form-group span-2"><label htmlFor="observations">Observacoes da profissional</label><textarea id="observations" name="observations" rows="3" value={form.observations} onChange={handleChange} /></div>
        <div className="form-actions span-2"><button type="submit" className="btn-primary">{editingPatient ? 'Atualizar ficha' : 'Salvar ficha'}</button></div>
      </form>
    </section>
  );
}

function PatientList({ selectedPatientId, onSelect, onEdit }) {
  const { patients, deletePatient, getPatientApplications } = useData();
  const [query, setQuery] = useState('');
  const filteredPatients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return patients;
    return patients.filter((patient) => [patient.name, patient.guardian, patient.school, patient.schoolYear].filter(Boolean).some((value) => value.toLowerCase().includes(normalized)));
  }, [patients, query]);

  const handleDelete = (patient) => {
    if (window.confirm(`Excluir a ficha de ${patient.name} e seus registros?`)) deletePatient(patient.id);
  };

  return (
    <section className="panel" aria-labelledby="patients-title">
      <div className="panel-heading"><div><p className="eyebrow">Casos</p><h2 id="patients-title">Adolescentes cadastrados</h2></div><input className="search-input" type="search" placeholder="Buscar por nome, escola ou responsavel" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      {filteredPatients.length === 0 ? <p className="empty-state">Nenhum adolescente encontrado.</p> : (
        <div className="table-wrap"><table><thead><tr><th>Nome</th><th>Idade</th><th>Escola</th><th>Aplicacoes</th><th>Acoes</th></tr></thead><tbody>
          {filteredPatients.map((patient) => <tr key={patient.id} className={selectedPatientId === patient.id ? 'selected-row' : ''}>
            <td><button type="button" className="link-button" onClick={() => onSelect(patient.id)}><strong>{patient.name}</strong></button><span>{patient.guardian || 'Responsavel nao informado'}</span></td>
            <td>{calculateAge(patient.birthDate)?.years ?? 'Nao informado'} anos</td>
            <td>{[patient.school, patient.schoolYear].filter(Boolean).join(' / ') || 'Nao informado'}</td>
            <td>{getPatientApplications(patient.id).length}</td>
            <td className="table-actions"><button type="button" className="btn-secondary" onClick={() => onEdit(patient)}>Editar</button><button type="button" className="btn-danger-outline" onClick={() => handleDelete(patient)}>Excluir</button></td>
          </tr>)}
        </tbody></table></div>
      )}
    </section>
  );
}

function PatientCase({ patient, onStartApplication, onEdit, onNavigate }) {
  const { getPatientApplications } = useData();
  const patientApplications = getPatientApplications(patient.id);
  const age = calculateAge(patient.birthDate);

  return (
    <section className="panel case-panel" aria-labelledby="case-title">
      <div className="panel-heading"><div><p className="eyebrow">Ficha individual</p><h2 id="case-title">{patient.name}</h2><p className="muted">{age ? `${age.years} anos` : 'Idade nao calculada'} | {patient.school || 'Escola nao informada'}</p></div><div className="button-row"><button type="button" className="btn-secondary" onClick={() => onEdit(patient)}>Editar ficha</button><button type="button" className="btn-secondary" onClick={() => downloadPatientWord(patient)}>Baixar ficha Word</button><button type="button" className="btn-secondary" onClick={() => printPatientSheet(patient)}>Salvar ficha PDF</button><button type="button" className="btn-primary" onClick={onStartApplication}>Nova aplicacao</button></div></div>
      <div className="case-grid">
        <div><span className="field-label">Queixa principal</span><p>{patient.mainConcern || 'Nao informado'}</p></div>
        <div><span className="field-label">Motivo da avaliacao</span><p>{patient.evaluationReason || 'Nao informado'}</p></div>
        <div><span className="field-label">Responsavel</span><p>{patient.guardian || 'Nao informado'}{patient.guardianPhone ? ` | ${patient.guardianPhone}` : ''}</p></div>
        <div><span className="field-label">Documentos</span><p>{patient.documents || 'Nenhum registro'}</p></div>
      </div>
      <div className="subsection-heading"><h3>Testes realizados e pendentes</h3><button type="button" className="link-button" onClick={() => onNavigate('applications')}>Ver aplicacoes</button></div>
      {patientApplications.length === 0 ? <p className="empty-state">Nenhuma aplicacao registrada para este caso.</p> : <div className="evaluation-list">{patientApplications.map((application) => <article key={application.id} className="evaluation-item"><div><strong>{application.instrumentName}</strong><span>{formatDate(application.applicationDate)} | {application.informant || 'Informante nao informado'}</span></div><span className={`status-pill ${application.status === 'completed' ? 'status-green' : 'status-blue'}`}>{application.status === 'completed' ? 'Concluida' : 'Rascunho'}</span></article>)}</div>}
    </section>
  );
}

function InstrumentLibrary() {
  const { instruments } = useData();
  const [selectedId, setSelectedId] = useState(instruments[0]?.id);
  const selected = instruments.find((instrument) => instrument.id === selectedId) || instruments[0];

  return (
    <section className="panel" aria-labelledby="instruments-title">
      <div className="panel-heading"><div><p className="eyebrow">Etapa 2</p><h2 id="instruments-title">Biblioteca de instrumentos</h2><p className="muted">Metadados organizados; o conteudo dos protocolos deve ser inserido somente com autorizacao.</p></div></div>
      <div className="library-layout"><div className="instrument-list">{instruments.map((instrument) => <button type="button" key={instrument.id} className={selected?.id === instrument.id ? 'instrument-option active' : 'instrument-option'} onClick={() => setSelectedId(instrument.id)}><strong>{instrument.shortName}</strong><span>{instrument.name}</span></button>)}</div>{selected && <div className="instrument-detail"><div className="detail-heading"><div><p className="eyebrow">Instrumento selecionado</p><h3>{selected.name}</h3></div><span className="status-pill status-blue">{selected.normativeStatus === 'descriptive-unless-manual' ? 'Norma depende do manual' : 'Descritivo'}</span></div><p>{selected.description}</p><div className="template-steps" aria-label="Estrutura padrao do instrumento"><div className="template-step active"><strong>1</strong><span>Orientacao tecnica</span></div><div className="template-step"><strong>2</strong><span>Aplicacao</span></div><div className="template-step"><strong>3</strong><span>Correcao</span></div><div className="template-step"><strong>4</strong><span>Analise</span></div><div className="template-step"><strong>5</strong><span>Relatorio</span></div></div><div className="technical-table"><div><span>Nome do instrumento</span><strong>{selected.name}</strong></div><div><span>Finalidade</span><strong>{selected.description}</strong></div><div><span>Publico-alvo</span><strong>{selected.ageRange}</strong></div><div><span>Informante</span><strong>{selected.informants.join(', ')}</strong></div><div><span>Forma de aplicacao</span><strong>{selected.application}</strong></div><div><span>Pontuacao e correcao</span><strong>{selected.scoring}</strong></div><div><span>Dominios relacionados</span><strong>{selected.domains.join(', ')}</strong></div><div><span>Limitacoes</span><strong>{selected.limitation}</strong></div></div><div className="warning-box"><strong>Limitacao tecnica:</strong> {selected.limitation}</div><div className="info-box"><strong>Status do conteudo:</strong> cadastro tecnico pronto; itens e regras especificas aguardam protocolo autorizado.</div></div>}</div>
    </section>
  );
}

function ResultEditor({ results, onChange }) {
  const updateResult = (id, field, value) => onChange(results.map((result) => (result.id === id ? { ...result, [field]: value } : result)));
  const addResult = () => onChange([...results, makeResult()]);
  const removeResult = (id) => onChange(results.length > 1 ? results.filter((result) => result.id !== id) : results);

  return <div className="result-editor"><div className="section-title-row"><h3>Resultado por area</h3><button type="button" className="btn-secondary" onClick={addResult}>Adicionar area</button></div><div className="table-wrap"><table className="results-table"><thead><tr><th>Area avaliada</th><th>Pontuacao</th><th>Maximo</th><th>Porcentagem</th><th>Classificacao</th><th>Observacao</th><th></th></tr></thead><tbody>{results.map((result) => { const percentage = result.score !== '' && result.maximum !== '' && Number(result.maximum) > 0 ? (Number(result.score) / Number(result.maximum)) * 100 : ''; return <tr key={result.id}><td><input value={result.area} onChange={(event) => updateResult(result.id, 'area', event.target.value)} placeholder="Ex.: Atencao" /></td><td><input type="number" min="0" value={result.score} onChange={(event) => updateResult(result.id, 'score', event.target.value)} /></td><td><input type="number" min="0" value={result.maximum} onChange={(event) => updateResult(result.id, 'maximum', event.target.value)} /></td><td>{percentage === '' ? <span className="muted">-</span> : <strong>{percentage.toFixed(1)}%</strong>}</td><td><select value={result.classification} onChange={(event) => updateResult(result.id, 'classification', event.target.value)}><option>Preservada</option><option>Atencao</option><option>Investigacao necessaria</option><option>Indicadores elevados</option><option>Inconclusivo</option></select></td><td><input value={result.observation} onChange={(event) => updateResult(result.id, 'observation', event.target.value)} placeholder="Registro qualitativo" /></td><td><button type="button" className="icon-button" title="Remover area" onClick={() => removeResult(result.id)}>x</button></td></tr>; })}</tbody></table></div></div>;
}

function QuestionnaireBlock({ instrument, answers, onChange, supplementalAnswers, onSupplementalChange }) {
  const questionnaire = instrument?.questionnaire;
  if (!questionnaire) {
    return <div className="info-box protocol-placeholder"><strong>Aplicacao do protocolo:</strong> este instrumento ainda nao possui itens cadastrados. Registre a tarefa autorizada e os resultados por area abaixo.</div>;
  }

  const hasScoring = questionnaire.scoringMode === 'raw' && questionnaire.options.every((option) => typeof option.score === 'number');
  const total = questionnaire.items.reduce((sum, item, index) => sum + (questionnaire.options.find((option) => option.id === answers[index])?.score || 0), 0);
  const range = questionnaire.ranges?.find((item) => total >= Number(item.range.split(' ')[0]) && total <= Number(item.range.split(' ')[2])) || questionnaire.ranges?.[questionnaire.ranges.length - 1];
  const answeredCount = Object.keys(answers).length;

  return <div className="questionnaire-block"><div className="section-title-row"><div><p className="eyebrow">Bloco 2 - Aplicacao</p><h3>{questionnaire.title}</h3></div><span className="status-pill status-blue">{answeredCount}/{questionnaire.items.length} respondidos</span></div><div className="info-box"><strong>Nota tecnica:</strong> {questionnaire.note} Marque somente uma alternativa em cada item.</div><div className="table-wrap"><table className="questionnaire-table"><thead><tr><th>N.</th><th>Indicador investigado</th>{questionnaire.options.map((option) => <th key={option.id}>{option.id}</th>)}</tr></thead><tbody>{questionnaire.items.map((item, index) => { const itemText = typeof item === 'string' ? item : item.text; return <tr key={typeof item === 'string' ? item : item.id}><td>{index + 1}</td><td>{itemText}</td>{questionnaire.options.map((option) => <td key={option.id}><label className="response-cell"><input type="radio" name={`question-${index}`} checked={answers[index] === option.id} onChange={() => onChange(index, option.id)} /><span>{option.id}</span></label></td>)}</tr>; })}</tbody></table></div><div className="questionnaire-summary">{hasScoring ? <><strong>Resultado automatico do protocolo:</strong> {total}/{questionnaire.maximum || questionnaire.items.length} pontos | {(total / (questionnaire.maximum || questionnaire.items.length) * 100).toFixed(1)}%{range ? ` | ${range.label}` : ' | revisar conforme o manual.'}</> : <><strong>Registro atual:</strong> {answeredCount} de {questionnaire.items.length} respostas. O arquivo nao define ponto de corte ou regra automatica; a interpretacao deve ser manual.</>}</div>{questionnaire.ranges?.length ? <div className="range-table"><table><thead><tr><th>Pontuacao</th><th>Porcentagem</th><th>Leitura descritiva</th></tr></thead><tbody>{questionnaire.ranges.map((item) => <tr key={item.range}><td>{item.range}</td><td>{item.percentage}</td><td>{item.label}</td></tr>)}</tbody></table></div> : null}{questionnaire.supplementalFields?.length ? <div className="supplemental-fields"><div className="section-title-row"><h3>Campos complementares</h3></div>{questionnaire.supplementalFields.map((field, index) => <div className="form-group" key={field}><label htmlFor={`supplemental-${index}`}>{field}</label><textarea id={`supplemental-${index}`} rows="2" value={supplementalAnswers[index] || ''} onChange={(event) => onSupplementalChange(index, event.target.value)} /></div>)}</div> : null}</div>;
}

function EvaluationForm({ initialApplication, onSaved }) {
  const { patients, instruments, saveApplication, updateApplication } = useData();
  const [form, setForm] = useState(emptyApplication);
  const [results, setResults] = useState([makeResult()]);
  const [answers, setAnswers] = useState({});
  const [supplementalAnswers, setSupplementalAnswers] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const patient = patients.find((item) => item.id === form.patientId);
  const instrument = instruments.find((item) => item.id === form.testId);
  const eligibility = getEligibility(instrument, patient);

  useEffect(() => {
    if (initialApplication) {
      setForm({ ...emptyApplication, ...initialApplication, reviewConfirmed: Boolean(initialApplication.reviewConfirmed) });
      setResults(initialApplication.results?.length ? initialApplication.results : [makeResult()]);
      setAnswers(initialApplication.answers || {});
      setSupplementalAnswers(initialApplication.supplementalAnswers || {});
    } else {
      setForm({ ...emptyApplication });
      setResults([makeResult()]);
      setAnswers({});
      setSupplementalAnswers({});
    }
    setError('');
    setSuccess('');
  }, [initialApplication]);

  useEffect(() => {
    if (!instrument?.questionnaire) setAnswers({});
    if (!instrument?.questionnaire) setSupplementalAnswers({});
  }, [form.testId]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = (event, status) => {
    event.preventDefault();
    setError('');
    if (!patient || !instrument) { setError('Selecione o adolescente e o instrumento.'); return; }
    if (eligibility.blocked) { setError(eligibility.warning); return; }
    if (status === 'completed' && !form.reviewConfirmed) { setError('Confirme a revisao profissional antes de concluir.'); return; }
    const validResults = results.filter((result) => result.area.trim());
    const questionnaire = instrument.questionnaire;
    const answeredCount = questionnaire ? Object.keys(answers).length : 0;
    if (status === 'completed' && questionnaire && answeredCount !== questionnaire.items.length) { setError('Responda todos os itens do questionario antes de concluir.'); return; }
    if (status === 'completed' && validResults.length === 0 && !questionnaire) { setError('Registre pelo menos uma area avaliada antes de concluir.'); return; }
    if (validResults.some((result) => result.maximum !== '' && Number(result.score) > Number(result.maximum))) { setError('A pontuacao nao pode ser maior que o maximo informado.'); return; }

    const normalizedResults = validResults.map((result) => ({
      ...result,
      area: result.area.trim(),
      score: result.score === '' ? '' : Number(result.score),
      maximum: result.maximum === '' ? '' : Number(result.maximum),
      percentage: result.score !== '' && result.maximum !== '' && Number(result.maximum) > 0 ? Number(((Number(result.score) / Number(result.maximum)) * 100).toFixed(1)) : '',
      observation: result.observation.trim(),
    }));
    const questionnaireResult = questionnaire && questionnaire.scoringMode === 'raw' && answeredCount === questionnaire.items.length ? (() => {
      const score = questionnaire.items.reduce((sum, item, index) => sum + (questionnaire.options.find((option) => option.id === answers[index])?.score || 0), 0);
      const maximum = questionnaire.maximum || questionnaire.items.length;
      const percentage = Number(((score / maximum) * 100).toFixed(1));
      const range = questionnaire.ranges?.find((item) => score >= Number(item.range.split(' ')[0]) && score <= Number(item.range.split(' ')[2])) || questionnaire.ranges?.[questionnaire.ranges.length - 1];
      return { id: `questionnaire-${Date.now()}`, area: 'Pontuacao total do questionario', score, maximum, percentage, classification: range?.label || 'Resultado descritivo', observation: 'Resultado calculado conforme a regra expressa no arquivo enviado.' };
    })() : null;
    const manualQuestionnaireResult = questionnaire && questionnaire.scoringMode !== 'raw' && answeredCount === questionnaire.items.length ? {
      id: `questionnaire-${Date.now()}`,
      area: 'Questionario respondido - revisao manual',
      score: '',
      maximum: '',
      percentage: '',
      classification: 'Inconclusivo',
      observation: `${answeredCount} de ${questionnaire.items.length} respostas registradas; o arquivo nao define correcao automatica.`,
    } : null;
    const payload = {
      ...form,
      patientAge: calculateAge(patient.birthDate)?.years ?? null,
      instrumentId: instrument.id,
      instrumentName: instrument.name,
      instrumentDomains: instrument.domains,
      results: questionnaireResult ? [...normalizedResults, questionnaireResult] : manualQuestionnaireResult ? [...normalizedResults, manualQuestionnaireResult] : normalizedResults,
      answers,
      supplementalAnswers,
      quantitativeAnalysis: form.quantitativeAnalysis.trim(),
      qualitativeAnalysis: form.qualitativeAnalysis.trim(),
      limitations: form.limitations.trim() || instrument.limitation,
    };
    if (initialApplication) updateApplication(initialApplication.id, payload, status);
    else saveApplication(payload, status);
    setSuccess(status === 'completed' ? 'Aplicacao concluida e marcada para integracao.' : 'Rascunho salvo.');
    onSaved?.();
  };

  return (
    <section className="panel" aria-labelledby="application-title">
      <div className="panel-heading"><div><p className="eyebrow">Etapa 3</p><h2 id="application-title">{initialApplication ? 'Editar aplicacao' : 'Nova aplicacao'}</h2><p className="muted">O conteudo das perguntas deve vir do protocolo autorizado pela profissional.</p></div></div>
      {error && <div className="error-message">{error}</div>}{success && <div className="success-message">{success}</div>}{eligibility.warning && <div className={eligibility.blocked ? 'danger-box' : 'warning-box'}>{eligibility.warning}</div>}
      <form onSubmit={(event) => handleSubmit(event, 'draft')}>
        <div className="form-grid">
          <div className="form-group"><label htmlFor="patientId">Adolescente</label><select id="patientId" name="patientId" value={form.patientId} onChange={handleChange} required><option value="">Selecione</option>{patients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div className="form-group"><label htmlFor="testId">Instrumento</label><select id="testId" name="testId" value={form.testId} onChange={handleChange} required><option value="">Selecione</option>{instruments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div className="form-group"><label htmlFor="applicationDate">Data da aplicacao</label><input id="applicationDate" name="applicationDate" type="date" value={form.applicationDate} onChange={handleChange} required /></div>
          <div className="form-group"><label htmlFor="informant">Informante</label><select id="informant" name="informant" value={form.informant} onChange={handleChange}><option value="">Selecione</option>{(instrument?.informants || []).map((informant) => <option key={informant}>{informant}</option>)}</select></div>
          <div className="form-group"><label htmlFor="professional">Profissional aplicador</label><input id="professional" name="professional" value={form.professional} onChange={handleChange} /></div>
          <div className="form-group"><label htmlFor="version">Versao utilizada</label><input id="version" name="version" placeholder="Ex.: manual, ano ou protocolo" value={form.version} onChange={handleChange} /></div>
          <div className="form-group"><label htmlFor="duration">Tempo de aplicacao</label><input id="duration" name="duration" placeholder={instrument?.duration || 'Registrar tempo'} value={form.duration} onChange={handleChange} /></div>
          <div className="form-group"><label htmlFor="conditions">Condicoes de aplicacao</label><input id="conditions" name="conditions" placeholder="Ambiente, interrupcoes e recursos" value={form.conditions} onChange={handleChange} /></div>
        </div>
        {instrument && <div className="technical-summary"><strong>{instrument.name}</strong><span>{instrument.description}</span><span>Dominios relacionados: {instrument.domains.join(', ')}</span></div>}
        <QuestionnaireBlock instrument={instrument} answers={answers} onChange={(index, value) => setAnswers((current) => ({ ...current, [index]: value }))} supplementalAnswers={supplementalAnswers} onSupplementalChange={(index, value) => setSupplementalAnswers((current) => ({ ...current, [index]: value }))} />
        <div className="form-group"><label htmlFor="behaviorObservations">Observacoes comportamentais</label><textarea id="behaviorObservations" name="behaviorObservations" rows="3" value={form.behaviorObservations} onChange={handleChange} /></div>
        <ResultEditor results={results} onChange={setResults} />
        <div className="form-grid analysis-grid"><div className="form-group"><label htmlFor="quantitativeAnalysis">Analise quantitativa</label><textarea id="quantitativeAnalysis" name="quantitativeAnalysis" rows="4" value={form.quantitativeAnalysis} onChange={handleChange} /></div><div className="form-group"><label htmlFor="qualitativeAnalysis">Analise qualitativa</label><textarea id="qualitativeAnalysis" name="qualitativeAnalysis" rows="4" value={form.qualitativeAnalysis} onChange={handleChange} /></div><div className="form-group"><label htmlFor="attentionItems">Itens de maior atencao</label><textarea id="attentionItems" name="attentionItems" rows="3" value={form.attentionItems} onChange={handleChange} /></div><div className="form-group"><label htmlFor="preservedSkills">Habilidades preservadas</label><textarea id="preservedSkills" name="preservedSkills" rows="3" value={form.preservedSkills} onChange={handleChange} /></div><div className="form-group"><label htmlFor="difficulties">Dificuldades identificadas</label><textarea id="difficulties" name="difficulties" rows="3" value={form.difficulties} onChange={handleChange} /></div><div className="form-group"><label htmlFor="limitations">Limitacoes da interpretacao</label><textarea id="limitations" name="limitations" rows="3" value={form.limitations} onChange={handleChange} /></div></div>
        <label className="checkbox-row"><input type="checkbox" name="reviewConfirmed" checked={form.reviewConfirmed} onChange={handleChange} /> Confirmei a pontuacao, as porcentagens, as limitacoes e a revisao profissional.</label>
        <div className="form-actions button-row"><button type="submit" className="btn-secondary">Salvar rascunho</button><button type="button" className="btn-primary" onClick={(event) => handleSubmit(event, 'completed')} disabled={eligibility.blocked}>Concluir aplicacao</button></div>
      </form>
    </section>
  );
}

function RecentApplications({ onEdit }) {
  const { applications, patients } = useData();
  const rows = applications.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 10);
  return <section className="panel" aria-labelledby="recent-title"><div className="panel-heading"><div><p className="eyebrow">Historico</p><h2 id="recent-title">Aplicacoes recentes</h2></div></div>{rows.length === 0 ? <p className="empty-state">Nenhuma aplicacao registrada.</p> : <div className="evaluation-list">{rows.map((application) => <article key={application.id} className="evaluation-item"><div><strong>{patients.find((patient) => patient.id === application.patientId)?.name || 'Adolescente removido'}</strong><span>{application.instrumentName} | {formatDate(application.updatedAt)}</span></div><div className="button-row"><span className={`status-pill ${application.status === 'completed' ? 'status-green' : 'status-blue'}`}>{application.status === 'completed' ? 'Concluida' : 'Rascunho'}</span><button type="button" className="btn-secondary" onClick={() => onEdit(application)}>Abrir</button></div></article>)}</div>}</section>;
}

function IntegrationView({ selectedPatientId, onPatientChange }) {
  const { patients, getPatientApplications, hypotheses, saveHypotheses } = useData();
  const [selectedHypotheses, setSelectedHypotheses] = useState([]);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const patient = patients.find((item) => item.id === selectedPatientId);
  const patientApplications = patient ? getPatientApplications(patient.id).filter((application) => application.status === 'completed') : [];
  const existing = hypotheses.find((item) => item.patientId === selectedPatientId);

  useEffect(() => {
    setSelectedHypotheses(existing?.selected || []);
    setNotes(existing?.notes || '');
    setSaved(false);
  }, [selectedPatientId, existing?.updatedAt]);

  const domainRows = INTEGRATION_DOMAINS.map((domain) => {
    const related = patientApplications.filter((application) => application.instrumentDomains?.includes(domain));
    const resultRows = related.flatMap((application) => (application.results || []).filter((result) => result.area));
    const percentages = resultRows.filter((result) => result.percentage !== '').map((result) => Number(result.percentage));
    const classifications = [...new Set(resultRows.map((result) => result.classification).filter(Boolean))];
    return { domain, related, resultRows, average: percentages.length ? percentages.reduce((sum, value) => sum + value, 0) / percentages.length : null, classifications };
  });

  const toggleHypothesis = (hypothesis) => setSelectedHypotheses((current) => current.includes(hypothesis) ? current.filter((item) => item !== hypothesis) : [...current, hypothesis]);
  const save = () => { if (!patient) return; saveHypotheses(patient.id, selectedHypotheses, notes.trim()); setSaved(true); };

  return <section className="panel" aria-labelledby="integration-title"><div className="panel-heading"><div><p className="eyebrow">Etapa 4</p><h2 id="integration-title">Integracao e hipoteses</h2><p className="muted">A matriz organiza evidencias; a profissional decide o que permanece como hipotese investigativa.</p></div><select className="patient-selector" value={selectedPatientId} onChange={(event) => onPatientChange(event.target.value)}><option value="">Selecione o adolescente</option>{patients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>{!patient ? <p className="empty-state">Selecione um adolescente para visualizar a integracao.</p> : <><div className="table-wrap"><table className="integration-table"><thead><tr><th>Dominio</th><th>Instrumentos relacionados</th><th>Resultado integrado</th><th>Leitura</th></tr></thead><tbody>{domainRows.map((row) => <tr key={row.domain}><td><strong>{row.domain}</strong></td><td>{row.related.length ? row.related.map((application) => application.instrumentName).join(', ') : 'Sem dados'}</td><td>{row.average === null ? <span className="status-pill status-blue">Nao avaliado</span> : <span className={`status-pill ${row.average >= 75 ? 'status-red' : row.average >= 50 ? 'status-yellow' : 'status-green'}`}>{row.average.toFixed(1)}%</span>}</td><td>{row.classifications.length > 1 ? 'Resultados divergentes; revisar contexto.' : row.classifications[0] || 'Dados ainda ausentes.'}</td></tr>)}</tbody></table></div><div className="integration-columns"><div><div className="subsection-heading"><h3>Hipoteses investigativas</h3><span className="muted">{selectedHypotheses.length} selecionadas</span></div><div className="hypothesis-grid">{INVESTIGATIVE_HYPOTHESES.map((hypothesis) => <label key={hypothesis} className="checkbox-row"><input type="checkbox" checked={selectedHypotheses.includes(hypothesis)} onChange={() => toggleHypothesis(hypothesis)} />{hypothesis}</label>)}</div></div><div><div className="form-group"><label htmlFor="hypothesisNotes">Notas da integracao</label><textarea id="hypothesisNotes" rows="12" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Convergencias, divergencias, dados ausentes e encaminhamentos." /></div><button type="button" className="btn-primary" onClick={save}>Salvar integracao</button>{saved && <div className="success-message compact-message">Integracao salva para revisao do caso.</div>}</div></div></>}</section>;
}

function ReportView({ selectedPatientId, onPatientChange }) {
  const { patients, applications, hypotheses, saveReportDraft, professionalProfile } = useData();
  const [conclusion, setConclusion] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [limitations, setLimitations] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [saved, setSaved] = useState(false);
  const patient = patients.find((item) => item.id === selectedPatientId);
  const patientApplications = applications.filter((application) => application.patientId === selectedPatientId);
  const patientHypotheses = hypotheses.find((item) => item.patientId === selectedPatientId);

  const save = () => { if (!patient || !authorized) return; saveReportDraft(patient.id, { conclusion: conclusion.trim(), recommendations: recommendations.trim(), limitations: limitations.trim(), applicationIds: patientApplications.map((application) => application.id), hypotheses: patientHypotheses?.selected || [], professionalProfile }); setSaved(true); };

  return <section className="panel" aria-labelledby="report-title"><div className="panel-heading"><div><p className="eyebrow">Etapa 5</p><h2 id="report-title">Preparacao do RAM</h2><p className="muted">Revise o conteudo antes de salvar ou exportar o documento compativel com Word.</p></div><select className="patient-selector" value={selectedPatientId} onChange={(event) => onPatientChange(event.target.value)}><option value="">Selecione o adolescente</option>{patients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>{!patient ? <p className="empty-state">Selecione um adolescente para preparar o RAM.</p> : <><div className="report-header"><div><p className="eyebrow">Cabecalho profissional</p><strong>{professionalProfile.name || 'Nome da profissional nao preenchido'}</strong><span>{professionalProfile.formation || 'Formacao nao preenchida'}{professionalProfile.cbo ? ` | CBO ${professionalProfile.cbo}` : ''}</span><span>{professionalProfile.phone || 'Telefone nao preenchido'}{professionalProfile.email ? ` | ${professionalProfile.email}` : ''}</span></div><span className="status-pill status-blue">Relatorio multidimensional</span></div><div className="report-outline"><strong>{patient.name}</strong><span>{patientApplications.length} aplicacoes registradas</span><span>{patientHypotheses?.selected?.length || 0} hipoteses em investigacao</span><span>Identificacao, historico, instrumentos, resultados, integracao, conclusao, recomendacoes e limitacoes.</span></div><div className="form-grid analysis-grid"><div className="form-group"><label htmlFor="conclusion">Conclusao profissional</label><textarea id="conclusion" rows="8" value={conclusion} onChange={(event) => setConclusion(event.target.value)} /></div><div className="form-group"><label htmlFor="recommendations">Recomendacoes e encaminhamentos</label><textarea id="recommendations" rows="8" value={recommendations} onChange={(event) => setRecommendations(event.target.value)} /></div><div className="form-group span-2"><label htmlFor="reportLimitations">Limitacoes</label><textarea id="reportLimitations" rows="4" value={limitations} onChange={(event) => setLimitations(event.target.value)} placeholder="Inclua normas, informantes, protocolo incompleto e limites da interpretacao." /></div></div><label className="checkbox-row"><input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} /> Autorizei a criacao deste rascunho para revisao final.</label><div className="form-actions button-row"><button type="button" className="btn-secondary" onClick={() => window.print()} disabled={!authorized}>Imprimir / salvar PDF</button><button type="button" className="btn-primary" onClick={save} disabled={!authorized}>Salvar rascunho do RAM</button><button type="button" className="btn-primary" onClick={() => downloadRamWord(patient, professionalProfile, patientApplications, patientHypotheses, conclusion, recommendations, limitations)} disabled={!authorized}>Baixar Word</button>{saved && <div className="success-message compact-message">Rascunho salvo.</div>}</div></>}</section>;
}

function Workspace() {
  const { patients } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const activeView = getViewFromPath(location.pathname);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [editingPatient, setEditingPatient] = useState(null);
  const [editingApplication, setEditingApplication] = useState(null);
  const [showPatientImport, setShowPatientImport] = useState(false);
  const [patientImportDraft, setPatientImportDraft] = useState(null);

  const navigateToView = (view) => {
    if (view !== 'applications') setEditingApplication(null);
    navigate(APP_ROUTES[view] || APP_ROUTES.dashboard);
  };
  const selectPatient = (patientId) => { setSelectedPatientId(patientId); navigateToView('patients'); };
  const startApplication = (patientId = selectedPatientId) => { setSelectedPatientId(patientId); setEditingApplication(null); navigateToView('applications'); };
  const openApplication = (application) => { setEditingApplication(application); setSelectedPatientId(application.patientId); navigateToView('applications'); };
  const openPatientImport = () => {
    setEditingPatient(null);
    setShowPatientImport(true);
    navigateToView('patients');
  };

  const renderActivePage = () => {
    if (activeView === 'patients') {
      return <>
        {showPatientImport && <PatientDocumentImport onClose={() => setShowPatientImport(false)} onDraftReady={(draft) => { setEditingPatient(null); setPatientImportDraft(draft); setShowPatientImport(false); window.setTimeout(() => document.getElementById('patient-form-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); }} />}
        <PatientForm editingPatient={editingPatient} importDraft={patientImportDraft} onImportDraftConsumed={() => setPatientImportDraft(null)} onSaved={() => { setEditingPatient(null); navigateToView('patients'); }} onCancel={() => setEditingPatient(null)} />
        <PatientList selectedPatientId={selectedPatientId} onSelect={selectPatient} onEdit={(patient) => { setEditingPatient(patient); setSelectedPatientId(patient.id); }} />
        {patients.find((patient) => patient.id === selectedPatientId) && <PatientCase patient={patients.find((patient) => patient.id === selectedPatientId)} onStartApplication={() => startApplication(selectedPatientId)} onEdit={(patient) => setEditingPatient(patient)} onNavigate={navigateToView} />}
      </>;
    }
    if (activeView === 'instruments') return <InstrumentLibrary />;
    if (activeView === 'applications') return <><EvaluationForm initialApplication={editingApplication} onSaved={() => {}} /><RecentApplications onEdit={openApplication} /></>;
    if (activeView === 'integration') return <IntegrationView selectedPatientId={selectedPatientId} onPatientChange={setSelectedPatientId} />;
    if (activeView === 'reports') return <ReportView selectedPatientId={selectedPatientId} onPatientChange={setSelectedPatientId} />;
    if (activeView === 'profile') return <ProfessionalProfileForm />;
    return <>
      <div className="welcome-band"><div><p className="eyebrow">Fluxo de trabalho</p><h2>Organize cada caso com registro, revisao e integracao.</h2><p>O sistema calcula e organiza. A profissional interpreta, revisa, valida e assina.</p></div><div className="button-row"><button type="button" className="btn-primary" onClick={() => { setEditingPatient(null); navigateToView('patients'); }}>Cadastrar adolescente</button><button type="button" className="btn-secondary" onClick={openPatientImport}>Importar documentos</button><button type="button" className="btn-secondary" onClick={() => startApplication()}>Nova aplicacao</button></div></div>
      <ProfessionalProfileForm />
      <RecentApplications onEdit={openApplication} />
    </>;
  };

  return <div className="app-shell"><Header activeView={activeView} onNavigate={navigateToView} /><main className="container"><DashboardCards /><SourceSafetyNotice />{renderActivePage()}</main></div>;
}

function Root() {
  return <Routes>
    <Route path={PUBLIC_ROUTES.privacy} element={<PrivacyPage />} />
    <Route path={PUBLIC_ROUTES.terms} element={<TermsPage />} />
    {Object.values(APP_ROUTES).map((path) => <Route key={path} path={path} element={<Workspace />} />)}
    <Route path="*" element={<NotFoundPage />} />
  </Routes>;
}

export default function App() {
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DataProvider><Root /></DataProvider></BrowserRouter>;
}
