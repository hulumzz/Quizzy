import { useState } from 'react';
import { DeleteIcon, DiscussionIcon, EditIcon } from '../../../components/icons';
import { Badge, Button, Textarea } from '../../../components/ui';

function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Baru saja' : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function Author({ message }) {
  return <div className="qz-discussion-author"><span aria-hidden="true">{message.author.name.charAt(0).toUpperCase()}</span><div><strong>{message.author.name}</strong><small>{dateLabel(message.createdAt)}{message.editedAt ? ' · diedit' : ''}</small></div>{message.author.role === 'teacher' ? <Badge tone="success">Guru</Badge> : null}</div>;
}

function MessageActions({ message, onEdit, onDelete }) {
  if (!message.canEdit) return null;
  return <div className="qz-discussion-message__actions"><Button variant="ghost" size="sm" onClick={onEdit}><EditIcon size={15} /> Edit</Button><Button variant="ghost" size="sm" onClick={onDelete}><DeleteIcon size={15} /> Hapus</Button></div>;
}

export default function DiscussionThread({ discussion, canResolve, busy, onReply, onUpdate, onDelete, onStatus }) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const [editing, setEditing] = useState(null);

  const submitReply = async () => {
    const content = reply.trim();
    if (content.length < 2) return;
    const success = await onReply(discussion.id, content);
    if (!success) return;
    setReply('');
    setReplying(false);
  };

  const submitEdit = async () => {
    const content = editing.content.trim();
    if (content.length < 2) return;
    const success = await onUpdate(discussion.id, editing.replyId, content);
    if (!success) return;
    setEditing(null);
  };

  const renderContent = (message, replyId = null) => {
    const isEditing = editing?.id === message.id;
    return <div className="qz-discussion-message__body">
      {message.deleted ? <p className="qz-discussion-deleted">Pesan ini telah dihapus.</p> : isEditing ? <div className="qz-discussion-edit"><Textarea value={editing.content} onChange={(event) => setEditing((current) => ({ ...current, content: event.target.value }))} maxLength={3000} /><div><Button size="sm" disabled={busy || editing.content.trim().length < 2} onClick={submitEdit}>Simpan</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(null)}>Batal</Button></div></div> : <p>{message.content}</p>}
      {!message.deleted && !isEditing ? <MessageActions message={message} onEdit={() => setEditing({ id: message.id, replyId, content: message.content })} onDelete={() => onDelete(discussion.id, replyId, message.content)} /> : null}
    </div>;
  };

  return (
    <article className={`qz-discussion-thread${discussion.status === 'resolved' ? ' qz-discussion-thread--resolved' : ''}`}>
      <div className="qz-discussion-message qz-discussion-message--root">
        <Author message={discussion} />
        {renderContent(discussion)}
        <div className="qz-discussion-thread__toolbar">
          <Button variant="ghost" size="sm" disabled={discussion.deleted || busy} onClick={() => setReplying((value) => !value)}><DiscussionIcon size={15} /> Balas</Button>
          {discussion.status === 'resolved' ? <Badge tone="success">Terjawab</Badge> : null}
          {canResolve && !discussion.deleted ? <Button variant="secondary" size="sm" disabled={busy} onClick={() => onStatus(discussion.id, discussion.status === 'resolved' ? 'open' : 'resolved', null)}>{discussion.status === 'resolved' ? 'Buka kembali' : 'Tandai selesai'}</Button> : null}
        </div>
      </div>
      {replying ? <div className="qz-discussion-reply-form"><Textarea label="Balasan" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Tulis balasan yang membantu…" maxLength={3000} /><div><Button size="sm" disabled={busy || reply.trim().length < 2} onClick={submitReply}>Kirim balasan</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => setReplying(false)}>Batal</Button></div></div> : null}
      {discussion.replies.length ? <div className="qz-discussion-replies">{discussion.replies.map((message) => <div className={`qz-discussion-message${message.isAnswer ? ' qz-discussion-message--answer' : ''}`} key={message.id}><Author message={message} />{message.isAnswer ? <Badge tone="success" className="qz-answer-badge">Jawaban dipilih</Badge> : null}{renderContent(message, message.id)}{canResolve && !message.deleted && !message.isAnswer ? <Button variant="ghost" size="sm" disabled={busy} onClick={() => onStatus(discussion.id, 'resolved', message.id)}>Tandai sebagai jawaban</Button> : null}</div>)}</div> : null}
    </article>
  );
}
