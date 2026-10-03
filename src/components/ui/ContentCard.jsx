import { cn } from '../../lib/cn';
import Card from './Card';

export default function ContentCard({ icon: Icon, title, description, badge, meta, actions, children, className, featured = false, headingLevel = 2 }) {
  const Heading = `h${headingLevel}`;
  return <Card className={cn('qz-content-card', featured && 'qz-content-card--featured', className)}>
    <div className="qz-content-card__head"><span className="qz-card-icon" aria-hidden="true">{Icon ? <Icon size={23} /> : null}</span>{badge ? <div className="qz-content-card__badges">{badge}</div> : null}</div>
    <div className="qz-content-card__content"><Heading>{title}</Heading>{description ? <p className="qz-content-card__description">{description}</p> : null}</div>
    {meta ? <div className="qz-content-card__meta">{meta}</div> : null}
    {children}
    {actions ? <div className="qz-content-card__actions">{actions}</div> : null}
  </Card>;
}
