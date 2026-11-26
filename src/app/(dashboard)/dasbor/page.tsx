import { requireActor } from '@/lib/session';
import {
    dailySeries,
    listReports,
    needActionStatusesFor,
    reportCounts,
    type ReportListFilters,
} from '@/lib/domain/reports';
import { getReport } from '@/lib/domain/report-detail';
import { queueCounts } from '@/lib/domain/queries';
import {
    caseGeoPoints,
    facilityPoints,
    kelurahanZones,
    uncoveredKelurahan,
} from '@/lib/domain/map-data';
import { isValidUuid } from '@/lib/security';
import { readPage } from '@/components/shell/pager-view';
import {
    DasborWorkspace,
    type DasborQueue,
    type DasborView,
} from './dasbor-workspace';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

const VALID_QUEUES = new Set<DasborQueue>([
    'all',
    'overdue',
    'kdrs',
    'pe',
    'fogging',
    'cluster',
]);

function parseQueue(raw: string | undefined): DasborQueue {
    return raw && VALID_QUEUES.has(raw as DasborQueue)
        ? (raw as DasborQueue)
        : 'all';
}

function filtersForQueue(
    queue: DasborQueue,
    role: Parameters<typeof needActionStatusesFor>[0],
): Partial<ReportListFilters> {
    if (queue === 'overdue') return { slaOverdueOnly: true };
    if (queue === 'kdrs') return { statuses: [...needActionStatusesFor(role)] };
    if (queue === 'pe') {
        return {
            statuses: ['ASSIGNED_ACCEPTED', 'PE_IN_PROGRESS', 'PE_COMPLETED'],
        };
    }
    if (queue === 'fogging') {
        return {
            statuses: [
                'FOGGING_REQUIRED',
                'SIKLUS_1_DONE',
                'SIKLUS_2_SCHEDULED',
            ],
        };
    }
    if (queue === 'cluster') return { clusterOnly: true };
    return {};
}

export default async function DasborPage({
    searchParams,
}: {
    searchParams: Promise<{
        view?: string;
        queue?: string;
        q?: string;
        selected?: string;
        page?: string;
    }>;
}) {
    const sp = await searchParams;
    const actor = await requireActor();
    const page = readPage(sp.page);
    const queue = parseQueue(sp.queue);
    const searchQuery = (sp.q ?? '').trim();

    // RUMAH_SAKIT tidak menggunakan Peta Komando; paksa tampilan Ruang Kerja.
    const view: DasborView =
        actor.role !== 'RUMAH_SAKIT' && sp.view === 'map' ? 'map' : 'workspace';

    // Audit READ_PII opt-in: hanya panggil getReport jika ?selected adalah UUID valid.
    const selectedId =
        sp.selected && isValidUuid(sp.selected) ? sp.selected : null;

    const listFilters: ReportListFilters = {
        ...filtersForQueue(queue, actor.role),
        search: searchQuery || undefined,
        page,
        perPage: 20,
    };

    const [counts, series, queues, reports, selectedDetail, gapData, mapData] =
        await Promise.all([
            reportCounts(actor),
            dailySeries(actor),
            queueCounts(actor),
            listReports(actor, listFilters),
            selectedId ? getReport(actor, selectedId) : Promise.resolve(null),
            actor.role === 'DINKES'
                ? uncoveredKelurahan(actor)
                : Promise.resolve({ rows: [], total: 0 }),
            view === 'map'
                ? Promise.all([
                      facilityPoints(actor),
                      kelurahanZones(actor),
                      caseGeoPoints(actor),
                  ]).then(([points, zones, cases]) => ({
                      points,
                      zones,
                      cases,
                  }))
                : Promise.resolve(null),
        ]);

    const periodLabel = new Intl.DateTimeFormat('id-ID', {
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
    }).format(new Date());

    return (
        <DasborWorkspace
            role={actor.role}
            periodLabel={periodLabel}
            view={view}
            queue={queue}
            searchQuery={searchQuery}
            counts={counts}
            queues={queues}
            reports={reports}
            selectedDetail={selectedDetail}
            series={series}
            uncoveredCount={gapData.total}
            mapData={mapData}
        />
    );
}
