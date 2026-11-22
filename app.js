/* ========== ESTADO ========== */
let STATE = DB.load();
let currentView = 'list';
let editingFightId = null;
let editingCompId = null;

/* ========== UTILIDADES ========== */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const uid = () => 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2200);
}

function activeComp() {
  return STATE.comps.find(c => c.id === STATE.activeCompId) || STATE.comps[0];
}

function save() { DB.save(STATE); }

/* ========== TEMA ========== */
function applySettings() {
  const s = STATE.settings;
  document.documentElement.setAttribute('data-theme', s.theme);
  document.documentElement.style.setProperty('--primary', s.primary);
  document.documentElement.style.setProperty('--accent', s.accent);
  document.documentElement.style.setProperty('--font-size', s.fontSize + 'px');
  document.documentElement.style.setProperty('--animation-speed', s.animationSpeed);
  document.body.classList.toggle('competition-mode', s.competitionMode);
  if (s.bgImage) {
    document.documentElement.setAttribute('data-bg','image');
    document.documentElement.style.setProperty('--custom-bg', `url(${s.bgImage})`);
  } else {
    document.documentElement.removeAttribute('data-bg');
  }
}

/* ========== NAVEGACIÓN ========== */
function goTo(view) {
  currentView = view;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  renderView(view);
  window.scrollTo({top:0, behavior:'smooth'});
}

function renderView(view) {
  if (view === 'list') renderFightList();
  else if (view === 'schedule') renderSchedule();
  else if (view === 'comps') renderComps();
  else if (view === 'summary') renderSummary();
  else if (view === 'settings') renderSettings();
  const c = activeComp();
  $('#activeCompName').textContent = c ? c.name : 'Sin competición';
}

/* ========== VISTA: LISTA ========== */
function renderFightList() {
  const c = activeComp();
  if (!c) { $('#fightList').innerHTML = emptyState('Sin competiciones'); return; }

  // Rellenar filtros
  const matSet = new Set(c.fights.map(f => f.mat).filter(Boolean));
  const catSet = new Set(c.fights.map(f => f.category).filter(Boolean));
  fillSelect($('#filterMat'), 'Todos los tapices', [...matSet], $('#filterMat').value);
  fillSelect($('#filterCat'), 'Todas las categorías', [...catSet], $('#filterCat').value);

  const q = $('#searchInput').value.toLowerCase().trim();
  const sort = $('#sortSelect').value;
  const fMat = $('#filterMat').value;
  const fCat = $('#filterCat').value;
  const fState = $('#filterState').value;

  let fights = c.fights.slice();
  if (q) fights = fights.filter(f =>
    (f.athlete||'').toLowerCase().includes(q) ||
    (f.category||'').toLowerCase().includes(q) ||
    (f.mat||'').toLowerCase().includes(q) ||
    (f.notes||'').toLowerCase().includes(q) ||
    (f.modality||'').toLowerCase().includes(q) ||
    Object.values(f.custom||{}).some(v => (''+v).toLowerCase().includes(q))
  );
  if (fMat) fights = fights.filter(f => f.mat === fMat);
  if (fCat) fights = fights.filter(f => f.category === fCat);
  if (fState) fights = fights.filter(f => f.state === fState);

  const sorters = {
    number: (a,b) => (a.number||0) - (b.number||0),
    time: (a,b) => (a.time||'99').localeCompare(b.time||'99'),
    mat: (a,b) => (a.mat||'').localeCompare(b.mat||''),
    athlete: (a,b) => (a.athlete||'').localeCompare(b.athlete||''),
    category: (a,b) => (a.category||'').localeCompare(b.category||'')
  };
  fights.sort(sorters[sort] || sorters.number);

  const list = $('#fightList');
  if (!fights.length) {
    list.innerHTML = emptyState(c.fights.length ? 'Sin resultados con estos filtros' : 'Aún no hay combates. ¡Añade el primero!');
    return;
  }

  const stateLabel = { pending:'Pendiente', ongoing:'En curso', done:'Finalizado', cancelled:'Cancelado' };

  list.innerHTML = fights.map(f => {
    const extra = Object.entries(f.custom||{}).filter(([_,v])=>v).map(([k,v]) =>
      `<div><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</div>`).join('');
    return `
    <div class="fight-card" data-state="${f.state||'pending'}" data-id="${f.id}">
      <div class="fight-top">
        <div class="fight-num">#${f.number || '—'}</div>
        <div class="fight-badges">
          ${f.mat ? `<span class="badge">🟦 ${escapeHtml(f.mat)}</span>` : ''}
          ${f.time ? `<span class="badge">🕐 ${escapeHtml(f.time)}</span>` : ''}
          <span class="badge state-${f.state||'pending'}">${stateLabel[f.state||'pending']}</span>
        </div>
      </div>
      <div class="fight-athlete">${escapeHtml(f.athlete || 'Sin nombre')}</div>
      <div class="fight-meta">
        ${f.category ? `<span>${escapeHtml(f.category)}</span>` : ''}
        ${f.modality ? `<span>· ${escapeHtml(f.modality)}</span>` : ''}
      </div>
      ${extra ? `<div class="fight-extra">${extra}</div>` : ''}
      ${f.notes ? `<div class="fight-extra">📝 ${escapeHtml(f.notes)}</div>` : ''}
    </div>`;
  }).join('');

  $$('.fight-card', list).forEach(card => {
    card.addEventListener('click', () => openFightModal(card.dataset.id));
  });
}

