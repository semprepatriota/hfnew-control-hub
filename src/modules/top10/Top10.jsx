import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Player } from "@remotion/player";
import { useSearchParams } from "react-router-dom";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Film,
  GripVertical,
  ImagePlus,
  Loader,
  Music2,
  Play,
  Plus,
  RefreshCw,
  Save,
  Scissors,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import * as api from "./api";
import {
  buildTimeline,
  FPS,
  MODELS,
  swapScenes,
  timeLabel,
} from "./timeline.mjs";
import Top10Composition from "./Top10Composition";
import SceneHeadlineEditor from './SceneHeadlineEditor';
import { emptyHeadline, fixedHeadline, headlineImage, headlineStyle } from './headline.mjs';
import "./top10.css";

const clone = (value) => JSON.parse(JSON.stringify(value));
const running = (job) =>
  ["queued", "running", "cancelling"].includes(job?.status);
const draftKey = (id) => `hfnew:top10:draft:${id}`;

function Panel({ title, children, initial = true, trailing }) {
  const [open, setOpen] = useState(initial);
  return (
    <section className="t10-panel">
      <div className="t10-panel-heading">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          <span>{title}</span>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {trailing}
      </div>
      {open && <div className="t10-panel-body">{children}</div>}
    </section>
  );
}
function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  disabled,
}) {
  return (
    <label className="t10-slider">
      <span>
        {label}
        <output>{Number(value).toFixed(step < 1 ? 2 : 0)}</output>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
      />
    </label>
  );
}

