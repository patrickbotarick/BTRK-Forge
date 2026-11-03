import { useId, useState } from 'react';
import type { ComponentStyle } from '../../../packages/project-schema';

type Dimension = ComponentStyle['width'];

export function DimensionField({label,value,apply}:{
  label:string;value:Dimension|undefined;apply:(value:Dimension)=>void;
}){
  const [mode,setMode]=useState(value===undefined?'':typeof value==='number'?'px':value);
  const [pixels,setPixels]=useState(typeof value==='number'?String(value):'');
  const [error,setError]=useState('');
  const errorId=useId();
  return <form noValidate onSubmit={event=>{
    event.preventDefault();
    if(mode==='auto'||mode==='fill'){apply(mode);return;}
    const number=Number(pixels);
    if(mode!=='px'||!pixels.trim()||!Number.isInteger(number)||number<0||number>2000){
      setError('Informe um inteiro entre 0 e 2000 pixels.');
      return;
    }
    apply(number);
  }}>
    <label>{label}<select aria-label={label} value={mode} onChange={event=>{setMode(event.target.value);setError('');}}>
      {value===undefined&&<option value="" disabled>Valores mistos</option>}
      <option value="auto">Automática</option><option value="fill">Preencher (100%)</option><option value="px">Pixels</option>
    </select></label>
    {mode==='px'&&<label>{label} em pixels<input type="number" min={0} max={2000} step={1} value={pixels}
      aria-invalid={!!error} aria-describedby={error?errorId:undefined}
      onChange={event=>{setPixels(event.target.value);setError('');}}/></label>}
    {error&&<p id={errorId} role="alert" className="logic-error">{error}</p>}
    <button type="submit" disabled={!mode}>Aplicar {label.toLocaleLowerCase('pt-BR')}</button>
  </form>;
}
