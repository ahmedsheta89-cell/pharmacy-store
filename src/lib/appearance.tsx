import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {useLocation} from 'wouter';
import {watchStoreAppearance} from './firebase';
import {DEFAULT_APPEARANCE,isTheme,activeTheme,type StoreAppearance,type ThemeId} from './themes';
type State={appearance:StoreAppearance;loaded:boolean;error:boolean;preview:ThemeId|null;setPreview:(id:ThemeId|null)=>void};
const Context=createContext<State>({appearance:DEFAULT_APPEARANCE,loaded:false,error:false,preview:null,setPreview:()=>{}});
export const useStoreAppearance=()=>useContext(Context);
export function AppearanceProvider({children}:{children:ReactNode}) {
 const [appearance,setAppearance]=useState(DEFAULT_APPEARANCE),[loaded,setLoaded]=useState(false),[error,setError]=useState(false),[preview,setPreview]=useState<ThemeId|null>(null);
 useEffect(()=>{const stop=watchStoreAppearance(value=>{setAppearance(value);setLoaded(true);setError(false);},()=>{setError(true);setLoaded(true);});return ()=>stop?.();},[]);
 return <Context.Provider value={{appearance,loaded,error,preview,setPreview}}>{children}</Context.Provider>;
}
export function ThemeSurface({children}:{children:ReactNode}) {
 const [location]=useLocation();const {appearance,preview}=useStoreAppearance();
 // This local URL override is a visual preview only. It never writes settings.
 const candidate=new URLSearchParams(window.location.search).get('previewTheme');
 const [now,setNow]=useState(()=>new Date());useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30000);const refresh=()=>setNow(new Date());addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return ()=>{clearInterval(timer);removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[]);
 const theme=isTheme(candidate)?candidate:preview||activeTheme(appearance,now);
 useEffect(()=>{if(location==='/admin')return;const meta=document.querySelector('meta[name="theme-color"]');const old=meta?.getAttribute('content');const node=document.querySelector('.storefront-theme');if(node)meta?.setAttribute('content',getComputedStyle(node).getPropertyValue('--page').trim());return ()=>{if(old)meta?.setAttribute('content',old);};},[theme,location]);
 return location==='/admin'?<>{children}</>:<div className={theme==='legacy'?'storefront-legacy':'storefront-theme'} data-store-theme={theme}>{candidate&&isTheme(candidate)&&<div className="theme-preview-notice" role="status">معاينة محلية للتصميم فقط، لا تغيّر المتجر للزوار. <a href={location}>إنهاء المعاينة</a></div>}{children}</div>;
}
