// ╔══════════════════════════════════════════════════════════════╗
// ║  GIST SYNC — Cole este bloco inteiro dentro do <script>     ║
// ║  do seu index.html, logo antes das linhas:                  ║
// ║    render(); initPomodoro(); renderCalendar();               ║
// ╚══════════════════════════════════════════════════════════════╝

const GIST_TOKEN_KEY = 'alpb_gist_token';
const GIST_ID_KEY    = 'alpb_gist_id';
const GIST_FILENAME  = 'cronograma-alpb-data.json';
let _gistSyncing  = false;
let _gistSaveTimer = null;

function gistGetToken() { return localStorage.getItem(GIST_TOKEN_KEY) || ''; }
function gistGetId()    { return localStorage.getItem(GIST_ID_KEY)    || ''; }

// ── Carrega dados do Gist ─────────────────────────────────────
async function gistLoad() {
  const token = gistGetToken();
  if (!token) return null;
  try {
    // 1) Tenta buscar diretamente pelo ID já salvo
    const gistId = gistGetId();
    if (gistId) {
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.files?.[GIST_FILENAME]?.content;
        if (content) return JSON.parse(content);
      }
    }
    // 2) Busca na lista de gists do usuário
    const listRes = await fetch('https://api.github.com/gists?per_page=100', {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
    });
    if (!listRes.ok) return null;
    const gists = await listRes.json();
    const found = gists.find(g => g.files?.[GIST_FILENAME]);
    if (found) {
      localStorage.setItem(GIST_ID_KEY, found.id);
      const detail = await fetch(`https://api.github.com/gists/${found.id}`, {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
      });
      if (detail.ok) {
        const d = await detail.json();
        const content = d.files?.[GIST_FILENAME]?.content;
        if (content) return JSON.parse(content);
      }
    }
  } catch(e) { console.warn('Gist load error:', e); }
  return null;
}

// ── Salva dados no Gist ───────────────────────────────────────
async function gistSave(stateObj) {
  const token = gistGetToken();
  if (!token) return;
  if (_gistSyncing) return;
  _gistSyncing = true;

  const body = JSON.stringify({
    description: 'Cronograma ALPB – backup automático',
    public: false,
    files: { [GIST_FILENAME]: { content: JSON.stringify(stateObj) } }
  });

  try {
    const gistId = gistGetId();
    const url    = gistId ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists';
    const method = gistId ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json'
      },
      body
    });

    if (res.ok) {
      const d = await res.json();
      if (d.id) localStorage.setItem(GIST_ID_KEY, d.id);
      showSyncIndicator('✓ Salvo na nuvem');
    } else {
      const err = await res.json().catch(() => ({}));
      console.warn('Gist save error:', res.status, err);
      showSyncIndicator('⚠ Erro ao salvar (' + res.status + ')', true);
    }
  } catch(e) {
    console.warn('Gist save network error:', e);
    showSyncIndicator('⚠ Sem conexão', true);
  } finally {
    _gistSyncing = false;
  }
}

// ── Debounce: salva 1.5s após última alteração ────────────────
function scheduleSave(stateObj) {
  clearTimeout(_gistSaveTimer);
  _gistSaveTimer = setTimeout(() => gistSave(stateObj), 1500);
}

// ── Indicador visual no header ────────────────────────────────
function showSyncIndicator(msg, isError) {
  const el = document.getElementById('gistSyncBadge');
  if (!el) return;
  el.textContent = msg;
  el.style.color   = isError ? '#c0392b' : '#2e7d52';
  el.style.opacity = '1';
  clearTimeout(el._fadeTimer);
  el._fadeTimer = setTimeout(() => { el.style.opacity = '0'; }, 3000);
}