function fillSelect(sel, allLabel, values, current) {
  sel.innerHTML = `<option value="">${allLabel}</option>` +
    values.map(v => `<option value="${escapeHtml(v)}" ${v===current?'selected':''}>${escapeHtml(v)}</option>`).join('');
}

function emptyState(msg) {
  return `<div class="empty"><span class="emoji">🥋</span>${escapeHtml(msg)}</div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* ========== MODAL COMBATE ========== */
function openFightModal(id=null) {
  editingFightId = id;
  const c = activeComp();
  const f = id ? c.fights.find(x=>x.id===id) : {
    number: nextNumber(c), time:'', mat:'', athlete:'', category:'', modality:'', state:'pending', notes:'', custom:{}
  };
  const custom = f.custom || {};
  const customFields = c.customFields || [];

  $('#modalBody').innerHTML = `
    <h3 style="margin:0 0 14px">${id?'Editar':'Nuevo'} combate</h3>
    <div class="grid-3">
      <div class="form-row"><label>Número</label><input type="number" id="fNum" value="${f.number||''}"></div>
      <div class="form-row"><label>Hora</label><input type="time" id="fTime" value="${f.time||''}"></div>
      <div class="form-row"><label>Tapiz</label><input type="text" id="fMat" value="${escapeHtml(f.mat||'')}" list="matList">
        <datalist id="matList">${(c.matNames||[]).map(m=>`<option>${escapeHtml(m)}</option>`).join('')}</datalist>
      </div>
    </div>
    <div class="form-row"><label>Deportista *</label><input type="text" id="fAthlete" value="${escapeHtml(f.athlete||'')}" placeholder="Nombre del deportista" required></div>
    <div class="grid-2">
      <div class="form-row"><label>Categoría</label><input type="text" id="fCat" value="${escapeHtml(f.category||'')}" placeholder="Ej: -68kg Senior"></div>
      <div class="form-row"><label>Modalidad</label>
        <select id="fMod">
          <option value="">—</option>
          ${['Combate','Freestyle','Poomsae','Otro'].map(m=>`<option ${f.modality===m?'selected':''}>${m}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row"><label>Estado</label>
      <select id="fState">
        <option value="pending" ${f.state==='pending'?'selected':''}>Pendiente</option>
        <option value="ongoing" ${f.state==='ongoing'?'selected':''}>En curso</option>
        <option value="done" ${f.state==='done'?'selected':''}>Finalizado</option>
        <option value="cancelled" ${f.state==='cancelled'?'selected':''}>Cancelado</option>
      </select>
    </div>
    ${customFields.length ? `<h4 style="margin:14px 0 8px;font-size:13px;color:var(--muted)">Campos personalizados</h4>
      ${customFields.map(cf => `
        <div class="form-row"><label>${escapeHtml(cf.name)}</label>
          <input type="text" data-custom="${escapeHtml(cf.name)}" value="${escapeHtml(custom[cf.name]||'')}">
        </div>`).join('')}` : ''}
    <div class="form-row"><label>Notas</label><textarea id="fNotes">${escapeHtml(f.notes||'')}</textarea></div>
    <div class="form-actions">
      <button class="btn-primary" id="saveFight">💾 Guardar</button>
      ${id ? `<button class="btn-ghost" id="dupFight">📋 Duplicar</button>
              <button class="btn-danger" id="delFight">🗑 Eliminar</button>` : ''}
    </div>
  `;
  showModal();

  $('#saveFight').onclick = () => {
    const athlete = $('#fAthlete').value.trim();
    if (!athlete) return toast('El deportista es obligatorio');
    const customObj = {};
    $$('[data-custom]').forEach(el => { customObj[el.dataset.custom] = el.value.trim(); });
    const data = {
      id: f.id || uid(),
      number: +$('#fNum').value || nextNumber(c),
      time: $('#fTime').value,
      mat: $('#fMat').value.trim(),
      athlete,
      category: $('#fCat').value.trim(),
      modality: $('#fMod').value,
      state: $('#fState').value,
      notes: $('#fNotes').value.trim(),
      custom: customObj
    };
    if (id) {
      const idx = c.fights.findIndex(x=>x.id===id);
      c.fights[idx] = data;
    } else {
      c.fights.push(data);
    }
    save(); closeModal(); toast(id?'Combate actualizado':'Combate añadido');
    renderView(currentView);
  };
  if (id) {
    $('#dupFight').onclick = () => {
      const copy = {...f, id: uid(), number: nextNumber(c)};
      c.fights.push(copy); save(); closeModal(); toast('Combate duplicado'); renderView(currentView);
    };
    $('#delFight').onclick = () => {
      if (!confirm('¿Eliminar este combate?')) return;
      c.fights = c.fights.filter(x=>x.id!==id);
      save(); closeModal(); toast('Combate eliminado'); renderView(currentView);
    };
  }
}

function nextNumber(c) {
  if (!c.fights.length) return 1;
  return Math.max(...c.fights.map(f => +f.number || 0)) + 1;
}

/* ========== MODAL GENÉRICO ========== */
function showModal() { $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); }

/* ========== VISTA: HORARIOS ========== */
function renderSchedule() {
  const c = activeComp();
  if (!c) return;
  const sch = c.schedule || { start:'09:00', duration:15, breakMin:5 };
  $('#schedStart').value = sch.start;
  $('#schedDuration').value = sch.duration;
  $('#schedBreak').value = sch.breakMin;
  $('#schedMats').value = c.mats || 2;

  const mats = c.matNames || ['Tapiz 1','Tapiz 2'];
  const groups = {};
  mats.forEach(m => groups[m] = []);
  c.fights.slice().sort((a,b) => (+a.number||0) - (+b.number||0)).forEach(f => {
    const key = f.mat && mats.includes(f.mat) ? f.mat : mats[0];
    groups[key].push(f);
  });

  $('#scheduleView').innerHTML = mats.map(m => `
    <div class="mat-group">
      <h3>${escapeHtml(m)} (${groups[m].length})</h3>
      ${groups[m].length ? groups[m].map(f => `
        <div class="schedule-item">
          <time>${escapeHtml(f.time||'—')}</time>
          <span style="flex:1">#${f.number||'—'} · ${escapeHtml(f.athlete||'')}</span>
          ${f.category ? `<span class="badge">${escapeHtml(f.category)}</span>` : ''}
        </div>`).join('') : `<div class="empty" style="padding:20px">Sin combates</div>`}
    </div>
  `).join('');

  $('#schedStart').onchange = e => { c.schedule.start = e.target.value; save(); };
  $('#schedDuration').onchange = e => { c.schedule.duration = +e.target.value; save(); };
  $('#schedBreak').onchange = e => { c.schedule.breakMin = +e.target.value; save(); };
  $('#schedMats').onchange = e => {
    const n = Math.max(1, +e.target.value);
    c.mats = n;
    c.matNames = c.matNames || [];
    while (c.matNames.length < n) c.matNames.push('Tapiz ' + (c.matNames.length+1));
    c.matNames = c.matNames.slice(0, n);
    save(); renderSchedule();
  };

  $('#calcScheduleBtn').onclick = calcSchedule;
}

function calcSchedule() {
  const c = activeComp();
  const sch = c.schedule;
  const mats = c.matNames;
  const fights = c.fights.slice().sort((a,b)=>(+a.number||0)-(+b.number||0));
  if (!fights.length) return toast('No hay combates para programar');

  const [h, m] = sch.start.split(':').map(Number);
  let base = h*60 + m;
  const slot = sch.duration + sch.breakMin;
  const matCursor = {};
  mats.forEach(m => matCursor[m] = base);

  fights.forEach(f => {
    const mat = f.mat && mats.includes(f.mat) ? f.mat : mats[0];
    const t = matCursor[mat];
    const hh = String(Math.floor(t/60)%24).padStart(2,'0');
    const mm = String(t%60).padStart(2,'0');
    f.time = `${hh}:${mm}`;
    f.mat = mat;
    matCursor[mat] = t + slot;
  });

  save();
  toast('⏰ Horarios calculados');
  renderSchedule();
  if (currentView === 'list') renderFightList();
}

/* ========== VISTA: COMPETICIONES ========== */
function renderComps() {
  const list = $('#compList');
  if (!STATE.comps.length) {
    list.innerHTML = emptyState('Sin competiciones');
    return;
  }
  list.innerHTML = STATE.comps.map(c => `
    <div class="comp-card ${c.id===STATE.activeCompId?'active':''}" data-id="${c.id}">
      <h3>${escapeHtml(c.name)} ${c.archived?'📦':''}</h3>
      <div class="meta">${escapeHtml(c.date||'')} · ${escapeHtml(c.place||'Sin lugar')} · ${c.fights.length} combates · ${c.mats} tapices</div>
      <div class="comp-actions">
        ${c.id!==STATE.activeCompId?`<button class="btn-primary" data-action="activate">Activar</button>`:'<span class="badge">Activa</span>'}
        <button class="btn-ghost" data-action="edit">✏️</button>
        <button class="btn-ghost" data-action="dup">📋</button>
        <button class="btn-ghost" data-action="archive">${c.archived?'Desarchivar':'Archivar'}</button>
        ${STATE.comps.length>1?`<button class="btn-danger" data-action="del">🗑</button>`:''}
      </div>
    </div>
  `).join('');

  $$('.comp-card').forEach(card => {
    const id = card.dataset.id;
    card.querySelectorAll('[data-action]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const c = STATE.comps.find(x=>x.id===id);
        if (action==='activate') { STATE.activeCompId = id; save(); toast('Competición activada'); renderComps(); renderView(currentView); }
        else if (action==='edit') openCompModal(id);
        else if (action==='dup') {
          const copy = JSON.parse(JSON.stringify(c));
          copy.id = uid(); copy.name += ' (copia)';
          STATE.comps.push(copy); save(); toast('Competición duplicada'); renderComps();
        }
        else if (action==='archive') { c.archived = !c.archived; save(); renderComps(); }
        else if (action==='del') {
          if (!confirm('¿Eliminar esta competición y todos sus combates?')) return;
          STATE.comps = STATE.comps.filter(x=>x.id!==id);
          if (STATE.activeCompId===id) STATE.activeCompId = STATE.comps[0].id;
          save(); toast('Competición eliminada'); renderComps(); renderView(currentView);
        }
      };
    });
  });
}

