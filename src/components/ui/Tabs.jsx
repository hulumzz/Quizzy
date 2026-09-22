export default function Tabs({ items, value, onChange, label = 'Pilihan tampilan' }) {
  return (
    <div className="qz-tabs" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button key={item.value} type="button" className="qz-tab" role="tab" aria-selected={value === item.value} onClick={() => onChange(item.value)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}
