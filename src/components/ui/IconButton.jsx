import { cn } from '../../lib/cn';

export default function IconButton({ label, className, type = 'button', ...props }) {
  return <button type={type} className={cn('qz-icon-button', className)} aria-label={label} title={label} {...props} />;
}
