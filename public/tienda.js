'use strict';
const $=s=>document.querySelector(s), main=$('#main');
const money=n=>new Intl.NumberFormat('es-SV',{style:'currency',currency:'USD'}).format(n/100);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let shop, cart=[], filter='Todos', adminKey='', toastTimer;
try{cart=JSON.parse(localStorage.getItem('mx-cart')||'[]');if(!Array.isArray(cart))cart=[]}catch{}
const product=id=>shop.products.find(p=>p.id===id);
const img=(id,alt,cls='')=>'<img class="'+cls+'" src="img/'+id+'.jpg" decoding="async" alt="'+esc(alt)+'">';
const link=(route,title,cls='btn')=>'<a class="'+cls+'" href="#'+route+'">'+title+'</a>';
const input=(key,label,type='text',required=true,attrs='')=>'<label>'+label+'<input name="'+key+'" type="'+type+'" '+(required?'required ':'')+attrs+'></label>';
const select=(key,label,choices)=>'<label>'+label+'<select name="'+key+'">'+choices.map(x=>{const [v,t]=Array.isArray(x)?x:[x,x];return '<option value="'+esc(v)+'">'+esc(t)+'</option>'}).join('')+'</select></label>';
const textArea=(key,label)=>'<label>'+label+'<textarea name="'+key+'" rows="4" maxlength="2400" required></textarea></label>';
const row=(a,b,cls='')=>'<div class="summary '+cls+'"><span>'+esc(a)+'</span><strong>'+esc(b)+'</strong></div>';
const head=(name,sub='')=>'<h1>'+name+'</h1>'+(sub?'<p class="intro">'+sub+'</p>':'');
const personal=()=>'<div class="two">'+input('nombre','Nombre completo','text',true,'maxlength="100" autocomplete="name"')+input('correo','Correo electrónico','email',true,'autocomplete="email" maxlength="200"')+'</div>';
const submit=(label)=>'<p class="error" role="alert"></p><button type="submit">'+label+'</button>';
const fd=f=>Object.fromEntries(new FormData(f));
const modeName=m=>m==='kit'?'Kit para armar':'Ensamblado';
const price=l=>product(l.id)[l.mode]+product(l.id).extra*l.variant;
const installation=l=>l.install?product(l.id).install:0;
async function api(path,data){
 const opt={method:data?'POST':'GET',headers:{}};
 if(path==='admin'||path.startsWith('admin/'))opt.headers['X-Mueblux-Key']=adminKey;
 if(data){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(data)}
 const res=await fetch('/api/'+path,opt), out=await res.json();
 if(!res.ok)throw Error(out.error||'No se pudo completar la operación.');return out;
}
function persist(){localStorage.setItem('mx-cart',JSON.stringify(cart));$('#count').textContent=cart.reduce((n,l)=>n+l.qty,0)}
function toast(msg){clearTimeout(toastTimer);$('#toast').textContent=msg;$('#toast').style.display='block';toastTimer=setTimeout(()=>$('#toast').style.display='none',3500)}
function formAction(f,handler){
 f.onsubmit=async e=>{e.preventDefault();const b=f.querySelector('[type=submit]'),err=f.querySelector('.error');err.textContent='';b.disabled=true;
 try{await handler(fd(f))}catch(ex){err.textContent=ex.message}finally{b.disabled=false}};
}
const cards=ps=>'<div class="grid catalog-grid">'+ps.map(p=>
 '<a class="card" href="#producto/'+p.id+'">'+img(p.img,p.name)+
 '<div class="card-body"><small>'+p.category+'</small><h3>'+p.name+'</h3><strong>Desde '+money(p.kit)+'</strong></div></a>'
).join('')+'</div>';
function home(){
 const featured=['comedor-ronda','mesa-bahia','escritorio-roble','aparador-terra'].map(product).filter(Boolean);
 main.innerHTML='<section class="hero"><div class="herotext"><p class="kicker">Muebles de madera y melamina</p><h1>Diseños que transforman espacios.</h1><p class="hero-copy">Piezas para vivir, trabajar y compartir. Elige las medidas, el acabado y cómo quieres recibirlas.</p>'+link('catalogo','Explorar catálogo')+'</div>'+img('hero','Sala iluminada con un mueble bajo de madera')+'</section>'+
 '<div class="bar"><div><h2>La colección Mueblux</h2></div>'+link('catalogo','Ver los '+shop.products.length+' muebles','text-link')+'</div>'+cards(featured.length?featured:shop.products.slice(0,4))+
 '<section class="banner">'+img('kitchen','Cocina con mobiliario en madera')+'<div><h2>Muebles a medida</h2><p>Cuéntanos qué mueble necesitas y las dimensiones de tu espacio.</p>'+link('cotizar','Solicitar cotización')+'</div></section>';
}
function catalog(){
 const cats=['Todos',...new Set(shop.products.map(p=>p.category))];
 const shown=shop.products.filter(p=>filter==='Todos'||p.category===filter);
 main.innerHTML=head('Catálogo de muebles','Selecciona un modelo para comparar tamaños, acabados y modalidades de armado.')+
 '<div class="catalog-toolbar"><div class="filters" aria-label="Categorías">'+cats.map(c=>'<button aria-pressed="'+(c===filter)+'" class="'+(c===filter?'':'light')+'">'+c+'</button>').join('')+
 '</div><span class="catalog-count">'+shown.length+' '+(shown.length===1?'modelo':'modelos')+'</span></div>'+cards(shown);
 main.querySelectorAll('.filters button').forEach(b=>b.onclick=()=>{filter=b.textContent;catalog();[...main.querySelectorAll('.filters button')].find(x=>x.textContent===filter)?.focus()});
}
function detail(id){
 const p=product(id);if(!p)return missing();
 main.innerHTML=link('catalogo','Volver al catálogo','back')+'<div class="split">'+img(p.img,p.name,'detailpic')+'<article><span class="kicker">'+p.category+'</span>'+head(p.name,p.desc)+'<p>'+p.material+' · '+p.stock+' disponibles</p><form id="configure">'+select('variant','Dimensiones (ancho × fondo × alto)',p.size.map((s,i)=>[i,s]))+'<div class="two">'+select('finish','Acabado',shop.finishes)+select('mode','Modalidad',[['kit','Kit para armar'],['assembled','Ensamblado en taller']])+'</div>'+input('qty','Cantidad','number',true,'min="1" max="'+Math.min(20,p.stock)+'" value="1"')+'<label><input type="checkbox" name="install"> Instalación a domicilio ('+money(p.install)+' por unidad)</label><div id="calc"></div><p class="note">Flete según zona en el carrito.</p>'+submit(p.stock?'Agregar al carrito':'Agotado')+'</form></article></div>';
 const f=$('#configure'),line=()=>({id,qty:+f.qty.value,variant:+f.variant.value,finish:f.finish.value,mode:f.mode.value,install:f.install.checked});
 const update=()=>{const l=line();$('#calc').innerHTML=row('Subtotal',money((price(l)+installation(l))*l.qty),'total')};f.oninput=update;update();if(!p.stock)f.querySelector('button').disabled=true;
 formAction(f,()=>{const l=line();if(cart.filter(x=>x.id===id).reduce((n,x)=>n+x.qty,0)+l.qty>p.stock)throw Error('La cantidad supera las existencias.');cart.push(l);persist();location.hash='carrito'});
}
function gallery(){main.innerHTML=head('Galerías de imágenes','Explora los modelos de la colección y las posibilidades de un proyecto a medida.')+'<div class="grid gallery">'+[...shop.products.map(p=>[p.img,p.name,'producto/'+p.id]),['kitchen','Cocinas a medida','cotizar'],['hero','Mobiliario para sala','cotizar']].map(([i,t,r])=>'<figure><a href="#'+r+'">'+img(i,t)+'<figcaption>'+t+'</figcaption></a></figure>').join('')+'</div>'}
function creators(){main.innerHTML=head('Creadores','Equipo de Comercio Electrónico · Universidad de El Salvador · Grupo 01')+'<div class="grid">'+shop.team.map(t=>'<article class="panel profile">'+(t.photo?'<img class="portrait" alt="'+esc(t.name)+'" src="'+esc(t.photo)+'">':'<div class="avatar" aria-label="Fotografía pendiente">'+esc(t.name.split(' ').slice(0,2).map(s=>s[0]).join(''))+'</div>')+'<h3>'+esc(t.name)+'</h3><p>'+esc(t.id)+'</p><small>'+esc(t.role||'Rol por confirmar')+'</small></article>').join('')+'</div>'}
function inquiry(quote){
 main.innerHTML=head(quote?'Cotiza tu proyecto':'Contacto',quote?'Solicita un mueble a medida o una propuesta por volumen para tu empresa.':'Envíanos tus dudas sobre materiales, pedidos, entrega o instalación.')+'<div class="split"><form class="panel" id="request">'+personal()+(quote?select('tipo','Tipo de solicitud',['A medida','Empresa / volumen'])+input('empresa','Empresa (opcional)','text',false,'maxlength="160"')+'<div class="two">'+input('medidas','Dimensiones aproximadas','text',true,'placeholder="Ej. 150 × 60 × 75 cm" maxlength="160"')+input('cantidad','Unidades','number',true,'min="1" max="999" value="1"')+'</div><label><input type="checkbox" name="credito_fiscal"> Solicito cotización con crédito fiscal</label>':'')+textArea('mensaje',quote?'Materiales, acabado y detalles del proyecto':'Tu consulta')+submit(quote?'Enviar solicitud':'Enviar consulta')+'</form>'+img(quote?'kitchen':'desk',quote?'Mobiliario de cocina a medida':'Escritorio en madera','detailpic')+'</div>';
 const f=$('#request');formAction(f,async d=>{if(quote){d.cantidad=+d.cantidad;d.credito_fiscal=f.credito_fiscal.checked}const out=await api(quote?'cotizacion':'contacto',d);main.innerHTML=head(quote?'Solicitud recibida':'Consulta recibida')+'<p class="result">Guardamos tu '+(quote?'solicitud de cotización':'consulta')+'. Referencia <strong>'+esc(out.code)+'</strong>.</p>'+link('inicio','Volver al inicio')});
}
function basket(){
 if(!cart.length){main.innerHTML=head('Tu carrito','Tu carrito está vacío.')+link('catalogo','Explorar catálogo');return}
 main.innerHTML=head('Tu carrito')+'<div class="split"><section><h2>Muebles seleccionados</h2>'+cart.map((l,i)=>{const p=product(l.id);return '<article class="line">'+img(p.img,p.name)+'<div><h3>'+p.name+'</h3><p>'+esc(p.size[l.variant])+' · '+esc(l.finish)+' · '+modeName(l.mode)+'</p><p>'+l.qty+' × '+money(price(l))+(l.install?' + instalación '+money(installation(l)*l.qty):'')+'</p><button class="light remove" data-index="'+i+'">Quitar</button></div></article>'}).join('')+link('catalogo','Seguir comprando','back')+'</section><form id="checkout" class="panel"><h2>Entrega y pago</h2>'+personal()+input('telefono','Teléfono','tel',true,'maxlength="35" autocomplete="tel"')+input('direccion','Dirección de entrega','text',true,'maxlength="300" autocomplete="street-address"')+select('zona','Zona de entrega',Object.entries(shop.zones).map(([k,v])=>[k,k+' · '+money(v)]))+select('pago','Forma de pago',shop.methods)+'<div id="terms">'+select('cuotas','Cuotas sin intereses',[[1,'Un pago'],[3,'3 cuotas'],[6,'6 cuotas']])+'</div><p class="info">Pedido de demostración. Usa datos ficticios. El medio seleccionado se registra como simulación.</p><div id="totals"></div>'+submit('Confirmar pedido de prueba')+'</form></div>';
 main.querySelectorAll('.remove').forEach(b=>b.onclick=()=>{cart.splice(+b.dataset.index,1);persist();basket()});
 const f=$('#checkout');const update=()=>{const goods=cart.reduce((a,l)=>a+l.qty*price(l),0),service=cart.reduce((a,l)=>a+l.qty*installation(l),0),freight=shop.zones[f.zona.value],total=goods+service+freight,card=f.pago.value==='Tarjeta';$('#terms').hidden=!card;if(!card)f.cuotas.value='1';const n=+f.cuotas.value,base=Math.floor(total/n);$('#totals').innerHTML=row('Muebles',money(goods))+row('Instalación',money(service))+row('Entrega',money(freight))+row('Total',money(total),'total')+(n>1?row('Plan de cuotas',(n-1)+' × '+money(base)+' + 1 × '+money(total-base*(n-1))):'')};f.onchange=update;update();
 formAction(f,async d=>{d.cuotas=+d.cuotas;d.items=cart;const snapshot=JSON.stringify(d);let attempt=JSON.parse(sessionStorage.getItem('mx-intento')||'null');if(!attempt||attempt.snapshot!==snapshot){attempt={snapshot,token:crypto.randomUUID()};sessionStorage.setItem('mx-intento',JSON.stringify(attempt))}d.intento=attempt.token;const out=await api('pedido',d);sessionStorage.removeItem('mx-intento');cart=[];persist();sessionStorage.setItem('mx-last',out.code);location.hash='seguimiento/'+out.code;shop=await api('shop')});
}
function track(code=''){
 main.innerHTML=head('Seguimiento de pedido','Consulta el estado de tu pedido con la referencia que recibiste al confirmar.')+'<form class="wide panel" id="tracking">'+input('code','Referencia del pedido','text',true,'maxlength="30"')+submit('Consultar pedido')+'</form><div class="wide" id="trackingResult" aria-live="polite"></div>';
 const f=$('#tracking');f.code.value=code||sessionStorage.getItem('mx-last')||'';
 const lookup=async()=>{const ref=f.code.value.trim().toUpperCase(),r=await api('seguimiento/'+encodeURIComponent(ref));$('#trackingResult').innerHTML='<article class="result break"><h3>Pedido '+esc(ref)+'</h3>'+row('Estado',r.estado)+row('Despacho',r.entrega||'Por programar')+r.items.map(l=>row(l.cantidad+' × '+l.producto+' · '+l.modalidad,money((l.precio+l.instalacion)*l.cantidad))).join('')+row('Total con entrega',money(r.total))+row('Pago',r.pago)+row('Comprobante',r.comprobante)+'</article>'};
 formAction(f,async()=>{$('#trackingResult').textContent='';await lookup()});if(code)lookup().catch(e=>f.querySelector('.error').textContent=e.message);
}
function missing(){main.innerHTML=head('Página no encontrada')+link('inicio','Volver al inicio')}
async function management(){
 main.innerHTML=head('Gestión del taller')+'<form class="panel wide" id="login">'+input('clave','Clave de gestión','password',true,'autocomplete="off"')+submit('Ingresar')+'</form>';
 if(!adminKey){formAction($('#login'),async d=>{adminKey=d.clave.trim();try{await api('admin')}catch(e){adminKey='';throw e}await management()});return}
 const records=await api('admin');if(location.hash!=='#gestion')return;
 const details=r=>{const d=r.data;return '<details><summary>'+esc(r.kind)+' · '+esc(d.nombre)+' · '+esc(r.status)+'</summary><p class="break">'+esc(r.code)+' · '+esc(r.stamp.replace('T',' '))+'</p>'+Object.entries(d).filter(([k])=>!['items','total','flete'].includes(k)).map(([k,v])=>row(k.replaceAll('_',' '),typeof v==='boolean'?(v?'Sí':'No'):v)).join('')+(d.items?d.items.map(l=>'<p>'+esc(l.cantidad+' × '+l.producto+' · '+l.modalidad+' · '+l.medidas+' · '+l.acabado)+' · '+money((l.precio+l.instalacion)*l.cantidad)+'</p>').join('')+row('Flete',money(d.flete))+row('Total',money(d.total)):'')+'<form class="record" data-code="'+esc(r.code)+'">'+select('status','Estado',r.kind==='Pedido'?['Recibido','En preparación','En ruta','Entregado']:['Recibido','Atendido'])+(r.kind==='Pedido'?input('despacho','Fecha y ruta de despacho','text',false,'maxlength="160" value="'+esc(d.despacho)+'"')+input('comprobante','Referencia de comprobante de prueba','text',true,'value="'+esc(d.comprobante)+'"'):'')+submit('Guardar cambios')+'</form></details>'};
 main.innerHTML=head('Gestión del taller')+'<button id="logout" class="light">Cerrar sesión</button><div class="bar"><h2>Pedidos y mensajes</h2></div><section class="wide">'+(records.map(details).join('')||'<p>Aún no hay solicitudes registradas.</p>')+'</section><div class="bar"><h2>Inventario y equipo</h2></div><div class="split"><form id="stock" class="panel"><h3>Existencias por modelo</h3>'+select('id','Modelo',shop.products.map(p=>[p.id,p.name+' · '+p.stock+' disponibles']))+input('qty','Nueva existencia total','number',true,'min="0" max="9999"')+submit('Actualizar existencias')+'</form><form id="team" class="panel"><h3>Ficha de creador</h3>'+select('id','Integrante',shop.team.map(t=>[t.id,t.name]))+input('role','Rol desempeñado','text',true,'maxlength="100"')+input('foto','Fotografía (opcional al actualizar)','file',false,'accept="image/jpeg,image/png,image/webp"')+submit('Guardar ficha')+'</form></div>';
 $('#logout').onclick=()=>{adminKey='';management()};
 const saved=async()=>{shop=await api('shop');await management();toast('Cambios guardados')};
 main.querySelectorAll('.record').forEach(f=>{f.elements.status.value=records.find(r=>r.code===f.dataset.code).status;formAction(f,async d=>{await api('admin/record',{...d,code:f.dataset.code});await saved()})});
 formAction($('#stock'),async d=>{await api('admin/stock',{id:d.id,qty:+d.qty});await saved()});
 const f=$('#team');const setRole=()=>f.elements.role.value=shop.team.find(t=>t.id===f.elements.id.value).role;f.elements.id.onchange=setRole;setRole();
 formAction(f,async d=>{let photo='';if(d.foto.size){const bmp=await createImageBitmap(d.foto),canvas=document.createElement('canvas'),s=Math.min(bmp.width,bmp.height);canvas.width=canvas.height=400;canvas.getContext('2d').drawImage(bmp,(bmp.width-s)/2,(bmp.height-s)/2,s,s,0,0,400,400);photo=canvas.toDataURL('image/jpeg',.78);bmp.close()}await api('admin/team',{id:d.id,role:d.role,photo});await saved()});
}
function route(){
 const [page,arg]=(location.hash.slice(1)||'inicio').split('/');
 $('#nav').classList.remove('open');$('#toggle').setAttribute('aria-expanded','false');
 document.querySelectorAll('nav a').forEach(a=>{a.removeAttribute('aria-current');if(a.hash==='#'+page)a.setAttribute('aria-current','page')});
 const pages={inicio:home,catalogo:catalog,producto:()=>detail(arg),galeria:gallery,creadores:creators,contacto:()=>inquiry(false),cotizar:()=>inquiry(true),carrito:basket,seguimiento:()=>track(arg),gestion:management};
 Promise.resolve((pages[page]||missing)()).catch(e=>{main.textContent=e.message});window.scrollTo(0,0);main.focus({preventScroll:true});document.title=(main.querySelector('h1')?.textContent||'Tienda')+' | Mueblux';
}
$('#toggle').onclick=()=>{const open=$('#nav').classList.toggle('open');$('#toggle').setAttribute('aria-expanded',String(open))};
(async()=>{try{shop=await api('shop');cart=cart.filter(l=>l&&product(l.id)&&Number.isInteger(l.qty)&&l.qty>0&&['kit','assembled'].includes(l.mode)&&[0,1].includes(l.variant)&&shop.finishes.includes(l.finish));persist();route();window.addEventListener('hashchange',route)}catch(e){main.textContent='No se pudo cargar la tienda. Actualiza la página para intentarlo de nuevo.'}})();
