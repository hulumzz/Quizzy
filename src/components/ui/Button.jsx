import { buttonClassName } from './buttonStyles';

export default function Button({ variant = 'primary', size = 'md', block = false, className, type = 'button', ...props }) {
  return <button type={type} className={buttonClassName({ variant, size, block, className })} {...props} />;
}
