export const THEME_IDS = ['noir-gold','violet-pop','terracotta-dune','midnight-azure','brutalist-paper','royal-amethyst','ramadan','eid-fitr','eid-adha'] as const;
export type ThemeId = typeof THEME_IDS[number];
export const DEFAULT_THEME: ThemeId = 'royal-amethyst';
export const THEMES: {id:ThemeId;name:string;description:string;colors:[string,string,string]}[] = [
 {id:'noir-gold',name:'Noir Gold',description:'أسود هادئ، ذهبي دافئ وتفاصيل دقيقة',colors:['#0B0B0F','#C9A24B','#F4EDDE']},
 {id:'violet-pop',name:'Violet Pop',description:'بنفسجي جريء، وردي ولمسة ليموني',colors:['#2B0A54','#E7218C','#C8FF3D']},
 {id:'terracotta-dune',name:'Terracotta Dune',description:'رملي دافئ، تراكوتا وحواف طبيعية',colors:['#F7EFE3','#C05B2E','#33231A']},
 {id:'midnight-azure',name:'Midnight Azure',description:'كحلي عميق، أزرق مضيء وتفاصيل زجاجية',colors:['#081426','#2E9BFF','#7FE3FF']},
 {id:'brutalist-paper',name:'Brutalist Paper',description:'ورقي، حدود سوداء وتباين برتقالي',colors:['#F2EFE6','#141414','#FF4D00']},
 {id:'royal-amethyst',name:'Royal Amethyst',description:'برقوقي ملكي، روز جولد وخط عربي أصيل',colors:['#1F0E29','#D9A08F','#F6ECE4']},
];
THEMES.push({id:'ramadan',name:'ليالي رمضان',description:'أخضر ليلي، هلال وفوانيس ذهبية',colors:['#071F22','#D8B96C','#EADFC6']},{id:'eid-fitr',name:'بهجة الفطر',description:'عاجي مضيء، بنفسجي ولمسات احتفال',colors:['#FFF8EE','#6E327F','#C69230']},{id:'eid-adha',name:'عيد الأضحى',description:'أخضر زمردي وعاجي، أقواس وزخارف ذهبية',colors:['#103C30','#D5BA78','#FFF5DF']});
export function isTheme(value:unknown):value is ThemeId {return typeof value==='string' && (THEME_IDS as readonly string[]).includes(value);}
export type SeasonWindow={enabled:boolean;start:string;end:string};
export const SEASON_IDS=['ramadan','eid_fitr','eid_adha'] as const;
export type SeasonId=typeof SEASON_IDS[number];
export const SEASON_NAMES:Record<SeasonId,string>={ramadan:'رمضان',eid_fitr:'عيد الفطر',eid_adha:'عيد الأضحى'};
export type SeasonalSettings={auto:boolean;ramadan:SeasonWindow;eid_fitr:SeasonWindow;eid_adha:SeasonWindow};
export const DEFAULT_SEASONS:SeasonalSettings={auto:false,ramadan:{enabled:false,start:'',end:''},eid_fitr:{enabled:false,start:'',end:''},eid_adha:{enabled:false,start:'',end:''}};
export function validDate(value:string):boolean {if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
export function validSeasons(s:SeasonalSettings):boolean {const windows=SEASON_IDS.map(id=>s[id]);if(windows.some(w=>w.enabled&&(!validDate(w.start)||!validDate(w.end)||w.start>w.end)))return false;return !windows.some((a,i)=>a.enabled&&windows.some((b,j)=>j>i&&b.enabled&&a.start<=b.end&&b.start<=a.end));}
export function cairoDate(now:Date):string {const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return ['year','month','day'].map(k=>parts.find(p=>p.type===k)?.value).join('-');}
export function activeTheme(value:StoreAppearance,now=new Date()):ThemeId {const s=value.seasonal;if(!s.auto||!validSeasons(s))return value.theme;const day=cairoDate(now);for(const id of SEASON_IDS){const w=s[id];if(w.enabled&&day>=w.start&&day<=w.end)return id.replace('_','-') as ThemeId;}return value.theme;}
export type StoreAppearance={theme:ThemeId;accepting_orders:boolean;closed_message:string;seasonal:SeasonalSettings};
export const DEFAULT_APPEARANCE:StoreAppearance={theme:DEFAULT_THEME,accepting_orders:true,seasonal:DEFAULT_SEASONS,closed_message:'استقبال الطلبات متوقف مؤقتًا. تواصل مع الصيدلية للاستفسار.'};
export function parseAppearance(value:unknown):StoreAppearance {
 const v=(value && typeof value==='object'?value:{}) as Record<string,unknown>;
 const raw=(v.seasonal&&typeof v.seasonal==='object'?v.seasonal:{}) as Record<string,unknown>;
 const window=(id:string):SeasonWindow=>{const w=(raw[id]&&typeof raw[id]==='object'?raw[id]:{}) as Record<string,unknown>;return {enabled:w.enabled===true,start:typeof w.start==='string'?w.start:'',end:typeof w.end==='string'?w.end:''};};
 return {seasonal:{auto:raw.auto===true,ramadan:window('ramadan'),eid_fitr:window('eid_fitr'),eid_adha:window('eid_adha')},theme:isTheme(v.theme)?v.theme:DEFAULT_THEME,accepting_orders:v.accepting_orders!==false,closed_message:typeof v.closed_message==='string'&&v.closed_message.trim()?v.closed_message.trim().slice(0,240):DEFAULT_APPEARANCE.closed_message};
}
