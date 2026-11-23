/* Consistent continuous-reading focus and a shared paper reader for the library. */
let scrollFocusLastY=0,scrollFocusBound=null,scrollFocusLock=0;
function measureScrollFocusBar(){const bar=$('.scroll-reader-bar');if(!bar)return;const was=document.body.classList.contains('scroll-bar-hidden');if(was)document.body.classList.remove('scroll-bar-hidden');const h=Math.ceil(bar.getBoundingClientRect().height)||96;document.documentElement.style.setProperty('--scroll-focus-bar',h+'px');if(was)document.body.classList.add('scroll-bar-hidden')}
function syncScrollFocusBar(){const main=$('#main');if(!main||!document.body.classList.contains('scroll-focus')){document.body.classList.remove('scroll-bar-hidden');return}if(Date.now()<scrollFocusLock){scrollFocusLastY=main.scrollTop;return}const y=main.scrollTop,delta=y-scrollFocusLastY;if(y<=16||delta<-8){if(document.body.classList.contains('scroll-bar-hidden')){document.body.classList.remove('scroll-bar-hidden');scrollFocusLock=Date.now()+140}}else if(delta>10&&y>36){if(!document.body.classList.contains('scroll-bar-hidden')){document.body.classList.add('scroll-bar-hidden');scrollFocusLock=Date.now()+140}}scrollFocusLastY=y}
function bindScrollFocusHide(on){const main=$('#main');if(scrollFocusBound){scrollFocusBound.main.removeEventListener('scroll',scrollFocusBound.onScroll);scrollFocusBound.main.removeEventListener('pointerup',scrollFocusBound.onTap);window.removeEventListener('resize',scrollFocusBound.onResize);scrollFocusBound=null}document.body.classList.remove('scroll-bar-hidden');document.documentElement.style.removeProperty('--scroll-focus-bar');if(!on||!main)return;measureScrollFocusBar();scrollFocusLastY=main.scrollTop;scrollFocusLock=0;const onScroll=()=>syncScrollFocusBar();const onTap=e=>{if(e.target.closest('.scroll-reader-bar,a,input,label,select,button'))return;if(e.clientY<88){document.body.classList.remove('scroll-bar-hidden');scrollFocusLock=Date.now()+120}};const onResize=()=>measureScrollFocusBar();main.addEventListener('scroll',onScroll,{passive:true});main.addEventListener('pointerup',onTap,{passive:true});window.addEventListener('resize',onResize,{passive:true});scrollFocusBound={main,onScroll,onTap,onResize}}
async function setContinuousFocus(enabled){document.body.classList.toggle('scroll-focus',enabled);const button=$('#scroll-focus');if(button){button.setAttribute('aria-pressed',String(enabled));button.textContent=enabled?'✕ '+t('خروج من التركيز','Exit focus'):'⛶ '+t('وضع التركيز','Focus mode')}bindScrollFocusHide(enabled);requestAnimationFrame(()=>{measureScrollFocusBar();});if(enabled){const el=document.documentElement;const request=el.requestFullscreen||el.webkitRequestFullscreen||el.msRequestFullscreen;try{if(request&&!document.fullscreenElement&&!document.webkitFullscreenElement)await request.call(el)}catch{try{toast?.(t('وضع التركيز يملأ مساحة المتصفح.','Focus fills the browser area.'))}catch{}}}else{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.webkitFullscreenElement)document.webkitExitFullscreen?.()}catch{}}}
const polishedScroll=scrollQuran;scrollQuran=function(start){polishedScroll(start);const bar=$('.scroll-reader-bar');if(!bar)return;const button=document.createElement('button');button.id='scroll-focus';button.className='chip';button.textContent='⛶ '+t('وضع التركيز','Focus mode');button.setAttribute('aria-pressed',document.body.classList.contains('scroll-focus'));button.onclick=()=>setContinuousFocus(!document.body.classList.contains('scroll-focus'));bar.append(button)};
let libraryDataPromise,libraryViewState=null,libraryLayoutTimer;
function loadLibraryData(){return libraryDataPromise||(libraryDataPromise=Promise.all(['books.json','books-text.json','prayer-library.json','original-text-books.json','heritage-library.json'].map(f=>fetch(f).then(r=>{if(!r.ok)throw Error('books');return r.json()}).catch(e=>{if(f!=='books.json')return [];throw e}))).then(([original,text,devotional,transcriptions,heritage])=>{const converted=new Map(transcriptions.map(b=>[b.id,b]));BOOKS=[...text,...original.map(b=>converted.has(b.id)?{...b,...converted.get(b.id),originalPdf:b.pdf,originalSlides:b.slides}:b),...devotional,...heritage];return BOOKS}).catch(e=>{libraryDataPromise=null;throw e}))}
function librarySections(selected='root'){const items=[['root','#library',t('الكل','All')],['aqidah','#library/aqidah',t('العقيدة','Aqidah')],['hadith','#library/hadith',t('الحديث','Hadith')],['sunnah','#library/sunnah',t('السنة','Sunnah')],['prayers','#library/prayers',t('الأدعية','Prayers')],['prayers-duas','#library/prayers-duas',t('أدعية','Duas')],['prayers-munajat','#library/prayers-munajat',t('مناجيات','Munajat')]];return `<nav class="library-collections" aria-label="${t('أقسام المكتبة','Library sections')}"><div class="library-collections-track">${items.map(([id,href,label])=>`<a class="chip" href="${href}" ${selected===id?'aria-current="page"':''}>${label}</a>`).join('')}</div></nav>`}
function libraryParentHref(id=''){
 if(!id||id==='root')return '#home';
 if(id==='prayers-duas'||id==='prayers-munajat')return '#library/prayers';
 if(['prayers','aqidah','hadith','sunnah'].includes(id))return '#library';
 return '#library';
}
function libraryPathNav(id=''){
 const section=id||'root';
 const labels={
  root:t('مكتبة سكينة','Sakinah Library'),
  prayers:t('الأدعية','Prayers'),
  'prayers-duas':t('أدعية','Duas'),
  'prayers-munajat':t('مناجيات','Munajat'),
  aqidah:t('العقيدة','Aqidah'),
  hadith:t('الحديث','Hadith'),
  sunnah:t('السنة','Sunnah')
 };
 const crumbs=[{href:'#library',label:labels.root}];
 if(section==='prayers-duas'||section==='prayers-munajat'){
  crumbs.push({href:'#library/prayers',label:labels.prayers});
  crumbs.push({href:'#library/'+section,label:labels[section],current:true});
 }else if(section!=='root'){
  crumbs.push({href:'#library/'+section,label:labels[section]||section,current:true});
 }else crumbs[0].current=true;
 const backHref=libraryParentHref(section);
 const backLabel=section==='root'?t('الرئيسية','Home'):t('رجوع','Back');
 return `<nav class="library-path" aria-label="${t('مسار المكتبة','Library path')}">
  <a class="chip library-back" href="${backHref}">→ ${backLabel}</a>
  <ol class="library-crumbs">${crumbs.map((c,i)=>`<li>${i?`<span class="library-crumb-sep" aria-hidden="true">‹</span>`:''}${c.current?`<span aria-current="page">${esc(c.label)}</span>`:`<a href="${c.href}">${esc(c.label)}</a>`}</li>`).join('')}</ol>
 </nav>`
}
function libraryPdfHref(b){return b?.pdf||b?.originalPdf||''}
function libraryShelfCard({title,meta='',readHref,pdfHref='',readLabel,pdfLabel,sealAlt=''}){
 const readText=readLabel||t('قراءة','Read');
 const pdfText=pdfLabel||'PDF';
 const pdf=pdfHref
  ?`<a class="btn secondary book-pdf" href="${esc(pdfHref)}" download target="_blank" rel="noopener">${pdfText}</a>`
  :`<button type="button" class="btn secondary book-pdf" disabled aria-disabled="true" title="${t('لا يتوفر ملف PDF لهذا العنوان','No PDF is available for this title')}">${pdfText}</button>`;
 return `<article class="book-card shelf-card" title="${esc(title)}">
  <div class="book-seal" aria-hidden="true"><img class="book-emblem" src="assets/sakinah-emblem.png" alt="${esc(sealAlt)}"></div>
  <h2>${esc(title)}</h2>
  ${meta?`<p class="book-meta">${meta}</p>`:''}
  <div class="book-actions">
   <a class="btn book-read" href="${esc(readHref)}">${readText}</a>
   ${pdf}
  </div>
 </article>`}
