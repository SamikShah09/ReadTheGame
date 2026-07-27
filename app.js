/*
 * app.js
 * -------
 * Game logic for Read The Defense. Depends on storage.js (window.storage shim)
 * and plays.js (SEED_PLAYS array) being loaded first.
 */

const app = document.getElementById('app');

// --- Storage shim -----------------------------------------------------
// window.storage exists only inside Claude's artifact sandbox. Outside of
// it (e.g. hosted on GitHub Pages), fall back to localStorage so the app
// still works — with the caveat that "shared" data is then only shared
// across browser sessions on the same device, not across real visitors,
// since there's no server involved. For a true cross-user leaderboard
// once hosted elsewhere, swap this shim for a real backend (Firebase,
// Supabase, etc.) behind the same get/set/delete/list interface.
let usingStorageFallback = false;
if(!window.storage){
  usingStorageFallback = true;
  const nsKey = (key, shared) => 'rtd:' + (shared ? 'shared:' : 'local:') + key;
  window.storage = {
    get: (key, shared) => Promise.resolve().then(()=>{
      const raw = localStorage.getItem(nsKey(key, shared));
      return raw ? { key, value: raw, shared: !!shared } : null;
    }),
    set: (key, value, shared) => Promise.resolve().then(()=>{
      localStorage.setItem(nsKey(key, shared), value);
      return { key, value, shared: !!shared };
    }),
    delete: (key, shared) => Promise.resolve().then(()=>{
      localStorage.removeItem(nsKey(key, shared));
      return { key, deleted: true, shared: !!shared };
    }),
    list: (prefix, shared) => Promise.resolve().then(()=>{
      const p = nsKey(prefix || '', shared);
      const keys = [];
      for(let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i);
        if(k && k.startsWith(p)) keys.push(prefix ? prefix + k.slice(p.length) : k.slice(nsKey('',shared).length));
      }
      return { keys, prefix, shared: !!shared };
    })
  };
}
// ------------------------------------------------------------------------

let state = {
  screen: 'login',
  username: null,
  tab: 'play',
  plays: [],
  currentPlayIdx: null,
  answered: false,
  chosenIdx: null,
  session: { correct: 0, total: 0 },
  leaderboard: [],
  loading: true,
};


function loadFromStorage(cb){
  Promise.resolve(window.storage && window.storage.get('plays-list', true))
    .then(res=>{
      state.plays = (res && res.value) ? JSON.parse(res.value) : SEED_PLAYS;
    })
    .catch(()=>{ state.plays = SEED_PLAYS; })
    .then(()=> refreshLeaderboard())
    .then(()=>{ state.loading=false; render(); if(cb) cb(); });
}

function savePlays(){
  return window.storage.set('plays-list', JSON.stringify(state.plays), true).catch(()=>{});
}

function refreshLeaderboard(){
  return Promise.resolve(window.storage && window.storage.list('profile:', true))
    .then(async (res)=>{
      const keys = (res && res.keys) ? res.keys : [];
      const entries = [];
      for(const k of keys){
        try{
          const r = await window.storage.get(k, true);
          if(r && r.value) entries.push(JSON.parse(r.value));
        }catch(e){}
      }
      entries.sort((a,b)=> (b.totalScore||0) - (a.totalScore||0));
      state.leaderboard = entries;
    })
    .catch(()=>{ state.leaderboard = []; });
}

function getProfile(username){
  return window.storage.get('profile:'+username, true)
    .then(r=> r && r.value ? JSON.parse(r.value) : { username, totalScore:0, gamesPlayed:0, correct:0, attempts:0, bestStreak:0 })
    .catch(()=> ({ username, totalScore:0, gamesPlayed:0, correct:0, attempts:0, bestStreak:0 }));
}

function saveProfile(profile){
  return window.storage.set('profile:'+profile.username, JSON.stringify(profile), true).catch(()=>{});
}

function login(username){
  username = username.trim();
  if(!username) return;
  state.username = username;
  state.screen = 'main';
  getProfile(username).then(p=>{
    state.profile = p;
    render();
  });
}

function logout(){
  state.username = null;
  state.profile = null;
  state.screen = 'login';
  state.session = { correct:0, total:0 };
  render();
}

let clockTimer = null;

function startPlay(idx){
  state.currentPlayIdx = idx;
  state.answered = false;
  state.chosenIdx = null;
  state.screen = 'game';
  state.clipToken = Date.now(); // cache-buster so "watch again" restarts cleanly
  render();
  runClock();
}

