import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { requireRole } from '@/lib/session';
import { peCandidates } from '@/lib/domain/pe';
import {
    Empty,
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { PeForm } from './pe-form';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

export default async function PeBaruPage({
    searchParams,
}: {
    searchParams: Promise<{ reportId?: string }>;
}) {
    const sp = await searchParams;
    const actor = await requireRole('PUSKESMAS');
    const { rows, total } = await peCandidates(actor);
    const leftOut = Math.max(0, total - rows.length);

    const [userRow] = await getDb()
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, actor.userId))
        .limit(1);

    const defaultOfficerName = userRow?.name ?? '';

    return (
        <PageBody>
            <PageHeader
                title="Form Penyelidikan Epidemiologi (PE)"
                context={
                    leftOut > 0
                        ? `Menampilkan ${rows.length} dari ${total} laporan yang siap diselidiki.`
                        : 'Formulir standar Kemenkes 6 bagian dengan kalkulator ABJ/HI/CI/BI real-time.'
                }
            />

            <PageContent>
                {rows.length === 0 ? (
                    <Panel title="Penyelidikan epidemiologi">
                        <Empty
                            action={{
                                href: '/pe',
                                label: 'Buka antrian puskesmas',
                            }}
                        >
                            Belum ada laporan untuk diselidiki. Terima laporan
                            di antrian puskesmas terlebih dahulu.
                        </Empty>
                    </Panel>
                ) : (
                    <PeForm
                        candidates={rows}
                        initialReportId={sp.reportId}
                        defaultOfficerName={defaultOfficerName}
                    />
                )}
            </PageContent>
        </PageBody>
    );
}