// ── Modal de configuração do token ───────────────────────────
function openGistConfig() {
  const cur = gistGetToken();
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';

  overlay.innerHTML = `
    <div style="background:#fffef9;border-radius:20px;padding:32px 36px;width:100%;max-width:460px;box-shadow:0 8px 40px rgba(0,0,0,0.25);font-family:'DM Sans',sans-serif;">
      <div style="font-family:'DM Serif Display',serif;font-size:22px;margin-bottom:6px;">☁ Sincronização na Nuvem</div>
      <div style="font-size:13px;color:#7a7060;margin-bottom:20px;line-height:1.7;">
        Cole seu <strong>GitHub Personal Access Token</strong> com permissão
        <code style="background:#f0ece3;padding:1px 6px;border-radius:4px;font-size:12px;">gist</code>
        para salvar seus dados automaticamente na nuvem e acessar em qualquer dispositivo.<br><br>
        <a href="https://github.com/settings/tokens/new?scopes=gist&description=cronograma-alpb-sync"
           target="_blank"
           style="color:#1a3a5c;font-weight:600;text-decoration:none;">
          🔑 Gerar token no GitHub →
        </a>
        <span style="font-size:11px;color:#7a7060;display:block;margin-top:4px;">(marque apenas "gist" na lista de permissões)</span>
      </div>
      <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#7a7060;margin-bottom:6px;">Token</div>
      <input id="gistTokenInput" type="password" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
        style="width:100%;font-family:'DM Sans',sans-serif;font-size:14px;padding:10px 14px;border:1px solid #d9d3c4;border-radius:10px;background:#f8f5ef;outline:none;margin-bottom:16px;box-sizing:border-box;"
        value="${cur}">
      <div style="display:flex;gap:10px;">
        <button id="gistSaveBtn"
          style="flex:1;padding:11px;background:#1a3a5c;color:#fff;border:none;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer;transition:opacity 0.2s;"
          onmouseover="this.style.opacity='0.88'" onmouseout="this.style.opacity='1'">
          ✓ Salvar e sincronizar
        </button>
        <button id="gistCancelBtn"
          style="padding:11px 18px;border:1px solid #d9d3c4;border-radius:10px;background:none;color:#7a7060;font-family:'DM Sans',sans-serif;font-size:14px;cursor:pointer;">
          Cancelar
        </button>
      </div>
      ${cur ? `
      <button id="gistRemoveBtn"
        style="margin-top:10px;width:100%;padding:9px;background:none;border:1px solid #d9d3c4;border-radius:10px;color:#c0392b;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s;"
        onmouseover="this.style.background='#fdecea'" onmouseout="this.style.background='none'">
        🗑 Remover token e desativar sync
      </button>` : ''}
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('gistCancelBtn').addEventListener('click', () => overlay.remove());

  document.getElementById('gistSaveBtn').addEventListener('click', async () => {
    const val = document.getElementById('gistTokenInput').value.trim();
    if (!val) { alert('Cole o token gerado no GitHub.'); return; }
    localStorage.setItem(GIST_TOKEN_KEY, val);
    localStorage.removeItem(GIST_ID_KEY);
    overlay.remove();
    showSyncIndicator('⟳ Enviando dados para nuvem…');
    await gistSave(state);
  });

  const removeBtn = document.getElementById('gistRemoveBtn');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      localStorage.removeItem(GIST_TOKEN_KEY);
      localStorage.removeItem(GIST_ID_KEY);
      overlay.remove();
      showSyncIndicator('Token removido — sync desativado');
    });
  }
}

// ── Inicialização: carrega dados da nuvem ao abrir ────────────
async function initGistSync() {
  if (!gistGetToken()) return; // sem token, nada a fazer
  showSyncIndicator('⟳ Verificando nuvem…');
  const remote = await gistLoad();
  if (remote && typeof remote === 'object') {
    // Mescla: dados remotos têm prioridade
    state = Object.assign({}, state, remote);
    // Garante que todas as chaves existam
    if (!state.checked)       state.checked       = {};
    if (!state.times)         state.times         = {};
    if (!state.questions)     state.questions     = {};
    if (!state.pomodoro)      state.pomodoro      = {};
    if (!state.customLessons) state.customLessons = {};
    if (!state.planner)       state.planner       = {};
    if (!state.assuntos)      state.assuntos      = {};
    if (!state.urls)          state.urls          = {};
    if (!state.outras)        state.outras        = { subjects:{}, checked:{}, times:{}, questions:{}, customLessons:{} };
    localStorage.setItem(KEY, JSON.stringify(state));
    showSyncIndicator('✓ Sincronizado com a nuvem');
    // Re-renderiza com dados atualizados
    render();
    initPomodoro();
    renderCalendar();
  } else if (gistGetToken()) {
    // Primeira vez com token: envia dados locais para nuvem
    await gistSave(state);
  }
}
