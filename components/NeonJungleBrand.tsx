import { BASE_PATH } from "@/lib/basePath";

export default function NeonJungleBrand() {
  return <div style={{display:"flex",justifyContent:"center",padding:"20px 0"}}>
    <a href="https://neonjungletools.com/" target="_blank" rel="noopener noreferrer" aria-label="A Neon Jungle Tools product — visit Neon Jungle Tools" style={{display:"inline-flex",alignItems:"center",gap:10,padding:"12px 14px",background:"#060b18",border:"1px solid #263044",borderRadius:12,maxWidth:"100%",textDecoration:"none"}}>
      <img src={`${BASE_PATH}/brand/njt-symbol.webp`} alt="" width="36" height="36" style={{width:36,height:36,objectFit:"contain",flexShrink:0}} />
      <span style={{minWidth:0}}><small style={{display:"block",color:"#c7cbd3",fontSize:10,marginBottom:6}}>A product by</small><img src={`${BASE_PATH}/brand/njt-wordmark.svg`} alt="Neon Jungle Tools" width="4064" height="260" style={{display:"block",width:220,maxWidth:"100%",height:"auto"}} /></span>
    </a>
  </div>;
}
