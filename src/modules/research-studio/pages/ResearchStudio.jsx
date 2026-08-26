import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  ExternalLink,
  FileText,
  Film,
  Image,
  LibraryBig,
  Loader2,
  MonitorUp,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { researchStudioApi } from '../services/researchStudioApi';
import ResearchStudioEditor from '../components/ResearchStudioEditor';
import './research-studio.css';

const EMPTY_FORM = {
  title: '',
  channel: 'HFNEW Atualidade',
  language: 'pt-BR',
  aspect_ratio: '16:9',
  brief: '',
  targets: { images: 70, videos: 40, documents: 25, own_elements: 25 },
};

const SOURCE_LABELS = {
  all: 'Todas as fontes',
  openverse: 'Openverse',
  wikimedia: 'Wikimedia Commons',
  pexels: 'Pexels',
  pixabay: 'Pixabay',
  official_data: 'ONS + ANEEL',
  manual: 'Manual',
  aneel: 'ANEEL',
  ons: 'ONS',
};

const STATUS_LABELS = {
  draft: 'Rascunho',
  planned: 'Planejado',
  ready_for_remotion: 'Pronto para Remotion',
  awaiting_local_bridge: 'Aguardando ponte local',
  received: 'Recebido',
  syncing: 'Sincronizando',
  ready_in_studio: 'Pronto no Studio',
  rendering: 'Renderizando',
  completed: 'Finalizado',
  failed: 'Falhou',
};

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function sceneSearchQuery(scene) {
  const rawQueries = scene?.queries;
  const queryCandidates = Array.isArray(rawQueries)
    ? rawQueries
    : (typeof rawQueries === 'string' ? [rawQueries] : []);
  const plannedQuery = queryCandidates.find((query) => typeof query === 'string' && query.trim().length >= 3);
  return plannedQuery?.trim()
    || scene?.title?.trim()
    || scene?.visual_goal?.trim()
    || scene?.narration?.trim().slice(0, 180)
    || '';
}