function libraryCard(b){
 const pages=b.hadithCount||b.slides?.length||0;
 const title=lang()==='en'?b.titleEn||b.title:b.title;
 const metaParts=[b.author?esc(b.author):'',b.category?'':(ar(pages)+' '+(b.hadithCount?t('حديثًا','hadiths'):t('صفحة','pages')))].filter(Boolean);
 return libraryShelfCard({
  title,
  meta:metaParts.join(' · '),
  readHref:`#library/${b.id}/${read('bookPosition-'+b.id,0)}`,
  pdfHref:libraryPdfHref(b),
  readLabel:t('قراءة','Read'),
  pdfLabel:'PDF'
 })
}
function libraryDirectoryCards(books){
 const count=section=>books.filter(b=>b.section===section).length;
 return [{href:'#library/aqidah',title:t('العقيدة الإباضية','Ibadi Aqidah'),desc:t('مشارق الأنوار، بهجة الأنوار، أصول الدين وغيرها.','Mashariq, Bahjat, Usul al-Din and more.'),n:count('aqidah')},{href:'#library/hadith',title:t('كتب الحديث','Hadith books'),desc:t('مسند الربيع والصحاح والسنن للقراءة.','Musnad al-Rabi, Sahih and Sunan collections.'),n:count('hadith')},{href:'#library/sunnah',title:t('السنة والمختصرات','Sunnah & digests'),desc:t('الأربعون النووية والقدسية.','Nawawi and Qudsi forties.'),n:count('sunnah')},{href:'#library/prayers',title:t('مكتبة الأدعية','Prayer Library'),desc:t('الأدعية والمناجيات المشكّلة مع المصدر.','Vocalized supplications with sources.'),n:books.filter(b=>b.category).length}]
  .map(c=>libraryShelfCard({
   title:c.title,
   meta:`${esc(c.desc)} · ${ar(c.n)} ${t('كتابًا','books')}`,
   readHref:c.href,
   pdfHref:'',
   readLabel:t('دخول','Enter'),
   pdfLabel:'PDF'
  })).join('')
}
function hadithApiToSlides(data,bookTitle){const sections=data.metadata?.sections||{},buckets={};for(const h of data.hadiths||[]){const book=String(h.reference?.book??0);(buckets[book]||(buckets[book]=[])).push(h)}const keys=Object.keys(buckets).sort((a,b)=>Number(a)-Number(b)).filter(k=>buckets[k].length);const slides=[];for(const key of keys){const list=buckets[key],sectionName=sections[key]||'',chunk=4;for(let i=0;i<list.length;i+=chunk){const part=list.slice(i,i+chunk),first=part[0].hadithnumber||part[0].arabicnumber,last=part[part.length-1].hadithnumber||part[part.length-1].arabicnumber;slides.push({title:(sectionName?sectionName+' · ':'')+t('أحاديث','Hadiths')+' '+ar(first)+(part.length>1?'–'+ar(last):''),text:part.map(h=>((h.hadithnumber||h.arabicnumber)?ar(h.hadithnumber||h.arabicnumber)+'. ':'')+(h.text||'').trim()).filter(Boolean).join('\n\n'),reference:bookTitle+(sectionName?' · '+sectionName:'')+' · '+ar(first)+(part.length>1?'–'+ar(last):'')})}}return slides.length?slides:[{title:bookTitle,text:t('تعذر قراءة أحاديث هذا المصدر.','Could not parse hadiths from this source.'),reference:bookTitle}]}
const remoteHadithCache=new Map();
async function ensureHeritageBook(book){if(!book?.remoteHadith||book._hadithReady)return book;if(remoteHadithCache.has(book.id)){const slides=remoteHadithCache.get(book.id);book.slides=slides;book._hadithReady=true;return book}$('#main').innerHTML=heading(esc(lang()==='en'?book.titleEn||book.title:book.title),t('جارٍ تحميل نص الحديث…','Loading hadith text…'));try{const data=await fetch(book.remoteHadith).then(r=>{if(!r.ok)throw Error('hadith');return r.json()});const slides=hadithApiToSlides(data,book.title);remoteHadithCache.set(book.id,slides);book.slides=slides;book._hadithReady=true;const idx=BOOKS.findIndex(b=>b.id===book.id);if(idx>=0)BOOKS[idx]=book;return book}catch{toast?.(t('تعذر تحميل كتاب الحديث. تحقق من الاتصال.','Could not load the hadith book. Check your connection.'));throw Error('hadith-load')}}
function renderLibraryIndex(books,id){const section=id||'root',group=id==='prayers-duas'?'duas':id==='prayers-munajat'?'munajat':null,heritage=['aqidah','hadith','sunnah'].includes(id)?id:null,title=id==='prayers'?t('مكتبة الأدعية','Prayer Library'):group==='duas'?t('الأدعية','Supplications'):group==='munajat'?t('المناجيات','Intimate prayers'):heritage==='aqidah'?t('العقيدة','Aqidah'):heritage==='hadith'?t('الحديث','Hadith'):heritage==='sunnah'?t('السنة','Sunnah'):t('مكتبة سكينة','Sakinah Library');document.body.classList.remove('library-focus');$('#main').classList.remove('library-reader');
 const directoryCards=libraryDirectoryCards(books);
 let selected=group?books.filter(b=>b.category===group):heritage?books.filter(b=>b.section===heritage):books.filter(b=>!b.category&&!b.section);const collectionDownload=group?`<a class="chip" download href="books/devotional/${group}-complete.pdf">↓ ${t('تنزيل المجموعة كاملة PDF','Download the complete collection PDF')}</a>`:'';
 const blurb=id==='prayers'?t('اختر الأدعية أو المناجيات. حُفظت الألفاظ والتشكيل ونسبة النصوص إلى مصادرها.','Choose supplications or intimate prayers. Wording, source vocalization and attribution are retained.'):heritage==='aqidah'?t('كتب العقيدة الإباضية للقراءة النصية، منسوبة إلى مصادرها.','Ibadi aqidah books for text reading, with source attribution.'):heritage==='hadith'?t('كتب الحديث للقراءة. مسند الربيع محليًا، والصحاح والسنن تُحمَّل عند الفتح.','Hadith books for reading. Musnad al-Rabi is local; Sahih and Sunan load when opened.'):heritage==='sunnah'?t('مختصرات السنة: الأربعون النووية والقدسية.','Sunnah digests: Nawawi and Qudsi forties.'):t('اختر قسمًا، ثم اقرأ ككتاب بصفحات ثابتة أو نزّل PDF.','Choose a section, then read as fixed book pages or download a PDF.');
 const prayerCards=id==='prayers'?['duas','munajat'].map(category=>libraryShelfCard({
  title:category==='duas'?t('الأدعية','Supplications'):t('المناجيات','Intimate prayers'),
  meta:`${ar(books.filter(b=>b.category===category).length)} ${t('كتيبًا مشكّلًا من المصدر','source-vocalized booklets')}`,
  readHref:`#library/prayers-${category}`,
  pdfHref:`books/devotional/${category}-complete.pdf`,
  readLabel:t('قراءة','Read'),
  pdfLabel:'PDF'
 })).join(''):'';
 $('#main').innerHTML=heading(title,blurb)+libraryPathNav(section)+librarySections(section)+(id==='prayers'?'':`<div class="toolbar"><label class="sr-only" for="library-search">${t('بحث في الكتب','Search books')}</label><input id="library-search" type="search" placeholder="${t('ابحث عن كتيّب…','Find a booklet…')}">${collectionDownload}</div>`)+`<div class="books-grid shelf-grid">${id==='prayers'?prayerCards:(group||heritage?'':directoryCards)+selected.map(libraryCard).join('')}</div>`;
 prepareScreen('books');const grid=$('.books-grid');
 grid?.classList.remove('screen-deck','deck-books');
 openCatalog(grid,'books');
 document.body.classList.add('catalog-scroll');
 bindLibraryCardOpens(grid);
 if($('#library-search'))$('#library-search').oninput=e=>{const term=normalize(e.target.value);grid.innerHTML=(!group&&!heritage&&!term?directoryCards:'')+selected.filter(b=>normalize(b.title+' '+(b.titleEn||'')+' '+(b.author||'')).includes(term)).map(libraryCard).join('');grid.classList.remove('screen-deck','deck-books');openCatalog(grid,'books');bindLibraryCardOpens(grid)}
}
function bindLibraryCardOpens(grid){if(!grid)return;grid.querySelectorAll('.book-card').forEach(card=>{
  const link=card.querySelector('a.book-read[href^="#"]');
  if(!link)return;
  card.classList.add('book-card-openable');
  const open=()=>{const href=link.getAttribute('href')||'';location.hash=href.startsWith('#')?href.slice(1):href};
  card.onclick=e=>{if(e.target.closest('a,button'))return;e.preventDefault();open()};
 })}
