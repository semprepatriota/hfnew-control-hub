import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  Film,
  GripVertical,
  Image,
  Layers3,
  Loader2,
  MonitorUp,
  Music,
  Palette,
  Save,
  Settings2,
} from 'lucide-react';
import './research-studio-editor.css';

const DEFAULT_GLOBAL = {
  background_color: '#05080c',
  accent_color: '#32e58b',
  text_color: '#ffffff',
  show_scene_number: true,
  show_credits: true,
  logo_url: '',
  logo_position: 'top-right',
  logo_size: 12,
  logo_opacity: 0.9,
  music_url: '',
  music_volume: 0.12,
  owned_media_confirmed: false,
};

function buildEditor(project) {
  const approved = (project.assets || []).filter((asset) => asset.status === 'approved' && ['image', 'video'].includes(asset.media_type));
  const saved = project.editor || {};
  const savedScenes = new Map((saved.scenes || []).map((scene) => [scene.scene_id, scene]));
  const scenes = (project.scenes || []).map((scene, index) => {
    const current = savedScenes.get(scene.id) || {};
    const assigned = approved.find((asset) => asset.id === current.asset_id)
      || approved.find((asset) => asset.scene_id === scene.id || scene.asset_ids?.includes(asset.id));
    return {
      scene_id: scene.id,
      order: Number(current.order || index + 1),
      enabled: current.enabled !== false,
      asset_id: current.asset_id || assigned?.id || '',
      title: current.title ?? scene.title ?? '',
      narration: current.narration ?? scene.narration ?? '',
      duration_seconds: Number(current.duration_seconds || scene.duration_seconds || 8),
      fit: current.fit || 'cover',
      position_x: Number(current.position_x ?? 50),
      position_y: Number(current.position_y ?? 50),
      scale: Number(current.scale ?? 100),
      show_title: current.show_title !== false,
      show_narration: current.show_narration !== false,
      transition: current.transition || 'fade',
    };
  }).sort((a, b) => a.order - b.order).map((scene, index) => ({ ...scene, order: index + 1 }));
  return {
    aspect_ratio: saved.aspect_ratio === '9:16' ? '9:16' : (project.aspect_ratio === '9:16' ? '9:16' : '16:9'),
    scenes,
    global_settings: { ...DEFAULT_GLOBAL, ...(saved.global_settings || {}) },
  };
}

function mediaUrl(asset) {
  return asset?.preview_url || asset?.original_url || '';
}

