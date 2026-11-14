import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/session';
import { listReports } from '@/lib/domain/reports';

/**
 * Zero-PII quick search endpoint for the global Command Palette (`cmdk`).
 * Searches `reportNumber` and `kelurahan` strictly within the caller's tenant scope.
 */
export async function GET(request: Request) {
    let actor;
    try {
        actor = await requireActor();
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) {
        return NextResponse.json({ reports: [] });
    }

    const { rows } = await listReports(actor, {
        search: q,
        page: 1,
        perPage: 8,
    });

    return NextResponse.json({
        reports: rows.map((r) => ({
            id: r.id,
            reportNumber: r.reportNumber,
            kelurahan: r.kelurahan,
            kecamatan: r.kecamatan,
            status: r.status,
            caseType: r.caseType,
        })),
    });
}