function libraryMode(){return 'spread'}
function librarySpread(){const w=document.documentElement.clientWidth||innerWidth,h=document.documentElement.clientHeight||innerHeight;return w>=720&&w>=h*0.85}
function libraryPageHeader(book,page){return `<div class="library-leaf-head"><span>${esc(lang()==='en'?book.titleEn||book.title:book.title)}</span><span>سَكِينَة</span></div>`}
function normalizeLibraryText(text=''){
 return String(text||'')
  .replace(/\u06DD/g,' ')
  .replace(/\u06DE/g,'')
  .replace(/\s*\._\)\s*:?/g,'. ')
  .replace(/\s*[_\)]+\s*:/g,' ')
  .replace(/\r\n?/g,'\n')
  /* Soft PDF/OCR wraps become spaces; only blank lines stay paragraph breaks. */
  .replace(/[ \t]*\n[ \t]*(?!\n)/g,' ')
  .replace(/\n{2,}/g,'\n\n')
  .replace(/[ \t]{2,}/g,' ')
  .replace(/\s+([،؛:!؟.])/g,'$1')
  .replace(/([«\(\[])\s+/g,'$1')
  .replace(/\s+([»\)\]])/g,'$1')
  .replace(/\s{2,}/g,' ')
  .trim()
}
function libraryParagraphs(text){
 const clean=normalizeLibraryText(text);
 if(!clean)return [];
 /* Prefer real blank-line paragraphs; otherwise keep one flowing block per slide. */
 const parts=clean.includes('\n\n')
  ?clean.split(/\n\n+/).map(p=>p.replace(/\s+/g,' ').trim()).filter(Boolean)
  :[clean.replace(/\s+/g,' ').trim()];
 return parts;
}
function libraryTextHtml(text){
 const parts=libraryParagraphs(text);
 return parts.map(part=>`<p class="library-para">${esc(part)}</p>`).join('')||`<p class="library-para"></p>`
}
function libraryPrintedLabel(page){
 if(Number.isFinite(page?.printedPage))return t('المطبوع ص','Print p.')+' '+ar(page.printedPage);
 return '';
}
function libraryPaper(book,page,side=''){
 const heading=book.textEdition&&page.title&&!page.part&&!/^ص\s*\d+/.test(String(page.title||''))?page.title:'';
 const printed=libraryPrintedLabel(page);
 return `<section class="library-paper book-leaf ${book.textEdition?'text-edition':'image-edition'} ${side}" data-library-page="${page.number}" draggable="false">${libraryPageHeader(book,page)}<div class="library-paper-body" lang="ar" dir="rtl">${book.textEdition?`${heading?`<h2>${esc(heading)}</h2>`:''}<div class="library-text" contenteditable="false">${libraryTextHtml(page.text)}</div>`:`<img src="${esc(page.image)}" alt="${esc(book.title)} — ${t('الصفحة','Page')} ${ar(page.source+1)}" loading="lazy" draggable="false">`}</div><div class="library-leaf-foot"><span>${t('الصفحة','Page')} ${ar(page.number)}</span><span>${printed||(page.part?t('تتمة','continued'):'')}</span></div></section>`
}
function libraryMeasureHeight(measure,paras){
 measure.replaceChildren();
 for(const para of paras){
  const p=document.createElement('p');
  p.className='library-para';
  p.textContent=para;
  measure.append(p);
 }
 return measure.offsetHeight;
}
function librarySplitParagraph(para,measure,avail){
 const words=para.split(/\s+/).filter(Boolean);
 if(words.length<=1)return [para];
 const chunks=[];let buf=[];
 for(const word of words){
  const trial=[...buf,word];
  if(libraryMeasureHeight(measure,[trial.join(' ')])>avail&&buf.length){
   chunks.push(buf.join(' '));
   buf=[word];
  }else buf=trial;
 }
 if(buf.length)chunks.push(buf.join(' '));
 return chunks.length?chunks:[para];
}
function paginateLibrary(book){
 if(!book?.slides?.length)return [];
 if(!book.textEdition){
  return book.slides.map((s,i)=>({...s,text:'',source:i,number:i+1,part:0}));
 }
 const stage=$('#library-stage');
 const pageW=Math.max(200,parseFloat(stage?getComputedStyle(stage).getPropertyValue('--library-page-width'):'')||Math.min(420,(stage?.clientWidth||800)*0.42));
 const pageH=pageW*1.4142;
 const baseAvail=Math.max(160,pageH-88);
 const font=read('libraryFont',24);
 const measure=document.createElement('div');
 measure.className='library-measure';
 measure.style.cssText=`position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;width:${Math.floor(pageW-48)}px;font-family:Amiri,'Noto Naskh Arabic',serif;font-size:${font}px;line-height:1.85;direction:rtl;text-align:justify;text-align-last:right;`;
 document.body.append(measure);
 const pages=[];let number=1;
 try{
  book.slides.forEach((slide,source)=>{
   const paras=libraryParagraphs(slide.text||'');
   if(!paras.length){pages.push({title:slide.title||'',text:'',reference:slide.reference||'',printedPage:slide.printedPage??null,source,number:number++,part:0});return}
   let buf=[],part=0;
   const hasHeading=slide.title&&!/^ص\s*\d+/.test(String(slide.title));
   const room=()=>part===0&&hasHeading?Math.max(140,baseAvail-Math.round(font*1.55)):baseAvail;
   const flush=()=>{
    if(!buf.length)return;
    pages.push({title:slide.title||'',text:buf.join('\n\n'),reference:slide.reference||'',printedPage:slide.printedPage??null,source,number:number++,part:part});
    part+=1;buf=[];
   };
   for(const para of paras){
    const trial=[...buf,para],limit=room();
    if(libraryMeasureHeight(measure,trial)>limit&&buf.length){
     flush();
     const nextLimit=room();
     if(libraryMeasureHeight(measure,[para])>nextLimit){
      for(const chunk of librarySplitParagraph(para,measure,nextLimit)){buf=[chunk];flush()}
     }else buf=[para];
    }else buf.push(para);
   }
   flush();
  });
 }finally{measure.remove()}
 return pages.length?pages:[{title:book.title,text:'',reference:'',source:0,number:1,part:0}];
}
function libraryTurn(delta){const state=libraryViewState;if(!state?.pages?.length)return;const count=librarySpread()?2:1;const next=Math.max(0,Math.min(state.pages.length-1,state.cursor+(delta>0?count:-count)));if(next===state.cursor)return;const stage=$('#library-stage');stage?.classList.add(delta>0?'library-turn-next':'library-turn-prev');state.cursor=next;write('bookPosition-'+state.book.id,state.pages[next].source);write('bookPart-'+state.book.id,next);history.replaceState(null,'','#library/'+state.book.id+'/'+state.pages[next].source);drawLibraryPages();requestAnimationFrame(()=>setTimeout(()=>stage?.classList.remove('library-turn-next','library-turn-prev'),40))}
function bindLibraryGestures(stage){if(!stage||stage.dataset.gestures==='1')return;stage.dataset.gestures='1';let start=null;stage.addEventListener('pointerdown',e=>{if(e.target.closest('button,a,input'))return;start={x:e.clientX,y:e.clientY,id:e.pointerId};try{stage.setPointerCapture(e.pointerId)}catch{}});stage.addEventListener('pointerup',e=>{if(!start||start.id!==e.pointerId)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.abs(dx)<48||Math.abs(dx)<Math.abs(dy)*1.2)return;libraryTurn(dx>0?-1:1)});stage.addEventListener('pointercancel',()=>{start=null})}
function drawLibraryPages(){const state=libraryViewState;if(!state||!$('#library-stage'))return;const {book,pages}=state;if(!pages.length){$('#library-stage').innerHTML=`<p class="library-empty">${t('لا صفحات في هذا الكتاب.','No pages in this book.')}</p>`;return}state.cursor=Math.max(0,Math.min(pages.length-1,state.cursor));const stage=$('#library-stage'),count=librarySpread()?2:1;document.body.dataset.libraryMode='book';document.body.dataset.libraryOrient=count===2?'landscape':'portrait';stage.classList.remove('library-continuous');stage.classList.toggle('library-spread',count===2);stage.classList.toggle('library-single',count===1);
 const shown=pages.slice(state.cursor,state.cursor+count);
 if(count===2){
  /* Arabic open book: first page of the spread sits on the RIGHT, next on the LEFT. */
  const rightPage=shown[0],leftPage=shown[1];
  const leftHtml=leftPage?libraryPaper(book,leftPage,'left-leaf'):`<section class="library-paper book-leaf left-leaf is-blank" aria-hidden="true"></section>`;
  stage.innerHTML=`<div class="library-spread-frame">${leftHtml}${libraryPaper(book,rightPage,'right-leaf')}</div>`;
 }else stage.innerHTML=libraryPaper(book,shown[0],'single-leaf');
 $('#library-position').textContent=ar(state.cursor+1)+(count===2&&state.cursor+1<pages.length?' — '+ar(state.cursor+2):'')+' / '+ar(pages.length);$('#library-prev').disabled=state.cursor===0;$('#library-next').disabled=state.cursor+count>=pages.length;$('#library-prev').hidden=false;$('#library-next').hidden=false;
 const remember=cursor=>{state.cursor=cursor;write('bookPosition-'+book.id,pages[cursor].source);write('bookPart-'+book.id,cursor);history.replaceState(null,'','#library/'+book.id+'/'+pages[cursor].source);$('#library-position').textContent=ar(cursor+1)+(count===2&&cursor+1<pages.length?' — '+ar(cursor+2):'')+' / '+ar(pages.length)};
 $('#library-prev').onclick=()=>libraryTurn(-1);$('#library-next').onclick=()=>libraryTurn(1);$('#library-save').onclick=()=>{remember(state.cursor);toast(t('حُفظ موضعك.','Your place is saved.'))};
 bindLibraryGestures(stage);
 state.observer?.disconnect();
}
function fitLibrary(){const state=libraryViewState,stage=$('#library-stage');if(!state||!stage)return;if(!state.book?.slides?.length){state.pages=[];drawLibraryPages();return}const count=librarySpread()?2:1,room=stage.clientWidth-(count===2?18:8),h=stage.clientHeight-10;const width=Math.min(room/count,Math.max(260,(h-4)*(count===2?0.72:0.707)));stage.style.setProperty('--library-page-width',Math.floor(width)+'px');stage.style.setProperty('--library-font',read('libraryFont',24)+'px');const old=state.pages?.[state.cursor],source=old?.source??state.source;state.pages=paginateLibrary(state.book);const same=state.pages.findIndex(p=>p.source===source&&p.part===(old?.part||0));state.cursor=same>=0?same:Math.max(0,state.pages.findIndex(p=>p.source===source));if(!old){const saved=read('bookPart-'+state.book.id,0);if(Number.isFinite(saved)&&state.pages[saved]?.source===source)state.cursor=saved}drawLibraryPages()}
async function setLibraryFocus(enabled){document.body.classList.toggle('library-focus',enabled);$('#library-focus')?.setAttribute('aria-pressed',enabled);if($('#library-focus'))$('#library-focus').textContent=enabled?'✕ '+t('خروج','Exit'):'⛶ '+t('وضع التركيز','Focus');if(enabled){try{const request=document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen;await request?.call(document.documentElement)}catch{}}else if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});requestAnimationFrame(fitLibrary)}
libraryPage=async function(id,index=0){
 const token=location.hash;let libraryBooks;try{libraryBooks=await loadLibraryData()}catch{$('#main').innerHTML=heading(t('مكتبة سكينة','Sakinah Library'),t('تعذر تحميل المكتبة. أعد المحاولة.','Could not load the library. Please retry.'));return}if(location.hash!==token||currentRoute!=='library')return;
 libraryViewState?.observer?.disconnect();libraryViewState=null;document.body.classList.remove('book-view','library-reader-view');resetView();
 if(!id||['prayers','prayers-duas','prayers-munajat','aqidah','hadith','sunnah'].includes(id)){renderLibraryIndex(libraryBooks,id);return}
 let book=libraryBooks.find(b=>b.id===id);if(!book){location.hash='library';return}
 try{book=await ensureHeritageBook(book)}catch{renderLibraryIndex(libraryBooks,book.section||'root');return}
 if(location.hash!==token||currentRoute!=='library')return;
 if(!book.slides?.length){toast?.(t('تعذر فتح هذا الكتاب.','Could not open this book.'));renderLibraryIndex(libraryBooks,book.section||book.category&&('prayers-'+book.category)||'root');return}
 write('libraryReadMode','spread');
 const source=Math.max(0,Math.min(book.slides.length-1,Number(index)||0));document.body.classList.add('library-reader-view');$('#main').className='library-reader';const backHref=book.category?'#library/prayers-'+book.category:book.section?'#library/'+book.section:'#library';
 const backLabel=book.category||book.section?t('رجوع للقسم','Back to section'):t('رجوع للمكتبة','Back to library');
 $('#main').innerHTML=`<div class="library-reader-top"><a class="chip library-back" href="${backHref}" aria-label="${backLabel}">→ ${backLabel}</a><h1>${esc(lang()==='en'?book.titleEn||book.title:book.title)}</h1><button class="chip" id="library-options" aria-label="${t('المصادر والخيارات','Sources and options')}">⋯</button></div><div class="library-reader-tools">${book.originalPdf?`<button class="chip" id="library-original" aria-label="${t('مقارنة الصفحة الأصلية','Compare original page')}">⌑</button>`:''}${book.textEdition?'<button class="chip" id="library-smaller" aria-label="تصغير الخط">أ−</button><button class="chip" id="library-larger" aria-label="تكبير الخط">أ+</button>':''}<button class="chip" id="library-focus" aria-pressed="${document.body.classList.contains('library-focus')}">⛶ ${t('وضع التركيز','Focus')}</button><button class="chip" id="library-save" aria-label="${t('حفظ موضع القراءة','Save reading position')}">◆</button><button class="chip" id="library-night" aria-label="${t('تبديل الوضع الليلي','Toggle night mode')}">☾</button>${book.pdf?`<a class="chip" href="${esc(book.pdf)}" download>↓ PDF</a>`:''}</div><div class="library-stage" id="library-stage" tabindex="0" aria-label="${t('صفحات الكتاب','Book pages')}"></div><div class="library-navigation"><button class="chip" id="library-prev" aria-label="${t('الصفحة السابقة','Previous page')}">→ ${t('السابق','Prev')}</button><span id="library-position" role="status"></span><button class="chip" id="library-next" aria-label="${t('الصفحة التالية','Next page')}">${t('التالي','Next')} ←</button></div>`;
 libraryViewState={book,source,cursor:0,pages:null};
 $('#library-focus').onclick=()=>setLibraryFocus(!document.body.classList.contains('library-focus'));
 $('#library-night').onclick=()=>$('#theme').click();
 $('#library-options').onclick=()=>{const dialog=openReaderDialog(t('عن هذا الإصدار','About this edition'),`<p>${esc(book.sourceLabel||'')}</p>${book.editionNote?`<p class="library-edition-note">${esc(book.editionNote)}</p>`:''}${book.vocalizationNote?`<p class="library-edition-note">${esc(book.vocalizationNote)}</p>`:''}${book.sourceURL?`<a class="library-source-link" target="_blank" rel="noopener" href="${esc(book.sourceURL)}">${t('النص في المصدر','Source text')} ↗</a>`:''}${book.originalPdf?`<a class="chip" download href="${esc(book.originalPdf)}">↓ ${t('ملف الأصل قبل التفريغ','Original source PDF')}</a>`:''}<p>${book.textEdition?t('يُعرض النص كصفحات كتاب بخط موحّد، دون تمرير داخل الصفحة. رقم «المطبوع» —إن وُجد— من ترقيم المصدر وقد لا يبدأ من ١.','Text is shown as fixed book pages with a unified typeface, without scrolling inside a page. A “print” page number — when present — comes from the source and may not start at 1.'):t('هذه صفحات أصلية مصوّرة تُعرض كورق كتاب.','These are original page images shown as book leaves.')}</p>${book.pdf?`<a class="btn" href="${esc(book.pdf)}" download>↓ PDF</a><button class="chip" id="library-share">${t('مشاركة الملف','Share file')}</button>`:''}`);dialog.querySelector('#library-share')?.addEventListener('click',()=>shareFile(book.pdf,book.title));};
 if($('#library-original'))$('#library-original').onclick=()=>{const page=libraryViewState.pages[libraryViewState.cursor],original=book.originalSlides.find(s=>s.sourcePage===page.sourcePage)||book.originalSlides[page.source];openReaderDialog(t('الصفحة الأصلية للمقارنة','Original page for comparison'),`<p>${t('الصفحة الأصلية','Original page')} ${ar(original.sourcePage)}</p><img style="width:100%;height:auto" src="${esc(original.image)}" alt="${esc(book.title)}">`)};
 for(const [btnId,delta]of [['library-smaller',-2],['library-larger',2]])if($('#'+btnId))$('#'+btnId).onclick=()=>{write('libraryFont',Math.max(18,Math.min(36,read('libraryFont',24)+delta)));fitLibrary()};
 window.scrollTo(0,0);
 try{await document.fonts.load(`${read('libraryFont',24)}px Amiri`)}catch{}
 try{await document.fonts.load(`${read('libraryFont',24)}px "Noto Naskh Arabic"`)}catch{}
 if(libraryViewState?.book===book)requestAnimationFrame(()=>requestAnimationFrame(fitLibrary));
};
window.addEventListener('resize',()=>{clearTimeout(libraryLayoutTimer);libraryLayoutTimer=setTimeout(fitLibrary,180)});document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(document.body.classList.contains('scroll-focus'))setContinuousFocus(false);if(document.body.classList.contains('library-focus'))setLibraryFocus(false)}if(document.body.classList.contains('library-reader-view')&&!e.target.closest('input,textarea,select,[contenteditable]')){if(e.key==='ArrowLeft'){e.preventDefault();libraryTurn(1)}if(e.key==='ArrowRight'){e.preventDefault();libraryTurn(-1)}}});window.addEventListener('hashchange',()=>{if(currentRoute!=='quran-scroll'){document.body.classList.remove('scroll-focus','scroll-bar-hidden');bindScrollFocusHide(false)}if(currentRoute!=='library'||!location.hash.split('/')[1]){document.body.classList.remove('library-reader-view','library-focus');$('#main').classList.remove('library-reader');libraryViewState?.observer?.disconnect();libraryViewState=null}});document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&!document.webkitFullscreenElement){if(document.body.classList.contains('library-focus')){document.body.classList.remove('library-focus');requestAnimationFrame(fitLibrary)}/* keep scroll-focus CSS fill even if native fullscreen is denied/exited */}});
var modernLibraryPage=libraryPage;
const polishedBook=renderBook;renderBook=function(value){polishedBook(value);if(!$('#book'))return;const night=document.createElement('button');night.id='reader-night';night.className='chip';night.textContent='☾';night.setAttribute('aria-label',t('تبديل الوضع الليلي','Toggle night mode'));night.onclick=()=>$('#theme').click();$('.book-toolbar').insertBefore(night,$('#reader-more'));if(typeof tuckReaderTools==='function')tuckReaderTools();const focusNight=night.cloneNode(true);focusNight.id='focus-night';focusNight.onclick=night.onclick;$('.focus-bar').insertBefore(focusNight,$('#focus-exit'))};
route();
