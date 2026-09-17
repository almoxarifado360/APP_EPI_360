const API_URL='https://script.google.com/macros/s/AKfycbxOiYHEdq95i3t6ZKQ9fAlDLPOrwoFbNI1qBHyqxnip7bL9TCZ6dVG2aYk9ZwFMeu2h/exec';
const CAUTELA='Pelo presente, declaro ter recebido da empresa ________________________________, os EPI abaixo relacionados, para serem utilizados no exercício da função a serviço da empresa, assumindo o compromisso de usá-los em trabalho, zelar pela sua guarda e conservação e devolvê-los ao setor responsável da empresa quando se tornar impróprio para uso, por motivo de demissão ou afastamento!\n\nEm caso de perda, extravio ou avaria proposital dos equipamentos e ferramentas recebidos, autorizo a empresa na forma prevista no parágrafo primeiro do Art. 462 da Consolidação das Leis do Trabalho (CLT), a descontar de meu salário, a importância correspondente ao valor do material, inclusive no que couber a título de indenização por rescisão de contrato de trabalho!\n\nNa constatação de defeito de fabricação ou danificação, provocadas acidentalmente, ou por desgastes de uso de qualquer um dos materiais, comprometo-me a entregá-lo(s) ao setor responsável, mediante recibo. E também, em caso de minha demissão e/ou afastamento por qualquer circunstância.';
let dados={epis:[],colaboradores:[]},fotoDataUrl='',canvas,ctx,desenhando=false,assinaturaExiste=false;

window.addEventListener('load',()=>{inicializarCanvas();carregarDados();abrirTela('inicio');});

function jsonp(action,params={}){return new Promise((resolve,reject)=>{const cb='epi360_cb_'+Date.now()+'_'+Math.floor(Math.random()*10000),s=document.createElement('script');const q=new URLSearchParams({api:'1',action,callback:cb,...params});let timer=setTimeout(()=>{cleanup();reject(new Error('Tempo limite ao consultar o servidor.'))},20000);function cleanup(){clearTimeout(timer);delete window[cb];s.remove()}window[cb]=(r)=>{cleanup();if(r&&r.erro)reject(new Error(r.erro));else resolve(r)};s.onerror=()=>{cleanup();reject(new Error('Não foi possível conectar ao servidor.'))};s.src=API_URL+'?'+q.toString();document.body.appendChild(s)});}

async function carregarDados(){try{const r=await jsonp('carregarDados');dados=r||{epis:[],colaboradores:[]};preencherColaboradores();document.getElementById('qtdEpi').textContent=(dados.epis||[]).length;document.getElementById('qtdColab').textContent=(dados.colaboradores||[]).filter(c=>String(c.ativo||'SIM').toUpperCase()!=='NÃO').length;const box=document.getElementById('itens');if(box&&!box.children.length)adicionarItem();await carregarUltimasRetiradas()}catch(e){mostrarErro(e)}}

async function carregarUltimasRetiradas(){const box=document.getElementById('ultimasRetiradas');if(!box)return;box.innerHTML='<div class="loading">Carregando...</div>';try{const lista=await jsonp('listarSaidasRecentes',{limite:10});if(!Array.isArray(lista)||!lista.length){box.innerHTML='<div class="empty">Nenhuma retirada registrada ainda.</div>';return}box.innerHTML=lista.slice(0,5).map(x=>`<div class="latest"><div class="latest-date">${esc(x.data||'')}</div><div><strong>${esc(x.descricao||'')}</strong><span>${esc(x.colaborador||'')}${x.quantidade?' · Qtd.: '+esc(x.quantidade):''}</span></div></div>`).join('')}catch(e){box.innerHTML='<div class="empty">As últimas retiradas aparecerão aqui.</div>'}}

