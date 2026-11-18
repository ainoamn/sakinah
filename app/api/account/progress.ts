const SURA_AYAHS=[7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
export const MAX_PROGRESS_KEYS=200;
export function validProgress(entry:any){
 if(!entry||typeof entry.key!=='string'||entry.key.length>100||!Number.isInteger(entry.updatedAt)||entry.updatedAt<0||entry.updatedAt>Date.now()+300000)return false;
 const k=entry.key,v=entry.value;
 if(k==='counts'||/^session-(athkar|duas|ruqyah|salawat|praise|humility|favorites)\|[\u0600-\u06ff a-zA-Z0-9_-]{1,60}$/.test(k))return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length<=300&&Object.entries(v).every(([id,n])=>/^[a-zA-Z0-9_-]{1,50}$/.test(id)&&Number.isInteger(n)&&Number(n)>=0&&Number(n)<=1e9);
 if(k==='lastPage'||k==='savedPage')return Number.isInteger(v)&&v>=1&&v<=604;
 if(k==='tasbih')return Number.isInteger(v)&&v>=0&&v<=1e9;
 if(k==='tasbihGoal')return [33,100,1000].includes(v);
 if(k==='tasbihDhikr')return typeof v==='string'&&v.length<=150;
 if(k==='lastRoute')return typeof v==='string'&&/^#(?:home|quran(?:-scroll)?|athkar|duas|ruqyah|salawat|praise|humility|names|tasbih|deeds|favorites|landmarks|library|calendar|session)(?:[/?][^\u0000-\u001f]*)?$/.test(v)&&v.length<=250;
 if(k==='bookmark')return v===null||(Number.isInteger(v?.s)&&v.s>=1&&v.s<=114&&Number.isInteger(v?.a)&&v.a>=1&&v.a<=SURA_AYAHS[v.s-1]);
 return false
}