function ResearchStudioEditor({ project, busy, onSave, onOpenRemotion }) {
  const [open, setOpen] = useState(true);
  const [editor, setEditor] = useState(() => buildEditor(project));
  const [activeSceneId, setActiveSceneId] = useState(editor.scenes[0]?.scene_id || '');
  const [inspector, setInspector] = useState('scene');
  const [draggedId, setDraggedId] = useState('');

  useEffect(() => {
    const next = buildEditor(project);
    setEditor(next);
    setActiveSceneId((current) => next.scenes.some((scene) => scene.scene_id === current) ? current : (next.scenes[0]?.scene_id || ''));
  }, [project.id, project.updated_at]);

  const approvedAssets = useMemo(
    () => (project.assets || []).filter((asset) => asset.status === 'approved' && ['image', 'video'].includes(asset.media_type)),
    [project.assets],
  );
  const activeScene = editor.scenes.find((scene) => scene.scene_id === activeSceneId) || editor.scenes[0] || null;
  const activeAsset = approvedAssets.find((asset) => asset.id === activeScene?.asset_id) || null;
  const totalDuration = editor.scenes.filter((scene) => scene.enabled).reduce((sum, scene) => sum + Number(scene.duration_seconds || 0), 0);
  const dirty = JSON.stringify(editor) !== JSON.stringify(buildEditor(project));

  function updateScene(patch) {
    if (!activeScene) return;
    setEditor((current) => ({
      ...current,
      scenes: current.scenes.map((scene) => scene.scene_id === activeScene.scene_id ? { ...scene, ...patch } : scene),
    }));
  }

  function updateGlobal(patch) {
    setEditor((current) => ({
      ...current,
      global_settings: { ...current.global_settings, ...patch },
    }));
  }

  function moveScene(sceneId, direction) {
    setEditor((current) => {
      const scenes = [...current.scenes];
      const index = scenes.findIndex((scene) => scene.scene_id === sceneId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= scenes.length) return current;
      [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
      return { ...current, scenes: scenes.map((scene, order) => ({ ...scene, order: order + 1 })) };
    });
  }

  function dropScene(targetId) {
    if (!draggedId || draggedId === targetId) return;
    setEditor((current) => {
      const scenes = [...current.scenes];
      const from = scenes.findIndex((scene) => scene.scene_id === draggedId);
      const to = scenes.findIndex((scene) => scene.scene_id === targetId);
      if (from < 0 || to < 0) return current;
      const [moved] = scenes.splice(from, 1);
      scenes.splice(to, 0, moved);
      return { ...current, scenes: scenes.map((scene, order) => ({ ...scene, order: order + 1 })) };
    });
    setDraggedId('');
  }

  return (
    <section className={`research-studio-editor ${open ? '' : 'collapsed'}`}>
      <button type="button" className="research-studio-editor-heading" onClick={() => setOpen((value) => !value)}>
        <span><Layers3 size={18} /> Painel de Edição Remotion <strong>{editor.scenes.filter((scene) => scene.enabled).length} cenas · {totalDuration.toFixed(1)}s</strong></span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {open && (
        <div className="research-studio-editor-body">
          <div className="research-studio-editor-toolbar">
            <div className="research-studio-ratio" aria-label="Formato do vídeo">
              <button type="button" className={editor.aspect_ratio === '16:9' ? 'active' : ''} onClick={() => setEditor({ ...editor, aspect_ratio: '16:9' })}>16:9</button>
              <button type="button" className={editor.aspect_ratio === '9:16' ? 'active' : ''} onClick={() => setEditor({ ...editor, aspect_ratio: '9:16' })}>9:16</button>
            </div>
            <span className={dirty ? 'research-studio-editor-dirty active' : 'research-studio-editor-dirty'}>{dirty ? 'Alterações não salvas' : 'Edição salva'}</span>
            <button type="button" className="research-studio-editor-save" onClick={() => onSave(editor)} disabled={Boolean(busy) || !dirty}>
              {busy === 'editor-save' ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Salvar edição
            </button>
            <button type="button" className="research-studio-editor-open" onClick={() => onOpenRemotion(editor)} disabled={Boolean(busy) || !editor.scenes.some((scene) => scene.enabled && scene.asset_id)}>
              {busy === 'editor-remotion' ? <Loader2 className="spin" size={16} /> : <MonitorUp size={16} />} Atualizar no Remotion
            </button>
          </div>

          <div className="research-studio-editor-grid">
            <aside className="research-studio-editor-scenes">
              <div className="research-studio-editor-subheading"><span>Cenas</span><small>Arraste para ordenar</small></div>
              <div className="research-studio-editor-scene-list">
                {editor.scenes.map((scene, index) => {
                  const asset = approvedAssets.find((item) => item.id === scene.asset_id);
                  return (
                    <article
                      key={scene.scene_id}
                      draggable
                      className={`${scene.scene_id === activeScene?.scene_id ? 'active' : ''} ${scene.enabled ? '' : 'disabled'}`}
                      onDragStart={() => setDraggedId(scene.scene_id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => dropScene(scene.scene_id)}
                    >
                      <button type="button" className="drag" title="Arrastar cena" aria-label="Arrastar cena"><GripVertical size={15} /></button>
                      <button type="button" className="select" onClick={() => setActiveSceneId(scene.scene_id)}>
                        <b>{String(index + 1).padStart(2, '0')}</b>
                        <span><strong>{scene.title || `Cena ${index + 1}`}</strong><small>{asset?.title || 'Sem mídia'} · {scene.duration_seconds}s</small></span>
                      </button>
                      <div className="order-actions">
                        <button type="button" onClick={() => moveScene(scene.scene_id, -1)} disabled={index === 0} title="Mover para cima"><ChevronUp size={13} /></button>
                        <button type="button" onClick={() => moveScene(scene.scene_id, 1)} disabled={index === editor.scenes.length - 1} title="Mover para baixo"><ChevronDown size={13} /></button>
                      </div>
                      <button type="button" className="visibility" onClick={() => updateSceneFor(editor, setEditor, scene.scene_id, { enabled: !scene.enabled })} title={scene.enabled ? 'Desativar cena' : 'Ativar cena'}>
                        {scene.enabled ? <Eye size={15} /> : <EyeOff size={15} />}
                      </button>
                    </article>
                  );
                })}
              </div>
            </aside>

            <main className="research-studio-editor-preview-column">
              <div className={`research-studio-editor-preview ${editor.aspect_ratio === '9:16' ? 'vertical' : 'horizontal'}`} style={{ backgroundColor: editor.global_settings.background_color }}>
                {activeAsset ? (
                  activeAsset.media_type === 'video' ? (
                    <video key={activeAsset.id} src={mediaUrl(activeAsset)} controls muted loop playsInline style={{ objectFit: activeScene.fit, objectPosition: `${activeScene.position_x}% ${activeScene.position_y}%`, scale: activeScene.scale / 100 }} />
                  ) : (
                    <img src={mediaUrl(activeAsset)} alt="" style={{ objectFit: activeScene.fit, objectPosition: `${activeScene.position_x}% ${activeScene.position_y}%`, scale: activeScene.scale / 100 }} />
                  )
                ) : <div className="research-studio-editor-no-media"><Image size={38} /><span>Escolha uma mídia aprovada</span></div>}
                <div className="research-studio-editor-shade" />
                {activeScene?.enabled && (
                  <div className="research-studio-editor-copy" style={{ color: editor.global_settings.text_color }}>
                    {editor.global_settings.show_scene_number && <small style={{ color: editor.global_settings.accent_color }}>CENA {String(activeScene.order).padStart(2, '0')}</small>}
                    {activeScene.show_title && <strong>{activeScene.title}</strong>}
                    {activeScene.show_narration && activeScene.narration && <p>{activeScene.narration.length > 260 ? `${activeScene.narration.slice(0, 257)}...` : activeScene.narration}</p>}
                    <i style={{ backgroundColor: editor.global_settings.accent_color }} />
                  </div>
                )}
                {editor.global_settings.logo_url && <img className={`research-studio-editor-logo ${editor.global_settings.logo_position}`} src={editor.global_settings.logo_url} alt="Logo" style={{ width: `${editor.global_settings.logo_size}%`, opacity: editor.global_settings.logo_opacity }} />}
                {activeAsset && editor.global_settings.show_credits && (
                  <small className="research-studio-editor-credit">
                    {activeAsset.source}{activeAsset.creator ? ` / ${activeAsset.creator}` : ''}
                  </small>
                )}
              </div>
              <div className="research-studio-editor-timeline" aria-label="Timeline de cenas">
                {editor.scenes.filter((scene) => scene.enabled).map((scene) => (
                  <button key={scene.scene_id} type="button" className={scene.scene_id === activeScene?.scene_id ? 'active' : ''} style={{ flexGrow: Math.max(3, Number(scene.duration_seconds || 8)) }} onClick={() => setActiveSceneId(scene.scene_id)} title={`${scene.title} · ${scene.duration_seconds}s`}>
                    <span>{scene.order}</span>
                  </button>
                ))}
              </div>
            </main>

            <aside className="research-studio-editor-inspector">
              <div className="research-studio-editor-inspector-tabs">
                <button type="button" className={inspector === 'scene' ? 'active' : ''} onClick={() => setInspector('scene')}><Settings2 size={15} /> Cena</button>
                <button type="button" className={inspector === 'project' ? 'active' : ''} onClick={() => setInspector('project')}><Palette size={15} /> Projeto</button>
              </div>

              {inspector === 'scene' && activeScene && (
                <div className="research-studio-editor-controls">
                  <label>Mídia aprovada<select value={activeScene.asset_id} onChange={(event) => updateScene({ asset_id: event.target.value })}><option value="">Sem mídia</option>{approvedAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.media_type === 'video' ? 'Vídeo' : 'Imagem'} · {asset.title}</option>)}</select></label>
                  <label>Título<input maxLength={180} value={activeScene.title} onChange={(event) => updateScene({ title: event.target.value })} /></label>
                  <label>Texto<textarea rows={5} maxLength={5000} value={activeScene.narration} onChange={(event) => updateScene({ narration: event.target.value })} /></label>
                  <div className="research-studio-editor-inline">
                    <label>Duração<input type="number" min="3" max="90" step="0.5" value={activeScene.duration_seconds} onChange={(event) => updateScene({ duration_seconds: Number(event.target.value) })} /></label>
                    <label>Transição<select value={activeScene.transition} onChange={(event) => updateScene({ transition: event.target.value })}><option value="none">Sem efeito</option><option value="fade">Suave</option><option value="slide">Deslizar</option><option value="zoom">Zoom</option></select></label>
                  </div>
                  <div className="research-studio-editor-inline">
                    <label>Enquadramento<select value={activeScene.fit} onChange={(event) => updateScene({ fit: event.target.value })}><option value="cover">Preencher</option><option value="contain">Imagem inteira</option></select></label>
                    <label>Zoom <output>{activeScene.scale}%</output><input type="range" min="100" max="180" value={activeScene.scale} onChange={(event) => updateScene({ scale: Number(event.target.value) })} /></label>
                  </div>
                  <label>Posição horizontal <output>{activeScene.position_x}%</output><input type="range" min="0" max="100" value={activeScene.position_x} onChange={(event) => updateScene({ position_x: Number(event.target.value) })} /></label>
                  <label>Posição vertical <output>{activeScene.position_y}%</output><input type="range" min="0" max="100" value={activeScene.position_y} onChange={(event) => updateScene({ position_y: Number(event.target.value) })} /></label>
                  <div className="research-studio-editor-toggles">
                    <label><input type="checkbox" checked={activeScene.enabled} onChange={(event) => updateScene({ enabled: event.target.checked })} /> Cena ativa</label>
                    <label><input type="checkbox" checked={activeScene.show_title} onChange={(event) => updateScene({ show_title: event.target.checked })} /> Mostrar título</label>
                    <label><input type="checkbox" checked={activeScene.show_narration} onChange={(event) => updateScene({ show_narration: event.target.checked })} /> Mostrar texto</label>
                  </div>
                </div>
              )}

              {inspector === 'project' && (
                <div className="research-studio-editor-controls">
                  <div className="research-studio-editor-colors">
                    <label>Fundo<input type="color" value={editor.global_settings.background_color} onChange={(event) => updateGlobal({ background_color: event.target.value })} /></label>
                    <label>Destaque<input type="color" value={editor.global_settings.accent_color} onChange={(event) => updateGlobal({ accent_color: event.target.value })} /></label>
                    <label>Texto<input type="color" value={editor.global_settings.text_color} onChange={(event) => updateGlobal({ text_color: event.target.value })} /></label>
                  </div>
                  <label>URL HTTPS da logo<input type="url" placeholder="https://.../logo.png" value={editor.global_settings.logo_url || ''} onChange={(event) => updateGlobal({ logo_url: event.target.value })} /></label>
                  <div className="research-studio-editor-inline">
                    <label>Posição<select value={editor.global_settings.logo_position} onChange={(event) => updateGlobal({ logo_position: event.target.value })}><option value="top-left">Superior esquerda</option><option value="top-right">Superior direita</option><option value="bottom-left">Inferior esquerda</option><option value="bottom-right">Inferior direita</option></select></label>
                    <label>Tamanho <output>{editor.global_settings.logo_size}%</output><input type="range" min="4" max="30" value={editor.global_settings.logo_size} onChange={(event) => updateGlobal({ logo_size: Number(event.target.value) })} /></label>
                  </div>
                  <label>Opacidade da logo <output>{Math.round(editor.global_settings.logo_opacity * 100)}%</output><input type="range" min="0.1" max="1" step="0.05" value={editor.global_settings.logo_opacity} onChange={(event) => updateGlobal({ logo_opacity: Number(event.target.value) })} /></label>
                  <label><Music size={14} /> URL HTTPS da música<input type="url" placeholder="https://.../musica.mp3" value={editor.global_settings.music_url || ''} onChange={(event) => updateGlobal({ music_url: event.target.value })} /></label>
                  <label>Volume da música <output>{Math.round(editor.global_settings.music_volume * 100)}%</output><input type="range" min="0" max="1" step="0.01" value={editor.global_settings.music_volume} onChange={(event) => updateGlobal({ music_volume: Number(event.target.value) })} /></label>
                  <div className="research-studio-editor-toggles">
                    <label><input type="checkbox" checked={editor.global_settings.show_scene_number} onChange={(event) => updateGlobal({ show_scene_number: event.target.checked })} /> Número da cena</label>
                    <label><input type="checkbox" checked={editor.global_settings.show_credits} onChange={(event) => updateGlobal({ show_credits: event.target.checked })} /> Crédito da mídia</label>
                    <label className="rights"><input type="checkbox" checked={editor.global_settings.owned_media_confirmed} onChange={(event) => updateGlobal({ owned_media_confirmed: event.target.checked })} /> Confirmo que possuo direitos sobre a logo e a música informadas.</label>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      )}
    </section>
  );
}

function updateSceneFor(editor, setEditor, sceneId, patch) {
  setEditor({
    ...editor,
    scenes: editor.scenes.map((scene) => scene.scene_id === sceneId ? { ...scene, ...patch } : scene),
  });
}

export default ResearchStudioEditor;