function openCompModal(id=null) {
  const c = id ? STATE.comps.find(x=>x.id===id) : {
    name:'', date: new Date().toISOString().slice(0,10), place:'', organizer:'', mats:1,
    matNames:['Tapiz 1'], extra:'', archived:false,
    schedule:{start:'09:00',duration:15,breakMin:5}, fights:[], customFields:[]
  };
  $('#modalBody').innerHTML = `
    <h3 style="margin:0 0 14px">${id?'Editar':'Nueva'} competición</h3>
    <div class="form-row"><label>Nombre *</label><input type="text" id="cName" value="${escapeHtml(c.name)}"></div>
    <div class="grid-2">
      <div class="form-row"><label>Fecha</label><input type="date" id="cDate" value="${c.date||''}"></div>
      <div class="form-row"><label>Nº tapices</label><input type="number" id="cMats" min="1" max="20" value="${c.mats||1}"></div>
    </div>
    <div class="form-row"><label>Lugar</label><input type="text" id="cPlace" value="${escapeHtml(c.place||'')}"></div>
    <div class="form-row"><label>Organizador</label><input type="text" id="cOrg" value="${escapeHtml(c.organizer||'')}"></div>
    <div class="form-row"><label>Info adicional</label><textarea id="cExtra">${escapeHtml(c.extra||'')}</textarea></div>
    <div class="form-actions">
      <button class="btn-primary" id="saveComp">💾 Guardar</button>
    </div>
  `;
  showModal();
  $('#saveComp').onclick = () => {
    const name = $('#cName').value.trim();
    if (!name) return toast('El nombre es obligatorio');
    const mats = Math.max(1, +$('#cMats').value || 1);
    const matNames = c.matNames && c.matNames.length ? c.matNames.slice() : [];
    while (matNames.length < mats) matNames.push('Tapiz ' + (matNames.length+1));
    matNames.length = mats;
    const data = {
      id: c.id || uid(),
      name, date: $('#cDate').value, place: $('#cPlace').value.trim(),
      organizer: $('#cOrg').value.trim(), mats, matNames,
      extra: $('#cExtra').value.trim(),
      archived: c.archived || false,
      schedule: c.schedule || {start:'09:00',duration:15,breakMin:5},
      fights: c.fights || [],
      customFields: c.customFields || []
    };
    if (id) {
      const idx = STATE.comps.findIndex(x=>x.id===id);
      STATE.comps[idx] = data;
    } else {
      STATE.comps.push(data);
      STATE.activeCompId = data.id;
    }
    save(); closeModal(); toast(id?'Competición actualizada':'Competición creada');
    renderComps(); renderView(currentView);
  };
}

