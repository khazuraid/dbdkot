import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/session';
import { audit } from '@/lib/audit';
import {
    getSurveillanceReportData,
    generateSurveillanceWorkbook,
    getEpiWeekReportData,
    generateEpiWeekWorkbook,
    getEndemicityStratification,
    generateEndemicityWorkbook,
    getPeComplianceReport,
    generatePeComplianceWorkbook,
} from '@/lib/domain/surveillance-report';

export async function GET(req: Request) {
    let actor;
    try {
        actor = await requireActor();
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'age';
    const rawYear = searchParams.get('y') || searchParams.get('year');
    const rawMonth = searchParams.get('m') || searchParams.get('month');
    const level =
        searchParams.get('lvl') === 'puskesmas' ||
        searchParams.get('level') === 'puskesmas'
            ? 'puskesmas'
            : 'kota';
    const puskesmasId =
        searchParams.get('pk') || searchParams.get('puskesmasId') || undefined;

    const year = rawYear ? parseInt(rawYear, 10) : new Date().getFullYear();
    const month = rawMonth ? parseInt(rawMonth, 10) : new Date().getMonth() + 1;

    try {
        let workbook;
        let filename = '';

        if (type === 'epiweek') {
            const data = await getEpiWeekReportData(actor, { year, level, puskesmasId });
            workbook = await generateEpiWeekWorkbook(data);
            filename = `LAPORAN_SKDR_MINGGUAN_W1_W52_${year}.xlsx`;
        } else if (type === 'endemicity') {
            const data = await getEndemicityStratification(actor, year);
            workbook = await generateEndemicityWorkbook(data);
            filename = `STRATIFIKASI_ENDEMISITAS_KELURAHAN_3TAHUN_${year}.xlsx`;
        } else if (type === 'pe_compliance') {
            const data = await getPeComplianceReport(actor, { year, month });
            workbook = await generatePeComplianceWorkbook(data);
            filename = `KEPATUHAN_WAKTU_RESPON_PE_${month ? `${month}_` : ''}${year}.xlsx`;
        } else {
            const reportData = await getSurveillanceReportData(actor, {
                year,
                month,
                level,
                puskesmasId,
            });
            workbook = await generateSurveillanceWorkbook(reportData);
            const safeLocation = reportData.locationName.replace(/[^a-zA-Z0-9-_]/g, '_');
            filename = `LAPORAN_DBD_GOLONGAN_UMUR_${safeLocation}_${reportData.month}_${reportData.year}.xlsx`;
        }

        await audit({
            actor,
            action: 'READ',
            entityType: 'REPORT_RS',
            entityId: `EXPORT_EXCEL_${type.toUpperCase()}`,
            changes: {
                filters: {
                    from: null,
                    to: { type, year, month, level, puskesmasId },
                },
            },
        });

        const buffer = await workbook.xlsx.writeBuffer();

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type':
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store, max-age=0',
            },
        });
    } catch (err) {
        console.error('Surveillance Excel Export Error:', err);
        return NextResponse.json(
            { error: 'Gagal membuat file Excel laporan surveilans' },
            { status: 500 },
        );
    }
}
