export default function SectionHeader({ title, description, action }) {
  return (
    <div className="qz-section-header">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
