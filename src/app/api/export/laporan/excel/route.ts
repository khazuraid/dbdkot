import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { requireActor } from '@/lib/session';
import { audit } from '@/lib/audit';
import {
    STATUSES,
    STATUS_LABEL,
    CASE_TYPE_LABEL,
    getReportsForExport,
    type ReportStatus,
    type ReportPeriod,
    type ReportAgeGroup,
} from '@/lib/domain/reports';

export async function GET(req: Request) {
    let actor;
    try {
        actor = await requireActor();
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    const rawStatus = searchParams.get('status');
    const status = rawStatus && STATUSES.includes(rawStatus as ReportStatus)
        ? (rawStatus as ReportStatus)
        : undefined;

    const search = searchParams.get('search')?.trim() || undefined;

    const rawPeriod = searchParams.get('period');
    const period = ['weekly', 'monthly', 'quarterly', 'yearly'].includes(rawPeriod ?? '')
        ? (rawPeriod as ReportPeriod)
        : undefined;

    const caseType = searchParams.get('caseType')?.trim() || undefined;

    const rawGender = searchParams.get('gender');
    const gender = rawGender === 'L' || rawGender === 'P' ? rawGender : undefined;

    const rawAgeGroup = searchParams.get('ageGroup');
    const ageGroup = ['under_5', '5_14', '15_44', '45_plus'].includes(rawAgeGroup ?? '')
        ? (rawAgeGroup as ReportAgeGroup)
        : undefined;

    const rawSource = searchParams.get('sourceType');
    const sourceType = rawSource === 'RS' || rawSource === 'PUSKESMAS'
        ? rawSource
        : undefined;

    const rows = await getReportsForExport(actor, {
        status,
        search,
        period,
        caseType,
        gender,
        ageGroup,
        sourceType,
    });

    await audit({
        actor,
        action: 'READ',
        entityType: 'REPORT_RS',
        entityId: 'EXPORT_EXCEL',
        changes: {
            filters: {
                from: null,
                to: { status, search, period, caseType, gender, ageGroup, sourceType, rowCount: rows.length },
            },
        },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'WALI-EPI Surveilans DBD';
    wb.created = new Date();

    const ws = wb.addWorksheet('Daftar Kasus DBD', {
        views: [{ state: 'frozen', ySplit: 5 }],
    });

    // Header Judul
    ws.mergeCells('A1:N1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'SISTEM SURVEILANS EPIDEMIOLOGI DENGUE (WALI-EPI)';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0D9488' }, // Teal 600
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(1).height = 30;

    // Subjudul / Metadata
    ws.mergeCells('A2:N2');
    const subCell = ws.getCell('A2');
    subCell.value = `Rekapitulasi Data Kasus Dengue | Diunduh oleh: ${actor.email} (${actor.role}) | Tanggal: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB`;
    subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF334155' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(2).height = 20;

    // Filter info
    ws.mergeCells('A3:N3');
    const filterInfoCell = ws.getCell('A3');
    const filterParts: string[] = [];
    if (period) {
        const periodMap: Record<string, string> = {
            weekly: '7 Hari Terakhir',
            monthly: 'Bulan Ini',
            quarterly: 'Triwulan Ini',
            yearly: 'Tahun Ini',
        };
        filterParts.push(`Periode: ${periodMap[period] ?? period}`);
    }
    if (caseType) filterParts.push(`Diagnosa: ${CASE_TYPE_LABEL[caseType] ?? caseType}`);
    if (gender) filterParts.push(`JK: ${gender === 'L' ? 'Laki-laki' : 'Perempuan'}`);
    if (ageGroup) {
        const ageMap: Record<string, string> = {
            under_5: 'Balita (<5 th)',
            '5_14': 'Anak (5-14 th)',
            '15_44': 'Dewasa (15-44 th)',
            '45_plus': 'Lansia (≥45 th)',
        };
        filterParts.push(`Umur: ${ageMap[ageGroup] ?? ageGroup}`);
    }
    if (sourceType) filterParts.push(`Sumber: ${sourceType === 'RS' ? 'Rumah Sakit' : 'Puskesmas'}`);
    if (status) filterParts.push(`Status: ${STATUS_LABEL[status] ?? status}`);
    if (search) filterParts.push(`Pencarian: "${search}"`);

    filterInfoCell.value = filterParts.length > 0
        ? `Filter Aktif: ${filterParts.join(' | ')} (Total: ${rows.length} kasus)`
        : `Semua Data Kasus (Total: ${rows.length} kasus)`;
    filterInfoCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F766E' } };
    filterInfoCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(3).height = 18;

    // Spacing row
    ws.getRow(4).height = 8;

    // Kolom tabel
    const columns = [
        { header: 'No', key: 'no', width: 6 },
        { header: 'No. Laporan', key: 'reportNumber', width: 22 },
        { header: 'Sumber Lapor', key: 'source', width: 18 },
        { header: 'Tgl Masuk/Rawat', key: 'admissionDate', width: 16 },
        { header: 'Tgl Lapor', key: 'createdAt', width: 16 },
        { header: 'Diagnosa', key: 'caseType', width: 16 },
        { header: 'Umur (Th)', key: 'age', width: 12 },
        { header: 'Jenis Kelamin', key: 'gender', width: 14 },
        { header: 'Kelurahan', key: 'kelurahan', width: 22 },
        { header: 'Kecamatan', key: 'kecamatan', width: 22 },
        { header: 'Kota / Kab', key: 'kota', width: 20 },
        { header: 'Status Terkini', key: 'status', width: 30 },
        { header: 'Latitude', key: 'lat', width: 14 },
        { header: 'Longitude', key: 'lng', width: 14 },
    ];

    const tableHeaderRow = ws.getRow(5);
    tableHeaderRow.values = columns.map((c) => c.header);
    tableHeaderRow.height = 26;
    tableHeaderRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E293B' }, // Slate 800
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF94A3B8' } },
            left: { style: 'thin', color: { argb: 'FF94A3B8' } },
            bottom: { style: 'medium', color: { argb: 'FF0D9488' } },
            right: { style: 'thin', color: { argb: 'FF94A3B8' } },
        };
    });

    columns.forEach((col, idx) => {
        ws.getColumn(idx + 1).width = col.width;
    });

    // Populate rows
    rows.forEach((r, idx) => {
        const rowIdx = idx + 6;
        const row = ws.getRow(rowIdx);

        const isPuskesmas = r.sourceType === 'PUSKESMAS_POLI' || r.sourceType === 'PUSKESMAS';
        const sourceLabel = isPuskesmas ? 'Puskesmas' : 'Rumah Sakit';
        const genderLabel = r.gender === 'L' ? 'Laki-laki' : r.gender === 'P' ? 'Perempuan' : '-';
        const caseLabel = CASE_TYPE_LABEL[r.caseType] ?? r.caseType;
        const statusLabel = STATUS_LABEL[r.status] ?? r.status;

        const admDateStr = r.admissionDate
            ? new Date(r.admissionDate).toISOString().slice(0, 10)
            : '-';
        const createDateStr = r.createdAt
            ? new Date(r.createdAt).toISOString().slice(0, 10)
            : '-';

        row.values = [
            idx + 1,
            r.reportNumber,
            sourceLabel,
            admDateStr,
            createDateStr,
            caseLabel,
            r.age,
            genderLabel,
            r.kelurahan ?? '-',
            r.kecamatan ?? '-',
            r.kota ?? 'Kota Bandung',
            statusLabel,
            r.latitude ?? '-',
            r.longitude ?? '-',
        ];

        row.height = 20;

        const isEven = idx % 2 === 0;
        row.eachCell((cell, colNumber) => {
            cell.font = { name: 'Arial', size: 9 };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' },
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };

            // Alignments
            if (colNumber === 1 || colNumber === 3 || colNumber === 4 || colNumber === 5 || colNumber === 8) {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else if (colNumber === 7 || colNumber === 13 || colNumber === 14) {
                cell.alignment = { vertical: 'middle', horizontal: 'right' };
            } else {
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
            }

            // Highlighting report number
            if (colNumber === 2) {
                cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0D9488' } };
            }
        });
    });

    const buffer = await wb.xlsx.writeBuffer();
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `Rekap-Kasus-DBD-${dateStamp}.xlsx`;

    return new NextResponse(buffer, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    });
}