function preencherColaboradores(){['colaborador','filtroFicha'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const atual=el.value;el.innerHTML='<option value="">Selecione o colaborador...</option>';(dados.colaboradores||[]).forEach(c=>{if(String(c.ativo||'SIM').toUpperCase()==='NÃO')return;const o=document.createElement('option');o.value=c.nome;o.textContent=c.nome;el.appendChild(o)});if(atual)el.value=atual})}
function abrirTela(t){const ids={inicio:'telaInicio',entrega:'telaEntrega',fichas:'telaFichas',historico:'telaHistorico'},menus={inicio:'mInicio',entrega:'mEntrega',fichas:'mFichas',historico:'mHistorico'};Object.values(ids).forEach(id=>document.getElementById(id).classList.add('hidden'));Object.values(menus).forEach(id=>document.getElementById(id).classList.remove('ativo'));document.getElementById(ids[t]).classList.remove('hidden');document.getElementById(menus[t]).classList.add('ativo');esconderMensagem();if(t==='historico')carregarListaFichas()}

function adicionarItem(){const box=document.getElementById('itens'),row=document.createElement('div');row.className='epi-row';const idx=box.children.length;row.innerHTML=`<div class="epi-top"><div style="font-weight:900">EPI ${idx+1}</div>${idx?'<button class="remove-item no-print" onclick="this.closest(\'.epi-row\').remove()">Remover</button>':''}</div><div class="field" style="margin-top:10px"><label>EPI <b>*</b></label><select class="epiSelect" onchange="atualizarEstoque(this)"><option value="">Selecione...</option></select><div class="stock"></div></div><div class="epi-grid"><div class="field"><label>CA</label><input class="ca" readonly></div><div class="field"><label>Quantidade <b>*</b></label><input class="qtd" type="number" min="1" value="1"></div></div>`;box.appendChild(row);const select=row.querySelector('.epiSelect');(dados.epis||[]).forEach(e=>{const o=document.createElement('option');o.value=e.codigo;o.textContent=e.codigo+' — '+e.descricao;o.dataset.ca=e.ca;o.dataset.estoque=e.estoqueAtual;o.dataset.min=e.estoqueMinimo;select.appendChild(o)})}
function atualizarEstoque(sel){const o=sel.options[sel.selectedIndex],row=sel.closest('.epi-row');row.querySelector('.ca').value=o?.dataset?.ca||'';const est=Number(o?.dataset?.estoque||0),min=Number(o?.dataset?.min||0),box=row.querySelector('.stock');box.textContent='Estoque atual: '+est+' · mínimo: '+min;box.className='stock '+(est<=0?'zero':est<min?'alert':'ok')}

async function mostrarFichaRapida(){const nome=document.getElementById('colaborador').value,box=document.getElementById('fichaRapida');if(!nome){box.classList.add('hidden');return}box.classList.remove('hidden');box.textContent='Consultando ficha anual...';try{const r=await jsonp('consultarFichaColaborador',{nome});if(!r.ficha){box.innerHTML='<b>👤 '+esc(r.colaborador?.nome||nome)+'</b><br>Empresa: <b>'+esc(r.colaborador?.empresa||'')+'</b> · CPF: <b>'+esc(r.colaborador?.cpf||'')+'</b><br><span>ℹ️ Ainda não existe ficha anual. Ela será criada automaticamente na primeira entrega.</span>';return}box.innerHTML='<b>👤 '+esc(r.colaborador?.nome||nome)+'</b><br>Empresa: <b>'+esc(r.colaborador?.empresa||'')+'</b> · CPF: <b>'+esc(r.colaborador?.cpf||'')+'</b><br>▤ Ficha: <b>'+esc(r.ficha.idFicha)+'</b> · Período: <b>'+esc(r.ficha.inicio)+' a '+esc(r.ficha.fim)+'</b> · Status: <b>'+esc(r.ficha.status)+'</b>'}catch(e){box.textContent='Não foi possível consultar a ficha agora.'}}

