import React from 'react';
import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { peHouseholdSurveys } from '@/db/schema';
import { getReport } from '@/lib/domain/report-detail';
import {
    PeLampiranDocument,
    PeLengkapDocument,
    SuratCamatLurahDocument,
    SuratHasilKadinkesDocument,
} from '@/lib/pdf/kemenkes-templates';
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

    const { kind, id } = await context.params;
    const report = await getReport(actor, id);
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