function runClock(){
  if(clockTimer) clearInterval(clockTimer);
  const play = state.plays[state.currentPlayIdx];
  const duration = Math.max(3, play.duration || 20);
  let remaining = duration;
  const clockEl = document.getElementById('shotclock');
  if(clockEl) clockEl.textContent = String(remaining).padStart(2,'0');
  clockTimer = setInterval(()=>{
    remaining -= 1;
    const el = document.getElementById('shotclock');
    if(el) el.textContent = String(Math.max(0, remaining)).padStart(2,'0');
    if(remaining <= 0){
      clearInterval(clockTimer);
      revealQuestion();
    }
  }, 1000);
}

function replayClip(){
  state.clipToken = Date.now();
  const iframe = document.getElementById('clip-frame');
  if(iframe) iframe.src = buildEmbedSrc(state.plays[state.currentPlayIdx], state.clipToken);
  runClock();
  const q = document.getElementById('question-block');
  if(q) q.style.display = 'none';
}

function buildEmbedSrc(play, token){
  return `https://www.youtube.com/embed/${encodeURIComponent(play.youtubeId)}`
    + `?autoplay=1&mute=0&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&t=${token}`;
}

function revealQuestion(){
  if(clockTimer) clearInterval(clockTimer);
  const el = document.getElementById('question-block');
  if(el) el.style.display = 'block';
  const btn = document.getElementById('reveal-early-btn');
  if(btn) btn.style.display = 'none';
}

function choose(idx){
  if(state.answered) return;
  state.answered = true;
  state.chosenIdx = idx;
  const play = state.plays[state.currentPlayIdx];
  const isCorrect = idx === play.correctIdx;
  state.session.total += 1;
  if(isCorrect) state.session.correct += 1;

  state.profile.attempts = (state.profile.attempts||0) + 1;
  if(isCorrect){
    state.profile.correct = (state.profile.correct||0) + 1;
    state.profile.totalScore = (state.profile.totalScore||0) + 100;
  }
  state.profile.gamesPlayed = (state.profile.gamesPlayed||0) + 1;
  saveProfile(state.profile).then(()=> refreshLeaderboard()).then(render);
  render();
}

function nextPlay(){
  const nextIdx = (state.currentPlayIdx + 1) % state.plays.length;
  startPlay(nextIdx);
}

function addPlay(data){
  state.plays.push({
    id: 'p'+Date.now(),
    title: data.title,
    youtubeId: data.youtubeId,
    duration: parseInt(data.duration,10) || 20,
    situation: data.situation,
    prompt: data.prompt,
    options: data.options,
    correctIdx: parseInt(data.correctIdx,10),
    explanation: data.explanation,
  });
  savePlays().then(()=>{ state.tab='play'; render(); });
}

// ---------- RENDER ----------
function render(){
  if(state.loading){
    app.innerHTML = `<div class="wrap"><div class="empty">Loading the gym...</div></div>`;
    return;
  }
  if(state.screen === 'login'){ renderLogin(); return; }
  if(state.screen === 'game'){ renderGame(); return; }
  renderMain();
}

function renderLogin(){
  app.innerHTML = `
    <div class="brand" style="justify-content:center; margin-bottom:6px;">
      <h1>READ THE <span>DEFENSE</span></h1>
    </div>
    <p style="text-align:center; color:var(--net-gray); font-size:13.5px; margin-top:0;">Watch the possession. When it freezes, make the read.</p>
    <div class="card" style="max-width:380px; margin:24px auto 0;">
      <span class="label">Enter your name</span>
      <input id="login-input" type="text" placeholder="e.g. CoachTay" maxlength="24" />
      <button class="btn" style="width:100%;" onclick="handleLogin()">Take the court →</button>
      <div class="notice">No password — this just tags your scores on the shared leaderboard, which any player using this app can see.</div>
    </div>
  `;
  const input = document.getElementById('login-input');
  input.addEventListener('keydown', (e)=>{ if(e.key==='Enter') handleLogin(); });
  input.focus();
}

function handleLogin(){
  const v = document.getElementById('login-input').value;
  login(v);
}

function renderMain(){
  const p = state.profile || {totalScore:0, correct:0, attempts:0};
  const acc = p.attempts ? Math.round((p.correct/p.attempts)*100) : 0;

  app.innerHTML = `
    <div class="brand">
      <h1>READ THE <span>DEFENSE</span></h1>
      <div class="user-pill"><b>${escapeHtml(state.username)}</b> · ${p.totalScore||0} pts <button onclick="logout()">switch</button></div>
    </div>

    <div class="tabs">
      <div class="tab ${state.tab==='play'?'active':''}" onclick="setTab('play')">PLAY</div>
      <div class="tab ${state.tab==='add'?'active':''}" onclick="setTab('add')">ADD A CLIP</div>
      <div class="tab ${state.tab==='board'?'active':''}" onclick="setTab('board')">LEADERBOARD</div>
    </div>

    <div id="tab-content"></div>
  `;
  const content = document.getElementById('tab-content');
  if(state.tab==='play') content.innerHTML = renderPlayList(p, acc);
  if(state.tab==='add') content.innerHTML = renderAddForm();
  if(state.tab==='board') content.innerHTML = renderLeaderboard();
  if(state.tab==='add') wireAddForm();
}