function inicializarCanvas(){
  canvas=document.getElementById('canvas');
  if(!canvas)return;

  ctx=canvas.getContext('2d');
  canvas.style.touchAction='none';
  canvas.style.userSelect='none';
  canvas.style.webkitUserSelect='none';
  canvas.style.webkitTouchCallout='none';

  ajustarCanvas();

  // Navegadores modernos: Pointer Events (celular, tablet e mouse).
  if(window.PointerEvent){
    canvas.addEventListener('pointerdown',iniciarDesenho,{passive:false});
    canvas.addEventListener('pointermove',desenhar,{passive:false});
    canvas.addEventListener('pointerup',finalizarDesenho,{passive:false});
    canvas.addEventListener('pointercancel',finalizarDesenho,{passive:false});
  }else{
    // Fallback para navegadores antigos.
    canvas.addEventListener('touchstart',iniciarTouch,{passive:false});
    canvas.addEventListener('touchmove',desenharTouch,{passive:false});
    canvas.addEventListener('touchend',finalizarDesenho,{passive:false});
    canvas.addEventListener('touchcancel',finalizarDesenho,{passive:false});
    canvas.addEventListener('mousedown',iniciarDesenho);
    canvas.addEventListener('mousemove',desenhar);
    window.addEventListener('mouseup',finalizarDesenho);
  }

  window.addEventListener('resize',()=>{
    // Não apaga a assinatura ao girar/redimensionar o tablet.
    const imagem=assinaturaExiste ? canvas.toDataURL('image/png') : '';
    ajustarCanvas();
    if(imagem) restaurarAssinatura(imagem);
  });
}

function configurarContexto(){
  if(!ctx)return;
  ctx.lineWidth=3;
  ctx.lineCap='round';
  ctx.lineJoin='round';
  ctx.strokeStyle='#111111';
  ctx.fillStyle='#111111';
}

function ajustarCanvas(){
  if(!canvas||!ctx)return;
  const r=canvas.getBoundingClientRect();
  const largura=Math.max(280,Math.floor(r.width||600));
  const altura=window.innerWidth<=720?235:270;
  const dpr=Math.max(1,window.devicePixelRatio||1);

  canvas.width=Math.floor(largura*dpr);
  canvas.height=Math.floor(altura*dpr);
  canvas.style.width=largura+'px';
  canvas.style.height=altura+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  configurarContexto();
}

function posicaoAssinatura(e){
  const r=canvas.getBoundingClientRect();
  return {x:e.clientX-r.left,y:e.clientY-r.top};
}

function iniciarDesenho(e){
  if(e.cancelable)e.preventDefault();
  desenhando=true;
  assinaturaExiste=true;
  const p=posicaoAssinatura(e);
  ctx.beginPath();
  ctx.moveTo(p.x,p.y);
  if(canvas.setPointerCapture && e.pointerId!=null){
    try{canvas.setPointerCapture(e.pointerId)}catch(_){}
  }
}

function desenhar(e){
  if(!desenhando)return;
  if(e.cancelable)e.preventDefault();
  const p=posicaoAssinatura(e);
  ctx.lineTo(p.x,p.y);
  ctx.stroke();
}

function finalizarDesenho(e){
  if(!desenhando)return;
  desenhando=false;
  if(e&&canvas.releasePointerCapture&&e.pointerId!=null){
    try{canvas.releasePointerCapture(e.pointerId)}catch(_){}
  }
}

function iniciarTouch(e){
  if(e.cancelable)e.preventDefault();
  if(!e.touches||!e.touches.length)return;
  const t=e.touches[0];
  iniciarDesenho({clientX:t.clientX,clientY:t.clientY,preventDefault:()=>{}});
}

function desenharTouch(e){
  if(!desenhando||!e.touches||!e.touches.length)return;
  if(e.cancelable)e.preventDefault();
  const t=e.touches[0];
  desenhar({clientX:t.clientX,clientY:t.clientY,preventDefault:()=>{}});
}

function restaurarAssinatura(dataUrl){
  const img=new Image();
  img.onload=()=>{
    const r=canvas.getBoundingClientRect();
    ctx.clearRect(0,0,r.width,r.height);
    ctx.drawImage(img,0,0,r.width,r.height);
    assinaturaExiste=true;
  };
  img.src=dataUrl;
}

function limparAssinatura(){
  if(!canvas||!ctx)return;
  const r=canvas.getBoundingClientRect();
  ctx.clearRect(0,0,r.width,r.height);
  assinaturaExiste=false;
}

function prepararFoto(event){const file=event.target.files&&event.target.files[0];if(!file)return;const rd=new FileReader();rd.onload=e=>{const img=new Image();img.onload=()=>{const lim=1000;let w=img.naturalWidth,h=img.naturalHeight;if(w>lim||h>lim){const s=Math.min(lim/w,lim/h);w=Math.round(w*s);h=Math.round(h*s)}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);fotoDataUrl=c.toDataURL('image/jpeg',.68);const p=document.getElementById('preview');p.src=fotoDataUrl;p.style.display='block';document.getElementById('removerFoto').classList.remove('hidden');document.getElementById('fotoStatus').textContent='✓ Foto pronta para envio.'};img.src=e.target.result};rd.readAsDataURL(file)}
function removerFoto(){fotoDataUrl='';document.getElementById('fotoInput').value='';document.getElementById('preview').src='';document.getElementById('preview').style.display='none';document.getElementById('removerFoto').classList.add('hidden');document.getElementById('fotoStatus').textContent='A foto é obrigatória.'}

