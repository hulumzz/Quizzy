export default function Brand({ compact = false }) {
  return <span className={`nlr-brand${compact ? ' nlr-brand--compact' : ''}`}><img src="/android-chrome-192x192.png" alt="" width="38" height="38" /><span>Nalaro <b>Class</b></span></span>;
}
