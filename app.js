const API='https://api.alquran.cloud/v1';
const CACHE='quran-data-v2';
const $=id=>document.getElementById(id);
let surahs=[],allAyahs=Array(114).fill(null),current=0,searchTimer,onlineMode=true,playingIndex=-1,currentTafsirAyah=null,tafsirCache={};
const saved=()=>{try{return JSON.parse(localStorage.getItem('quran-last-read')||'null')}catch{return null}};
function notify(msg){const el=$('status');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3200)}
async function request(url){
  const cache=await caches.open(CACHE),hit=await cache.match(url);
  if(hit){const j=await hit.json();if(j.code===200)return j.data}
  if(!navigator.onLine)throw new Error('هذه البيانات غير محفوظة على الجهاز. اتصل بالإنترنت لتنزيلها.');
  const r=await fetch(url);if(!r.ok)throw new Error('تعذر تحميل البيانات');
  const copy=r.clone();try{await cache.put(url,copy)}catch{}
  const j=await r.json();if(j.code!==200)throw new Error(j.status||'حدث خطأ');return j.data;
}
async function getLocalJson(path){
  const c=await caches.open(CACHE),hit=await c.match(path);
  if(hit)return hit.json();
  const r=await fetch(path);if(!r.ok)throw new Error('ملف السورة غير متاح حالياً');
  try{await c.put(path,r.clone())}catch{} return r.json();
}
async function getSurah(n){
  try{return await getLocalJson('./quran-data/'+String(n).padStart(3,'0')+'.json')}
  catch(e){return request(API+'/surah/'+n+'/quran-uthmani')}
}
async function cachedSurah(n){
  if(allAyahs[n-1])return allAyahs[n-1];
  const c=await caches.open(CACHE);
  for(const key of ['./quran-data/'+String(n).padStart(3,'0')+'.json',API+'/surah/'+n+'/quran-uthmani']){
    const r=await c.match(key);
    if(r){try{const j=await r.json();const d=j.code===200?j.data:j;if(d&&d.ayahs){allAyahs[n-1]=d;return d}}catch{}}
  } return null;
}
function renderList(filter=''){
  const list=$('surahList'),q=filter.trim().toLowerCase();
  const rows=surahs.filter(s=>s.name.includes(q)||s.englishName.toLowerCase().includes(q)||String(s.number)===q);
  $('surahCount').textContent=rows.length+' سورة';list.innerHTML='';
  if(!rows.length){list.innerHTML='<div class="empty">لا توجد نتائج</div>';return}
  rows.forEach(s=>{const b=document.createElement('button');b.className='surah-item'+(s.number===current?' active':'');b.innerHTML='<span class="surah-num"><span>'+s.number+'</span></span><strong>'+s.name+'</strong><span class="surah-meta">'+s.numberOfAyahs+' آية</span>';b.addEventListener('click',()=>loadSurah(s.number));list.appendChild(b)});
}
function renderAyahs(s){
  $('readerHeader').querySelector('.muted').textContent=s.revelationType==='Meccan'?'مكية':'مدنية';
  $('readerHeader').querySelector('h2').textContent=s.name+' — '+s.englishName;
  $('verses').innerHTML='';
  if(s.number!==1&&s.number!==9){const bas=document.createElement('div');bas.className='bismillah';bas.textContent='بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';$('verses').appendChild(bas)}
  s.ayahs.forEach((a,i)=>{
    const row=document.createElement('div');row.className='ayah-item';row.dataset.index=i;
    const span=document.createElement('span');span.className='ayah';span.textContent=a.text+' ';
    const mark=document.createElement('span');mark.className='ayah-marker';mark.textContent=a.numberInSurah;
    const actions=document.createElement('span');actions.className='ayah-actions';
    const play=document.createElement('button');play.className='ayah-action';play.type='button';play.textContent='▶ استمع';play.title='استمع إلى الآية';play.addEventListener('click',()=>playAyah(i));
    const tafsir=document.createElement('button');tafsir.className='ayah-action';tafsir.type='button';tafsir.textContent='التفسير';tafsir.addEventListener('click',()=>showTafsir(i));
    actions.append(play,tafsir);row.append(span,mark,actions);$('verses').appendChild(row);
  });
}
async function loadSurah(n){
  current=n;playingIndex=-1;$('audioPlayer').pause();$('tafsirPanel').hidden=true;renderList($('searchInput').value);$('surahSelect').value=String(n);
  $('verses').innerHTML='<div class="loading">جارٍ تجهيز السورة…</div>';
  try{let s=await cachedSurah(n);if(!s)s=await getSurah(n);allAyahs[n-1]=s;renderAyahs(s);
    localStorage.setItem('quran-last-read',JSON.stringify({surah:n,ayah:1}));
    $('prevBtn').disabled=n===1;$('nextBtn').disabled=n===114;updateStorageStatus();
    if(innerWidth<760)$('reader').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){$('verses').innerHTML='<div class="empty">'+e.message+'</div>';notify(e.message)}
}
function updateStorageStatus(){
  const count=allAyahs.filter(Boolean).length;
  $('offlineStatus').textContent='محفوظ على هذا الجهاز: '+count+' من 114 سورة';
}
async function downloadOne(n,quiet=false){
  const s=await getSurah(n);allAyahs[n-1]=s;updateStorageStatus();
  if(!quiet)notify('تم حفظ سورة '+s.name+' على هذا الجهاز لتعمل دون إنترنت');
  return s;
}
async function downloadFull(){
  if(!navigator.onLine){notify('اتصل بالإنترنت أولاً لبدء التحميل');return}
  const btn=$('downloadAllBtn');btn.disabled=true;
  const queue=Array.from({length:114},(_,i)=>i+1).filter(n=>!allAyahs[n-1]);
  let done=114-queue.length,cursor=0,failed=[];
  $('downloadProgress').hidden=false;$('downloadProgress').textContent='بدأ تحميل القرآن: '+done+'/114';
  async function worker(){while(cursor<queue.length){const n=queue[cursor++];try{await downloadOne(n,true);done++;$('downloadProgress').textContent='جارٍ التحميل: '+done+'/114 سورة';}catch(e){failed.push(n)}}}
  await Promise.all(Array.from({length:3},worker));
  $('downloadProgress').textContent=failed.length?'اكتمل جزئياً؛ تعذر تحميل '+failed.length+' سورة. أعد المحاولة.':'اكتمل تحميل القرآن وحُفظ على هذا الجهاز.';
  notify(failed.length?'لم يكتمل تحميل بعض السور':'اكتمل تحميل القرآن دون اتصال');
  btn.disabled=false;updateStorageStatus();
}
function playAyah(index){
  const s=allAyahs[current-1];if(!s||!s.ayahs[index])return;
  playingIndex=index;document.querySelectorAll('.ayah-item').forEach((el,i)=>el.classList.toggle('playing',i===index));
  const a=s.ayahs[index],edition=$('reciterSelect').value,audio=$('audioPlayer');
  audio.src='https://cdn.islamic.network/quran/audio/128/'+edition+'/'+a.number+'.mp3';
  audio.play().catch(()=>notify('تعذر تشغيل الصوت؛ اضغط تشغيل من مشغل الصوت'));
}
$('audioPlayer').addEventListener('ended',()=>{const s=allAyahs[current-1];if(s&&playingIndex>=0&&playingIndex<s.ayahs.length-1)playAyah(playingIndex+1);else{playingIndex=-1;document.querySelectorAll('.ayah-item').forEach(el=>el.classList.remove('playing'))}});
$('reciterSelect').addEventListener('change',()=>{if(playingIndex>=0)playAyah(playingIndex)});
async function showTafsir(index){
  const s=allAyahs[current-1];if(!s||!s.ayahs[index])return;
  currentTafsirAyah=index;const panel=$('tafsirPanel'),edition=$('tafsirSelect').value;panel.hidden=false;$('tafsirText').textContent='جارٍ تحميل التفسير…';
  const key=current+':'+edition;
  try{if(!tafsirCache[key]){const data=await request(API+'/surah/'+current+'/'+edition);tafsirCache[key]=data.ayahs||[]}
    const item=tafsirCache[key][index];$('tafsirText').textContent=item?item.text:'لا يتوفر تفسير لهذه الآية في هذا المصدر.';
    panel.querySelector('.tafsir-heading strong').textContent='تفسير '+s.name+' — الآية '+s.ayahs[index].numberInSurah;
    panel.scrollIntoView({behavior:'smooth',block:'nearest'});
  }catch(e){$('tafsirText').textContent='تعذر جلب التفسير حالياً. تحقق من الاتصال.'}
}
$('tafsirSelect').addEventListener('change',()=>{if(currentTafsirAyah!==null)showTafsir(currentTafsirAyah)});
async function searchAyahs(q){
  const term=q.trim();if(term.length<2)return;
  if(!navigator.onLine){const needle=term.replace(/[ًٌٍَُِّْـٰ]/g,'');const found=[];for(const s of allAyahs)if(s)for(const a of s.ayahs)if(a.text.replace(/[ًٌٍَُِّْـٰ]/g,'').includes(needle))found.push({s,a});showResults(found,term);return}
  try{const d=await request(API+'/search/'+encodeURIComponent(term)+'/all/quran-uthmani');showResults(d.matches.slice(0,60).map(a=>({s:{name:a.surah.name},a})),term)}
  catch(e){notify('تعذر البحث الآن')}
}
function showResults(matches,q){
  $('verses').innerHTML='';$('readerHeader').querySelector('.muted').textContent='نتائج البحث';$('readerHeader').querySelector('h2').textContent='نتائج البحث عن: '+q;
  matches.slice(0,60).forEach(({s,a})=>{const card=document.createElement('div');card.className='search-result';const label=document.createElement('small');label.textContent=s.name+' — الآية '+a.numberInSurah;const p=document.createElement('p');p.className='ayah';p.textContent=a.text;card.append(label,p);$('verses').appendChild(card)});
  if(!matches.length)$('verses').innerHTML='<div class="empty">لم يتم العثور على نتائج ضمن البيانات المتاحة</div>';
}
async function init(){
  try{
    try{surahs=await getLocalJson('./quran-data/index.json')}catch{surahs=await request(API+'/surah')}$('surahSelect').innerHTML='<option value="">اختر السورة…</option>';
    surahs.forEach(s=>{const o=document.createElement('option');o.value=s.number;o.textContent=s.number+' — '+s.name;$('surahSelect').appendChild(o)});
    renderList();
    const c=await caches.open(CACHE);
    allAyahs=await Promise.all(Array.from({length:114},(_,i)=>c.match('./quran-data/'+String(i+1).padStart(3,'0')+'.json').then(async r=>{if(!r)return null;try{return await r.json()}catch{return null}})));
    updateStorageStatus();const last=saved();await loadSurah(last?.surah||1);
  }catch(e){$('surahList').innerHTML='<div class="empty">تعذر تحميل الفهرس. تحقق من اتصال الإنترنت.</div>';notify(e.message)}
}
$('surahSelect').addEventListener('change',e=>{if(e.target.value)loadSurah(Number(e.target.value))});
$('searchInput').addEventListener('input',e=>{renderList(e.target.value);clearTimeout(searchTimer);const q=e.target.value;if(q.trim().length>=2)searchTimer=setTimeout(()=>searchAyahs(q),350);else if(!q.trim()&&current)loadSurah(current)});
$('prevBtn').addEventListener('click',()=>current>1&&loadSurah(current-1));$('nextBtn').addEventListener('click',()=>current<114&&loadSurah(current+1));
$('continueBtn').addEventListener('click',()=>{const last=saved();loadSurah(last?.surah||1);$('reader').scrollIntoView({behavior:'smooth'})});

