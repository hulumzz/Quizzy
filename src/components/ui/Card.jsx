import { cn } from '../../lib/cn';

export default function Card({ children, variant = 'default', className, bodyClassName }) {
  return <section className={cn('qz-card', variant !== 'default' && `qz-card--${variant}`, className)}><div className={cn('qz-card__body', bodyClassName)}>{children}</div></section>;
}
