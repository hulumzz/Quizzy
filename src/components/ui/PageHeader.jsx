export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="qz-page-header">
      <div className="qz-page-header__copy">
        {eyebrow ? <p className="qz-page-header__eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="qz-page-header__actions">{actions}</div> : null}
    </header>
  );
}
