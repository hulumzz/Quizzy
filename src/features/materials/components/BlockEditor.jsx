import { useState } from 'react';
import { AddIcon, DeleteIcon } from '../../../components/icons';
import { Button, Input, Textarea } from '../../../components/ui';
import { uploadErrorMessage, uploadMaterialAsset } from '../../../services/upload.service';

const labels = {
  paragraph: 'Paragraf', heading: 'Judul bagian', bullet_list: 'Daftar poin', numbered_list: 'Daftar bernomor', quote: 'Kutipan', link: 'Tautan', youtube: 'YouTube', image: 'Gambar', file: 'File', divider: 'Pemisah',
};

function newBlock(type) {
  const id = crypto.randomUUID();
  if (type === 'divider') return { id, type };
  if (['bullet_list', 'numbered_list'].includes(type)) return { id, type, items: [''] };
  if (['link', 'youtube', 'image', 'file'].includes(type)) return { id, type, url: '', label: '' };
  return { id, type, content: '', ...(type === 'heading' ? { level: 2 } : {}) };
}

export default function BlockEditor({ blocks, onChange, errors = {}, classId }) {
  const [uploadingId, setUploadingId] = useState('');
  const [uploadErrors, setUploadErrors] = useState({});
  const update = (index, patch) => onChange(blocks.map((block, itemIndex) => itemIndex === index ? { ...block, ...patch } : block));
  const upload = async (index, block, file) => {
    if (!file) return;
    setUploadingId(block.id);
    setUploadErrors((current) => ({ ...current, [block.id]: '' }));
    try {
      const asset = await uploadMaterialAsset(classId, file);
      update(index, { url: asset.url, label: block.label || file.name });
    } catch (error) {
      setUploadErrors((current) => ({ ...current, [block.id]: uploadErrorMessage(error) }));
    } finally { setUploadingId(''); }
  };
  const move = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  };
  return <div className="qz-block-editor">
    {blocks.map((block, index) => <section className="qz-editor-block" key={block.id}>
      <div className="qz-editor-block__header"><span>{index + 1}. {labels[block.type]}</span><div><Button variant="ghost" size="sm" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Pindahkan blok ke atas">↑</Button><Button variant="ghost" size="sm" onClick={() => move(index, 1)} disabled={index === blocks.length - 1} aria-label="Pindahkan blok ke bawah">↓</Button><Button variant="ghost" size="sm" onClick={() => onChange(blocks.filter((_, itemIndex) => itemIndex !== index))} aria-label="Hapus blok"><DeleteIcon size={16} /></Button></div></div>
      {block.type === 'divider' ? <hr /> : null}
      {block.type === 'heading' ? <div className="qz-editor-heading"><label>Level<select className="qz-select" value={block.level} onChange={(event) => update(index, { level: Number(event.target.value) })}><option value={2}>Judul 2</option><option value={3}>Judul 3</option></select></label><Input value={block.content} onChange={(event) => update(index, { content: event.target.value })} placeholder="Judul bagian" maxLength={5000} error={errors[`blocks.${index}.content`]} /></div> : null}
      {['paragraph', 'quote'].includes(block.type) ? <Textarea value={block.content} onChange={(event) => update(index, { content: event.target.value })} placeholder={block.type === 'quote' ? 'Tulis kutipan atau gagasan penting...' : 'Tulis penjelasan materi...'} maxLength={5000} error={errors[`blocks.${index}.content`]} /> : null}
      {['bullet_list', 'numbered_list'].includes(block.type) ? <Textarea value={(block.items || []).join('\n')} onChange={(event) => update(index, { items: event.target.value.split('\n') })} placeholder="Satu item per baris" error={errors[`blocks.${index}.items`]} /> : null}
      {['link', 'youtube', 'image', 'file'].includes(block.type) ? <div className="qz-form-stack">
        {['image', 'file'].includes(block.type) ? <label className="qz-upload-control"><span>{block.type === 'image' ? 'Unggah gambar' : 'Unggah dokumen'}</span><input type="file" accept={block.type === 'image' ? 'image/jpeg,image/png,image/webp,image/gif' : '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt'} disabled={uploadingId === block.id} onChange={(event) => upload(index, block, event.target.files?.[0])} /><small>{uploadingId === block.id ? 'Mengunggah file...' : block.type === 'image' ? 'JPG, PNG, WebP, atau GIF - maks. 8 MB' : 'PDF, Office, atau TXT - maks. 15 MB'}</small></label> : null}
        {uploadErrors[block.id] ? <p className="qz-field__error" role="alert">{uploadErrors[block.id]}</p> : null}
        {!['image', 'file'].includes(block.type) ? <Input label="Tautan" type="url" value={block.url} onChange={(event) => update(index, { url: event.target.value })} placeholder={block.type === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://...'} maxLength={2048} error={errors[`blocks.${index}.url`]} /> : null}
        <Input label={block.type === 'image' ? 'Keterangan gambar' : block.type === 'file' ? 'Nama dokumen' : 'Label'} value={block.label} onChange={(event) => update(index, { label: event.target.value })} placeholder={block.type === 'image' ? 'Contoh: Ilustrasi tata surya' : 'Nama sumber atau file'} maxLength={160} error={errors[`blocks.${index}.label`]} />
      </div> : null}
    </section>)}
    <div className="qz-add-block"><span>Tambah blok</span><div>{Object.entries(labels).map(([type, label]) => <button type="button" key={type} onClick={() => onChange([...blocks, newBlock(type)])}><AddIcon size={15} /> {label}</button>)}</div></div>
    {errors.blocks ? <p className="qz-field__error">{errors.blocks}</p> : null}
  </div>;
}
