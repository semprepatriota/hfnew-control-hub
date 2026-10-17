import React from 'react';
import { Sparkles, Languages, Type } from 'lucide-react';
import { emptyHeadline } from './headline.mjs';

export default function SceneHeadlineEditor({ value, rank, disabled, onChange, onGenerate }) {
  const h = { ...emptyHeadline(), ...value };
  const range = (key, label, min, max, step = .01) => <label className="t10-headline-range" key={key}>
    <span>{label}<output>{key === 'font_size' ? `${h[key]} px` : `${Math.round(h[key]*100)}%`}</output></span>
    <input aria-label={`${label} da headline ${rank}`} disabled={disabled} type="range" min={min} max={max} step={step} value={h[key]} onChange={e=>onChange({[key]:Number(e.target.value)})}/>
  </label>;
  return <details className="t10-scene-headline" onDragStart={e=>e.stopPropagation()}>
    <summary><Type size={13}/>Headline{h.enabled ? ' · ativa' : ' · sem headline'}</summary>
    <div className="t10-scene-headline-body">
      <label className="t10-checkbox"><input type="checkbox" disabled={disabled} checked={h.enabled} onChange={e=>onChange({enabled:e.target.checked})}/>Usar headline</label>
      <button type="button" className="t10-button hook" disabled={disabled} onClick={onGenerate} title="Ler 3 quadros desta cena, traduzir a legenda original e sugerir Hook + CTA para comedia"><Sparkles size={14}/>Hook + CTA</button>
      <label>Headline da cena<textarea aria-label={`Headline da cena ${rank}`} disabled={disabled} maxLength={400} rows={3} value={h.text} onChange={e=>onChange({text:e.target.value})}/></label>
      {h.hook_cta && <button type="button" className="t10-button" disabled={disabled} onClick={()=>onChange({text:h.hook_cta})} title={h.hook_cta}><Sparkles size={13}/>Usar Hook + CTA</button>}
      {(h.original_text || h.translation) && <details className="t10-caption-reading"><summary><Languages size={13}/>Original e tradução</summary>
        <label>Original<textarea readOnly rows={3} value={h.original_text}/></label>
        <label>Tradução<textarea aria-label={`Tradução da cena ${rank}`} disabled={disabled} rows={3} maxLength={1200} value={h.translation} onChange={e=>onChange({translation:e.target.value})}/></label>
        <button type="button" className="t10-button" disabled={disabled || !h.translation || h.translation.length>400} onClick={()=>onChange({text:h.translation})} title={h.translation.length>400 ? 'Reduza a traducao para ate 400 caracteres' : 'Usar esta traducao no lugar do Hook + CTA'}><Languages size={13}/>Usar tradução</button>
      </details>}
      <label className="t10-checkbox"><input type="checkbox" disabled={disabled} checked={h.cover_original} onChange={e=>onChange({cover_original:e.target.checked})}/>Cobrir escrita original</label>
      {range('font_size','Fonte',24,120,2)}
      {range('y','Posição Y',0,1-h.height)}
      {range('x','Posição X',0,1-h.width)}
      {range('width','Largura',.2,1)}
      {range('height','Altura',.06,.5)}
      {range('opacity','Opacidade da faixa',0,1)}
      <div className="t10-headline-colors">
        <label title="Cor da escrita">Texto<input type="color" aria-label={`Cor da headline ${rank}`} value={h.color} disabled={disabled} onChange={e=>onChange({color:e.target.value})}/></label>
        <label title="Cor da faixa">Faixa<input type="color" aria-label={`Cor da faixa ${rank}`} value={h.background} disabled={disabled} onChange={e=>onChange({background:e.target.value})}/></label>
      </div>
    </div>
  </details>;
}
