// URL da API do Google Apps Script.
// Depois de publicar o Código.gs como Web App, cole aqui a URL /exec.
const API_URL = 'https://script.google.com/macros/s/AKfycbxOiYHEdq95i3t6ZKQ9fAlDLPOrwoFbNI1qBHyqxnip7bL9TCZ6dVG2aYk9ZwFMeu2h/exec';

let dados={epis:[],colaboradores:[]},fotoDataUrl='',canvas,ctx,desenhando=false,assinaturaExiste=false;

window.addEventListener('load',()=>{inicializarCanvas();carregarDados();abrirTela('inicio');window.addEventListener('message',receberRespostaPost);});

function apiGet(action,params={}){return new Promise((resolve,reject)=>{if(API_URL.startsWith('COLE_'))return reject(new Error('Configure primeiro a API_URL no app.js.'));const cb='cb_'+Date.now()+'_'+Math.floor(Math.random()*10000);const script=document.createElement('script');window[cb]=(r)=>{cleanup();resolve(r)};script.onerror=()=>{cleanup();reject(new Error('Não foi possível acessar a API do Google Apps Script.'))};const q=new URLSearchParams({api:'1',action,callback:cb,...params});script.src=API_URL+(API_URL.includes('?')?'&':'?')+q.toString();document.body.appendChild(script);function cleanup(){delete window[cb];script.remove()}})}
function carregarDados(){apiGet('carregarDados').then(r=>{dados=r||{epis:[],colaboradores:[]};preencherColaboradores();document.getElementById('qtdEpi').textContent=(dados.epis||[]).length;document.getElementById('qtdColab').textContent=(dados.colaboradores||[]).filter(c=>String(c.ativo||'SIM').toUpperCase()!=='NÃO').length;document.getElementById('itens').innerHTML='';adicionarItem()}).catch(mostrarErro)}
function preencherColaboradores(){['colaborador','filtroFicha'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const atual=el.value;el.innerHTML='<option value="">Selecione...</option>';(dados.colaboradores||[]).forEach(c=>{if(String(c.ativo||'SIM').toUpperCase()==='NÃO')return;const o=document.createElement('option');o.value=c.nome;o.textContent=c.nome;el.appendChild(o)});if(atual)el.value=atual})}
function abrirTela(t){['inicio','entrega','fichas','historico'].forEach(x=>document.getElementById('tela'+x[0].toUpperCase()+x.slice(1)).classList.add('hidden'));['mInicio','mEntrega','mFichas','mHistorico'].forEach(x=>document.getElementById(x).classList.remove('ativo'));const map={inicio:['Inicio','mInicio'],entrega:['Entrega','mEntrega'],fichas:['Fichas','mFichas'],historico:['Historico','mHistorico']};document.getElementById('tela'+map[t][0]).classList.remove('hidden');document.getElementById(map[t][1]).classList.add('ativo');esconderMensagem();if(t==='historico')mostrarHistorico('recentes');if(t==='fichas')carregarListaFichas()}
function adicionarItem(){const box=document.getElementById('itens'),row=document.createElement('div');row.className='card';row.style.margin='0 0 8px';const idx=box.children.length;row.innerHTML='<div class="campo"><label>EPI</label><select class="epiSelect" onchange="atualizarEstoque(this)"><option value="">Selecione...</option></select><div class="estoque"></div></div><div class="grid"><div class="campo"><label>Quantidade</label><input class="qtd" type="number" min="1" value="1"></div><div class="campo"><label>CA</label><input class="ca" readonly></div></div>'+(idx?' <button class="btn perigo" onclick="this.parentElement.remove()">Remover EPI</button>':'');box.appendChild(row);const select=row.querySelector('.epiSelect');(dados.epis||[]).forEach(e=>{const o=document.createElement('option');o.value=e.codigo;o.textContent=e.codigo+' — '+e.descricao;o.dataset.ca=e.ca||'';o.dataset.estoque=e.estoqueAtual;o.dataset.min=e.estoqueMinimo;select.appendChild(o)})}
function atualizarEstoque(sel){const o=sel.options[sel.selectedIndex],row=sel.closest('.card');row.querySelector('.ca').value=o.dataset.ca||'';const est=Number(o.dataset.estoque||0),min=Number(o.dataset.min||0),box=row.querySelector('.estoque');box.textContent='Estoque atual: '+est+' · mínimo: '+min;box.className='estoque '+(est<=0?'zerado':est<min?'alerta':'ok')}
function mostrarFichaRapida(){const nome=document.getElementById('colaborador').value,box=document.getElementById('fichaRapida');if(!nome){box.classList.add('hidden');return}box.classList.remove('hidden');box.textContent='Consultando ficha vigente...';apiGet('consultarFichaColaborador',{nome}).then(r=>{if(!r.ficha){box.textContent='ℹ️ Ainda não existe ficha. Ela será criada automaticamente na primeira entrega.';return}box.innerHTML='📋 Ficha: <b>'+esc(r.ficha.idFicha)+'</b> · Período: <b>'+esc(r.ficha.inicio)+' a '+esc(r.ficha.fim)+'</b> · Status: <b>'+esc(r.ficha.status)+'</b>'}).catch(mostrarErro)}
function inicializarCanvas(){canvas=document.getElementById('canvas');ctx=canvas.getContext('2d');ajustarCanvas();window.addEventListener('resize',ajustarCanvas);canvas.addEventListener('pointerdown',iniciarDesenho);canvas.addEventListener('pointermove',desenhar);canvas.addEventListener('pointerup',finalizarDesenho);canvas.addEventListener('pointercancel',finalizarDesenho);canvas.addEventListener('pointerleave',finalizarDesenho)}
function ajustarCanvas(){const r=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;canvas.width=Math.max(1,Math.floor(r.width*dpr));canvas.height=Math.floor(190*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#111'}
function pos(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
function iniciarDesenho(e){e.preventDefault();desenhando=true;assinaturaExiste=true;const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);if(canvas.setPointerCapture)try{canvas.setPointerCapture(e.pointerId)}catch(_){} }
function desenhar(e){if(!desenhando)return;e.preventDefault();const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke()}
function finalizarDesenho(e){desenhando=false;if(e&&canvas.releasePointerCapture)try{canvas.releasePointerCapture(e.pointerId)}catch(_){} }
function limparAssinatura(){ctx.clearRect(0,0,canvas.width,canvas.height);assinaturaExiste=false}
function prepararFoto(event){const file=event.target.files&&event.target.files[0];if(!file)return;const rd=new FileReader();rd.onload=e=>{const img=new Image();img.onload=()=>{const lim=1280;let w=img.naturalWidth,h=img.naturalHeight;if(w>lim||h>lim){const s=Math.min(lim/w,lim/h);w=Math.round(w*s);h=Math.round(h*s)}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);fotoDataUrl=c.toDataURL('image/jpeg',.78);const p=document.getElementById('preview');p.src=fotoDataUrl;p.style.display='block';document.getElementById('removerFoto').classList.remove('hidden');document.getElementById('fotoStatus').textContent='✅ Foto pronta.'};img.src=e.target.result};rd.readAsDataURL(file)}
function removerFoto(){fotoDataUrl='';document.getElementById('fotoInput').value='';document.getElementById('preview').src='';document.getElementById('preview').style.display='none';document.getElementById('removerFoto').classList.add('hidden');document.getElementById('fotoStatus').textContent='A foto é obrigatória.'}
function registrar(){esconderMensagem();const colaborador=document.getElementById('colaborador').value;if(!colaborador)return mostrarErro('Selecione o colaborador.');const itens=[],cod={};document.querySelectorAll('#itens .card').forEach(row=>{const s=row.querySelector('.epiSelect');if(!s||!s.value||cod[s.value])return;const qtd=Number(row.querySelector('.qtd').value);if(qtd>0)itens.push({codigoEpi:s.value,quantidade:qtd});cod[s.value]=true});if(!itens.length)return mostrarErro('Selecione pelo menos um EPI.');if(!assinaturaExiste)return mostrarErro('O colaborador precisa assinar.');if(!fotoDataUrl)return mostrarErro('Tire ou selecione a foto da entrega.');const btn=document.getElementById('btnRegistrar');btn.disabled=true;btn.textContent='REGISTRANDO...';enviarPost({colaborador,itens,observacoes:document.getElementById('observacoes').value.trim(),assinaturaBase64:canvas.toDataURL('image/png'),fotoBase64:fotoDataUrl}).then(r=>{btn.disabled=false;btn.textContent='✓ REGISTRAR ENTREGA';if(!r.sucesso)throw new Error(r.erro||'Erro ao registrar entrega.');const d=r.dados;mostrarSucesso('✅ ENTREGA REGISTRADA\n\nColaborador: '+d.colaborador+'\nFicha: '+d.ficha+'\nEPIs: '+d.quantidadeItens+'\nData/hora: '+d.dataHora);limparEntrega();carregarDados()}).catch(e=>{btn.disabled=false;btn.textContent='✓ REGISTRAR ENTREGA';mostrarErro(e)})}
window.addEventListener('message', function(event){
  if(!event.data || event.data.tipo !== 'epi_api') return;
  if(typeof window._epiPostResolver === 'function'){
    const resolve = window._epiPostResolver;
    window._epiPostResolver = null;
    window._epiPostReject = null;
    if(window._epiPostTimer) clearTimeout(window._epiPostTimer);
    resolve(event.data);
  }
});

function enviarPost(payload){
  return new Promise((resolve,reject)=>{
    if(API_URL.startsWith('COLE_')) return reject(new Error('Configure primeiro a API_URL no app.js.'));
    const frame=document.getElementById('apiFrame');
    const form=document.createElement('form');
    form.method='POST';
    form.action=API_URL;
    form.target='apiFrame';
    form.style.display='none';
    const input=document.createElement('input');
    input.name='payload';
    input.value=JSON.stringify(payload);
    form.appendChild(input);
    document.body.appendChild(form);
    window._epiPostResolver=resolve;
    window._epiPostReject=reject;
    window._epiPostTimer=setTimeout(()=>{
      if(window._epiPostResolver){
        window._epiPostResolver=null;
        window._epiPostReject=null;
        reject(new Error('Tempo excedido ao registrar a entrega. Verifique a planilha antes de repetir o lançamento.'));
      }
      form.remove();
    },45000);
    form.submit();
    setTimeout(()=>form.remove(),1000);
  });
}
function receberRespostaPost(ev){if(!ev.data||ev.data.tipo!=='epi_api')return;const resolve=window._epiPostResolver,reject=window._epiPostReject;window._epiPostResolver=null;window._epiPostReject=null;if(!resolve&&!reject)return;if(ev.data.sucesso)resolve(ev.data);else reject(new Error(ev.data.erro||'Erro no servidor.'))}
function limparEntrega(){document.getElementById('colaborador').value='';document.getElementById('fichaRapida').classList.add('hidden');document.getElementById('itens').innerHTML='';document.getElementById('observacoes').value='';limparAssinatura();removerFoto();adicionarItem()}
function carregarFichaSelecionada(){const nome=document.getElementById('filtroFicha').value;if(!nome){document.getElementById('fichaResultado').innerHTML='';return}document.getElementById('fichaResultado').innerHTML='<div class="card"><div class="muted">Carregando ficha...</div></div>';apiGet('consultarFichaColaborador',{nome}).then(renderizarFicha).catch(mostrarErro)}
function renderizarFicha(r){
  const box=document.getElementById('fichaResultado');
  if(!r||!r.ficha){box.innerHTML='<div class="card"><div class="muted">Nenhuma ficha registrada para este colaborador ainda.</div></div>';return}
  const c=r.colaborador,f=r.ficha,rows=r.entregas||[];
  let html='';
  html+='<div class="cautela-documento"><div class="doc-header"><div class="doc-brand">GRUPO 360 MANUTENÇÃO</div><div class="doc-title">CAUTELA DE EPI</div></div>';
  html+='<div class="doc-info"><div><b>Empresa:</b> '+esc(c.empresa||'')+'</div><div><b>Colaborador:</b> '+esc(c.nome||'')+'</div><div><b>CPF:</b> '+esc(c.cpf||'')+'</div><div><b>Admissão:</b> '+esc(c.dataAdmissao||'')+'</div><div><b>Função:</b> '+esc(c.funcao||'')+'</div><div><b>Período da cautela:</b> '+esc(f.inicio)+' a '+esc(f.fim)+'</div></div>';
  html+='<div class="cautela-texto">'+esc(r.textoCautela).replace(/\n/g,'<br>')+'</div><div class="table-wrap"><table class="cautela-tabela"><thead><tr><th>Data</th><th>Código interno</th><th>Descrição</th><th>CA</th><th>Quantidade</th><th>Observações</th><th>Assinatura</th></tr></thead><tbody>';
  rows.forEach(x=>{html+='<tr><td>'+esc(x.data)+'</td><td>'+esc(x.codigo)+'</td><td>'+esc(x.descricao)+'</td><td>'+esc(x.ca)+'</td><td>'+esc(x.quantidade)+'</td><td>'+esc(x.observacoes)+'</td><td>'+(x.assinatura?'<a target="_blank" href="'+esc(x.assinatura)+'">Ver</a>':'—')+'</td></tr>'});
  html+='</tbody></table></div><div class="doc-footer"><span>Ficha: '+esc(f.idFicha)+'</span><span>Status: '+esc(f.status)+'</span></div><div class="assinaturas-finais"><div>Responsável / Empresa<span></span></div><div>Colaborador<span></span></div><div>Data<span>___/___/______</span></div></div>';
  html+='<div class="grid" style="margin-top:16px"><button class="btn primario" onclick="window.print()">🖨️ Imprimir ficha</button><button class="btn secundario" id="btnNovaFichaEntrega">＋ Nova entrega para '+esc(c.nome)+'</button></div></div>';
  box.innerHTML=html;
  document.getElementById('btnNovaFichaEntrega').onclick=()=>{abrirTela('entrega');document.getElementById('colaborador').value=c.nome;mostrarFichaRapida()};
}
function carregarListaFichas(){const box=document.getElementById('fichaResultado');if(!box)return;box.innerHTML='<div class="card"><div class="muted">Selecione um colaborador para consultar a ficha.</div></div>';apiGet('listarFichas').then(lista=>{preencherColaboradores();const area=document.createElement('div');area.className='card';area.innerHTML='<h2>Fichas cadastradas</h2>';if(!lista.length)area.innerHTML+='<div class="muted">Nenhuma ficha criada.</div>';lista.forEach(f=>{const d=document.createElement('div');d.className='ficha-item';d.innerHTML='<b>'+esc(f.colaborador)+'</b> <span class="badge '+(f.status==='ATIVA'?'ativa':'')+'">'+esc(f.status)+'</span><div class="muted">'+esc(f.inicio)+' a '+esc(f.fim)+' · '+esc(f.quantidadeEntregas)+' entrega(s) · '+esc(f.idFicha)+'</div>';d.onclick=()=>{document.getElementById('filtroFicha').value=f.colaborador;carregarFichaSelecionada()};area.appendChild(d)});box.innerHTML='';box.appendChild(area)}).catch(mostrarErro)}
function mostrarHistorico(tipo){document.getElementById('tabRecentes').classList.toggle('ativo',tipo==='recentes');document.getElementById('tabDiario').classList.toggle('ativo',tipo==='diario');document.getElementById('tabFichas').classList.toggle('ativo',tipo==='fichas');const box=document.getElementById('historicoConteudo');if(tipo==='fichas'){carregarListaFichasHistorico();return}if(tipo==='diario'){box.innerHTML='<div class="grid"><div class="campo"><label>Data</label><input id="dataHistorico" type="date" onchange="carregarHistoricoDia()"></div><div><button class="btn secundario" onclick="document.getElementById(\'dataHistorico\').value=new Date().toISOString().slice(0,10);carregarHistoricoDia()">📅 Hoje</button></div></div><div id="historicoLista" class="muted">Selecione uma data.</div>';return}box.innerHTML='<div id="historicoLista" class="muted">Carregando...</div>';apiGet('listarSaidasRecentes',{limite:50}).then(renderHistorico).catch(mostrarErro)}
function carregarHistoricoDia(){const v=document.getElementById('dataHistorico').value;if(!v)return;const p=v.split('-').reverse().join('/');document.getElementById('historicoLista').textContent='Carregando...';apiGet('listarSaidasPorData',{data:p}).then(renderHistorico).catch(mostrarErro)}
function renderHistorico(lista){const box=document.getElementById('historicoLista');if(!lista||!lista.length){box.innerHTML='<div class="muted">Nenhuma saída registrada.</div>';return}box.innerHTML='';lista.forEach(x=>{const d=document.createElement('div');d.className='historico-row';d.innerHTML='<div class="linha1"><span>'+esc(x.data)+' · '+esc(x.responsavel)+'</span><span>'+esc(x.codigo)+'</span></div><div class="linha2"><b>'+esc(x.descricao)+'</b> · Qtd: '+esc(x.quantidade)+' · CA: '+esc(x.ca)+'<br>'+esc(x.observacoes||'')+'<br>Ficha: '+esc(x.ficha)+'<div style="margin-top:7px">'+(x.assinatura?'<a target="_blank" href="'+esc(x.assinatura)+'">✍️ Assinatura</a>':'')+(x.foto?'<a target="_blank" href="'+esc(x.foto)+'">📷 Foto</a>':'')+'</div></div>';box.appendChild(d)})}
function carregarListaFichasHistorico(){const box=document.getElementById('historicoConteudo');box.innerHTML='<div class="muted">Carregando fichas...</div>';apiGet('listarFichas').then(lista=>{box.innerHTML='';lista.forEach(f=>{const d=document.createElement('div');d.className='ficha-item';d.innerHTML='<b>'+esc(f.colaborador)+'</b> <span class="badge '+(f.status==='ATIVA'?'ativa':'')+'">'+esc(f.status)+'</span><div class="muted">'+esc(f.inicio)+' a '+esc(f.fim)+' · '+esc(f.quantidadeEntregas)+' entrega(s)</div>';d.onclick=()=>{abrirTela('fichas');document.getElementById('filtroFicha').value=f.colaborador;carregarFichaSelecionada()};box.appendChild(d)})}).catch(mostrarErro)}
function mostrarErro(e){const msg=e&&e.message?e.message:String(e||'Erro desconhecido.');const el=document.getElementById('mensagem');el.className='mensagem erro';el.textContent='⚠️ '+msg;window.scrollTo({top:0,behavior:'smooth'})}
function mostrarSucesso(msg){const el=document.getElementById('mensagem');el.className='mensagem sucesso';el.textContent=msg;window.scrollTo({top:0,behavior:'smooth'})}
function esconderMensagem(){const el=document.getElementById('mensagem');el.className='mensagem hidden';el.textContent=''}
function esc(v){return String(v==null?'':v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
