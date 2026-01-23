import { useEffect, useState } from 'react';

export default function Answer(){
  const [html,setHtml] = useState<string>('<p>Cargando…</p>');
  useEffect(()=>{
    (window as any).fredie.onAnswer((p:{html:string}) => setHtml(p.html));
  },[]);
  return (
    <div style={{padding:16}}>
      <div className="card" dangerouslySetInnerHTML={{__html: html}} />
      <div style={{marginTop:12, display:'flex', gap:8}}>
        <button className="btn" onClick={()=> (window as any).fredie.openExternal('https://electron-vite.org')}>Exportar (mock)</button>
      </div>
    </div>
  );
}
