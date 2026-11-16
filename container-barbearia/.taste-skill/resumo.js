const r=require(process.argv[2]);const all=[];
const walk=(o,w)=>{if(Array.isArray(o))return o.forEach(x=>walk(x,w));if(o&&typeof o==='object'){const ww=o.width||o.w||o.vw||w;if((o.level||o.sev||o.status)==='FAIL'&&(o.id||o.check))all.push({...o,ww});for(const v of Object.values(o))if(v&&typeof v==='object')walk(v,ww)}};
for(const k of ['widths','sweep','narrow','slow','checks'])walk(r[k]);
const seen=new Set();for(const x of all){const m=(x.msg||x.message||'');const key=(x.check||x.id)+(x.ww||'')+m.slice(0,70);if(seen.has(key))continue;seen.add(key);console.log((x.check||x.id).padEnd(16),String(x.ww||'').padEnd(5),(x.sel||x.el||'').toString().slice(0,50).padEnd(50),'|',m.slice(0,170))}
