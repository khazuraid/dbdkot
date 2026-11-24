import React from 'react';
import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { peHouseholdSurveys } from '@/db/schema';
import { getReport } from '@/lib/domain/report-detail';
import { peDetail } from '@/lib/domain/pe';
import {
    PeLampiranDocument,
    PeLengkapDocument,
    SuratCamatLurahDocument,
    SuratHasilKadinkesDocument,
} from '@/lib/pdf/kemenkes-templates';
import { audit } from '@/lib/audit';
import { consumeRateLimit } from '@/lib/rate-limit';
import { isValidUuid } from '@/lib/security';
import { requireActor } from '@/lib/session';

export async function GET(
    _req: Request,
    context: { params: Promise<{ kind: string; id: string }> },
) {
    let actor;
    try {
        actor = await requireActor();
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rate = await consumeRateLimit(`export:pdf:${actor.userId}`, 60, 20);
    if (!rate.allowed) {
        return NextResponse.json(
            { error: 'Terlalu banyak permintaan PDF. Coba sebentar lagi.' },
            { status: 429, headers: { 'Retry-After': String(rate.retryAfter ?? 60) } },
        );
    }

    const { kind, id } = await context.params;
    if (!isValidUuid(id)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    let report = await getReport(actor, id);
    if (!report) {
        const pe = await peDetail(actor, id);
        if (pe) {
            report = await getReport(actor, pe.reportRSId);
        }
    }
    if (!report) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const households = report.pe
        ? await getDb()
              .select({
                  address: peHouseholdSurveys.address,
                  houseCount: peHouseholdSurveys.houseCount,
                  population: peHouseholdSurveys.population,
                  larvaCount: peHouseholdSurveys.larvaCount,
                  larvaType: peHouseholdSurveys.larvaType,
                  abateUsed: peHouseholdSurveys.abateUsed,
              })
              .from(peHouseholdSurveys)
              .where(eq(peHouseholdSurveys.reportPEId, report.pe.id))
        : [];

    let doc: Parameters<typeof renderToBuffer>[0];
    let filename: string;
    if (kind === 'pe-lampiran') {
        doc = React.createElement(PeLampiranDocument, {
            report,
            households,
        }) as unknown as Parameters<typeof renderToBuffer>[0];
        filename = `Lampiran-PE-${report.reportNumber}.pdf`;
    } else if (kind === 'pe-lengkap') {
        doc = React.createElement(PeLengkapDocument, {
            report,
            households,
        }) as unknown as Parameters<typeof renderToBuffer>[0];
        filename = `Berkas-Lengkap-PE-${report.reportNumber}.pdf`;
    } else if (kind === 'surat-kadinkes') {
        doc = React.createElement(SuratHasilKadinkesDocument, {
            report,
        }) as unknown as Parameters<typeof renderToBuffer>[0];
        filename = `Surat-Hasil-PE-Kadinkes-${report.reportNumber}.pdf`;
    } else if (kind === 'surat-camat-lurah') {
        doc = React.createElement(SuratCamatLurahDocument, {
            report,
        }) as unknown as Parameters<typeof renderToBuffer>[0];
        filename = `Surat-Penanggulangan-Camat-Lurah-${report.reportNumber}.pdf`;
    } else {
        return NextResponse.json(
            { error: 'Unknown PDF template kind' },
            { status: 400 },
        );
    }

    await audit({
        actor,
        action: 'READ_PII',
        entityType: 'REPORT_RS',
        entityId: report.id,
        changes: {
            exportPdfKind: { from: null, to: kind },
        },
    });

    const buffer = await renderToBuffer(doc);
    return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${filename}"`,
            'Cache-Control': 'no-store',
        },
    });
}
