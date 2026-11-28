import { requireRole } from '@/lib/session';
import { listFoggingQueue } from '@/lib/domain/fogging';
import { listPuskesmasWaOfficers } from '@/lib/domain/notify';
import {
    Empty,
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { Stat, StatRow } from '@/components/shell/stat';
import { CalendarCheck, CheckCircle2, Clock, Flame } from 'lucide-react';
import { FoggingCard } from './fogging-card';

export const instant = false;

export default async function TindakLanjutPage() {
    const actor = await requireRole('ADMIN', 'DINKES', 'PUSKESMAS');
    const items = await listFoggingQueue(actor);
    const officersByPkm = await listPuskesmasWaOfficers(
        items
            .map((i) => i.puskesmasId)
            .filter((id): id is string => Boolean(id)),
    );

    const canExecute = actor.role === 'DINKES' || actor.role === 'PUSKESMAS';

    const waitingCycle1 = items.filter((i) => {
        const c1 = i.cycles.find((c) => c.cycleNumber === 1);
        return !c1 || c1.status !== 'COMPLETED';
    }).length;

    const waitingCycle2 = items.filter((i) => {
        const c1 = i.cycles.find((c) => c.cycleNumber === 1);
        const c2 = i.cycles.find((c) => c.cycleNumber === 2);
        return c1?.status === 'COMPLETED' && (!c2 || c2.status !== 'COMPLETED');
    }).length;

    const completedAll = items.filter((i) => {
        const c1 = i.cycles.find((c) => c.cycleNumber === 1);
        const c2 = i.cycles.find((c) => c.cycleNumber === 2);
        return c1?.status === 'COMPLETED' && c2?.status === 'COMPLETED';
    }).length;

    return (
        <PageBody>
            <PageHeader
                title="Tindak Lanjut & Fogging Fokus"
                context="Pelaksanaan fogging 2 siklus (H0 & H+7 otomatis), pemotongan stok larvasida/insektisida, dan estimasi anggaran."
            />

            <PageContent>
                <StatRow className="grid-cols-2 lg:grid-cols-4">
                    <Stat
                        label="Total Antrian Fogging"
                        value={items.length}
                        signal="neutral"
                        hint="Kasus indikasi fogging"
                        icon={Flame}
                    />
                    <Stat
                        label="Menunggu Siklus 1 (H0)"
                        value={waitingCycle1}
                        signal={waitingCycle1 > 0 ? 'warn' : 'good'}
                        hint={
                            waitingCycle1 > 0
                                ? 'Prioritas penyemprotan pertama'
                                : 'Semua H0 terlaksana'
                        }
                        icon={Clock}
                    />
                    <Stat
                        label="Menunggu Siklus 2 (H+7)"
                        value={waitingCycle2}
                        signal={waitingCycle2 > 0 ? 'warn' : 'good'}
                        hint={
                            waitingCycle2 > 0
                                ? 'Jadwal putaran kedua'
                                : 'Nol antrian H+7'
                        }
                        icon={CalendarCheck}
                    />
                    <Stat
                        label="Selesai 2 Siklus"
                        value={completedAll}
                        signal="good"
                        hint="Siklus tuntas 100%"
                        icon={CheckCircle2}
                    />
                </StatRow>

                {items.length === 0 ? (
                    <Panel title="Antrian Fogging Fokus">
                        <Empty
                            action={{
                                href: '/laporan',
                                label: 'Lihat semua laporan',
                            }}
                        >
                            Belum ada kasus yang memerlukan tindak lanjut
                            fogging fokus saat ini.
                        </Empty>
                    </Panel>
                ) : (
                    <div className="flex flex-col gap-4">
                        {items.map((item) => (
                            <FoggingCard
                                key={item.reportId}
                                item={item}
                                canExecute={canExecute}
                                actorRole={actor.role}
                                actorInstitutionId={actor.institutionId}
                                puskesmasOfficers={
                                    item.puskesmasId
                                        ? (officersByPkm[item.puskesmasId] ??
                                          [])
                                        : []
                                }
                            />
                        ))}
                    </div>
                )}
            </PageContent>
        </PageBody>
    );
}
