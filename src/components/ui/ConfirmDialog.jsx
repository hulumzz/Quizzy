import Dialog from './Dialog';
import Button from './Button';

export default function ConfirmDialog({ open, onClose, onConfirm, title, description, message = 'Tindakan ini tidak dapat dibatalkan.', confirmLabel = 'Lanjutkan', busy = false }) {
  return <Dialog
    open={open}
    onClose={busy ? undefined : onClose}
    title={title}
    description={description}
    footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Batal</Button><Button variant="danger" onClick={onConfirm} disabled={busy}>{busy ? 'Memproses...' : confirmLabel}</Button></>}
  >
    {message ? <p>{message}</p> : null}
  </Dialog>;
}
