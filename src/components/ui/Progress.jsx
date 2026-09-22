export default function Progress({ value = 0, max = 100, label }) {
  const normalized = Math.max(0, Math.min(max, value));
  const percentage = max > 0 ? (normalized / max) * 100 : 0;
  return (
    <div>
      {label ? <div className="qz-field__hint" style={{ marginBottom: 6 }}>{label}</div> : null}
      <div style={{ height: 8, borderRadius: 999, background: '#e9e8ef', overflow: 'hidden' }} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={normalized}>
        <div style={{ height: '100%', width: `${percentage}%`, background: 'var(--qz-primary)', borderRadius: 'inherit' }} />
      </div>
    </div>
  );
}
