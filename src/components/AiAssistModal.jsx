import { useEffect, useState } from 'react';
import { Dialog, Button, Input, Textarea, ProcessLoader } from './ui';
import { AiAssistIcon } from './icons';
import { UploadCloud, FileText } from 'lucide-react';

const MAX_PDF_PAGES = 5;
const MAX_CONTEXT_LENGTH = 5000;
const MAX_DIFFICULTY_LENGTH = 80;
const MAX_MAIN_POINTS_LENGTH = 500;
let pdfJsLoader;

function loadPdfJs() {
  if (!pdfJsLoader) {
    pdfJsLoader = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjsLib, workerModule]) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
      return pdfjsLib;
    });
  }
  return pdfJsLoader;
}

function initialForm(initialContext) {
  return {
    title: initialContext.title || '',
    context: initialContext.context || '',
    pdfName: '',
    numQuestions: 5,
    questionTypes: {
      multiple_choice: true,
      true_false: true,
      arrange: false,
      short_answer: false,
    },
    difficulty: 'Siswa kelas 5 SD',
    mainPoints: '',
  };
}

export default function AiAssistModal({ open, onClose, module, initialContext = {}, onApply, busy }) {
  const initialTitle = initialContext.title || '';
  const initialText = initialContext.context || '';
  const [form, setForm] = useState(() => initialForm({ title: initialTitle, context: initialText }));
  
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(initialForm({ title: initialTitle, context: initialText }));
    setError('');
  }, [open, initialText, initialTitle]);
  
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Hanya file PDF yang didukung.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Ukuran PDF maksimal 2MB.');
      return;
    }
    
    setPdfExtracting(true);
    setError('');
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await loadPdfJs();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = Math.min(pdf.numPages, MAX_PDF_PAGES);
      
      let extractedText = '';
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        extractedText += pageText + '\n';
      }
      
      let cleanedText = extractedText.replace(/\s+/g, ' ').trim();
      if (!cleanedText) {
        setError('PDF tidak berisi teks yang dapat diekstrak. Gunakan PDF berbasis teks atau tulis ringkasannya.');
        return;
      }
      if (cleanedText.length > MAX_CONTEXT_LENGTH) {
        const suffix = '... (terpotong)';
        cleanedText = cleanedText.slice(0, MAX_CONTEXT_LENGTH - suffix.length) + suffix;
      }
      
      setForm(prev => ({
        ...prev,
        context: cleanedText,
        pdfName: file.name
      }));
    } catch (err) {
      setError('Gagal membaca PDF. Pastikan file tidak rusak atau terenkripsi.');
      console.error(err);
    } finally {
      setPdfExtracting(false);
      e.target.value = null;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    if (module === 'quiz') {
      const activeTypes = Object.entries(form.questionTypes)
        .filter(([, active]) => active)
        .map(([type]) => type);
        
      if (activeTypes.length === 0) {
        setError('Pilih minimal satu bentuk soal.');
        return;
      }
      
      const instruction = `Buat tepat ${form.numQuestions} soal bervariasi. HANYA gunakan tipe soal berikut: ${activeTypes.join(', ')}. Pastikan setiap soal valid dan akurat.`;
      const context = `Topik: ${form.title}\n\nMateri Referensi:\n${form.context.slice(0, MAX_CONTEXT_LENGTH)}`;
      
      onApply({ title: form.title.trim(), instruction, context });
    } else if (module === 'material') {
      const instruction = `Susun materi ringkas dan menarik untuk target: ${form.difficulty}. Fokus pada poin-poin berikut:\n${form.mainPoints}`;
      const context = `Topik Materi: ${form.title}\n\nMateri Referensi:\n${form.context.slice(0, MAX_CONTEXT_LENGTH)}`;
      
      onApply({ title: form.title.trim(), instruction, context });
    }
  };

  const renderQuizFields = () => (
    <>
      <Input 
        label="Jumlah Soal" 
        type="number" 
        min="1" 
        max="15" 
        value={form.numQuestions} 
        onChange={(event) => setForm((current) => ({ ...current, numQuestions: Math.max(1, Math.min(15, Number.parseInt(event.target.value, 10) || 5)) }))}
      />
      <div className="qz-field">
        <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>Bentuk Soal yang Diinginkan</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
            <input type="checkbox" checked={form.questionTypes.multiple_choice} onChange={e => setForm(f => ({ ...f, questionTypes: { ...f.questionTypes, multiple_choice: e.target.checked } }))} /> Pilihan Ganda
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
            <input type="checkbox" checked={form.questionTypes.true_false} onChange={e => setForm(f => ({ ...f, questionTypes: { ...f.questionTypes, true_false: e.target.checked } }))} /> Benar atau Salah
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
            <input type="checkbox" checked={form.questionTypes.arrange} onChange={e => setForm(f => ({ ...f, questionTypes: { ...f.questionTypes, arrange: e.target.checked } }))} /> Susun Urutan
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
            <input type="checkbox" checked={form.questionTypes.short_answer} onChange={e => setForm(f => ({ ...f, questionTypes: { ...f.questionTypes, short_answer: e.target.checked } }))} /> Jawaban Singkat
          </label>
        </div>
      </div>
    </>
  );

  const renderMaterialFields = () => (
    <>
      <Input 
        label="Target Pembelajar (Tingkat Kesulitan)" 
        placeholder="Misal: Siswa Kelas 5 SD, Pemula"
        maxLength={MAX_DIFFICULTY_LENGTH}
        value={form.difficulty} 
        onChange={(e) => setForm(f => ({ ...f, difficulty: e.target.value }))} 
      />
      <Textarea 
        label="Poin Utama yang Harus Dicakup" 
        placeholder="Sebutkan hal-hal yang wajib ada di materi..."
        rows={3}
        maxLength={MAX_MAIN_POINTS_LENGTH}
        value={form.mainPoints} 
        onChange={(e) => setForm(f => ({ ...f, mainPoints: e.target.value }))} 
      />
    </>
  );

  return (
    <Dialog 
      open={open} 
      onClose={busy ? undefined : onClose} 
      title={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><AiAssistIcon size={20} /> AI Assist: {module === 'quiz' ? 'Buat Kuis' : 'Susun Materi'}</span>}
      description={`AI akan mempelajari referensi Anda dan meng-generate draf ${module === 'quiz' ? 'soal kuis' : 'materi'} secara cerdas.`}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && <div className="qz-inline-state qz-inline-state--error">{error}</div>}
        
        <Input 
          label={module === 'quiz' ? 'Topik / Judul Kuis' : 'Topik Materi'} 
          value={form.title} 
          maxLength={120}
          onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} 
          required 
        />

        <div className="qz-field">
          <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>Referensi Materi (Teks / PDF)</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', alignSelf: 'flex-start', background: 'var(--bg-surface)' }}>
              <UploadCloud size={16} /> 
              {pdfExtracting ? 'Mengekstrak PDF...' : 'Ekstrak dari PDF (Max 2MB)'}
              <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handlePdfUpload} disabled={pdfExtracting || busy} />
            </label>
            {form.pdfName && <small style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}><FileText size={14}/> Diambil dari: {form.pdfName}</small>}
            <Textarea 
              placeholder="Atau ketik/paste ringkasan materi di sini..."
              rows={4}
              maxLength={MAX_CONTEXT_LENGTH}
              value={form.context} 
              onChange={(e) => setForm(f => ({ ...f, context: e.target.value }))} 
            />
            <small style={{ color: 'var(--text-muted)', alignSelf: 'flex-end', fontSize: '12px' }}>{form.context.length}/{MAX_CONTEXT_LENGTH} karakter</small>
          </div>
        </div>

        {module === 'quiz' ? renderQuizFields() : renderMaterialFields()}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Batal</Button>
          <Button type="submit" disabled={busy || pdfExtracting || form.title.trim().length < 3}>
            {busy ? <><ProcessLoader size={16} label="Memproses" /> Memproses...</> : <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><AiAssistIcon size={16}/> Generate Draft</span>}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