async function registrar(){esconderMensagem();const colaborador=document.getElementById('colaborador').value;if(!colaborador)return mostrarErro('Selecione o colaborador.');const itens=[],cod={};document.querySelectorAll('#itens .epi-row').forEach(row=>{const s=row.querySelector('.epiSelect');if(!s||!s.value||cod[s.value])return;const qtd=Number(row.querySelector('.qtd').value);if(qtd>0)itens.push({codigoEpi:s.value,quantidade:qtd});cod[s.value]=true});if(!itens.length)return mostrarErro('Selecione pelo menos um EPI.');if(!assinaturaExiste)return mostrarErro('O colaborador precisa assinar.');if(!fotoDataUrl)return mostrarErro('Tire ou selecione a foto da entrega.');const clientRequestId='REQ-'+Date.now()+'-'+Math.floor(Math.random()*100000);const payload={clientRequestId,colaborador,itens,observacoes:document.getElementById('observacoes').value.trim(),assinaturaBase64:canvas.toDataURL('image/png'),fotoBase64:fotoDataUrl};const btn=document.getElementById('btnRegistrar');btn.disabled=true;btn.textContent='REGISTRANDO...';try{await enviarPost(payload);mostrarSucesso('✓ ENTREGA REGISTRADA\n\nColaborador: '+colaborador+'\nA operação foi salva na planilha.');limparEntrega();await carregarDados()}catch(e){mostrarErro(e)}finally{btn.disabled=false;btn.textContent='✓ REGISTRAR ENTREGA'}}

function enviarPost(payload){return new Promise((resolve,reject)=>{const iframe=document.createElement('iframe');iframe.name='epi360_post_'+Date.now();iframe.style.display='none';document.body.appendChild(iframe);const form=document.createElement('form');form.method='POST';form.action=API_URL;form.target=iframe.name;form.style.display='none';const input=document.createElement('input');input.type='hidden';input.name='payload';input.value=JSON.stringify(payload);form.appendChild(input);document.body.appendChild(form);let tent=0;let finished=false;const finish=(err,res)=>{if(finished)return;finished=true;clearInterval(poll);form.remove();setTimeout(()=>iframe.remove(),500);err?reject(err):resolve(res)};form.submit();const poll=setInterval(async()=>{tent++;try{const r=await jsonp('statusEntrega',{id:payload.clientRequestId});if(r&&!r.pendente){if(r.sucesso)finish(null,r);else finish(new Error(r.erro||'Não foi possível registrar a entrega.'));return}}catch(_){}if(tent>=45)finish(new Error('O servidor demorou para confirmar o registro. Verifique a planilha antes de tentar novamente.'))},1000)})}
function limparEntrega(){document.getElementById('colaborador').value='';document.getElementById('fichaRapida').classList.add('hidden');document.getElementById('itens').innerHTML='';document.getElementById('observacoes').value='';limparAssinatura();removerFoto();adicionarItem()}

