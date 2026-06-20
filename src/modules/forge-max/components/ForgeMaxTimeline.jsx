import { ArrowDown, ArrowUp, Clock3, ListVideo, Scissors, X } from 'lucide-react';

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function ForgeMaxTimeline({ assets, clips, selectedClipId, busy, onSelect, onMove, onRemove, onTrim }) {
  const totalDuration = clips.reduce((total, clip) => total + Math.max(0, clip.end_seconds - clip.start_seconds), 0);

  return (
    <section className="forge-max-timeline-panel">
      <div className="forge-max-timeline-header">
        <div>
          <span className="forge-max-section-icon"><ListVideo size={17} /></span>
          <h2>Timeline de Edição</h2>
          <p>Organize a ordem e os cortes. Cada alteração é salva no projeto atual.</p>
        </div>
        <div className="forge-max-timeline-summary">
          <Clock3 size={15} />
          <strong>{clips.length} clipes</strong>
          <span>{formatDuration(totalDuration)}</span>
        </div>
      </div>

      {!clips.length ? (
        <div className="forge-max-timeline-empty">
          <Scissors size={26} />
          <strong>A timeline está vazia</strong>
          <span>Selecione um vídeo da biblioteca e use “Adicionar selecionado à timeline”.</span>
        </div>
      ) : (
        <div className="forge-max-timeline-track">
          {clips.map((clip, index) => {
            const asset = assets.find((item) => item.id === clip.asset_id);
            if (!asset) return null;
            const clipDuration = Math.max(clip.end_seconds - clip.start_seconds, 0.1);
            return (
              <article
                key={clip.id}
                className={`forge-max-timeline-clip ${clip.id === selectedClipId ? 'selected' : ''}`}
                style={{ flexGrow: Math.max(clipDuration, 8) }}
                onClick={() => onSelect(clip)}
              >
                <div className="forge-max-timeline-clip-title">
                  <span>V{index + 1}</span>
                  <strong title={asset.filename}>{asset.filename}</strong>
                </div>
                <div className="forge-max-timeline-clip-meta">
                  <span>{formatDuration(clip.start_seconds)} - {formatDuration(clip.end_seconds)}</span>
                  <span>{formatDuration(clipDuration)}</span>
                </div>
                <div className="forge-max-timeline-trim" onClick={(event) => event.stopPropagation()}>
                  <label>
                    <span>Início</span>
                    <input
                      type="number"
                      min="0"
                      max={asset.duration}
                      step="0.1"
                      defaultValue={clip.start_seconds}
                      onBlur={(event) => onTrim(clip.id, { start_seconds: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>Fim</span>
                    <input
                      type="number"
                      min="0.1"
                      max={asset.duration}
                      step="0.1"
                      defaultValue={clip.end_seconds}
                      onBlur={(event) => onTrim(clip.id, { end_seconds: event.target.value })}
                    />
                  </label>
                </div>
                <div className="forge-max-timeline-controls" onClick={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => onMove(clip.id, -1)} disabled={index === 0 || Boolean(busy)} aria-label="Mover clipe para cima" title="Mover para cima"><ArrowUp size={14} /></button>
                  <button type="button" onClick={() => onMove(clip.id, 1)} disabled={index === clips.length - 1 || Boolean(busy)} aria-label="Mover clipe para baixo" title="Mover para baixo"><ArrowDown size={14} /></button>
                  <button type="button" className="forge-max-timeline-remove" onClick={() => onRemove(clip.id)} disabled={Boolean(busy)} aria-label="Remover da timeline" title="Remover da timeline"><X size={14} /></button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default ForgeMaxTimeline;
