import { cn } from '../../lib/cn';

export function buttonClassName({ variant = 'primary', size = 'md', block = false, className } = {}) {
  return cn('qz-button', `qz-button--${variant}`, size !== 'md' && `qz-button--${size}`, block && 'qz-button--block', className);
}