async function carregarFichaSelecionada(){const nome=document.getElementById('filtroFicha').value;if(!nome){document.getElementById('fichaResultado').innerHTML='';return}document.getElementById('fichaResultado').innerHTML='<div class="card"><div class="loading">Carregando ficha...</div></div>';try{renderizarFicha(await jsonp('consultarFichaColaborador',{nome}))}catch(e){mostrarErro(e)}}
function renderizarFicha(r){const box=document.getElementById('fichaResultado');if(!r||!r.ficha){box.innerHTML='<div class="card"><div class="empty">Nenhuma ficha registrada para este colaborador ainda.</div></div>';return}const c=r.colaborador,f=r.ficha,rows=r.entregas||[];let html='<div class="cautela-documento">';html+='<div class="doc-header"><div class="doc-brand">GRUPO 360 MANUTENÇÃO</div><div class="doc-title">CAUTELA DE EPI</div></div>';html+='<div class="doc-info">';html+='<div><strong>Empresa:</strong> '+esc(c.empresa||'')+'</div>';html+='<div><strong>Colaborador:</strong> '+esc(c.nome||'')+'</div>';html+='<div><strong>CPF:</strong> '+esc(c.cpf||'')+'</div>';html+='<div><strong>Admissão:</strong> '+esc(c.dataAdmissao||'')+'</div>';html+='<div><strong>Função:</strong> '+esc(c.funcao||'')+'</div>';html+='<div><strong>Período da cautela:</strong> '+esc(f.inicio)+' a '+esc(f.fim)+'</div>';html+='</div>';html+='<div class="cautela-texto">'+esc(r.textoCautela||CAUTELA).replace(/\n/g,'<br>')+'</div>';html+='<div class="table-wrap"><table class="cautela-tabela"><thead><tr><th>Data</th><th>Código interno</th><th>Descrição</th><th>CA</th><th>Quantidade</th><th>Observações</th><th>Assinatura</th></tr></thead><tbody>';if(!rows.length)html+='<tr><td colspan="7" style="text-align:center">Nenhuma entrega nesta ficha.</td></tr>';rows.forEach(x=>{html+='<tr><td>'+esc(x.data)+'</td><td>'+esc(x.codigo)+'</td><td>'+esc(x.descricao)+'</td><td>'+esc(x.ca)+'</td><td>'+esc(x.quantidade)+'</td><td>'+esc(x.observacoes)+'</td><td>'+(x.assinatura?'<a href="'+esc(x.assinatura)+'" target="_blank">Ver assinatura</a>':'—')+'</td></tr>'});html+='</tbody></table></div>';html+='<div class="doc-footer"><div><strong>Ficha:</strong> '+esc(f.idFicha)+'</div><div><strong>Status:</strong> '+esc(f.status)+'</div></div>';html+='<div class="assinaturas-finais"><div>Responsável / Empresa:<br><span>________________________________________</span></div><div>Colaborador:<br><span>________________________________________</span></div><div>Data:<br><span>____/____/________</span></div></div>';html+='<div class="ficha-acoes no-print"><button class="primary-btn" onclick="window.print()">▣ Imprimir ficha</button><button class="outline-btn" onclick="novaEntregaPara(\''+jsesc(c.nome)+'\')">＋ Nova entrega para '+esc(c.nome)+'</button></div>';html+='</div>';box.innerHTML=html}
function novaEntregaPara(nome){abrirTela('entrega');document.getElementById('colaborador').value=nome;mostrarFichaRapida()}

async function carregarListaFichas(){const box=document.getElementById('listaFichas');box.innerHTML='<div class="loading">Carregando...</div>';try{const lista=await jsonp('listarFichas');if(!lista.length){box.innerHTML='<div class="empty">Nenhuma ficha criada.</div>';return}box.innerHTML='';lista.forEach(f=>{const d=document.createElement('div');d.className='ficha-item';d.innerHTML='<strong>'+esc(f.colaborador)+'</strong> <span class="badge '+(f.status==='ATIVA'?'ativa':'')+'">'+esc(f.status)+'</span><div class="muted">'+esc(f.inicio)+' a '+esc(f.fim)+' · '+esc(f.quantidadeEntregas)+' entrega(s) · '+esc(f.idFicha)+'</div>';d.onclick=()=>{abrirTela('fichas');document.getElementById('filtroFicha').value=f.colaborador;carregarFichaSelecionada()};box.appendChild(d)})}catch(e){box.innerHTML='<div class="empty">Não foi possível carregar o histórico.</div>';mostrarErro(e)}}

function mostrarSucesso(t){const e=document.getElementById('mensagem');e.textContent=t;e.className='message success';window.scrollTo({top:0,behavior:'smooth'})}
function mostrarErro(e){const t=e&&e.message?e.message:String(e||'Erro desconhecido.');const el=document.getElementById('mensagem');el.textContent='⚠ '+t;el.className='message error';window.scrollTo({top:0,behavior:'smooth'})}
function esconderMensagem(){const e=document.getElementById('mensagem');e.className='message';e.textContent=''}
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
function jsesc(v){return String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'")}
