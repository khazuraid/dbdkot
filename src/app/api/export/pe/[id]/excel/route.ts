import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { peHouseholdSurveys } from '@/db/schema';
import { getReport } from '@/lib/domain/report-detail';
import { requireActor } from '@/lib/session';

export async function GET(
    _req: Request,
    context: { params: Promise<{ id: string }> },
) {
    let actor;
    try {
        actor = await requireActor();
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
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

    const wb = new ExcelJS.Workbook();
    wb.creator = 'WALI-EPI Surveilans DBD';
    wb.created = new Date();

    const fd = (report.pe?.formData ?? {}) as Record<string, unknown>;

    // Sheet 1: Ringkasan PE
    const wsSummary = wb.addWorksheet('Ringkasan PE');
    wsSummary.columns = [
        { header: 'Bagian / Parameter', key: 'param', width: 36 },
        { header: 'Nilai / Keterangan', key: 'val', width: 56 },
    ];
    wsSummary.getRow(1).font = { bold: true };
    wsSummary.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
    };

    const summaryRows: Array<[string, string | number]> = [
        ['Nomor Laporan Kasus', report.reportNumber],
        ['Fasilitas Asal', report.institutionName ?? '-'],
        ['Puskesmas Wilayah', report.assignedPuskesmasName ?? '-'],
        [
            'Tanggal Penyelidikan Epidemiologi (PE)',
            report.pe?.peDate
                ? new Date(report.pe.peDate).toLocaleDateString('id-ID')
                : '-',
        ],
        ['Petugas PE', report.pe?.officerName ?? '-'],
        ['NIP Petugas PE', report.pe?.officerNip ?? '-'],
        ['Kepala Puskesmas', report.pe?.headOfPuskesmasName ?? '-'],
        ['NIP Kepala Puskesmas', report.pe?.headOfPuskesmasNip ?? '-'],
        ['Nama Penderita', report.patient.name],
        ['NIK', report.patient.nik],
        [
            'Umur / Jenis Kelamin',
            `${report.patient.age} tahun / ${report.patient.gender === 'L' ? 'Laki-laki' : 'Perempuan'}`,
        ],
        ['Alamat Domisili', report.patient.address],
        [
            'Kelurahan / Kecamatan / Kota',
            `Kel. ${report.kelurahan ?? '-'}, Kec. ${report.kecamatan ?? '-'}, ${report.kota ?? '-'}`,
        ],
        ['Nama KK / Responden', report.pe?.respondentName ?? '-'],
        ['Hubungan dengan Penderita', report.pe?.respondentRelation ?? '-'],
        ['Keluhan Utama', String(fd.mainComplaint ?? '-')],
        [
            'Gejala Klinis',
            Array.isArray(fd.clinicalSymptoms)
                ? fd.clinicalSymptoms.join(', ')
                : '-',
        ],
        [
            'NS1 / IgM / IgG',
            `${String(fd.labRdtNs1 ?? report.dengueBlot ?? '-')} / ${String(fd.labIgm ?? report.igm ?? '-')} / ${String(fd.labIgg ?? report.igg ?? '-')}`,
        ],
        [
            'Trombosit / Hematokrit',
            `${fd.labPlatelet ?? report.plateletCount ?? '-'} /uL | ${fd.labHematocrit ?? report.hematocrit ?? '-'}%`,
        ],
        ['Rumah Diperiksa', report.pe?.housesInspected ?? households.length],
        ['Rumah Positif Jentik', report.pe?.housesPositive ?? 0],
        ['Kontainer Diperiksa', report.pe?.containersInspected ?? 0],
        ['Kontainer Positif Jentik', report.pe?.containersPositive ?? 0],
        ['ABJ (%)', report.pe?.abj ? `${report.pe.abj}%` : '-'],
        ['House Index / HI (%)', report.pe?.houseIndex ? `${report.pe.houseIndex}%` : '-'],
        ['Container Index / CI (%)', report.pe?.containerIndex ? `${report.pe.containerIndex}%` : '-'],
        ['Breteau Index / BI (%)', report.pe?.breteauIndex ? `${report.pe.breteauIndex}%` : '-'],
        [
            'Status Risiko Penularan',
            report.pe?.transmissionRisk === 'POSITIF_PENULARAN'
                ? 'POSITIF PENULARAN'
                : 'NEGATIF PENULARAN',
        ],
        [
            'Rekomendasi Fogging',
            report.pe?.foggingRecommended ? 'Ya (Fogging Fokus 2 Siklus)' : 'Tidak (PSN 3M Plus)',
        ],
        ['Kesimpulan', report.pe?.conclusion ?? '-'],
        ['Rekomendasi', report.pe?.recommendation ?? '-'],
    ];

    for (const [param, val] of summaryRows) {
        wsSummary.addRow({ param, val });
    }

    // Sheet 2: Lampiran 1 - Pemeriksaan Jentik 40+ Rumah
    const wsHouses = wb.addWorksheet('Pemeriksaan Jentik Rumah');
    wsHouses.columns = [
        { header: 'No.', key: 'no', width: 6 },
        { header: 'Nama KK / Alamat Rumah', key: 'address', width: 38 },
        { header: 'Jml Rumah', key: 'houseCount', width: 12 },
        { header: 'Jml Penghuni', key: 'population', width: 14 },
        { header: 'Jentik (+/-)', key: 'larvaStatus', width: 14 },
        { header: 'Jml Positif', key: 'larvaCount', width: 12 },
        { header: 'Jenis Jentik', key: 'larvaType', width: 22 },
        { header: 'Abatisasi', key: 'abateUsed', width: 12 },
    ];
    wsHouses.getRow(1).font = { bold: true };
    wsHouses.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
    };

    households.forEach((h, idx) => {
        wsHouses.addRow({
            no: idx + 1,
            address: h.address,
            houseCount: h.houseCount,
            population: h.population,
            larvaStatus: h.larvaCount > 0 ? 'Positif (+)' : 'Negatif (-)',
            larvaCount: h.larvaCount,
            larvaType: h.larvaCount > 0 ? (h.larvaType ?? 'Aedes') : '-',
            abateUsed: h.abateUsed ? 'Ya' : 'Tidak',
        });
    });

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `Data-PE-${report.reportNumber}.xlsx`;

    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
        status: 200,
        headers: {
            'Content-Type':
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
        },
    });
}
