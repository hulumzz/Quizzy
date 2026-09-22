import { ClassesIcon } from '../components/icons';
import { Card, EmptyState, PageHeader } from '../components/ui';

export default function FeaturePlaceholder({ title, description, emptyTitle = 'Belum ada data', emptyDescription }) {
  return <div className="qz-placeholder qz-enter"><PageHeader title={title} description={description} /><Card><EmptyState icon={ClassesIcon} title={emptyTitle} description={emptyDescription || 'Area ini sudah memiliki rute sendiri dan akan dihubungkan ke data pada tahap fitur berikutnya.'} /></Card></div>;
}