function renderPlayList(p, acc){
  if(!state.plays.length){
    return `<div class="card"><div class="empty">No clips yet. Add one in the "Add a Clip" tab.</div></div>`;
  }
  const rows = state.plays.map((play, i)=> `
    <div class="card" style="padding:18px 20px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-family:'Teko',sans-serif; font-size:20px;">${escapeHtml(play.title)}</div>
        <div style="color:var(--net-gray); font-size:12.5px;">~${play.duration||20}s clip</div>
      </div>
      <button class="btn" onclick="startPlay(${i})">Run it ▶</button>
    </div>
  `).join('');
  return `
    <div class="scorebar">
      <span>SESSION: <b>${state.session.correct}/${state.session.total}</b></span>
      <span>CAREER ACCURACY: <b>${acc}%</b></span>
    </div>
    ${rows}
  `;
}

function renderAddForm(){
  return `
    <div class="card">
      <h2 class="section">Add a clip</h2>
      <div class="notice" style="margin-bottom:16px;">
        Use the YouTube video ID from a clip you have rights to embed (an official highlight/breakdown upload, etc.) —
        e.g. for <code>youtube.com/watch?v=abc123XYZ</code> the ID is <code>abc123XYZ</code>. The clip plays start to
        finish with no pause/scrub controls; set an approximate length so the question reveals right after.
      </div>
      <span class="label">Clip title</span>
      <input id="f-title" type="text" placeholder="e.g. Wolves PnR, 3rd Q vs Nuggets" />

      <span class="label">YouTube video ID</span>
      <input id="f-yt" type="text" placeholder="abc123XYZ" />
      <div class="field-help" style="margin-top:-10px;">The whole clip plays start to finish — players can't pause or scrub it, only watch (and rewatch).</div>

      <span class="label">Approx. clip length (seconds)</span>
      <input id="f-duration" type="number" min="3" placeholder="25" />
      <div class="field-help" style="margin-top:-10px;">Roughly how long the clip runs — the question reveals once this much time has passed.</div>

      <span class="label">Describe the situation</span>
      <textarea id="f-situation" rows="3" placeholder="What is the defense doing in this clip? Who's guarding whom, who's helping, where's the gap..."></textarea>

      <span class="label">Question</span>
      <input id="f-prompt" type="text" placeholder="e.g. What should the ball-handler do?" />

      <span class="label">Options (one per line, 2-4)</span>
      <textarea id="f-options" rows="4" placeholder="Pull up for the jumper&#10;Hit the roller&#10;Kick to the corner&#10;Drive baseline"></textarea>

      <span class="label">Correct option number (1-based)</span>
      <input id="f-correct" type="number" min="1" placeholder="3" />

      <span class="label">Explanation (shown after answering)</span>
      <textarea id="f-explanation" rows="3" placeholder="Why that read is correct given exactly what the defense showed."></textarea>

      <button class="btn" onclick="submitAddForm()">Save clip</button>
    </div>
  `;
}

function wireAddForm(){}

function submitAddForm(){
  const title = document.getElementById('f-title').value.trim();
  const youtubeId = document.getElementById('f-yt').value.trim();
  const duration = document.getElementById('f-duration').value;
  const situation = document.getElementById('f-situation').value.trim();
  const prompt = document.getElementById('f-prompt').value.trim();
  const options = document.getElementById('f-options').value.split('\n').map(s=>s.trim()).filter(Boolean);
  const correctIdx = parseInt(document.getElementById('f-correct').value,10) - 1;
  const explanation = document.getElementById('f-explanation').value.trim();

  if(!title || !youtubeId || !prompt || options.length<2 || isNaN(correctIdx) || correctIdx<0 || correctIdx>=options.length){
    alert('Please fill in a title, YouTube ID, question, at least 2 options, and a valid correct option number.');
    return;
  }
  addPlay({title, youtubeId, duration, situation, prompt, options, correctIdx, explanation});
}