/* ========== VISTA: RESUMEN ========== */
function renderSummary() {
  const c = activeComp();
  if (!c) return;
  const fights = c.fights;
  const total = fights.length;
  const pending = fights.filter(f=>f.state==='pending'||!f.state).length;
  const ongoing = fights.filter(f=>f.state==='ongoing').length;
  const done = fights.filter(f=>f.state==='done').length;
  const cancelled = fights.filter(f=>f.state==='cancelled').length;
  const cats = new Set(fights.map(f=>f.category).filter(Boolean)).size;
  const pct = total ? Math.round(done/total*100) : 0;

  const byMat = {};
  (c.matNames||[]).forEach(m => byMat[m]=0);
  fights.forEach(f => { const k = f.mat || 'Sin tapiz'; byMat[k] = (byMat[k]||0)+1; });
  const maxMat = Math.max(1, ...Object.values(byMat));

  $('#summaryContent').innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="num blue">${total}</div><div class="lbl">Combates</div></div>
      <div class="stat-card"><div class="num orange">${pending}</div><div class="lbl">Pendientes</div></div>
      <div class="stat-card"><div class="num green">${done}</div><div class="lbl">Finalizados</div></div>
      <div class="stat-card"><div class="num red">${ongoing}</div><div class="lbl">En curso</div></div>
      <div class="stat-card"><div class="num">${c.mats}</div><div class="lbl">Tapices</div></div>
      <div class="stat-card"><div class="num">${cats}</div><div class="lbl">Categorías</div></div>
    </div>
    <div class="card">
      <h3>Progreso</h3>
      <div style="font-size:26px;font-weight:900">${pct}%</div>
      <div class="progress-bar"><div style="width:${pct}%"></div></div>
      ${cancelled ? `<div style="font-size:12px;color:var(--muted);margin-top:8px">${cancelled} cancelados</div>` : ''}
    </div>
    <div class="card">
      <h3>Distribución por tapiz</h3>
      ${Object.entries(byMat).map(([k,v])=>`
        <div class="bar-row">
          <span class="lbl">${escapeHtml(k)}</span>
          <div class="bar"><div style="width:${v/maxMat*100}%"></div></div>
          <span class="val">${v}</span>
        </div>`).join('') || '<div class="empty">Sin datos</div>'}
    </div>
  `;
}

/* ========== VISTA: AJUSTES ========== */
function renderSettings() {
  const s = STATE.settings;
  const c = activeComp();

  $('#settingsContent').innerHTML = `
    <div class="card">
      <h3>🎨 Tema</h3>
      <div class="toggle-row">
        <span>Tema claro</span>
        <label class="switch"><input type="checkbox" id="sTheme" ${s.theme==='light'?'checked':''}><span class="slider"></span></label>
      </div>
      <div class="toggle-row">
        <span>Modo competición</span>
        <label class="switch"><input type="checkbox" id="sCompMode" ${s.competitionMode?'checked':''}><span class="slider"></span></label>
      </div>
      <div class="form-row" style="margin-top:12px">
        <label>Color principal</label>
        <div style="display:flex;gap:8px">
          ${['#3b7bff','#7b4dff','#22c55e','#f59e0b','#ef4444','#ec4899','#06b6d4'].map(col=>`
            <div class="color-swatch ${s.primary===col?'active':''}" style="background:${col}" data-col="${col}" data-target="primary"></div>`).join('')}
        </div>
      </div>
      <div class="form-row">
        <label>Color de acento</label>
        <div style="display:flex;gap:8px">
          ${['#ff3d5a','#f59e0b','#22c55e','#06b6d4','#ec4899','#eab308','#ef4444'].map(col=>`
            <div class="color-swatch ${s.accent===col?'active':''}" style="background:${col}" data-col="${col}" data-target="accent"></div>`).join('')}
        </div>
      </div>
      <div class="form-row">
        <label>Tamaño de letra: ${s.fontSize}px</label>
        <input type="range" id="sFont" min="13" max="20" value="${s.fontSize}">
      </div>
      <div class="form-row">
        <label>Velocidad animaciones: ${s.animationSpeed}x</label>
        <input type="range" id="sAnim" min="0.5" max="2" step="0.25" value="${s.animationSpeed}">
      </div>
      <div class="form-row">
        <label>Imagen de fondo</label>
        <input type="file" id="bgFile" accept="image/*">
        ${s.bgImage?`<button class="btn-ghost" id="clearBg" style="margin-top:6px">Quitar imagen</button>`:''}
      </div>
    </div>

    <div class="card">
      <h3>🥋 Competición actual</h3>
      ${c?`
        <div class="form-row"><label>Nombre</label><input type="text" id="ccName" value="${escapeHtml(c.name)}"></div>
        <div class="form-row"><label>Tapices (separados por coma)</label>
          <input type="text" id="ccMats" value="${escapeHtml((c.matNames||[]).join(', '))}">
        </div>
      `:'<div class="empty">Sin competición</div>'}
    </div>

    <div class="card">
      <h3>➕ Campos personalizados</h3>
      ${c?`
        <div id="cfList">
          ${(c.customFields||[]).map((cf,i)=>`
            <div class="toggle-row">
              <span>${escapeHtml(cf.name)}</span>
              <button class="btn-danger" data-rmcf="${i}" style="padding:6px 10px;font-size:12px">Eliminar</button>
            </div>`).join('') || '<div class="empty" style="padding:16px">Sin campos</div>'}
        </div>
        <div class="form-row" style="margin-top:10px">
          <input type="text" id="newCf" placeholder="Ej: Club, Coach, Provincia...">
        </div>
        <button class="btn-primary" id="addCf">Añadir campo</button>
      `:'<div class="empty">Sin competición</div>'}
    </div>

    <div class="card">
      <h3>💾 Datos</h3>
      <div class="form-actions">
        <button class="btn-ghost" id="exportCSV">📥 Exportar CSV</button>
        <button class="btn-ghost" id="importCSV">📤 Importar CSV</button>
        <button class="btn-ghost" id="exportJSON">💾 Backup JSON</button>
        <button class="btn-ghost" id="importJSON">♻️ Restaurar JSON</button>
        <button class="btn-ghost" id="printBtn">🖨️ Imprimir / PDF</button>
        <button class="btn-danger" id="resetBtn">🗑 Borrar todo</button>
      </div>
      <input type="file" id="csvFile" accept=".csv" style="display:none">
      <input type="file" id="jsonFile" accept=".json" style="display:none">
    </div>
  `;

  // Tema
  $('#sTheme').onchange = e => { s.theme = e.target.checked?'light':'dark'; save(); applySettings(); };
  $('#sCompMode').onchange = e => { s.competitionMode = e.target.checked; save(); applySettings(); };

  $$('.color-swatch').forEach(sw => {
    sw.onclick = () => {
      s[sw.dataset.target] = sw.dataset.col;
      save(); applySettings(); renderSettings();
    };
  });
  $('#sFont').oninput = e => { s.fontSize = +e.target.value; save(); applySettings(); e.target.previousElementSibling.textContent = `Tamaño de letra: ${s.fontSize}px`; };
  $('#sAnim').oninput = e => { s.animationSpeed = +e.target.value; save(); applySettings(); };

  $('#bgFile').onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { s.bgImage = reader.result; save(); applySettings(); renderSettings(); };
    reader.readAsDataURL(file);
  };
  const clearBgBtn = $('#clearBg');
  if (clearBgBtn) clearBgBtn.onclick = () => { s.bgImage = null; save(); applySettings(); renderSettings(); };

  if (c) {
    $('#ccName').onchange = e => { c.name = e.target.value; save(); renderView(currentView); };
    $('#ccMats').onchange = e => {
      const names = e.target.value.split(',').map(x=>x.trim()).filter(Boolean);
      c.matNames = names.length?names:['Tapiz 1'];
      c.mats = c.matNames.length;
      save(); renderView(currentView);
    };

    $$('[data-rmcf]').forEach(btn => {
      btn.onclick = () => {
        const i = +btn.dataset.rmcf;
        if (!confirm('¿Eliminar este campo? Los datos existentes no se borran pero dejarán de mostrarse.')) return;
        c.customFields.splice(i,1); save(); renderSettings();
      };
    });
    $('#addCf').onclick = () => {
      const name = $('#newCf').value.trim();
      if (!name) return toast('Escribe un nombre');
      if (c.customFields.some(f=>f.name===name)) return toast('Ya existe ese campo');
      c.customFields.push({name}); save(); toast('Campo añadido'); renderSettings();
    };
  }

  // Datos
  $('#exportCSV').onclick = () => exportCSV();
  $('#importCSV').onclick = () => $('#csvFile').click();
  $('#csvFile').onchange = e => importCSV(e.target.files[0]);
  $('#exportJSON').onclick = () => {
    download(`fightlist-backup-${Date.now()}.json`, JSON.stringify(STATE,null,2), 'application/json');
    toast('Backup descargado');
  };
  $('#importJSON').onclick = () => $('#jsonFile').click();
  $('#jsonFile').onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.comps || !data.settings) throw new Error('Formato incorrecto');
        STATE = data; save(); applySettings(); toast('Backup restaurado');
        renderView(currentView);
      } catch(err) { toast('Archivo inválido'); }
    };
    reader.readAsText(file);
  };
  $('#printBtn').onclick = () => window.print();
  $('#resetBtn').onclick = () => {
    if (!confirm('¿BORRAR TODOS los datos? Esta acción no se puede deshacer.')) return;
    if (!confirm('¿Estás SEGURO? Se perderán todas las competiciones.')) return;
    localStorage.removeItem(DB.KEY);
    STATE = DB.defaults(); save(); applySettings(); renderView(currentView);
    toast('Datos borrados');
  };
}

/* ========== CSV ========== */
function exportCSV() {
  const c = activeComp();
  if (!c) return;
  const customNames = (c.customFields||[]).map(f=>f.name);
  const headers = ['number','time','mat','athlete','category','modality','state','notes', ...customNames];
  const rows = [headers.join(',')];
  c.fights.forEach(f => {
    const row = [
      f.number||'', f.time||'', f.mat||'', f.athlete||'', f.category||'',
      f.modality||'', f.state||'', (f.notes||'').replace(/[\n,]/g,' '),
      ...customNames.map(n => (f.custom&&f.custom[n]||'').replace(/[\n,]/g,' '))
    ];
    rows.push(row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
  });
  download(`combates-${c.name.replace(/\s+/g,'_')}.csv`, rows.join('\n'), 'text/csv');
  toast('CSV exportado');
}

function importCSV(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = reader.result;
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) return toast('CSV vacío');
      const headers = parseCSVLine(lines[0]);
      const c = activeComp();
      const stdFields = ['number','time','mat','athlete','category','modality','state','notes'];
      // Registrar campos personalizados nuevos
      headers.forEach(h => {
        if (!stdFields.includes(h) && !(c.customFields||[]).some(f=>f.name===h)) {
          c.customFields = c.customFields || [];
          c.customFields.push({name: h});
        }
      });
      lines.slice(1).forEach(line => {
        const vals = parseCSVLine(line);
        const obj = {};
        headers.forEach((h,i) => obj[h] = vals[i] || '');
        const custom = {};
        Object.keys(obj).forEach(k => {
          if (!stdFields.includes(k) && obj[k]) custom[k] = obj[k];
        });
        c.fights.push({
          id: uid(),
          number: +obj.number || nextNumber(c),
          time: obj.time || '',
          mat: obj.mat || '',
          athlete: obj.athlete || '',
          category: obj.category || '',
          modality: obj.modality || '',
          state: obj.state || 'pending',
          notes: obj.notes || '',
          custom
        });
      });
      save(); toast(`Importados ${lines.length-1} combates`);
      renderView(currentView);
    } catch(e) { toast('Error al leer CSV'); console.error(e); }
  };
  reader.readAsText(file);
}

function parseCSVLine(line) {
  const out = []; let cur = ''; let inQ = false;
  for (let i=0;i<line.length;i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i+1]==='"') { cur+='"'; i++; }
      else inQ = !inQ;
    } else if (ch===',' && !inQ) { out.push(cur); cur=''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function download(filename, content, mime) {
  const blob = new Blob([content], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 100);
}

/* ========== EVENTOS GLOBALES ========== */
function init() {
  applySettings();
  renderView('list');

  $$('.nav-btn').forEach(btn => {
    btn.onclick = () => goTo(btn.dataset.view);
  });
  $('#addFightBtn').onclick = () => openFightModal();
  $('#addCompBtn').onclick = () => openCompModal();
  $('#modalClose').onclick = closeModal;
  $('#modal').onclick = e => { if (e.target === $('#modal')) closeModal(); };
  $('#compSwitchBtn').onclick = () => goTo('comps');

  ['searchInput','sortSelect','filterMat','filterCat','filterState'].forEach(id => {
    const el = $('#'+id);
    if (el) el.addEventListener('input', renderFightList);
  });

  // PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
}

document.addEventListener('DOMContentLoaded', init);
