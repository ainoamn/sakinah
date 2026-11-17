export function validProgress(entry:any){
 if(!entry||typeof entry.key!=='string'||!Number.isInteger(entry.updatedAt)||entry.updatedAt<0||entry.updatedAt>Date.now()+300000)return false;
 const k=entry.key,v=entry.value;
 if(k==='counts'||/^session-(athkar|duas|ruqyah|salawat|praise|humility|favorites)\|[\u0600-\u06ff a-zA-Z0-9_-]{1,60}$/.test(k))return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length<=300&&Object.entries(v).every(([id,n])=>/^[a-zA-Z0-9_-]{1,50}$/.test(id)&&Number.isInteger(n)&&Number(n)>=0&&Number(n)<=1e9);
 if(k==='lastPage'||k==='savedPage')return Number.isInteger(v)&&v>=1&&v<=604;
 if(k==='tasbih')return Number.isInteger(v)&&v>=0&&v<=1e9;
 if(k==='tasbihGoal')return [33,100,1000].includes(v);
 if(k==='tasbihDhikr')return typeof v==='string'&&v.length<=150;
 if(k==='lastRoute')return typeof v==='string'&&/^#(?:home|quran(?:-scroll)?|athkar|duas|ruqyah|salawat|praise|humility|names|tasbih|deeds|favorites|landmarks|library|calendar|session)(?:[/?][^\u0000-\u001f]*)?$/.test(v)&&v.length<=250;
 if(k==='bookmark')return v===null||(Number.isInteger(v?.s)&&v.s>=1&&v.s<=114&&Number.isInteger(v?.a)&&v.a>=1&&v.a<=286);
 return false
}
