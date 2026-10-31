const API='https://api.alquran.cloud/v1';
const DATA_CACHE='quran-data-v1';
const $=id=>document.getElementById(id);
let surahs=[],allAyahs=[],current=0,searchTimer;
const saved=()=>{try{return JSON.parse(localStorage.getItem('quran-last-read')||'null')}catch{return null}};
function notify(msg){const el=$('status');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3500)}
async function request(url){
  const cache=await caches.open(DATA_CACHE);
  const hit=await cache.match(url);
  if(hit){try{return await hit.json()}catch{}}
  const response=await fetch(url);
  if(!response.ok)throw new Error('تعذر تحميل البيانات');
  const copy=response.clone();
  try{await cache.put(url,copy)}catch{}
  const json=await response.json();
  if(json.code!==200)throw new Error(json.status||'حدث خطأ');
  return json.data;
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
  s.ayahs.forEach(a=>{const span=document.createElement('span');span.className='ayah';span.textContent=a.text+' ';const mark=document.createElement('span');mark.className='ayah-marker';mark.textContent=a.numberInSurah;$('verses').append(span,mark,document.createTextNode(' '))});
}
function loadSurah(n){
  const s=allAyahs[n-1];if(!s){notify('السورة غير متاحة بعد؛ اتصل بالإنترنت لإكمال التنزيل');return}
  current=n;renderList($('searchInput').value);$('surahSelect').value=String(n);renderAyahs(s);
  localStorage.setItem('quran-last-read',JSON.stringify({surah:n,ayah:1}));
  $('prevBtn').disabled=n===1;$('nextBtn').disabled=n===114;
  if(innerWidth<760)$('reader').scrollIntoView({behavior:'smooth',block:'start'});
}
function searchAyahs(q){
  const term=q.trim().replace(/[ًٌٍَُِّْـٰ]/g,'');
  if(term.length<2)return;
  const matches=[];
  for(const s of allAyahs)if(s)for(const a of s.ayahs)if(a.text.replace(/[ًٌٍَُِّْـٰ]/g,'').includes(term))matches.push({s,a});
  $('verses').innerHTML='';$('readerHeader').querySelector('.muted').textContent='نتائج البحث';
  $('readerHeader').querySelector('h2').textContent='نتائج البحث عن: '+q;
  matches.slice(0,60).forEach(({s,a})=>{const card=document.createElement('div');card.className='search-result';const label=document.createElement('small');label.textContent=s.name+' — الآية '+a.numberInSurah;const p=document.createElement('p');p.className='ayah';p.textContent=a.text;card.append(label,p);$('verses').appendChild(card)});
  if(!matches.length)$('verses').innerHTML='<div class="empty">لم يتم العثور على نتائج</div>';
  if(matches.length>60)notify('عُرضت أول 60 نتيجة');
}
async function downloadAll(){
  let done=allAyahs.filter(Boolean).length;
  const queue=Array.from({length:114},(_,i)=>i+1).filter(n=>!allAyahs[n-1]);
  if(!queue.length){setOfflineState();return}
  const status=$('status');notify('جارٍ تجهيز النسخة المحلية: '+done+'/114 سورة');
  let cursor=0;
  async function worker(){while(cursor<queue.length){const n=queue[cursor++];try{const s=await request(API+'/surah/'+n+'/quran-uthmani');allAyahs[n-1]=s;done++;if(done%5===0||done===114)notify('تم تنزيل '+done+' من 114 سورة')}catch(e){console.warn('Surah download failed',n,e);}}}
  await Promise.all(Array.from({length:6},worker));
  const missing=allAyahs.filter(x=>!x).length;
  if(!missing){notify('اكتمل تنزيل القرآن على هذا الجهاز؛ أصبح متاحاً دون إنترنت');setOfflineState()}
  else notify('اكتمل تنزيل '+(114-missing)+' سورة. يلزم اتصال لإكمال '+missing+' سورة.');
}
function setOfflineState(){
  const el=$('offlineStatus');if(el)el.textContent='النسخة المحلية: '+allAyahs.filter(Boolean).length+'/114 سورة';
}
async function init(){
  try{
    surahs=await request(API+'/surah');
    $('surahSelect').innerHTML='<option value="">اختر سورة…</option>';
    surahs.forEach(s=>{const o=document.createElement('option');o.value=s.number;o.textContent=s.number+' — '+s.name;$('surahSelect').appendChild(o)});
    renderList();
    const last=saved(),first=last?.surah||1;
    try{allAyahs=await Promise.all(Array.from({length:114},(_,i)=>caches.open(DATA_CACHE).then(c=>c.match(API+'/surah/'+(i+1)+'/quran-uthmani')).then(async r=>r?((await r.json()).data):null)))}catch{allAyahs=Array(114).fill(null)}
    if(!allAyahs[first-1]){const s=await request(API+'/surah/'+first+'/quran-uthmani');allAyahs[first-1]=s}
    loadSurah(first);setOfflineState();
    if(navigator.onLine)downloadAll();else notify('أنت غير متصل؛ ستظهر السور التي سبق تنزيلها فقط');
  }catch(e){$('surahList').innerHTML='<div class="empty">تعذر تحميل الفهرس. اتصل بالإنترنت أول مرة.</div>';notify(e.message)}
}
$('surahSelect').addEventListener('change',e=>{if(e.target.value)loadSurah(Number(e.target.value))});
$('searchInput').addEventListener('input',e=>{renderList(e.target.value);clearTimeout(searchTimer);const q=e.target.value;if(q.trim().length>=2)searchTimer=setTimeout(()=>searchAyahs(q),300);else if(!q.trim()&&current)loadSurah(current)});
$('prevBtn').addEventListener('click',()=>current>1&&loadSurah(current-1));$('nextBtn').addEventListener('click',()=>current<114&&loadSurah(current+1));
$('continueBtn').addEventListener('click',()=>{const last=saved();loadSurah(last?.surah||1);$('reader').scrollIntoView({behavior:'smooth'})});
$('themeBtn').addEventListener('click',()=>{document.body.classList.toggle('dark');localStorage.setItem('quran-dark',document.body.classList.contains('dark')?'1':'0')});
if(localStorage.getItem('quran-dark')==='1')document.body.classList.add('dark');
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>notify('تعذر تفعيل وضع التصفح دون إنترنت')));
init();
