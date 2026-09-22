import { LinkIcon } from '../../../components/icons';

function youtubeEmbed(value) {
  try {
    const url = new URL(value);
    let id = url.hostname.endsWith('youtu.be') ? url.pathname.slice(1) : url.searchParams.get('v');
    if (!id && url.pathname.includes('/shorts/')) id = url.pathname.split('/shorts/')[1]?.split('/')[0];
    if (!id && url.pathname.includes('/embed/')) id = url.pathname.split('/embed/')[1]?.split('/')[0];
    return /^[A-Za-z0-9_-]{6,20}$/.test(id || '') ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

export default function MaterialBlocks({ blocks }) {
  return <div className="qz-reader-blocks">{blocks.map((block) => {
    if (block.type === 'heading') return block.level === 3 ? <h3 key={block.id}>{block.content}</h3> : <h2 key={block.id}>{block.content}</h2>;
    if (block.type === 'paragraph') return <p key={block.id}>{block.content}</p>;
    if (block.type === 'quote') return <blockquote key={block.id}>{block.content}</blockquote>;
    if (block.type === 'bullet_list') return <ul key={block.id}>{block.items.map((item, index) => <li key={`${block.id}-${index}`}>{item}</li>)}</ul>;
    if (block.type === 'numbered_list') return <ol key={block.id}>{block.items.map((item, index) => <li key={`${block.id}-${index}`}>{item}</li>)}</ol>;
    if (block.type === 'divider') return <hr key={block.id} />;
    if (block.type === 'image') return <figure key={block.id}><img src={block.url} alt={block.label || ''} loading="lazy" />{block.label ? <figcaption>{block.label}</figcaption> : null}</figure>;
    if (block.type === 'youtube') {
      const embed = youtubeEmbed(block.url);
      return embed ? <figure key={block.id} className="qz-video"><iframe src={embed} title={block.label || 'Video materi'} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /><figcaption>{block.label || 'Video pendamping'}</figcaption></figure> : null;
    }
    if (block.type === 'link' || block.type === 'file') return <a key={block.id} className="qz-resource-link" href={block.url} target="_blank" rel="noreferrer"><LinkIcon size={20} /><span><strong>{block.label || (block.type === 'file' ? 'Buka file' : 'Buka tautan')}</strong><small>{block.url}</small></span></a>;
    return null;
  })}</div>;
}
