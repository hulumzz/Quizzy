import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ClassWorkspaceNav from '../components/classroom/ClassWorkspaceNav';
import { DiscussionIcon } from '../components/icons';
import { Button, Card, Dialog, EmptyState, PageHeader, Skeleton, Textarea, buttonClassName } from '../components/ui';
import DiscussionThread from '../features/discussions/components/DiscussionThread';
import { useDiscussions } from '../features/discussions/hooks/useDiscussions';
import { createDiscussion, createReply, deleteDiscussionMessage, discussionErrorMessage, setDiscussionStatus, updateDiscussionMessage } from '../services/discussion.service';

export default function MaterialDiscussion({ role }) {
  const { classId, materialId } = useParams();
  const { data, status, error, configured, reload } = useDiscussions(classId, materialId);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  const perform = async (request, after) => {
    setBusy(true);
    setActionError('');
    try {
      await request();
      await reload();
      after?.();
      return true;
    } catch (caught) {
      setActionError(discussionErrorMessage(caught));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = () => perform(() => createDiscussion(classId, materialId, content.trim()), () => setContent(''));
  const confirmDelete = () => perform(
    () => deleteDiscussionMessage(classId, materialId, pendingDelete.discussionId, pendingDelete.replyId),
    () => setPendingDelete(null),
  );

  if (status === 'loading') return <div className="qz-dashboard"><Skeleton width="48%" height={40} /><Skeleton height={170} /><Skeleton height={260} /></div>;
  if (status === 'error' && !data) return <Card className="qz-placeholder"><EmptyState icon={DiscussionIcon} title="Diskusi tidak dapat dibuka" description={discussionErrorMessage(error)} action={<Link to={`/${role}/classes/${classId}/discussions`} className={buttonClassName()}>Kembali ke diskusi</Link>} /></Card>;

  return <div className="qz-dashboard qz-enter">
    <PageHeader eyebrow="Diskusi materi" title={data?.material.title || 'Ruang diskusi'} description="Ajukan pertanyaan, bagikan pemahaman, dan jaga percakapan tetap terkait materi." actions={<Link to={`/${role}/classes/${classId}/materials/${materialId}`} className={buttonClassName({ variant: 'secondary' })}>Baca materi</Link>} />
    <ClassWorkspaceNav role={role} classId={classId} />
    {!configured ? <div className="qz-status-strip">Layanan diskusi belum tersedia di lingkungan ini.</div> : null}
    <Card className="qz-discussion-composer"><div><span className="qz-discussion-composer__icon"><DiscussionIcon size={22} /></span><div><h2>Mulai percakapan</h2><p>{role === 'teacher' ? 'Tambahkan arahan atau pertanyaan pemantik untuk kelas.' : 'Tanyakan bagian yang belum jelas atau bagikan hal yang kamu pahami.'}</p></div></div><Textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Tulis pesan yang jelas dan tetap sesuai topik…" maxLength={3000} hint={`${content.length}/3.000 karakter`} /><Button disabled={!configured || busy || content.trim().length < 2} onClick={submit}>{busy ? 'Memproses…' : 'Kirim ke diskusi'}</Button></Card>
    {actionError ? <div className="qz-inline-state qz-inline-state--error" role="alert">{actionError}</div> : null}
    {data?.discussions.length ? <div className="qz-discussion-list">{data.discussions.map((discussion) => <DiscussionThread key={discussion.id} discussion={discussion} canResolve={data.canResolve} busy={busy} onReply={(discussionId, message) => perform(() => createReply(classId, materialId, discussionId, message))} onUpdate={(discussionId, replyId, message) => perform(() => updateDiscussionMessage(classId, materialId, discussionId, { replyId, content: message }))} onDelete={(discussionId, replyId, preview) => setPendingDelete({ discussionId, replyId, preview })} onStatus={(discussionId, nextStatus, answerId) => perform(() => setDiscussionStatus(classId, materialId, discussionId, nextStatus, answerId))} />)}</div> : <Card className="qz-class-empty"><EmptyState icon={DiscussionIcon} title="Belum ada percakapan" description="Jadilah yang pertama memulai diskusi untuk materi ini." /></Card>}
    <Dialog open={Boolean(pendingDelete)} onClose={() => !busy && setPendingDelete(null)} title="Hapus pesan?" description="Pesan akan diganti penanda terhapus agar alur balasan tetap dapat dipahami." footer={<><Button variant="secondary" disabled={busy} onClick={() => setPendingDelete(null)}>Batal</Button><Button variant="danger" disabled={busy} onClick={confirmDelete}>{busy ? 'Menghapus…' : 'Hapus pesan'}</Button></>}><p className="qz-dialog-confirm">{pendingDelete?.preview}</p></Dialog>
  </div>;
}
