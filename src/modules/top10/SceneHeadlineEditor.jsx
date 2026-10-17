import React from 'react';
import { Sparkles, Languages, Type } from 'lucide-react';
import { emptyHeadline } from './headline.mjs';

export default function SceneHeadlineEditor({ value, rank, disabled, onChange, onGenerate }) {
  const h = { ...emptyHeadline(), ...value };
  return <div className="t10-scene-headline" onDragStart={e=>e.stopPropagation()}>
    <button type="button" className="t10-button hook t10-scene-generate" disabled={disabled} onClick={onGenerate} title="Ler a legenda de 3 quadros, traduzir para portugues e criar Hook + CTA de comedia"><Languages size={14}/>Hook + CTA</button>
    <details>
    <summary><Type size={13}/>Headline e tradução{h.enabled ? ' · ativa' : ' · opcional'}</summary>
    <div className="t10-scene-headline-body">
      <label className="t10-checkbox"><input type="checkbox" disabled={disabled} checked={h.enabled} onChange={e=>onChange({enabled:e.target.checked})}/>Usar headline</label>
      <label>Headline da cena<textarea aria-label={`Headline da cena ${rank}`} disabled={disabled} maxLength={400} rows={3} value={h.text} onChange={e=>onChange({text:e.target.value})}/></label>
      {h.hook_cta && <button type="button" className="t10-button" disabled={disabled} onClick={()=>onChange({text:h.hook_cta})} title={h.hook_cta}><Sparkles size={13}/>Usar Hook + CTA</button>}
      {(h.original_text || h.translation) && <details className="t10-caption-reading"><summary><Languages size={13}/>Original e tradução</summary>
        <label>Original<textarea readOnly rows={3} value={h.original_text}/></label>
        <label>Tradução<textarea aria-label={`Tradução da cena ${rank}`} disabled={disabled} rows={3} maxLength={1200} value={h.translation} onChange={e=>onChange({translation:e.target.value})}/></label>
        <button type="button" className="t10-button" disabled={disabled || !h.translation || h.translation.length>400} onClick={()=>onChange({text:h.translation})} title={h.translation.length>400 ? 'Reduza a traducao para ate 400 caracteres' : 'Usar esta traducao no lugar do Hook + CTA'}><Languages size={13}/>Usar tradução</button>
      </details>}
    </div>
    </details>
  </div>;
}
