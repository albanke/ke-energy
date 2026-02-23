(function(){
  const apiBase = (document.querySelector('meta[name="ke-api-base"]')?.getAttribute('content')?.trim() || (() => { try { return (localStorage.getItem('ke_api_base')||'').trim(); } catch(e) { return ''; } })() || "");
  const base = apiBase ? apiBase.replace(/\/$/, "") : "";
  const api = (path) => (base ? base + path : path);

  const els = {
    sessionChip: document.getElementById('sessionChip'),
    loginPanel: document.getElementById('loginPanel'),
    adminPanel: document.getElementById('adminPanel'),
    contattiPanel: document.getElementById('contattiPanel'),
    prodottiPanel: document.getElementById('prodottiPanel'),
    incentiviPanel: document.getElementById('incentiviPanel'),

    prodottiListPanel: document.getElementById('prodottiListPanel'),
    incentiviListPanel: document.getElementById('incentiviListPanel'),

    loginForm: document.getElementById('loginForm'),
    loginMsg: document.getElementById('loginMsg'),
    clearSessionBtn: document.getElementById('clearSessionBtn'),

    refreshAllBtn: document.getElementById('refreshAllBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    adminMsg: document.getElementById('adminMsg'),

    contattiBody: document.getElementById('contattiBody'),
    pageChip: document.getElementById('pageChip'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),

    prodottoForm: document.getElementById('prodottoForm'),
    prodottoMsg: document.getElementById('prodottoMsg'),

    incentivoForm: document.getElementById('incentivoForm'),
    incentivoMsg: document.getElementById('incentivoMsg'),

    // Upload inputs (prodotti)
    pImmagineFile: document.getElementById('pImmagineFile'),
    pPdfFile: document.getElementById('pPdfFile'),

    // Upload inputs (incentivi)
    iImmagineFile: document.getElementById('iImmagineFile'),

    // Modal modifica
    editDialog: document.getElementById('editDialog'),
    editTitle: document.getElementById('editTitle'),
    editCloseBtn: document.getElementById('editCloseBtn'),
    editForm: document.getElementById('editForm'),
    editFields: document.getElementById('editFields'),
    editType: document.getElementById('editType'),
    editId: document.getElementById('editId'),
    editMsg: document.getElementById('editMsg'),

    // Liste
    prodottiBody: document.getElementById('prodottiBody'),
    incentiviBody: document.getElementById('incentiviBody'),
    refreshProdottiBtn: document.getElementById('refreshProdottiBtn'),
    refreshIncentiviBtn: document.getElementById('refreshIncentiviBtn')
  };

  const LS_TOKEN = 'ke_admin_token';
  const LS_EXP = 'ke_admin_token_exp';

  let state = {
    page: 1,
    limit: 50
  };

  function setMsg(el, type, text){
    if(!el) return;
    el.classList.remove('hide','ok','err');
    el.classList.add(type === 'ok' ? 'ok' : 'err');
    el.textContent = text;
  }
  function clearMsg(el){
    if(!el) return;
    el.classList.add('hide');
    el.textContent = '';
    el.classList.remove('ok','err');
  }

  function getToken(){
    const t = localStorage.getItem(LS_TOKEN) || '';
    const exp = Number(localStorage.getItem(LS_EXP) || 0);
    if(!t) return null;
    if(exp && Date.now() > exp){
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_EXP);
      return null;
    }
    return { token: t, exp };
  }

  function setToken(token, exp){
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_EXP, String(exp || 0));
  }

  function clearToken(){
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_EXP);
  }

  function authHeaders(){
    const s = getToken();
    if(!s) return {};
    return { Authorization: 'Bearer ' + s.token };
  }

  function showAuthedUI(){
    const s = getToken();
    if(els.sessionChip){
      if(s) els.sessionChip.textContent = 'Autenticato';
      else els.sessionChip.textContent = 'Non autenticato';
    }

    const authed = Boolean(s);
    if(els.loginPanel) els.loginPanel.classList.toggle('hide', authed);
    if(els.adminPanel) els.adminPanel.classList.toggle('hide', !authed);
    if(els.contattiPanel) els.contattiPanel.classList.toggle('hide', !authed);
    if(els.prodottiPanel) els.prodottiPanel.classList.toggle('hide', !authed);
    if(els.incentiviPanel) els.incentiviPanel.classList.toggle('hide', !authed);
    if(els.prodottiListPanel) els.prodottiListPanel.classList.toggle('hide', !authed);
    if(els.incentiviListPanel) els.incentiviListPanel.classList.toggle('hide', !authed);
  }

  async function request(path, opts){
    const res = await fetch(api(path), {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(opts && opts.headers ? opts.headers : {})
      }
    });
    const data = await res.json().catch(() => ({}));
    if(!res.ok){
      const msg = data && data.error ? data.error : 'Errore richiesta';
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function uploadFile(file){
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(api('/api/admin/upload'), {
      method: 'POST',
      headers: { ...authHeaders() },
      body: fd
    });
    const data = await res.json().catch(() => ({}));
    if(!res.ok){
      const msg = data && data.error ? data.error : 'Errore upload';
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function esc(s){
    return String(s || '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  async function login(username, password){
    const data = await request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    setToken(data.token, data.expiresAt);
  }

  async function logout(){
    try {
      await request('/api/admin/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    clearToken();
  }

  async function loadContatti(){
    clearMsg(els.adminMsg);
    clearMsg(els.loginMsg);

    const data = await request(`/api/admin/contatti?page=${state.page}&limit=${state.limit}`, { method: 'GET' });
    const rows = Array.isArray(data.rows) ? data.rows : [];

    if(els.pageChip) els.pageChip.textContent = `Pagina ${state.page}`;

    if(!els.contattiBody) return;
    if(!rows.length){
      els.contattiBody.innerHTML = '<tr><td colspan="8" class="muted">Nessun contatto trovato.</td></tr>';
      return;
    }

    els.contattiBody.innerHTML = rows.map(r => {
      const note = (r.note || '').slice(0, 200);
      return `
        <tr>
          <td>${esc(r.id)}</td>
          <td>${esc(r.created_at || '')}</td>
          <td><strong>${esc(r.nome || '')}</strong></td>
          <td><a href="tel:${esc(r.telefono || '')}">${esc(r.telefono || '')}</a></td>
          <td><a href="mailto:${esc(r.email || '')}">${esc(r.email || '')}</a></td>
          <td>${esc(r.azienda || '')}</td>
          <td>${esc(note)}${(r.note && r.note.length > 200) ? '…' : ''}</td>
          <td><button class="btnx" type="button" data-del="${esc(r.id)}">Elimina</button></td>
        </tr>
      `;
    }).join('');

    // bind delete
    els.contattiBody.querySelectorAll('button[data-del]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-del');
        if(!id) return;
        if(!confirm('Eliminare questo contatto?')) return;
        btn.disabled = true;
        try {
          await request(`/api/admin/contatti/${encodeURIComponent(id)}`, { method: 'DELETE' });
          setMsg(els.adminMsg, 'ok', 'Contatto eliminato.');
          await loadContatti();
        } catch (e) {
          setMsg(els.adminMsg, 'err', e.message || 'Errore');
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  function formToJson(form){
    const fd = new FormData(form);
    const obj = {};
    for(const [k,v] of fd.entries()){
      obj[k] = v;
    }
    return obj;
  }

  async function addProdotto(payload){
    await request('/api/admin/prodotti', { method:'POST', body: JSON.stringify(payload) });
  }
  async function addIncentivo(payload){
    await request('/api/admin/incentivi', { method:'POST', body: JSON.stringify(payload) });
  }

  async function updateProdotto(id, payload){
    await request(`/api/admin/prodotti/${encodeURIComponent(id)}`, { method:'PUT', body: JSON.stringify(payload) });
  }

  async function updateIncentivo(id, payload){
    await request(`/api/admin/incentivi/${encodeURIComponent(id)}`, { method:'PUT', body: JSON.stringify(payload) });
  }

  async function loadProdotti(){
    const data = await request('/api/admin/prodotti', { method:'GET' });
    const rows = Array.isArray(data.rows) ? data.rows : [];
    if(!els.prodottiBody) return;
    if(!rows.length){
      els.prodottiBody.innerHTML = '<tr><td colspan="8" class="muted">Nessun prodotto presente.</td></tr>';
      return;
    }
    els.prodottiBody.innerHTML = rows.map(r => {
      const img = r.immagine ? `<a href="${esc(r.immagine)}" target="_blank" rel="noopener"><img alt="" src="${esc(r.immagine)}" style="width:54px;height:38px;object-fit:cover;border-radius:10px;border:1px solid rgba(255,255,255,.14)" /></a>` : '';
      const pdf = r.pdf ? `<a href="${esc(r.pdf)}" target="_blank" rel="noopener">PDF</a>` : '';
      const link = r.link ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">Link</a>` : '';
      return `
        <tr>
          <td>${esc(r.id)}</td>
          <td>${esc(r.created_at || '')}</td>
          <td><strong>${esc(r.titolo || '')}</strong></td>
          <td>${esc(r.categoria || '')}</td>
          <td>${img}</td>
          <td>${pdf}</td>
          <td>${link}</td>
          <td style="white-space:nowrap">
            <button class="btnx" type="button" data-edit-prodotto="${esc(r.id)}">Modifica</button>
            <button class="btnx" type="button" data-del-prodotto="${esc(r.id)}">Elimina</button>
          </td>
        </tr>
      `;
    }).join('');

    // bind edit
    els.prodottiBody.querySelectorAll('button[data-edit-prodotto]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit-prodotto');
        const row = rows.find(x => String(x.id) === String(id));
        if(!row) return;
        openEdit('prodotto', row);
      });
    });

    els.prodottiBody.querySelectorAll('button[data-del-prodotto]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-del-prodotto');
        if(!id) return;
        if(!confirm('Eliminare questo prodotto?')) return;
        btn.disabled = true;
        try {
          await request(`/api/admin/prodotti/${encodeURIComponent(id)}`, { method:'DELETE' });
          setMsg(els.adminMsg, 'ok', 'Prodotto eliminato.');
          await loadProdotti();
        } catch(e){
          setMsg(els.adminMsg, 'err', e.message || 'Errore');
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  async function loadIncentivi(){
    const data = await request('/api/admin/incentivi', { method:'GET' });
    const rows = Array.isArray(data.rows) ? data.rows : [];
    if(!els.incentiviBody) return;
    if(!rows.length){
      els.incentiviBody.innerHTML = '<tr><td colspan="7" class="muted">Nessun incentivo presente.</td></tr>';
      return;
    }
    els.incentiviBody.innerHTML = rows.map(r => {
      const img = r.immagine ? `<a href="${esc(r.immagine)}" target="_blank" rel="noopener"><img alt="" src="${esc(r.immagine)}" style="width:54px;height:38px;object-fit:cover;border-radius:10px;border:1px solid rgba(255,255,255,.14)" /></a>` : '';
      return `
        <tr>
          <td>${esc(r.id)}</td>
          <td>${esc(r.created_at || '')}</td>
          <td><strong>${esc(r.titolo || '')}</strong></td>
          <td>${esc(r.stato || '')}</td>
          <td>${esc(r.scadenza || '')}</td>
          <td>${img}</td>
          <td style="white-space:nowrap">
            <button class="btnx" type="button" data-edit-incentivo="${esc(r.id)}">Modifica</button>
            <button class="btnx" type="button" data-del-incentivo="${esc(r.id)}">Elimina</button>
          </td>
        </tr>
      `;
    }).join('');

    // bind edit
    els.incentiviBody.querySelectorAll('button[data-edit-incentivo]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit-incentivo');
        const row = rows.find(x => String(x.id) === String(id));
        if(!row) return;
        openEdit('incentivo', row);
      });
    });

    els.incentiviBody.querySelectorAll('button[data-del-incentivo]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-del-incentivo');
        if(!id) return;
        if(!confirm('Eliminare questo incentivo?')) return;
        btn.disabled = true;
        try {
          await request(`/api/admin/incentivi/${encodeURIComponent(id)}`, { method:'DELETE' });
          setMsg(els.adminMsg, 'ok', 'Incentivo eliminato.');
          await loadIncentivi();
        } catch(e){
          setMsg(els.adminMsg, 'err', e.message || 'Errore');
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  // Events
  if(els.clearSessionBtn){
    els.clearSessionBtn.addEventListener('click', () => {
      clearToken();
      showAuthedUI();
      setMsg(els.loginMsg, 'ok', 'Sessione pulita.');
    });
  }

  if(els.loginForm){
    els.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMsg(els.loginMsg);
      const u = (document.getElementById('username')?.value || '').trim();
      const p = (document.getElementById('password')?.value || '').trim();
      const btn = els.loginForm.querySelector('button[type="submit"]');
      if(btn){ btn.disabled = true; }
      try {
        await login(u, p);
      startAutoRefresh();
        showAuthedUI();
        setMsg(els.adminMsg, 'ok', 'Login effettuato.');
        state.page = 1;
        await loadContatti();
        await Promise.allSettled([loadProdotti(), loadIncentivi()]);
      } catch (err){
        setMsg(els.loginMsg, 'err', err.message || 'Credenziali non valide');
      } finally {
        if(btn){ btn.disabled = false; }
      }
    });
  }

  if(els.refreshAllBtn){
    els.refreshAllBtn.addEventListener('click', async () => {
      try {
        await loadContatti();
        await Promise.allSettled([loadProdotti(), loadIncentivi()]);
        setMsg(els.adminMsg, 'ok', 'Contatti aggiornati.');
      } catch(e){
        setMsg(els.adminMsg, 'err', e.message || 'Errore');
      }
    });
  }

  if(els.refreshProdottiBtn){
    els.refreshProdottiBtn.addEventListener('click', async () => {
      try{ await loadProdotti(); setMsg(els.adminMsg, 'ok', 'Prodotti aggiornati.'); }
      catch(e){ setMsg(els.adminMsg, 'err', e.message || 'Errore'); }
    });
  }

  if(els.refreshIncentiviBtn){
    els.refreshIncentiviBtn.addEventListener('click', async () => {
      try{ await loadIncentivi(); setMsg(els.adminMsg, 'ok', 'Incentivi aggiornati.'); }
      catch(e){ setMsg(els.adminMsg, 'err', e.message || 'Errore'); }
    });
  }

  // Upload handlers (prodotti)
  async function bindUpload(inputEl, targetInputId){
    if(!inputEl) return;
    inputEl.addEventListener('change', async () => {
      const file = inputEl.files && inputEl.files[0];
      if(!file) return;
      try {
        setMsg(els.adminMsg, 'ok', `Caricamento file: ${file.name}...`);
        const out = await uploadFile(file);
        const target = document.getElementById(targetInputId);
        if(target) target.value = out.url || '';
        setMsg(els.adminMsg, 'ok', 'File caricato. URL inserito automaticamente.');
      } catch(e){
        setMsg(els.adminMsg, 'err', e.message || 'Errore upload');
      }
    });
  }

  bindUpload(els.pImmagineFile, 'pImmagine');
  bindUpload(els.pPdfFile, 'pPdf');
  bindUpload(els.iImmagineFile, 'iImmagine');

  // -------------------- MODAL EDIT --------------------
  function fieldRow(label, html){
    return `<div style="margin-bottom:10px"><label style="display:block;font-weight:800;margin:6px 0 6px">${esc(label)}</label>${html}</div>`;
  }

  function openEdit(type, row){
    clearMsg(els.editMsg);
    if(!els.editDialog || !els.editFields || !els.editForm) return;

    els.editType.value = type;
    els.editId.value = row.id;
    if(els.editTitle) els.editTitle.textContent = type === 'prodotto' ? `Modifica prodotto #${row.id}` : `Modifica incentivo #${row.id}`;

    if(type === 'prodotto'){
      els.editFields.innerHTML = [
        fieldRow('Titolo', `<input id="eTitolo" required value="${esc(row.titolo || '')}" />`),
        fieldRow('Categoria', `<select id="eCategoria">
            <option value="">— Seleziona —</option>
            <option ${row.categoria==='Inverter'?'selected':''} value="Inverter">Inverter</option>
            <option ${row.categoria==='Moduli'?'selected':''} value="Moduli">Moduli</option>
            <option ${row.categoria==='Batterie'?'selected':''} value="Batterie">Batterie</option>
            <option ${row.categoria==='Wallbox'?'selected':''} value="Wallbox">Wallbox</option>
            <option ${row.categoria==='Strutture'?'selected':''} value="Strutture">Strutture</option>
            <option ${row.categoria==='Ottimizzatori'?'selected':''} value="Ottimizzatori">Ottimizzatori</option>
            <option ${row.categoria==='Monitoraggio'?'selected':''} value="Monitoraggio">Monitoraggio</option>
            <option ${row.categoria==='Altro'?'selected':''} value="Altro">Altro</option>
          </select>`),
        fieldRow('Descrizione', `<textarea id="eDescr" placeholder="...">${esc(row.descrizione || '')}</textarea>`),
        fieldRow('URL immagine', `<input id="eImmagine" value="${esc(row.immagine || '')}" placeholder="https://..." />
          <div class="muted" style="margin-top:6px">Oppure carica un'immagine:</div>
          <input id="eImmagineFile" type="file" accept="image/*" />`),
        fieldRow('PDF', `<input id="ePdf" value="${esc(row.pdf || '')}" placeholder="https://.../scheda.pdf" />
          <div class="muted" style="margin-top:6px">Oppure carica un PDF:</div>
          <input id="ePdfFile" type="file" accept="application/pdf" />`),
        fieldRow('Link esterno', `<input id="eLink" value="${esc(row.link || '')}" placeholder="https://..." />`),
        fieldRow('Punti elenco (1 per riga)', `<textarea id="eBullets" placeholder="...">${esc((row.bullets || []).join('\n'))}</textarea>`)
      ].join('');
    } else {
      els.editFields.innerHTML = [
        fieldRow('Titolo', `<input id="eTitolo" required value="${esc(row.titolo || '')}" />`),
        fieldRow('Stato', `<input id="eStato" value="${esc(row.stato || '')}" placeholder="Attivo / In arrivo" />`),
        fieldRow('Scadenza', `<input id="eScadenza" value="${esc(row.scadenza || '')}" placeholder="30/06/2026" />`),
        fieldRow('Descrizione', `<textarea id="eDescr" placeholder="...">${esc(row.descrizione || '')}</textarea>`),
        fieldRow('URL immagine', `<input id="eImmagine" value="${esc(row.immagine || '')}" placeholder="https://..." />
          <div class="muted" style="margin-top:6px">Oppure carica un'immagine:</div>
          <input id="eImmagineFile" type="file" accept="image/*" />`),
        fieldRow('Link 1', `<input id="eLink1" value="${esc(row.link1 || '')}" placeholder="https://..." />`),
        fieldRow('Etichetta Link 1', `<input id="eLink1Label" value="${esc(row.link1Label || '')}" placeholder="Es: Vai al sito" />`),
        fieldRow('Link 2', `<input id="eLink2" value="${esc(row.link2 || '')}" placeholder="https://..." />`),
        fieldRow('Etichetta Link 2', `<input id="eLink2Label" value="${esc(row.link2Label || '')}" placeholder="Es: Area clienti" />`),
        fieldRow('Punti elenco (1 per riga)', `<textarea id="eBullets" placeholder="...">${esc((row.bullets || []).join('\n'))}</textarea>`)
      ].join('');
    }

    // bind upload inside modal
    const eImgFile = document.getElementById('eImmagineFile');
    const ePdfFile = document.getElementById('ePdfFile');
    if(eImgFile) bindUpload(eImgFile, 'eImmagine');
    if(ePdfFile) bindUpload(ePdfFile, 'ePdf');

    if(typeof els.editDialog.showModal === 'function') els.editDialog.showModal();
    else els.editDialog.open = true;
  }

  if(els.editCloseBtn && els.editDialog){
    els.editCloseBtn.addEventListener('click', () => {
      els.editDialog.close();
    });
  }

  if(els.editForm){
    els.editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMsg(els.editMsg);
      const type = els.editType.value;
      const id = els.editId.value;
      const btn = els.editForm.querySelector('button[type="submit"]');
      if(btn) btn.disabled = true;
      try {
        const bullets = (document.getElementById('eBullets')?.value || '')
          .split(/\r?\n/)
          .map(s => s.trim())
          .filter(Boolean);

        if(type === 'prodotto'){
          await updateProdotto(id, {
            titolo: (document.getElementById('eTitolo')?.value || '').trim(),
            categoria: (document.getElementById('eCategoria')?.value || '').trim(),
            descrizione: (document.getElementById('eDescr')?.value || '').trim(),
            immagine: (document.getElementById('eImmagine')?.value || '').trim(),
            pdf: (document.getElementById('ePdf')?.value || '').trim(),
            link: (document.getElementById('eLink')?.value || '').trim(),
            bullets
          });
          setMsg(els.editMsg, 'ok', 'Prodotto aggiornato.');
          await loadProdotti();
        } else {
          await updateIncentivo(id, {
            titolo: (document.getElementById('eTitolo')?.value || '').trim(),
            stato: (document.getElementById('eStato')?.value || '').trim(),
            scadenza: (document.getElementById('eScadenza')?.value || '').trim(),
            descrizione: (document.getElementById('eDescr')?.value || '').trim(),
            immagine: (document.getElementById('eImmagine')?.value || '').trim(),
            link1: (document.getElementById('eLink1')?.value || '').trim(),
            link1Label: (document.getElementById('eLink1Label')?.value || '').trim(),
            link2: (document.getElementById('eLink2')?.value || '').trim(),
            link2Label: (document.getElementById('eLink2Label')?.value || '').trim(),
            bullets
          });
          setMsg(els.editMsg, 'ok', 'Incentivo aggiornato.');
          await loadIncentivi();
        }
      } catch(err){
        setMsg(els.editMsg, 'err', err.message || 'Errore');
      } finally {
        if(btn) btn.disabled = false;
      }
    });
  }

  if(els.logoutBtn){
    els.logoutBtn.addEventListener('click', async () => {
      await logout();
      showAuthedUI();
      setMsg(els.loginMsg, 'ok', 'Logout effettuato.');
    });
  }

  if(els.prevPageBtn){
    els.prevPageBtn.addEventListener('click', async () => {
      if(state.page <= 1) return;
      state.page -= 1;
      try{ await loadContatti(); } catch(e){ setMsg(els.adminMsg, 'err', e.message || 'Errore'); }
    });
  }
  if(els.nextPageBtn){
    els.nextPageBtn.addEventListener('click', async () => {
      state.page += 1;
      try{ await loadContatti(); } catch(e){ state.page -= 1; setMsg(els.adminMsg, 'err', e.message || 'Errore'); }
    });
  }

  if(els.prodottoForm){
    els.prodottoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMsg(els.prodottoMsg);
      const btn = els.prodottoForm.querySelector('button[type="submit"]');
      if(btn) btn.disabled = true;
      try {
        const payload = formToJson(els.prodottoForm);
        await addProdotto(payload);
        els.prodottoForm.reset();
        setMsg(els.prodottoMsg, 'ok', 'Prodotto aggiunto! Ora lo trovi in "Prodotti" sul sito.');
        loadProdotti().catch(() => {});
      } catch (err){
        setMsg(els.prodottoMsg, 'err', err.message || 'Errore');
      } finally {
        if(btn) btn.disabled = false;
      }
    });
  }

  if(els.incentivoForm){
    els.incentivoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMsg(els.incentivoMsg);
      const btn = els.incentivoForm.querySelector('button[type="submit"]');
      if(btn) btn.disabled = true;
      try {
        const payload = formToJson(els.incentivoForm);
        await addIncentivo(payload);
        els.incentivoForm.reset();
        setMsg(els.incentivoMsg, 'ok', 'Incentivo aggiunto! Ora lo trovi in "Incentivi" sul sito.');
        loadIncentivi().catch(() => {});
      } catch (err){
        setMsg(els.incentivoMsg, 'err', err.message || 'Errore');
      } finally {
        if(btn) btn.disabled = false;
      }
    });
  }

  // Boot
  showAuthedUI();
  const s = getToken();
  if(s){
    loadContatti().catch(() => {});
    loadProdotti().catch(() => {});
    loadIncentivi().catch(() => {});
  }
})();

  // AUTO REFRESH CONTATTI (per vedere subito i nuovi moduli)
  let _autoRefreshTimer = null;
  function startAutoRefresh(){
    if(_autoRefreshTimer) return;
    _autoRefreshTimer = setInterval(() => {
      try{
        const token = getToken();
        const panel = document.getElementById('contattiPanel');
        const visible = panel && !panel.classList.contains('hide');
        if(token && visible){
          loadContatti().catch(() => {});
        }
      }catch(e){}
    }, 15000);
  }