function renderLeaderboard(){
  const fallbackNote = usingStorageFallback
    ? `<div class="notice" style="margin-bottom:14px;">Running in standalone mode — this leaderboard is only shared across sessions on this browser/device, not across real visitors. Hook up a real backend to make it truly shared.</div>`
    : '';
  if(!state.leaderboard.length){
    return `<div class="card">${fallbackNote}<div class="empty">No scores yet — be the first on the board.</div></div>`;
  }
  const rows = state.leaderboard.map((e,i)=> `
    <tr class="${e.username===state.username?'me':''}">
      <td class="rank">${i+1}</td>
      <td>${escapeHtml(e.username)}</td>
      <td>${e.totalScore||0}</td>
      <td>${e.attempts ? Math.round((e.correct/e.attempts)*100)+'%' : '—'}</td>
    </tr>
  `).join('');
  return `
    <div class="card">
      <h2 class="section">Leaderboard</h2>
      ${fallbackNote}
      <table>
        <thead><tr><th></th><th>Player</th><th>Score</th><th>Accuracy</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function setTab(t){ state.tab = t; render(); }

function renderGame(){
  const play = state.plays[state.currentPlayIdx];
  const src = buildEmbedSrc(play, state.clipToken);

  app.innerHTML = `
    <div class="brand">
      <h1 style="font-size:30px;">READ THE <span>DEFENSE</span></h1>
      <div class="user-pill"><b>${escapeHtml(state.username)}</b> · ${(state.profile&&state.profile.totalScore)||0} pts</div>
    </div>
    <div class="card">
      <div style="font-family:'Teko',sans-serif; font-size:20px; margin-bottom:10px; color:var(--net-gray);">${escapeHtml(play.title)}</div>
      <div class="jumbotron" style="position:relative;">
        <iframe id="clip-frame" src="${src}" allow="autoplay; encrypted-media" tabindex="-1"></iframe>
        <div id="click-shield" style="position:absolute; inset:0; cursor:default;" title="Playback only — watch it through, no pausing"></div>
        <div class="shotclock" id="shotclock">--</div>
      </div>
      <div class="btn-row" style="margin-top:12px;">
        <button class="btn ghost" onclick="replayClip()">↻ Watch it again</button>
        <button class="btn ghost" id="reveal-early-btn" onclick="revealQuestion()">Show me the read now →</button>
      </div>

      <div id="question-block" style="display:none;">
        <div class="situation"><b>ON FILM:</b> ${escapeHtml(play.situation||'')}</div>
        <div class="prompt">${escapeHtml(play.prompt)}</div>
        <div id="options-block">
          ${play.options.map((opt,i)=>`
            <button class="option" id="opt-${i}" onclick="choose(${i})">
              <span class="num">${i+1}</span><span>${escapeHtml(opt)}</span>
            </button>
          `).join('')}
        </div>
        <div id="feedback-block"></div>
      </div>
    </div>
    <div class="btn-row">
      <button class="btn ghost" onclick="backToMenu()">← Back to menu</button>
    </div>
  `;

  if(state.answered){
    revealQuestion();
    markAnswered(play);
  }
}

function markAnswered(play){
  play.options.forEach((opt,i)=>{
    const btn = document.getElementById('opt-'+i);
    if(!btn) return;
    btn.disabled = true;
    if(i===play.correctIdx) btn.classList.add('correct');
    else if(i===state.chosenIdx) btn.classList.add('wrong');
  });
  const isCorrect = state.chosenIdx === play.correctIdx;
  const fb = document.getElementById('feedback-block');
  if(fb){
    fb.innerHTML = `
      <div class="feedback ${isCorrect?'good':'bad'}">
        <div class="verdict">${isCorrect ? 'BUCKET. Correct read.' : 'MISSED READ.'}</div>
        <div>${escapeHtml(play.explanation||'')}</div>
      </div>
      <div class="btn-row" style="margin-top:14px;">
        <button class="btn" onclick="nextPlay()">Next possession →</button>
        <button class="btn ghost" onclick="backToMenu()">Back to menu</button>
      </div>
    `;
  }
}

function backToMenu(){
  state.screen = 'main';
  state.tab = 'play';
  render();
}

function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// wrap choose to re-render feedback in-place instead of full re-render (keeps iframe from reloading)
const _choose = choose;
choose = function(idx){
  if(state.answered) return;
  state.answered = true;
  state.chosenIdx = idx;
  const play = state.plays[state.currentPlayIdx];
  const isCorrect = idx === play.correctIdx;
  state.session.total += 1;
  if(isCorrect) state.session.correct += 1;
  state.profile.attempts = (state.profile.attempts||0) + 1;
  if(isCorrect){
    state.profile.correct = (state.profile.correct||0) + 1;
    state.profile.totalScore = (state.profile.totalScore||0) + 100;
  }
  state.profile.gamesPlayed = (state.profile.gamesPlayed||0) + 1;
  markAnswered(play);
  saveProfile(state.profile).then(()=> refreshLeaderboard());
};

loadFromStorage();
