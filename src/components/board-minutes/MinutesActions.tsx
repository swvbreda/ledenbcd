import type { ImportDetails } from '@/lib/boardMinutesImport';

export function MinutesActions({rows,actions}:{rows?:ImportDetails['action_rows'];actions:string[]}){
  if(rows===undefined)return actions.length?<ol>{actions.map((action,i)=><li key={i} className="whitespace-pre-wrap">{action}</li>)}</ol>:<p>Geen afzonderlijk geregistreerde acties.</p>;
  if(!rows.length)return <p>Geen afzonderlijk geregistreerde acties.</p>;
  return <>
    <table className="minutes-action-table" aria-label="Actielijst"><colgroup><col/><col/><col/></colgroup><thead><tr><th scope="col">Actie</th><th scope="col">Verantwoordelijke</th><th scope="col">Termijn</th></tr></thead><tbody>{rows.map((row,i)=><tr key={i}><td>{row.action}</td><td>{row.owner||'—'}</td><td>{row.deadline||'—'}</td></tr>)}</tbody></table>
    <div className="minutes-action-cards">{rows.map((row,i)=><section key={i} aria-label={`Actie ${i+1}`}><p><strong>Actie</strong><br/>{row.action}</p><dl><dt>Verantwoordelijke</dt><dd>{row.owner||'—'}</dd><dt>Termijn</dt><dd>{row.deadline||'—'}</dd></dl></section>)}</div>
  </>;
}