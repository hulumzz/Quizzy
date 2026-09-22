export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="qz-empty">
      <div className="qz-empty__inner">
        {Icon ? <div className="qz-empty__icon"><Icon size={24} /></div> : null}
        <h3>{title}</h3>
        <p>{description}</p>
        {action ? <div className="qz-empty__action">{action}</div> : null}
      </div>
    </div>
  );
}