function setMode(mode){
  onlineMode=mode==='online';
  ['onlineBtn','downloadOneBtn','downloadAllBtn'].forEach(id=>{
    const b=$(id),active=(id==='onlineBtn'&&mode==='online')||(id==='downloadOneBtn'&&mode==='one')||(id==='downloadAllBtn'&&mode==='all');
    b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
  });
}
$('onlineBtn').addEventListener('click',()=>{setMode('online');notify('القراءة المباشرة: تُجلب السورة عند اختيارها فقط')});
$('downloadOneBtn').addEventListener('click',async()=>{setMode('one');const n=Number($('surahSelect').value||current);if(n)try{await downloadOne(n)}catch(e){notify(e.message)}});
$('downloadAllBtn').addEventListener('click',()=>{setMode('all');downloadFull()});
$('searchToggle').addEventListener('click',()=>{const box=$('headerSearch');box.classList.toggle('expanded');if(box.classList.contains('expanded'))$('searchInput').focus();else{$('searchInput').value='';renderList();}});
let lastScroll=window.scrollY;
window.addEventListener('scroll',()=>{const y=window.scrollY,bar=$('topbar');if(y<80)bar.classList.remove('header-hidden');else if(y>lastScroll+5)bar.classList.add('header-hidden');else if(y<lastScroll-5)bar.classList.remove('header-hidden');lastScroll=y;$('backToTop').classList.toggle('visible',y>300);},{passive:true});
$('backToTop').addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
$('themeBtn').addEventListener('click',()=>{document.body.classList.toggle('dark');localStorage.setItem('quran-dark',document.body.classList.contains('dark')?'1':'0')});
if(localStorage.getItem('quran-dark')==='1')document.body.classList.add('dark');
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
init();
