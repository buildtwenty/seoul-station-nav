// 뷰어 진입점. data/index.json → 역 선택 → 역 JSON 로드 → 경로·모형
import * as THREE from 'three';
import { StationScene } from './render.js';
import { createOrbit, frameOf } from './camera.js';
import { bestRoute, officialDoor } from './route.js';
import { describe } from './describe.js';
import { TYPE_KO } from './schema.js';

const $ = (s) => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 1, 6000);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.95));
const sun = new THREE.DirectionalLight(0xffffff, 0.55); sun.position.set(-200, 400, 250); scene.add(sun);
const S = new StationScene(scene);
const orbit = createOrbit(camera, canvas);

let index = [], official = {}, st = null;
let cur = { id: null, from: null, to: null, access: false };
let routeFrame = null, follow = true;

async function loadJSON(u) { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); }

async function init() {
  [index, official] = await Promise.all([loadJSON('data/index.json'), loadJSON('data/official/fast_transfer.json').then((j) => j.stations).catch(() => ({}))]);
  const sel = $('#station');
  for (const v of index) sel.add(new Option(`${v.name}${v.grade === 'C' ? ' (자동 생성)' : ''}`, v.id));
  const want = location.hash.slice(1);
  if (index.some((v) => v.id === want)) sel.value = want;
  sel.onchange = () => loadStation(sel.value);
  $('#from').onchange = (e) => { cur.from = e.target.value; fillTo(); refresh(true); };
  $('#to').onchange = (e) => { cur.to = e.target.value; refresh(false); };
  $('#access').onchange = (e) => { cur.access = e.target.checked; refresh(false); };
  $('#yscale').onchange = (e) => { S.yScale = e.target.checked ? 2.4 : 1; refresh(true); fitWhole(); };
  document.querySelectorAll('.views button[data-v]').forEach((b) => b.onclick = () => setView(b.dataset.v));
  $('#whole').onclick = () => { follow = !follow; $('#whole').setAttribute('aria-pressed', !follow); if (follow && routeFrame) orbit.frameTo(routeFrame.t, routeFrame.r); else fitWhole(); };
  resize(); requestAnimationFrame(frame);
  await loadStation(sel.value);
}

async function loadStation(id) {
  const v = index.find((x) => x.id === id); if (!v) return;
  st = await loadJSON(v.file); cur.id = id; location.hash = id;
  $('#title').textContent = st.name;
  $('#lede').textContent = st.lede || '어느 문에서 내려 어떤 계단으로 가는지, 층을 쌓아 올린 모형으로 봅니다.';
  fillSelects(); refresh(true); setView('iso');
  const f = frameOf(S.world); orbit.jumpTo(f.t, f.r); if (follow && routeFrame) orbit.frameTo(routeFrame.t, routeFrame.r);
}
function fitWhole() { const f = frameOf(S.world); orbit.frameTo(f.t, f.r); }
function setView(v) { orbit.setView(v); document.querySelectorAll('.views button[data-v]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.v === v)); }

function fillSelects() {
  const f = $('#from'); f.innerHTML = '';
  for (const k in st.platforms) f.add(new Option(st.platforms[k].short, k));
  cur.from = f.value; fillTo();
}
function fillTo() {
  const t = $('#to'), from = st.platforms[cur.from]; t.innerHTML = '';
  const og = document.createElement('optgroup'); og.label = '갈아타기';
  for (const k in st.platforms) if (st.platforms[k].line !== from.line) og.appendChild(new Option(st.platforms[k].short + ' 갈아타기', k));
  if (og.children.length) t.appendChild(og);
  const xg = document.createElement('optgroup'); xg.label = '나가기';
  Object.entries(st.nodes).filter(([, n]) => n.type === 'exit').sort((a, b) => a[1].no - b[1].no).forEach(([id, n]) => xg.appendChild(new Option(n.label, id)));
  t.appendChild(xg); cur.to = t.value;
}

function refresh(rebuild) {
  if (rebuild) S.build(st, cur.from);
  const r = bestRoute(st, cur.from, cur.to, { noStairs: cur.access });
  routeFrame = S.drawRoute(st, cur.from, r, reduced);
  if (follow && routeFrame) orbit.frameTo(routeFrame.t, routeFrame.r);
  $('#doorNo').textContent = r ? `${r.c}-${r.d}` : '–';
  const note = $('#doorNote');
  const off = officialDoor(st, official, cur.from, cur.to);
  if (!r) { note.className = 'note est'; note.textContent = cur.access ? '계단 없이 가는 경로가 이 모형에 없습니다' : '경로를 찾지 못했습니다'; }
  else if (off) {
    const same = off.text === `${r.c}-${r.d}`; note.className = 'note ' + (same ? 'ok' : 'bad');
    note.textContent = same ? `공식 빠른환승 위치 ${off.text}와 같습니다` : `공식 빠른환승 위치는 ${off.text}입니다. 모형 좌표를 고쳐야 합니다`;
  } else { note.className = 'note est'; note.textContent = '모형에서 계산한 값입니다. 공식 자료가 없어 현장 확인이 필요합니다'; }
  const ol = $('#steps'); ol.innerHTML = '';
  if (r) describe(st, cur.from, r).forEach((s) => {
    const li = document.createElement('li'); li.textContent = s.text;
    if (s.tag) { const b = document.createElement('span'); b.className = 'tag ' + s.tag; b.textContent = TYPE_KO[s.tag]; li.appendChild(b); }
    if (s.q) { const b = document.createElement('span'); b.className = 'tag q'; b.textContent = '위치 어림'; li.appendChild(b); }
    ol.appendChild(li);
  });
  const fx = st.facts || { ok: [], est: [] };
  const src = st.source ? `<h3>출처</h3><ul>${(st.source.urls || []).map((u) => `<li><a href="${u}" target="_blank" rel="noopener">${u.replace(/^https?:\/\//, '').slice(0, 60)}</a></li>`).join('')}${st.source.note ? `<li>${st.source.note}</li>` : ''}${st.source.checked ? `<li>확인일 ${st.source.checked}</li>` : ''}</ul>` : '';
  $('#facts').innerHTML = `<h3>자료로 확인한 것</h3><ul>${fx.ok.map((x) => `<li>${x}</li>`).join('')}</ul><h3>추정해서 놓은 것</h3><ul>${fx.est.map((x) => `<li>${x}</li>`).join('')}</ul>${src}`;
}

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.9 ? 46 : 32; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);

function frame(now) { orbit.update(); S.animate(now / 1000, reduced); renderer.render(scene, camera); requestAnimationFrame(frame); }

const themeWatch = () => { if (st) refresh(true); };
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeWatch);
new MutationObserver(themeWatch).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

(document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve())
  .then(init)
  .catch((e) => { $('.stage').innerHTML = `<p style="padding:24px">불러오기에 실패했습니다: ${e.message}<br>file:// 로 열면 데이터를 읽지 못합니다. 로컬 서버(python -m http.server)로 여세요.</p>`; });
