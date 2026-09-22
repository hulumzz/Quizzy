import { QuizIcon } from '../components/icons';
import { Button, Card, Input, PageHeader } from '../components/ui';

export default function QuizJoin() {
  return <div className="qz-placeholder qz-enter"><PageHeader title="Gabung kuis" description="Masukkan PIN yang diberikan guru saat sesi kuis dimulai." /><Card><form onSubmit={(event) => event.preventDefault()}><div className="qz-empty__icon"><QuizIcon size={24} /></div><Input label="PIN kuis" placeholder="Contoh: 482910" inputMode="numeric" maxLength={8} disabled hint="Gabung kuis akan aktif setelah sesi live tersedia." /><div style={{ marginTop: 16 }}><Button block disabled>Gabung kuis</Button></div></form></Card></div>;
}
