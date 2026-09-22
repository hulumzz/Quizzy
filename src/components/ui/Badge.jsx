import { cn } from '../../lib/cn';

export default function Badge({ children, tone = 'neutral', className }) {
  return <span className={cn('qz-badge', tone !== 'neutral' && `qz-badge--${tone}`, className)}>{children}</span>;
}
