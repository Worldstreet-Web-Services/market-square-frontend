const base='http://localhost:9222';
const [url,W,H]=[process.argv[2],+process.argv[3],+process.argv[4]];
const t=await (await fetch(`${base}/json/new?${encodeURIComponent(url)}`,{method:'PUT'})).json();
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const pend=new Map();
const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}))});
await new Promise(r=>ws.onopen=r);
ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id&&pend.has(d.id)){pend.get(d.id)(d.result);pend.delete(d.id)}};
await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:true});
await send('Page.enable');
await send('Page.addScriptToEvaluateOnNewDocument',{source:"try{localStorage.removeItem('ms.welcome.seen')}catch(e){}"});
await send('Page.navigate',{url});await new Promise(r=>setTimeout(r,5500));
const r=await send('Runtime.evaluate',{returnByValue:true,expression:`(()=>{
 const stage=document.querySelector('.ws-welcome-stage');
 const sb=stage.getBoundingClientRect();
 let l=1e9,t=1e9,rr=-1e9,b=-1e9;
 stage.querySelectorAll('img').forEach(el=>{const x=el.getBoundingClientRect();
   if(x.width<4||x.height<4)return; l=Math.min(l,x.left);t=Math.min(t,x.top);rr=Math.max(rr,x.right);b=Math.max(b,x.bottom);});
 const art={l:Math.round(l),t:Math.round(t),r:Math.round(rr),b:Math.round(b),w:Math.round(rr-l),h:Math.round(b-t)};
 return JSON.stringify({vw:innerWidth,vh:innerHeight,
   stage:{l:Math.round(sb.left),t:Math.round(sb.top),w:Math.round(sb.width),h:Math.round(sb.height)},
   art, artWidthPctOfStage:Math.round(art.w/sb.width*100), artHeightPctOfStage:Math.round(art.h/sb.height*100),
   artFitsViewport: art.l>=0 && art.r<=innerWidth},null,1)})()`});
console.log(r.result.value);
await fetch(`${base}/json/close/${t.id}`);ws.close();