function ResearchStudio() {
  const [health, setHealth] = useState(null);
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [activeSceneId, setActiveSceneId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [createOpen, setCreateOpen] = useState(true);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState('');
  const [searchForm, setSearchForm] = useState({ query: '', media_type: 'image', source: 'all', limit: 12 });
  const [assetFilter, setAssetFilter] = useState('pending');
  const [searchErrors, setSearchErrors] = useState([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ title: '', media_type: 'image', original_url: '', preview_url: '', creator: '', license: '' });

  const activeScene = useMemo(
    () => activeProject?.scenes?.find((scene) => scene.id === activeSceneId) || null,
    [activeProject, activeSceneId],
  );
  const visibleAssets = useMemo(
    () => (activeProject?.assets || []).filter((asset) => asset.status === assetFilter),
    [activeProject, assetFilter],
  );
  const coveredScenes = useMemo(
    () => (activeProject?.scenes || []).filter((scene) => scene.status === 'covered').length,
    [activeProject],
  );
  const selectedVideoCount = useMemo(() => {
    const editorScenes = activeProject?.editor?.scenes || [];
    const selectedIds = new Set(editorScenes
      .filter((scene) => scene.enabled !== false && scene.asset_id)
      .map((scene) => scene.asset_id));
    if (!editorScenes.length) {
      for (const scene of activeProject?.scenes || []) {
        for (const assetId of scene.asset_ids || []) selectedIds.add(assetId);
      }
    }
    return (activeProject?.assets || []).filter(
      (asset) => selectedIds.has(asset.id) && asset.status === 'approved' && asset.media_type === 'video',
    ).length;
  }, [activeProject]);

  function activateProject(project) {
    const firstScene = project?.scenes?.[0] || null;
    setActiveProject(project || null);
    setActiveSceneId(firstScene?.id || '');
    setSearchForm((current) => ({ ...current, query: sceneSearchQuery(firstScene) }));
    setSearchErrors([]);
  }

  async function bootstrap() {
    setBusy('bootstrap');
    try {
      const [healthData, projectData] = await Promise.all([
        researchStudioApi.health(),
        researchStudioApi.listProjects(),
      ]);
      setHealth(healthData);
      setProjects(projectData.projects || []);
      if (!activeProject && projectData.projects?.length) {
        activateProject(projectData.projects[0]);
      }
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  useEffect(() => {
    bootstrap();
  }, []);

  async function refreshProject(projectId = activeProject?.id) {
    if (!projectId) return null;
    const updated = await researchStudioApi.getProject(projectId);
    setActiveProject(updated);
    setProjects((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    if (!updated.scenes?.some((scene) => scene.id === activeSceneId)) {
      setActiveSceneId(updated.scenes?.[0]?.id || '');
    }
    return updated;
  }

  async function handleCreate(event) {
    event.preventDefault();
    setBusy('create');
    setNotice(null);
    try {
      const project = await researchStudioApi.createProject(form);
      setProjects((current) => [project, ...current]);
      activateProject(project);
      setForm(EMPTY_FORM);
      setCreateOpen(false);
      setNotice({ type: 'success', text: 'Projeto de pesquisa criado.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function handleDeleteProject(projectId) {
    if (!window.confirm('Excluir este projeto de pesquisa e seus pacotes?')) return;
    setBusy(`delete-project-${projectId}`);
    try {
      await researchStudioApi.deleteProject(projectId);
      const remaining = projects.filter((item) => item.id !== projectId);
      setProjects(remaining);
      activateProject(remaining[0] || null);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function handlePlan(useAi) {
    if (!activeProject) return;
    setBusy(useAi ? 'plan-ai' : 'plan-local');
    setNotice(null);
    try {
      const updated = await researchStudioApi.generatePlan(activeProject.id, useAi);
      setActiveProject(updated);
      setProjects((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      const firstScene = updated.scenes?.[0] || null;
      setActiveSceneId(firstScene?.id || '');
      setSearchForm((current) => ({ ...current, query: sceneSearchQuery(firstScene) }));
      setSearchErrors([]);
      setNotice({ type: 'success', text: `${updated.scenes?.length || 0} cenas planejadas.` });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  function selectScene(scene) {
    setActiveSceneId(scene.id);
    setSearchForm((current) => ({ ...current, query: sceneSearchQuery(scene) }));
    setSearchErrors([]);
  }

  async function handleSelectProject(projectId) {
    if (!projectId || projectId === activeProject?.id) return;
    setBusy(`select-project-${projectId}`);
    setNotice(null);
    try {
      const project = await researchStudioApi.getProject(projectId);
      setProjects((current) => current.map((item) => (item.id === project.id ? project : item)));
      activateProject(project);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function handleSearch(event) {
    event.preventDefault();
    if (!activeProject) return;
    setBusy('search');
    setSearchErrors([]);
    setNotice(null);
    try {
      const response = await researchStudioApi.search(activeProject.id, {
        ...searchForm,
        scene_id: activeSceneId,
        limit: Number(searchForm.limit),
      });
      setSearchErrors(response.errors || []);
      await refreshProject(activeProject.id);
      setAssetFilter('pending');
      setNotice({ type: 'success', text: `${response.results?.length || 0} materiais encontrados.` });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function handleAssetStatus(asset, status) {
    if (!activeProject) return;
    setBusy(`asset-${asset.id}`);
    try {
      await researchStudioApi.updateAsset(activeProject.id, asset.id, {
        status,
        scene_id: activeSceneId || asset.scene_id || '',
      });
      await refreshProject(activeProject.id);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function handleDeleteAsset(assetId) {
    if (!activeProject) return;
    setBusy(`asset-${assetId}`);
    try {
      await researchStudioApi.deleteAsset(activeProject.id, assetId);
      await refreshProject(activeProject.id);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function handleManualAsset(event) {
    event.preventDefault();
    if (!activeProject) return;
    setBusy('manual');
    try {
      await researchStudioApi.addManualAsset(activeProject.id, {
        ...manualForm,
        preview_url: manualForm.preview_url || null,
        landing_url: manualForm.original_url,
        license_url: null,
        scene_id: activeSceneId,
      });
      await refreshProject(activeProject.id);
      setManualForm({ title: '', media_type: 'image', original_url: '', preview_url: '', creator: '', license: '' });
      setManualOpen(false);
      setNotice({ type: 'success', text: 'Material manual registrado.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function handlePrepareRemotion() {
    if (!activeProject) return;
    setBusy('remotion');
    try {
      const job = await researchStudioApi.createRemotionJob(activeProject.id);
      await refreshProject(activeProject.id);
      setNotice({ type: 'success', text: `Pacote ${job.id} preparado para a ponte local.` });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function handleBatchDownload() {
    if (!activeProject) return;
    setBusy('batch-download');
    setNotice(null);
    try {
      const job = await researchStudioApi.createRemotionJob(activeProject.id);
      const filename = await downloadJobFile(job);
      await refreshProject(activeProject.id);
      setNotice({
        type: 'success',
        text: 'Lote preparado. Confirme a ponte local para baixar os arquivos e gerar o ZIP completo.',
      });
      window.setTimeout(() => {
        window.location.href = `hfnew-remotion://batch?file=${encodeURIComponent(filename)}`;
      }, 900);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function handleSaveEditor(editor) {
    if (!activeProject) return null;
    setBusy('editor-save');
    setNotice(null);
    try {
      const updated = await researchStudioApi.updateEditor(activeProject.id, editor);
      setActiveProject(updated);
      setProjects((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setNotice({ type: 'success', text: 'Edição do projeto salva.' });
      return updated;
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
      return null;
    } finally {
      setBusy('');
    }
  }

  async function handleSaveAndOpenRemotion(editor) {
    if (!activeProject) return;
    const projectId = activeProject.id;
    setBusy('editor-remotion');
    setNotice(null);
    try {
      const updated = await researchStudioApi.updateEditor(projectId, editor);
      setActiveProject(updated);
      setProjects((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      const job = await researchStudioApi.createRemotionJob(projectId);
      const blob = await researchStudioApi.downloadRemotionJob(projectId, job.id);
      const filename = job.filename || `${job.id}.zip`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 3000);
      await refreshProject(projectId);
      setNotice({ type: 'success', text: 'Edição salva e pacote preparado. Confirme a abertura da ponte local.' });
      window.setTimeout(() => {
        window.location.href = `hfnew-remotion://import?file=${encodeURIComponent(filename)}`;
      }, 1100);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function handleDownloadJob(job) {
    if (!activeProject) return;
    setBusy(`job-${job.id}`);
    try {
      await downloadJobFile(job);
      setNotice({ type: 'success', text: 'Pacote Remotion baixado.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function downloadJobFile(job) {
    const blob = await researchStudioApi.downloadRemotionJob(activeProject.id, job.id);
    const filename = job.filename || `${job.id}.zip`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    return filename;
  }

  async function handleOpenLocalBridge(job) {
    if (!activeProject) return;
    setBusy(`bridge-${job.id}`);
    try {
      const filename = await downloadJobFile(job);
      setNotice({ type: 'success', text: 'Pacote baixado. Confirme a abertura da ponte local no navegador.' });
      window.setTimeout(() => {
        window.location.href = `hfnew-remotion://import?file=${encodeURIComponent(filename)}`;
      }, 900);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  function updateTarget(key, value) {
    setForm((current) => ({
      ...current,
      targets: { ...current.targets, [key]: Number(value) },
    }));
  }

  return (
    <div className="research-studio-page">
      <header className="research-studio-header">
        <div>
          <span className="research-studio-kicker"><Search size={15} /> PESQUISA E ACERVO</span>
          <h1>HF Research Studio</h1>
        </div>
        <div className={`research-studio-health ${health?.status === 'operational' ? 'online' : ''}`}>
          <span /> {health?.status === 'operational' ? 'Operacional' : 'Verificando'}
        </div>
      </header>

      {notice && (
        <div className={`research-studio-notice ${notice.type}`}>
          {notice.type === 'success' ? <Check size={17} /> : <X size={17} />}
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Fechar"><X size={15} /></button>
        </div>
      )}

      <section className={`research-studio-section research-studio-create ${createOpen ? '' : 'collapsed'}`}>
        <button type="button" className="research-studio-section-title" onClick={() => setCreateOpen((value) => !value)}>
          <span><Plus size={18} /> Novo projeto de pesquisa</span>
          {createOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {createOpen && (
          <form className="research-studio-create-form" onSubmit={handleCreate}>
            <div className="research-studio-form-grid">
              <label>Título<input required minLength={2} maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
              <label>Canal<input maxLength={80} value={form.channel} onChange={(event) => setForm({ ...form, channel: event.target.value })} /></label>
              <label>Formato<select value={form.aspect_ratio} onChange={(event) => setForm({ ...form, aspect_ratio: event.target.value })}><option>16:9</option><option>9:16</option><option>1:1</option><option value="both">Horizontal + vertical</option></select></label>
              <label>Idioma<select value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })}><option value="pt-BR">Português</option><option value="en">Inglês</option><option value="es">Espanhol</option></select></label>
            </div>
            <div className="research-studio-targets">
              <label><Image size={15} /> Imagens<input type="number" min="0" max="200" value={form.targets.images} onChange={(event) => updateTarget('images', event.target.value)} /></label>
              <label><Film size={15} /> Vídeos<input type="number" min="0" max="120" value={form.targets.videos} onChange={(event) => updateTarget('videos', event.target.value)} /></label>
              <label><FileText size={15} /> Documentos<input type="number" min="0" max="100" value={form.targets.documents} onChange={(event) => updateTarget('documents', event.target.value)} /></label>
              <label><Sparkles size={15} /> Próprios<input type="number" min="0" max="100" value={form.targets.own_elements} onChange={(event) => updateTarget('own_elements', event.target.value)} /></label>
            </div>
            <label className="research-studio-brief">Roteiro ou briefing<textarea required minLength={10} maxLength={50000} rows={7} value={form.brief} onChange={(event) => setForm({ ...form, brief: event.target.value })} /></label>
            <button type="submit" className="research-studio-primary" disabled={busy === 'create'}>{busy === 'create' ? <Loader2 className="spin" size={18} /> : <Plus size={18} />} Criar projeto</button>
          </form>
        )}
      </section>

      <section className={`research-studio-section research-studio-projects ${projectsOpen ? '' : 'collapsed'}`}>
        <button type="button" className="research-studio-section-title" onClick={() => setProjectsOpen((value) => !value)}>
          <span><LibraryBig size={18} /> Projetos <strong>{projects.length}</strong></span>
          {projectsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {projectsOpen && (
          <div className="research-studio-project-strip">
            {projects.map((project) => (
              <article key={project.id} className={activeProject?.id === project.id ? 'active' : ''}>
                <button type="button" className="research-studio-project-select" onClick={() => handleSelectProject(project.id)} disabled={busy === `select-project-${project.id}`}>
                  <strong>{project.title}</strong>
                  <span>{STATUS_LABELS[project.status] || project.status} · {project.metrics?.scenes || 0} cenas · {project.metrics?.approved || 0} aprovados</span>
                </button>
                <button type="button" className="research-studio-icon-danger" onClick={() => handleDeleteProject(project.id)} title="Excluir projeto"><Trash2 size={15} /></button>
              </article>
            ))}
            {!projects.length && <p className="research-studio-empty">Nenhum projeto criado.</p>}
          </div>
        )}
      </section>

      {activeProject ? (
        <>
          <section className="research-studio-summary">
            <div><span>Cenas</span><strong>{activeProject.metrics?.scenes || 0}</strong></div>
            <div><span>Cobertas</span><strong>{coveredScenes}</strong></div>
            <div><span>Candidatos</span><strong>{activeProject.metrics?.candidates || 0}</strong></div>
            <div><span>Aprovados</span><strong>{activeProject.metrics?.approved || 0}</strong></div>
            <div><span>Imagens</span><strong>{activeProject.metrics?.images || 0}/{activeProject.targets?.images || 0}</strong></div>
            <div><span>Vídeos</span><strong>{activeProject.metrics?.videos || 0}/{activeProject.targets?.videos || 0}</strong></div>
          </section>

          <section className="research-studio-plan-bar">
            <div><BookOpen size={18} /><span><strong>{activeProject.title}</strong><small>{activeProject.channel} · {activeProject.aspect_ratio} · Atualizado {formatDate(activeProject.updated_at)}</small></span></div>
            <div>
              <button type="button" onClick={() => handlePlan(false)} disabled={Boolean(busy)}><RefreshCw size={16} className={busy === 'plan-local' ? 'spin' : ''} /> Planejar local</button>
              <button type="button" className="ai" onClick={() => handlePlan(true)} disabled={Boolean(busy) || !health?.openai_configured} title={health?.openai_configured ? 'Consome API somente neste clique' : 'OpenAI não configurada'}><Sparkles size={16} /> Planejar com IA</button>
            </div>
          </section>

          <div className="research-studio-workspace">
            <aside className="research-studio-scenes">
              <div className="research-studio-panel-heading"><span><BookOpen size={17} /> Cenas</span><strong>{activeProject.scenes?.length || 0}</strong></div>
              <div className="research-studio-scene-list">
                {(activeProject.scenes || []).map((scene) => (
                  <button key={scene.id} type="button" className={`${activeSceneId === scene.id ? 'active' : ''} ${scene.status === 'covered' ? 'covered' : ''}`} onClick={() => selectScene(scene)}>
                    <b>{String(scene.order).padStart(2, '0')}</b>
                    <span><strong>{scene.title}</strong><small>{scene.duration_seconds}s · {scene.asset_ids?.length || 0} aprovado(s)</small></span>
                    {scene.status === 'covered' && <BadgeCheck size={16} />}
                  </button>
                ))}
                {!activeProject.scenes?.length && <p className="research-studio-empty">Gere o plano de cenas.</p>}
              </div>
            </aside>

            <main className="research-studio-research">
              <div className="research-studio-panel-heading"><span><Search size={17} /> Pesquisa por cena</span>{activeScene && <strong>Cena {activeScene.order}</strong>}</div>
              {activeScene && (
                <div className="research-studio-scene-context">
                  <strong>{activeScene.title}</strong>
                  <p>{activeScene.visual_goal || activeScene.narration}</p>
                  <div>{(activeScene.queries || []).map((query) => <button type="button" key={query} onClick={() => setSearchForm({ ...searchForm, query })}>{query}</button>)}</div>
                </div>
              )}
              <form className="research-studio-search-form" onSubmit={handleSearch}>
                <label className="query"><span>Busca</span><input required minLength={3} maxLength={180} value={searchForm.query} onChange={(event) => setSearchForm({ ...searchForm, query: event.target.value })} /></label>
                <label><span>Tipo</span><select value={searchForm.media_type} onChange={(event) => setSearchForm({ ...searchForm, media_type: event.target.value, source: event.target.value === 'document' ? 'official_data' : 'all' })}><option value="image">Imagem</option><option value="video">Vídeo</option><option value="document">Documento/dados</option></select></label>
                <label><span>Fonte</span><select value={searchForm.source} onChange={(event) => setSearchForm({ ...searchForm, source: event.target.value })}><option value="all">Todas compatíveis</option>{searchForm.media_type === 'image' && <option value="openverse">Openverse</option>} {searchForm.media_type !== 'document' && <option value="wikimedia">Wikimedia</option>} {searchForm.media_type !== 'document' && <option value="pixabay">Pixabay</option>} {searchForm.media_type !== 'document' && <option value="pexels">Pexels (requer chave própria)</option>} {searchForm.media_type === 'document' && <option value="official_data">ONS + ANEEL</option>}</select></label>
                <label><span>Limite</span><input type="number" min="1" max="30" value={searchForm.limit} onChange={(event) => setSearchForm({ ...searchForm, limit: event.target.value })} /></label>
                <button type="submit" className="research-studio-primary" disabled={busy === 'search' || !activeSceneId}>{busy === 'search' ? <Loader2 className="spin" size={18} /> : <Search size={18} />} Pesquisar</button>
              </form>
              {searchErrors.length > 0 && <div className="research-studio-source-errors">{searchErrors.map((error) => <span key={error}>{error}</span>)}</div>}
              <button type="button" className="research-studio-manual-toggle" onClick={() => setManualOpen((value) => !value)}><Plus size={15} /> Registrar URL licenciada {manualOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>
              {manualOpen && (
                <form className="research-studio-manual-form" onSubmit={handleManualAsset}>
                  <input required placeholder="Título" value={manualForm.title} onChange={(event) => setManualForm({ ...manualForm, title: event.target.value })} />
                  <select value={manualForm.media_type} onChange={(event) => setManualForm({ ...manualForm, media_type: event.target.value })}><option value="image">Imagem</option><option value="video">Vídeo</option><option value="document">Documento</option><option value="own_element">Elemento próprio</option></select>
                  <input required type="url" placeholder="URL HTTPS do arquivo" value={manualForm.original_url} onChange={(event) => setManualForm({ ...manualForm, original_url: event.target.value })} />
                  <input type="url" placeholder="URL da miniatura (opcional)" value={manualForm.preview_url} onChange={(event) => setManualForm({ ...manualForm, preview_url: event.target.value })} />
                  <input placeholder="Autor" value={manualForm.creator} onChange={(event) => setManualForm({ ...manualForm, creator: event.target.value })} />
                  <input placeholder="Licença" value={manualForm.license} onChange={(event) => setManualForm({ ...manualForm, license: event.target.value })} />
                  <button type="submit" disabled={busy === 'manual'}><Plus size={16} /> Registrar</button>
                </form>
              )}
            </main>
          </div>

          <section className="research-studio-assets">
            <div className="research-studio-assets-toolbar">
              <div className="research-studio-panel-heading"><span><LibraryBig size={17} /> Curadoria</span></div>
              <div className="research-studio-tabs">
                <button type="button" className={assetFilter === 'pending' ? 'active' : ''} onClick={() => setAssetFilter('pending')}>Pendentes</button>
                <button type="button" className={assetFilter === 'approved' ? 'active' : ''} onClick={() => setAssetFilter('approved')}>Aprovados</button>
                <button type="button" className={assetFilter === 'rejected' ? 'active' : ''} onClick={() => setAssetFilter('rejected')}>Rejeitados</button>
              </div>
            </div>
            <div className="research-studio-asset-grid">
              {visibleAssets.map((asset) => (
                <article key={asset.id}>
                  <div className="research-studio-asset-preview">
                    {asset.preview_url ? <img src={asset.preview_url} alt="" loading="lazy" /> : asset.media_type === 'video' ? <Film size={34} /> : asset.media_type === 'document' ? <Database size={34} /> : <Image size={34} />}
                    <span>{SOURCE_LABELS[asset.source] || asset.source}</span>
                  </div>
                  <div className="research-studio-asset-info">
                    <strong title={asset.title}>{asset.title}</strong>
                    <small>{asset.creator || 'Autor não informado'}</small>
                    <em>{asset.license}</em>
                    <small className={asset.commercial_use_allowed ? 'license-ok' : 'license-blocked'}>{asset.license_warning}</small>
                    {asset.width > 0 && <small>{asset.width} × {asset.height}{asset.duration ? ` · ${asset.duration}s` : ''}</small>}
                  </div>
                  <div className="research-studio-asset-actions">
                    {asset.status !== 'approved' && <button type="button" className="approve" onClick={() => handleAssetStatus(asset, 'approved')} disabled={busy === `asset-${asset.id}` || !asset.commercial_use_allowed} title={asset.commercial_use_allowed ? 'Aprovar' : asset.license_warning}><Check size={16} /></button>}
                    {asset.status !== 'rejected' && <button type="button" className="reject" onClick={() => handleAssetStatus(asset, 'rejected')} disabled={busy === `asset-${asset.id}`} title="Rejeitar"><X size={16} /></button>}
                    {asset.status !== 'pending' && <button type="button" onClick={() => handleAssetStatus(asset, 'pending')} disabled={busy === `asset-${asset.id}`} title="Voltar para pendentes"><RefreshCw size={15} /></button>}
                    {asset.landing_url && <a href={asset.landing_url} target="_blank" rel="noopener noreferrer" title="Abrir fonte"><ExternalLink size={15} /></a>}
                    <button type="button" className="delete" onClick={() => handleDeleteAsset(asset.id)} disabled={busy === `asset-${asset.id}`} title="Excluir"><Trash2 size={15} /></button>
                  </div>
                </article>
              ))}
              {!visibleAssets.length && <p className="research-studio-empty">Nenhum material nesta etapa.</p>}
            </div>
          </section>

          <ResearchStudioEditor
            project={activeProject}
            busy={busy}
            onSave={handleSaveEditor}
            onOpenRemotion={handleSaveAndOpenRemotion}
            onDeleteAsset={handleDeleteAsset}
          />

          <section className="research-studio-remotion">
            <div className="research-studio-panel-heading"><span><Send size={17} /> Remotion Bridge</span><strong>{activeProject.remotion_jobs?.length || 0} pacote(s)</strong></div>
            <div className="research-studio-remotion-body">
              <div>
                <PackageCheck size={30} />
                <span><strong>Contrato Remotion</strong><small>{activeProject.metrics?.approved || 0} materiais aprovados · {activeProject.scenes?.length || 0} cenas</small></span>
              </div>
              <div className="research-studio-remotion-actions">
                <button type="button" className="research-studio-remotion-send" onClick={handlePrepareRemotion} disabled={Boolean(busy)}>{busy === 'remotion' ? <Loader2 className="spin" size={18} /> : <Send size={18} />} Preparar para Remotion</button>
                <button
                  type="button"
                  className="research-studio-batch-download"
                  onClick={handleBatchDownload}
                  disabled={Boolean(busy) || selectedVideoCount === 0}
                  title={selectedVideoCount ? `${selectedVideoCount} vídeo(s) selecionado(s)` : 'Selecione vídeos nas cenas e salve a edição'}
                >
                  {busy === 'batch-download' ? <Loader2 className="spin" size={18} /> : <Download size={18} />} Baixar Lote
                </button>
              </div>
            </div>
            <div className="research-studio-job-list">
              {(activeProject.remotion_jobs || []).slice().reverse().map((job) => (
                <article key={job.id}>
                  <span><strong>{job.id}</strong><small>{STATUS_LABELS[job.status] || job.status} · {formatDate(job.created_at)}</small></span>
                  <div className="research-studio-job-actions">
                    <button type="button" onClick={() => handleDownloadJob(job)} disabled={busy === `job-${job.id}`}><Download size={16} /> Baixar pacote</button>
                    <button type="button" className="open-bridge" onClick={() => handleOpenLocalBridge(job)} disabled={busy === `bridge-${job.id}`}>
                      {busy === `bridge-${job.id}` ? <Loader2 className="spin" size={16} /> : <MonitorUp size={16} />} Abrir no Remotion
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="research-studio-welcome"><Search size={38} /><h2>Crie o primeiro projeto</h2></section>
      )}
    </div>
  );
}

export default ResearchStudio;