export default function Top10() {
  const [searchParams] = useSearchParams();
  const requestedProject = searchParams.get("project") || "";
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [draft, setDraft] = useState(null);
  const [selected, setSelected] = useState(0);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState("");
  const [editVersion, setEditVersion] = useState(0);
  const [job, setJob] = useState(null);
  const [frame, setFrame] = useState(0);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const player = useRef(null);
  const trimPlayer = useRef(null);
  const uploadInput = useRef(null);
  const replacementSlot = useRef(null);
  const headlineBusy = useRef(false);
  const current = useRef(null);
  const draftRef = useRef(null);
  const dirty = useRef(false);
  const generation = useRef(0);
  const saveQueue = useRef(Promise.resolve());
  const mounted = useRef(true);
  const busy = Boolean(action) || running(job);
  const config = draft?.config;
  const items = useMemo(
    () => (project && config ? buildTimeline(project, config) : []),
    [project, config],
  );
  const durationFrames = items.length
    ? items.at(-1).from + items.at(-1).frames
    : 30;
  const filled =
    config?.scenes.filter((scene) => project?.assets[scene.asset_id]).length ||
    0;
  const scene = config?.scenes[selected];
  const asset = project?.assets[scene?.asset_id];

  const refresh = useCallback(async () => {
    const data = await api.listProjects();
    if (mounted.current) setProjects(data.projects);
    return data.projects;
  }, []);
  const apply = useCallback((data) => {
    current.current = data;
    let next = { title: data.title, config: clone(data.config) };
    let restored = false;
    try {
      const cached = JSON.parse(
        localStorage.getItem(draftKey(data.id)) || "null",
      );
      if (cached?.revision === data.revision && !running(data.job_state)) {
        next = cached.draft;
        restored = true;
      }
    } catch {
      /* A corrupted local draft must not prevent opening the saved project. */
    }
    draftRef.current = next;
    dirty.current = restored;
    generation.current += 1;
    setProject(data);
    setDraft(next);
    setJob(data.job_state || null);
    setFrame(0);
    setSaveState(restored ? "Ajustes recuperados" : "Salvo");
    setEditVersion((value) => value + 1);
  }, []);
  const saveCurrent = useCallback(() => {
    const task = async () => {
      while (dirty.current && current.current && draftRef.current) {
        const id = current.current.id;
        const version = generation.current;
        const payload = clone(draftRef.current);
        if (mounted.current) setSaveState("Salvando…");
        const saved = await api.saveProject(id, {
          ...payload,
          revision: current.current.revision,
        });
        if (current.current?.id !== id) return saved;
        current.current = saved;
        if (mounted.current) setProject(saved);
        if (version === generation.current) {
          dirty.current = false;
          localStorage.removeItem(draftKey(id));
          if (mounted.current) setSaveState("Salvo");
        } else {
          localStorage.setItem(
            draftKey(id),
            JSON.stringify({
              revision: saved.revision,
              draft: draftRef.current,
            }),
          );
        }
      }
      return current.current;
    };
    const result = saveQueue.current.catch(() => {}).then(task);
    saveQueue.current = result;
    return result;
  }, []);
  const change = (updater) => {
    const next = updater(clone(draftRef.current));
    draftRef.current = next;
    dirty.current = true;
    generation.current += 1;
    localStorage.setItem(
      draftKey(current.current.id),
      JSON.stringify({ revision: current.current.revision, draft: next }),
    );
    setDraft(next);
    setSaveState("Alterações pendentes");
    setEditVersion((value) => value + 1);
  };
  const update = (key, value) => {
    change((next) => ({ ...next, config: { ...next.config, [key]: value } }));
    if (key === "model") {
      const destination = buildTimeline(current.current, draftRef.current.config).find(item => item.kind === 'scene' && item.slot === selected)?.from || 0;
      player.current?.pause();
      player.current?.seekTo(destination);
      setFrame(destination);
    }
  };
  const updateScene = (key, value) =>
    change((next) => {
      next.config.scenes[selected][key] = value;
      return next;
    });
  const updateHeadline = (slot, patch) => change(next => {
    const h = fixedHeadline({ ...next.config.scenes[slot].headline, ...patch });
    next.config.scenes[slot].headline = h;
    return next;
  });
  const generateHeadline = async (slot) => {
    if (headlineBusy.current || busy) return;
    headlineBusy.current = true;
    try {
      await perform(`Analisando cena ${10-slot}`, async () => {
        const saved = await saveCurrent();
        const version = generation.current;
        const entry = saved.config.scenes[slot];
        const result = await api.generateSceneHeadline(saved.id, slot, {
          revision: saved.revision, asset_id: entry.asset_id,
          request_id: crypto.randomUUID().replaceAll('-', ''),
        });
        let captionBox = null;
        let locationWarning = false;
        if (result.text_found) {
          try {
            if (result.reference_frame_url) {
              const { locateOriginalCaption } = await import('./caption-locator.mjs');
              captionBox = await locateOriginalCaption(api.mediaUrl(result.reference_frame_url), result.original_text);
            }
          } catch { /* Keep the translation, but never apply an unverified cover. */ }
          locationWarning = !captionBox;
        }
        if (!mounted.current) return;
        if (current.current?.id !== saved.id || generation.current !== version) throw new Error('A cena mudou durante a analise. O texto nao foi substituido.');
        updateHeadline(slot, { ...fixedHeadline(entry.headline, captionBox), text: result.translation && result.translation.length <= 400 ? result.translation : result.headline,
          hook_cta: result.headline, original_text: result.original_text, translation: result.translation,
          ...(locationWarning ? {enabled:false} : {}) });
        await saveCurrent();
        setNotice(locationWarning ? `Cena ${10-slot}: traducao salva, mas a posicao da legenda nao foi confirmada. A cobertura ficou desativada para nao cobrir a cena no lugar errado.` : `Cena ${10-slot}: leitura de 3 quadros concluida. Confira o texto e ative a headline se desejar.`);
      });
    } finally { headlineBusy.current = false; }
  };
  useEffect(() => {
    let active = true;
    mounted.current = true;
    refresh()
      .then(async (data) => {
        const selected = requestedProject ? await api.loadProject(requestedProject) : data[0];
        if (active && mounted.current && selected) apply(selected);
      })
      .catch((caught) => { if (active) setError(caught.message); });
    return () => {
      active = false;
      mounted.current = false;
      saveCurrent().catch(() => {});
    };
  }, [refresh, apply, saveCurrent, requestedProject]);
  useEffect(() => {
    if (!dirty.current || running(job)) return;
    const timer = setTimeout(
      () =>
        saveCurrent().catch((caught) => {
          setError(caught.message);
          setSaveState("Não salvo");
        }),
      900,
    );
    return () => clearTimeout(timer);
  }, [editVersion, job, saveCurrent]);
  useEffect(() => {
    if (!project?.id || !running(job)) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const result = await api.getExport(project.id, job.id);
        if (stopped) return;
        setJob(result);
        if (!running(result)) {
          clearInterval(timer);
          if (result.status === "failed") {
            apply(await api.loadProject(project.id));
            setError(result.error || "A exportação falhou");
          }
          if (result.status === "completed") {
            apply(await api.loadProject(project.id));
            setNotice("MP4 pronto para baixar");
            refresh().catch(() => {});
          }
          if (result.status === "cancelled") {
            apply(await api.loadProject(project.id));
            setNotice("Exportação cancelada");
          }
        }
      } catch (caught) {
        if (!stopped) setError(`Acompanhamento: ${caught.message}`);
      }
    }, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [project?.id, job?.id, job?.status, apply, refresh]);
  useEffect(() => {
    const instance = player.current;
    if (!instance) return;
    const listener = (event) => setFrame(event.detail.frame);
    instance.addEventListener("frameupdate", listener);
    return () => instance.removeEventListener("frameupdate", listener);
  }, [project?.id]);
  useEffect(() => {
    const video = trimPlayer.current;
    if (video && scene && video.readyState >= 1)
      video.currentTime = scene.start;
  }, [selected, scene?.asset_id]);

  const perform = async (name, task) => {
    setAction(name);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setAction("");
    }
  };
  const selectProject = (id) =>
    perform("Abrindo projeto", async () => {
      await saveCurrent();
      apply(await api.loadProject(id));
      setSelected(0);
    });
  const create = () =>
    perform("Criando projeto", async () => {
      await saveCurrent();
      const data = await api.createProject("Novo TOP 10");
      apply(data);
      await refresh();
    });
  const removeProject = () => {
    if (!window.confirm(`Excluir o projeto “${draft.title}” e seus arquivos?`))
      return;
    perform("Excluindo projeto", async () => {
      await saveCurrent();
      const id = current.current.id;
      await api.deleteProject(id);
      localStorage.removeItem(draftKey(id));
      current.current = null;
      draftRef.current = null;
      dirty.current = false;
      setProject(null);
      setDraft(null);
      setJob(null);
      const data = await refresh();
      if (data.length) apply(data[0]);
    });
  };
  const upload = (kind, files, slot = null) => {
    if (!files?.length || !project) return;
    const incoming = Array.from(files);
    perform("Enviando arquivos", async () => {
      await saveCurrent();
      const slots =
        slot == null
          ? current.current.config.scenes
              .map((item, index) => (!item.asset_id ? index : null))
              .filter((item) => item != null)
          : [slot];
      if (kind === "video" && incoming.length > slots.length)
        throw new Error(
          `Há ${slots.length} espaços livres. Envie até essa quantidade ou substitua uma cena.`,
        );
      for (let i = 0; i < incoming.length; i += 1) {
        setAction(`Enviando ${i + 1}/${incoming.length}`);
        const data = await api.uploadAsset(
          project.id,
          kind,
          kind === "video" ? slots[i] : null,
          incoming[i],
        );
        localStorage.removeItem(draftKey(project.id));
        apply(data);
      }
      await refresh();
    });
  };
  const removeAsset = (id) => {
    if (!id || !window.confirm("Excluir este arquivo do projeto?")) return;
    perform("Excluindo arquivo", async () => {
      await saveCurrent();
      apply(await api.deleteAsset(project.id, id));
      await refresh();
    });
  };
  const seek = (item, play = false) => {
    if (!item) return;
    player.current?.pause();
    setSelected(item.slot);
    player.current?.seekTo(item.from);
    setFrame(item.from);
    if (play) player.current?.play();
  };
  const sceneItem = (slot) => items.find((item) => item.kind === "scene" && item.slot === slot);
  const selectScene = (slot, play = false) => {
    setSelected(slot);
    seek(sceneItem(slot), play);
  };
  const exportVideo = () =>
    perform("Preparando exportação", async () => {
      const saved = await saveCurrent();
      const result = await api.startExport(saved.id, saved.revision);
      setJob(result);
    });
  const setCut = (key, value) => {
    if (!asset) return;
    const safe = Math.max(0, Math.min(asset.duration, Math.round((Number(value) || 0) * FPS) / FPS));
    if (key === "start" && safe >= (scene.end || asset.duration) - 0.067)
      return;
    if (key === "end" && safe <= scene.start + 0.067) return;
    updateScene(key, safe);
    player.current?.pause();
    player.current?.seekTo(sceneItem(selected)?.from || 0);
    if (trimPlayer.current) trimPlayer.current.currentTime = safe;
  };
  const download = async () => {
    setError("");
    setDownloadProgress(0);
    try {
      const result = await api.downloadMP4(
        project.last_render,
        setDownloadProgress,
      );
      if (result === "saved") setNotice("MP4 salvo no computador");
    } catch (caught) {
      setError(caught.message);
    } finally {
      setDownloadProgress(null);
    }
  };
  const logo = project?.assets[project.logo];
  const music = project?.assets[project.music];

  return (
    <main className="top10">
      <header className="t10-header">
        <div>
          <h1>TOP 10</h1>
          <span>
            {filled}/10 cenas · {timeLabel(durationFrames / FPS)}
          </span>
        </div>
        <div className="t10-header-actions">
          {saveState && (
            <span className="t10-save-state">
              {saveState === "Salvo" && <Check size={13} />}
              {saveState}
            </span>
          )}
          <button
            className="t10-button"
            onClick={() => perform("Salvando", () => saveCurrent())}
            disabled={!project || busy}
            title="Salvar projeto"
          >
            <Save size={16} />
          </button>
          <button
            className="t10-button primary"
            onClick={create}
            disabled={busy}
          >
            <Plus size={16} /> Novo projeto
          </button>
        </div>
      </header>
      {error && (
        <div className="t10-alert" role="alert">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Fechar erro">
            <X size={15} />
          </button>
        </div>
      )}
      {notice && (
        <div className="t10-notice" role="status">
          {notice}
        </div>
      )}
      <Panel title="Projetos" initial={false}>
        <div className="t10-project-list">
          {projects.map((item) => (
            <button
              key={item.id}
              className={project?.id === item.id ? "selected" : ""}
              onClick={() => selectProject(item.id)}
              disabled={busy}
            >
              <Film size={16} />
              <span>{item.title}</span>
              <small>
                {item.config.scenes.filter((entry) => entry.asset_id).length}/10
              </small>
            </button>
          ))}
        </div>
        {project && (
          <div className="t10-project-name">
            <input
              aria-label="Nome do projeto"
              value={draft.title}
              maxLength={120}
              onChange={(event) =>
                change((next) => ({ ...next, title: event.target.value }))
              }
              disabled={busy}
            />
            <button
              className="t10-button danger"
              onClick={removeProject}
              disabled={busy}
            >
              <Trash2 size={15} /> Excluir projeto
            </button>
          </div>
        )}
      </Panel>
      {!project ? (
        <div className="t10-empty">
          <Film size={34} />
          <button
            className="t10-button primary"
            onClick={create}
            disabled={busy}
          >
            <Plus size={16} /> Criar TOP 10
          </button>
        </div>
      ) : (
        <>
          <div className="t10-editor">
            <div className="t10-preview-column">
              <div className="t10-subheading">
                <h2>Preview da montagem</h2>
                <span>
                  {timeLabel(frame / FPS)} / {timeLabel(durationFrames / FPS)}
                </span>
              </div>
              <div className="t10-stage">
                <Player
                  key={project.id}
                  ref={player}
                  component={Top10Composition}
                  inputProps={{ project, config }}
                  durationInFrames={durationFrames}
                  compositionWidth={1080}
                  compositionHeight={1920}
                  fps={FPS}
                  controls
                  clickToPlay
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
              <div className="t10-preview-actions">
                <button
                  className="t10-button"
                  onClick={() => {
                    player.current?.seekTo(0);
                    player.current?.play();
                  }}
                >
                  <Play size={15} /> Assistir tudo
                </button>
                <button
                  className="t10-button export"
                  disabled={busy || filled === 0}
                  onClick={exportVideo}
                >
                  {running(job) ? (
                    <Loader size={16} className="t10-spin" />
                  ) : (
                    <Film size={16} />
                  )}{" "}
                  Exportar MP4
                </button>
              </div>
              {running(job) && (
                <div className="t10-progress">
                  <progress max={100} value={job.progress} />
                  <span>
                    {job.status === "queued"
                      ? "Na fila"
                      : job.stage || "Exportando"}{" "}
                    · {job.progress}%
                  </span>
                  <button
                    className="t10-button danger"
                    disabled={job.status === "cancelling"}
                    onClick={() =>
                      api
                        .cancelExport(project.id, job.id)
                        .then(setJob)
                        .catch((caught) => setError(caught.message))
                    }
                  >
                    <X size={14} /> Cancelar
                  </button>
                </div>
              )}
            </div>
            <aside className="t10-inspector">
              <Panel title="Modelo de contador">
                <div className="t10-models">
                  {MODELS.map((model) => (
                    <button
                      key={model.id}
                      className={config.model === model.id ? "selected" : ""}
                      onClick={() => update("model", model.id)}
                      disabled={busy}
                      aria-pressed={config.model === model.id}
                    >
                      <video
                        src={api.counterUrl(model.id, 10)}
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        onLoadedMetadata={(event) => { event.currentTarget.currentTime = 0.5; }}
                        onMouseEnter={(event) =>
                          event.currentTarget.play().catch(() => {})
                        }
                        onMouseLeave={(event) => {
                          event.currentTarget.pause();
                          event.currentTarget.currentTime = 0.5;
                        }}
                      />
                      <span>
                        {model.label}
                        {config.model === model.id && <Check size={14} />}
                      </span>
                    </button>
                  ))}
                </div>
              </Panel>
              <Panel title={`Ajustar cena ${10 - selected}`}>
                <div className="t10-scene-tabs">
                  {Array.from({ length: 10 }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => selectScene(i)}
                      className={selected === i ? "selected" : ""}
                      aria-label={`Editar cena ${10 - i}`}
                    >
                      {10 - i}
                    </button>
                  ))}
                </div>
                {asset ? (
                  <>
                    <video
                      key={asset.id}
                      ref={trimPlayer}
                      className="t10-trim-video"
                      src={api.mediaUrl(asset.url)}
                      controls
                      playsInline
                      preload="metadata"
                      onLoadedMetadata={(event) => {
                        event.currentTarget.currentTime = scene.start;
                      }}
                      onTimeUpdate={(event) => {
                        const video = event.currentTarget;
                        if (
                          !video.paused &&
                          video.currentTime >= (scene.end || asset.duration)
                        ) {
                          video.pause();
                          video.currentTime = scene.start;
                        }
                      }}
                    />
                    <div className="t10-trim-controls">
                      <label>
                        Início (s)
                        <input
                          type="number"
                          aria-label="Início do corte"
                          value={Number(scene.start.toFixed(3))}
                          min={0}
                          max={asset.duration}
                          step={1 / FPS}
                          disabled={busy}
                          onChange={(event) =>
                            setCut("start", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Fim (s)
                        <input
                          type="number"
                          aria-label="Fim do corte"
                          value={Number(
                            (scene.end || asset.duration).toFixed(3),
                          )}
                          min={0}
                          max={asset.duration}
                          step={1 / FPS}
                          disabled={busy}
                          onChange={(event) =>
                            setCut("end", event.target.value)
                          }
                        />
                      </label>
                    </div>
                    <div className="t10-cut-buttons">
                      <button
                        className="t10-button"
                        disabled={busy}
                        onClick={() =>
                          setCut("start", trimPlayer.current?.currentTime)
                        }
                        title="Marcar início no tempo atual"
                      >
                        <Scissors size={14} /> Início aqui
                      </button>
                      <button
                        className="t10-button"
                        disabled={busy}
                        onClick={() =>
                          setCut("end", trimPlayer.current?.currentTime)
                        }
                        title="Marcar fim no tempo atual"
                      >
                        <Scissors size={14} /> Fim aqui
                      </button>
                      <button
                        className="t10-button"
                        disabled={busy}
                        onClick={() =>
                          change((next) => {
                            Object.assign(next.config.scenes[selected], {
                              start: 0,
                              end: asset.duration,
                              x: 0.5,
                              y: 0.5,
                              zoom: 1,
                            });
                            return next;
                          })
                        }
                        title="Restaurar corte e enquadramento"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                    <Slider
                      label="Início"
                      min={0}
                      max={asset.duration}
                      step={1 / FPS}
                      value={scene.start}
                      onChange={(value) => setCut("start", value)}
                      disabled={busy}
                    />
                    <Slider
                      label="Fim"
                      min={0}
                      max={asset.duration}
                      step={1 / FPS}
                      value={scene.end || asset.duration}
                      onChange={(value) => setCut("end", value)}
                      disabled={busy}
                    />
                    <Slider
                      label="Posição horizontal"
                      value={scene.x}
                      onChange={(value) => updateScene("x", value)}
                      disabled={busy}
                    />
                    <Slider
                      label="Posição vertical"
                      value={scene.y}
                      onChange={(value) => updateScene("y", value)}
                      disabled={busy}
                    />
                    <Slider
                      label="Zoom"
                      min={1}
                      max={3}
                      value={scene.zoom}
                      onChange={(value) => updateScene("zoom", value)}
                      disabled={busy}
                    />
                    <Slider
                      label="Volume da cena"
                      max={1}
                      value={scene.volume}
                      onChange={(value) => updateScene("volume", value)}
                      disabled={busy}
                    />
                    <button
                      className="t10-button primary"
                      onClick={() => selectScene(selected, true)}
                    >
                      <Play size={15} /> Assistir corte na montagem
                    </button>
                  </>
                ) : (
                  <button
                    className="t10-upload-empty"
                    disabled={busy}
                    onClick={() => {
                      replacementSlot.current = selected;
                      uploadInput.current.click();
                    }}
                  >
                    <Upload size={22} /> Adicionar cena {10 - selected}
                  </button>
                )}
              </Panel>
            </aside>
          </div>
          <Panel title={`Timeline · ${items.length} blocos`}>
            <div className="t10-timeline">
              {items.filter((item) => item.kind === "counter").map(({ slot }) => (
                <div className="t10-timeline-pair" key={slot}>
                  {items.filter((item) => item.slot === slot).map((item) => (
                    <button
                      key={item.kind}
                      className={`${item.kind} ${frame >= item.from && frame < item.from + item.frames ? "active" : ""}`}
                      onClick={() => seek(item)}
                      title={`${item.kind === "counter" ? "Contador" : "Cena"} ${item.rank} · ${(item.frames / FPS).toFixed(2)}s`}
                    >
                      {item.kind === "counter" ? (
                        <strong>{item.rank}</strong>
                      ) : item.asset?.thumbnail_url ? (
                        <img
                          src={api.mediaUrl(item.asset.thumbnail_url)}
                          alt={`Cena ${item.rank}`}
                          loading="lazy"
                        />
                      ) : (
                        <Film size={20} />
                      )}
                      <span>
                        {item.kind === "counter" ? "Contador" : "Cena"}{" "}
                        {item.rank}
                      </span>
                      <small>{(item.frames / FPS).toFixed(2)}s</small>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </Panel>
          <Panel
            title={`Cenas · ${filled}/10`}
            trailing={
              <button
                className="t10-button primary"
                disabled={busy || filled === 10}
                onClick={() => {
                  replacementSlot.current = null;
                  uploadInput.current.multiple = true;
                  uploadInput.current.click();
                }}
              >
                <Upload size={15} /> Enviar cenas
              </button>
            }
          >
            <input
              ref={uploadInput}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
              multiple={replacementSlot.current == null}
              hidden
              onChange={(event) => {
                upload("video", event.target.files, replacementSlot.current);
                event.currentTarget.value = "";
              }}
            />
            <div className="t10-scene-grid">
              {config.scenes.map((entry, slot) => {
                const media = project.assets[entry.asset_id];
                return (
                  <article
                    key={slot}
                    className={`t10-scene-card ${selected === slot ? "selected" : ""}`}
                    draggable={Boolean(media) && !busy}
                    onDragStart={(event) =>
                      event.dataTransfer.setData(
                        "application/x-top10-scene",
                        String(slot),
                      )
                    }
                    onDragOver={(event) => {
                      if (!busy) event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const raw = event.dataTransfer.getData(
                        "application/x-top10-scene",
                      );
                      if (raw && !busy) {
                        change((next) => ({
                          ...next,
                          config: swapScenes(next.config, Number(raw), slot),
                        }));
                        setSelected(slot);
                      }
                    }}
                  >
                    <div className="t10-scene-card-heading">
                      <span>
                        <GripVertical size={14} /> Cena {10 - slot}
                      </span>
                      {media && (
                        <button
                          className="t10-icon danger"
                          aria-label={`Excluir cena ${10 - slot}`}
                          disabled={busy}
                          onClick={() => removeAsset(media.id)}
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                    <button
                      className="t10-scene-cover"
                      onClick={() => {
                        setSelected(slot);
                        if (media) selectScene(slot);
                      }}
                      aria-label={`Selecionar cena ${10 - slot}`}
                    >
                      {media?.thumbnail_url ? (
                        <span className="t10-scene-poster">
                          <img src={api.mediaUrl(media.thumbnail_url)} loading="lazy" alt={media.name} style={{position:'absolute', width:`${entry.zoom*100}%`, height:`${entry.zoom*100}%`,left:`${(1-entry.zoom)*entry.x*100}%`,top:`${(1-entry.zoom)*entry.y*100}%`,objectFit:'cover',objectPosition:`${entry.x*100}% ${entry.y*100}%`}}/>
                          {headlineImage(project, slot, entry) && <img src={api.mediaUrl(headlineImage(project, slot, entry).url)} alt="" style={headlineStyle(entry.headline)}/>}
                        </span>
                      ) : (
                        <Film size={28} />
                      )}
                      {media && <Play size={22} className="t10-play-icon" />}
                    </button>
                    <div className="t10-scene-card-footer">
                      <span title={media?.name}>
                        {media
                          ? `${((entry.end || media.duration) - entry.start).toFixed(2)}s · ${media.name}`
                          : "Vazio"}
                      </span>
                      <button
                        className="t10-icon"
                        disabled={busy}
                        title={media ? "Substituir cena" : "Adicionar cena"}
                        onClick={() => {
                          replacementSlot.current = slot;
                          uploadInput.current.multiple = false;
                          uploadInput.current.click();
                        }}
                      >
                        <Upload size={15} />
                      </button>
                    </div>
                    <div className="t10-reorder">
                      <button
                        disabled={busy || slot === 0}
                        onClick={() =>
                          change((next) => ({
                            ...next,
                            config: swapScenes(next.config, slot, slot - 1),
                          }))
                        }
                        aria-label={`Mover cena ${10 - slot} para antes`}
                      >
                        ←
                      </button>
                      <button
                        disabled={busy || slot === 9}
                        onClick={() =>
                          change((next) => ({
                            ...next,
                            config: swapScenes(next.config, slot, slot + 1),
                          }))
                        }
                        aria-label={`Mover cena ${10 - slot} para depois`}
                      >
                        →
                      </button>
                      <button onClick={() => selectScene(slot)} disabled={busy}>
                        <Scissors size={13} /> Ajustar
                      </button>
                    </div>
                    {media && <SceneHeadlineEditor value={entry.headline} rank={10-slot} disabled={busy}
                      onChange={patch=>updateHeadline(slot,patch)} onGenerate={()=>generateHeadline(slot)}/>}
                  </article>
                );
              })}
            </div>
          </Panel>
          <div className="t10-bottom-grid">
            <Panel title="Música e efeitos" initial={false}>
              <div className="t10-file-row">
                <label className="t10-button">
                  <Music2 size={15} />{" "}
                  {music ? "Trocar música" : "Adicionar música"}
                  <input
                    hidden
                    type="file"
                    accept="audio/*"
                    disabled={busy}
                    onChange={(event) => {
                      upload("music", event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                {music && (
                  <>
                    <span title={music.name}>{music.name}</span>
                    <button
                      className="t10-icon danger"
                      disabled={busy}
                      onClick={() => removeAsset(music.id)}
                      aria-label="Excluir música"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
              {music && (
                <audio
                  controls
                  src={api.mediaUrl(music.url)}
                  preload="metadata"
                />
              )}
              <Slider
                label="Volume da música"
                value={config.music_volume}
                onChange={(value) => update("music_volume", value)}
                disabled={busy}
              />
              <Slider
                label="Efeitos dos contadores"
                value={config.counter_volume}
                max={1}
                onChange={(value) => update("counter_volume", value)}
                disabled={busy}
              />
            </Panel>
            <Panel title="Título e logo" initial={false}>
              <label className="t10-checkbox">
                <input
                  type="checkbox"
                  checked={config.title_enabled}
                  disabled={busy}
                  onChange={(event) =>
                    update("title_enabled", event.target.checked)
                  }
                />{" "}
                Usar título nas cenas
              </label>
              {config.title_enabled && (
                <>
                  <textarea
                    aria-label="Título do vídeo"
                    value={config.title}
                    maxLength={180}
                    disabled={busy}
                    onChange={(event) => update("title", event.target.value)}
                  />
                  <div className="t10-title-color">
                    <label>
                      Cor
                      <input
                        type="color"
                        value={config.title_color}
                        disabled={busy}
                        onChange={(event) =>
                          update("title_color", event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <Slider
                    label="Fonte"
                    value={config.title_size}
                    min={24}
                    max={120}
                    step={1}
                    onChange={(value) => update("title_size", value)}
                    disabled={busy}
                  />
                  <Slider
                    label="Posição do título"
                    value={config.title_y}
                    max={0.85}
                    onChange={(value) => update("title_y", value)}
                    disabled={busy}
                  />
                </>
              )}
              <div className="t10-file-row">
                <label className="t10-button">
                  <ImagePlus size={15} />{" "}
                  {logo ? "Trocar logo" : "Adicionar logo"}
                  <input
                    hidden
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={busy}
                    onChange={(event) => {
                      upload("logo", event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                {logo && (
                  <button
                    className="t10-icon danger"
                    disabled={busy}
                    onClick={() => removeAsset(logo.id)}
                    aria-label="Excluir logo"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              {logo && (
                <>
                  <label className="t10-checkbox">
                    <input
                      type="checkbox"
                      checked={config.logo_enabled}
                      disabled={busy}
                      onChange={(event) =>
                        update("logo_enabled", event.target.checked)
                      }
                    />{" "}
                    Usar logo
                  </label>
                  <Slider
                    label="Tamanho da logo"
                    value={config.logo_size}
                    min={0.04}
                    max={0.4}
                    onChange={(value) => update("logo_size", value)}
                    disabled={busy}
                  />
                  <Slider
                    label="Posição X"
                    value={config.logo_x}
                    onChange={(value) => update("logo_x", value)}
                    disabled={busy}
                  />
                  <Slider
                    label="Posição Y"
                    value={config.logo_y}
                    onChange={(value) => update("logo_y", value)}
                    disabled={busy}
                  />
                  <Slider
                    label="Opacidade"
                    value={config.logo_opacity}
                    onChange={(value) => update("logo_opacity", value)}
                    disabled={busy}
                  />
                </>
              )}
            </Panel>
          </div>
          {project.last_render && (
            <Panel title="Vídeo exportado">
              <div className="t10-result">
                <video
                  key={project.last_render.filename}
                  controls
                  playsInline
                  preload="metadata"
                  src={api.mediaUrl(project.last_render.url)}
                />
                <div>
                  <strong>{project.last_render.filename}</strong>
                  <span>
                    1080 × 1920 · {timeLabel(project.last_render.duration)}
                  </span>
                  <button
                    className="t10-button primary"
                    onClick={download}
                    disabled={downloadProgress != null}
                  >
                    <Download size={16} />{" "}
                    {downloadProgress == null
                      ? "Baixar MP4"
                      : `Salvando ${downloadProgress}%`}
                  </button>
                </div>
              </div>
            </Panel>
          )}
          {action && (
            <div className="t10-working" role="status">
              <Loader size={15} className="t10-spin" />
              {action}
            </div>
          )}
        </>
      )}
    </main>
  );
}
