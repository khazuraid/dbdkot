import { and, eq, gte, lt, lte, ne, or, type SQL } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { getDb } from '@/db';
import { institutions, reportsPE, reportsRS, foggingCycles } from '@/db/schema';
import { decryptPii } from '@/lib/crypto';
import { scopeToInstitution, type Actor } from '@/lib/session';

export type AgeGroupCounts = {
    l_p: number; // Laki-laki Penderita
    l_m: number; // Laki-laki Meninggal
    p_p: number; // Perempuan Penderita
    p_m: number; // Perempuan Meninggal
};

export type SurveillanceRow = {
    id: string;
    no: number;
    name: string; // Puskesmas name or Kelurahan name
    kelurahan?: string;
    rw?: string;
    rt?: string;
    rsPenemu?: string;
    under1: AgeGroupCounts;
    age1_4: AgeGroupCounts;
    age5_14: AgeGroupCounts;
    age15_44: AgeGroupCounts;
    over44: AgeGroupCounts;
    totalGender: AgeGroupCounts;
    totalCases: {
        p: number;
        m: number;
        all: number;
    };
    diPe: number;
    larvasidasi: number;
    difogging: number;
    abj: number | null; // e.g. 92.5
    abjSamples: number;
};

export type FaskesPenemuItem = {
    name: string;
    count: number;
};

export type SurveillanceReportResult = {
    title: string;
    subtitle: string;
    locationName: string;
    periodLabel: string;
    month: number;
    year: number;
    level: 'kota' | 'puskesmas';
    puskesmasName?: string;
    faskesPenemu: FaskesPenemuItem[];
    rows: SurveillanceRow[];
    totals: {
        under1: AgeGroupCounts;
        age1_4: AgeGroupCounts;
        age5_14: AgeGroupCounts;
        age15_44: AgeGroupCounts;
        over44: AgeGroupCounts;
        totalGender: AgeGroupCounts;
        totalCases: {
            p: number;
            m: number;
            all: number;
        };
        diPe: number;
        larvasidasi: number;
        difogging: number;
        avgAbj: number | null;
    };
};

export function extractRtRw(address: string): { rt: string; rw: string } {
    let rt = '-';
    let rw = '-';
    if (!address) return { rt, rw };

    const rtMatch = address.match(/\bRT[\s.:]*(\d{1,3})\b/i);
    const rwMatch = address.match(/\bRW[\s.:]*(\d{1,3})\b/i);

    if (rtMatch) rt = String(parseInt(rtMatch[1], 10)).padStart(2, '0');
    if (rwMatch) rw = String(parseInt(rwMatch[1], 10)).padStart(2, '0');

    if (rt === '-' && rw === '-') {
        const slashMatch = address.match(/\b(?:RT\s*[\/]?\s*RW|RT\/RW)\s*[:.]?\s*(\d{1,3})\s*[\/]\s*(\d{1,3})\b/i);
        if (slashMatch) {
            rt = String(parseInt(slashMatch[1], 10)).padStart(2, '0');
            rw = String(parseInt(slashMatch[2], 10)).padStart(2, '0');
        }
    }

    return { rt, rw };
}

function createEmptyAgeCounts(): AgeGroupCounts {
    return { l_p: 0, l_m: 0, p_p: 0, p_m: 0 };
}

function addAgeCounts(target: AgeGroupCounts, source: AgeGroupCounts) {
    target.l_p += source.l_p;
    target.l_m += source.l_m;
    target.p_p += source.p_p;
    target.p_m += source.p_m;
}

const MONTH_NAMES = [
    '',
    'JANUARI',
    'FEBRUARI',
    'MARET',
    'APRIL',
    'MEI',
    'JUNI',
    'JULI',
    'AGUSTUS',
    'SEPTEMBER',
    'OKTOBER',
    'NOVEMBER',
    'DESEMBER',
];

export async function getSurveillanceReportData(
    actor: Actor,
    params: {
        year?: number;
        month?: number;
        level?: 'kota' | 'puskesmas';
        puskesmasId?: string;
    },
): Promise<SurveillanceReportResult> {
    const db = getDb();
    const now = new Date();
    const year = params.year && params.year > 2000 ? params.year : now.getFullYear();
    const month = params.month && params.month >= 1 && params.month <= 12 ? params.month : now.getMonth() + 1;

    let level: 'kota' | 'puskesmas' = params.level === 'puskesmas' ? 'puskesmas' : 'kota';
    let targetPuskesmasId = params.puskesmasId;

    // Enforce role-based boundaries
    if (actor.role === 'PUSKESMAS') {
        level = 'puskesmas';
        targetPuskesmasId = actor.institutionId ?? undefined;
    } else if (actor.role === 'RUMAH_SAKIT') {
        level = 'puskesmas';
        targetPuskesmasId = actor.institutionId ?? undefined;
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    // Resolve Puskesmas info if specific puskesmas is selected
    let puskesmasName = '';
    if (targetPuskesmasId) {
        const [pRow] = await db
            .select({ name: institutions.name })
            .from(institutions)
            .where(eq(institutions.id, targetPuskesmasId))
            .limit(1);
        puskesmasName = pRow?.name ?? 'Puskesmas';
    }

    // Prepare date conditions on admissionDate / createdAt
    const conditions: SQL[] = [
        gte(reportsRS.admissionDate, startDate),
        lt(reportsRS.admissionDate, endDate),
    ];

    const scopedInstId = scopeToInstitution(actor);
    if (scopedInstId) {
        conditions.push(
            or(
                eq(reportsRS.institutionId, scopedInstId),
                eq(reportsRS.assignedPuskesmasId, scopedInstId),
            )!,
        );
    } else if (targetPuskesmasId) {
        conditions.push(eq(reportsRS.assignedPuskesmasId, targetPuskesmasId));
    }

    // Fetch reportsRS with PE, faskes penemu & fogging data
    const reports = await db
        .select({
            id: reportsRS.id,
            patientAge: reportsRS.patientAge,
            patientGender: reportsRS.patientGender,
            dischargeStatus: reportsRS.dischargeStatus,
            kelurahan: reportsRS.kelurahan,
            assignedPuskesmasId: reportsRS.assignedPuskesmasId,
            patientAddressEncrypted: reportsRS.patientAddressEncrypted,
            status: reportsRS.status,
            rt: reportsRS.rt,
            rw: reportsRS.rw,
            peId: reportsPE.id,
            peStatus: reportsPE.status,
            peRt: reportsPE.rt,
            peRw: reportsPE.rw,
            abj: reportsPE.abj,
            foggingId: foggingCycles.id,
            foggingStatus: foggingCycles.status,
            abateUsedKg: foggingCycles.abateUsedKg,
            rsName: institutions.name,
        })
        .from(reportsRS)
        .leftJoin(institutions, eq(institutions.id, reportsRS.institutionId))
        .leftJoin(reportsPE, eq(reportsPE.reportRSId, reportsRS.id))
        .leftJoin(foggingCycles, eq(foggingCycles.reportRSId, reportsRS.id))
        .where(and(...conditions));

    // Fetch all Puskesmas institutions if level === 'kota'
    const puskesmasList =
        level === 'kota'
            ? await db
                  .select({ id: institutions.id, name: institutions.name })
                  .from(institutions)
                  .where(eq(institutions.type, 'PUSKESMAS'))
                  .orderBy(institutions.name)
            : [];

    type GroupAccumulator = {
        id: string;
        name: string;
        kelurahan?: string;
        rw?: string;
        rt?: string;
        rsPenemuSet: Set<string>;
        under1: AgeGroupCounts;
        age1_4: AgeGroupCounts;
        age5_14: AgeGroupCounts;
        age15_44: AgeGroupCounts;
        over44: AgeGroupCounts;
        diPeReports: Set<string>;
        larvasidasiReports: Set<string>;
        difoggingReports: Set<string>;
        abjSum: number;
        abjCount: number;
    };

    const groupMap = new Map<string, GroupAccumulator>();
    const faskesPenemuMap = new Map<string, number>();

    if (level === 'kota') {
        for (const p of puskesmasList) {
            groupMap.set(p.id, {
                id: p.id,
                name: p.name,
                rsPenemuSet: new Set(),
                under1: createEmptyAgeCounts(),
                age1_4: createEmptyAgeCounts(),
                age5_14: createEmptyAgeCounts(),
                age15_44: createEmptyAgeCounts(),
                over44: createEmptyAgeCounts(),
                diPeReports: new Set(),
                larvasidasiReports: new Set(),
                difoggingReports: new Set(),
                abjSum: 0,
                abjCount: 0,
            });
        }
    }

    // Process each patient case
    for (const r of reports) {
        // Track RS / Faskes Penemu
        const rsName = r.rsName || 'Faskes Luar / Mandiri';
        faskesPenemuMap.set(rsName, (faskesPenemuMap.get(rsName) || 0) + 1);

        let groupKey = '';
        let groupName = '';
        let groupKelurahan: string | undefined;
        let groupRw: string | undefined;
        let groupRt: string | undefined;

        if (level === 'kota') {
            const pId = r.assignedPuskesmasId ?? 'UNASSIGNED';
            groupKey = pId;
            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, {
                    id: pId,
                    name: 'Lainnya / Belum Ditugaskan',
                    rsPenemuSet: new Set(),
                    under1: createEmptyAgeCounts(),
                    age1_4: createEmptyAgeCounts(),
                    age5_14: createEmptyAgeCounts(),
                    age15_44: createEmptyAgeCounts(),
                    over44: createEmptyAgeCounts(),
                    diPeReports: new Set(),
                    larvasidasiReports: new Set(),
                    difoggingReports: new Set(),
                    abjSum: 0,
                    abjCount: 0,
                });
            }
        } else {
            // Level === 'puskesmas': group strictly by RW and RT within Kelurahan
            let rt = (r.peRt || r.rt || '').trim();
            let rw = (r.peRw || r.rw || '').trim();
            if (!rt || !rw) {
                let address = '';
                try {
                    if (r.patientAddressEncrypted) {
                        address = decryptPii(r.patientAddressEncrypted);
                    }
                } catch {
                    address = '';
                }
                const parsed = extractRtRw(address);
                if (!rt && parsed.rt && parsed.rt !== '-') rt = parsed.rt;
                if (!rw && parsed.rw && parsed.rw !== '-') rw = parsed.rw;
            }

            const kel = (r.kelurahan || 'Kelurahan Lainnya').trim();
            const rwStr = rw ? `RW ${rw.replace(/\D/g, '').padStart(2, '0')}` : 'RW -';
            const rtStr = rt ? `RT ${rt.replace(/\D/g, '').padStart(2, '0')}` : 'RT -';
            groupKelurahan = kel;
            groupRw = rwStr;
            groupRt = rtStr;
            groupKey = `${kel}|${rwStr}|${rtStr}`;
            groupName = `${kel} - ${rwStr} / ${rtStr}`;

            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, {
                    id: groupKey,
                    name: groupName,
                    kelurahan: groupKelurahan,
                    rw: groupRw,
                    rt: groupRt,
                    rsPenemuSet: new Set(),
                    under1: createEmptyAgeCounts(),
                    age1_4: createEmptyAgeCounts(),
                    age5_14: createEmptyAgeCounts(),
                    age15_44: createEmptyAgeCounts(),
                    over44: createEmptyAgeCounts(),
                    diPeReports: new Set(),
                    larvasidasiReports: new Set(),
                    difoggingReports: new Set(),
                    abjSum: 0,
                    abjCount: 0,
                });
            }
        }

        const group = groupMap.get(groupKey)!;

        // Gender & Deceased status
        const isMale = r.patientGender === 'L';
        const rawStatus = (r.dischargeStatus || '').toLowerCase();
        const isDeceased =
            rawStatus.includes('meninggal') || rawStatus.includes('dead') || rawStatus.includes('wafat');

        const age = r.patientAge ?? 0;
        let targetBucket: AgeGroupCounts;
        if (age < 1) {
            targetBucket = group.under1;
        } else if (age <= 4) {
            targetBucket = group.age1_4;
        } else if (age <= 14) {
            targetBucket = group.age5_14;
        } else if (age <= 44) {
            targetBucket = group.age15_44;
        } else {
            targetBucket = group.over44;
        }

        if (isMale) {
            if (isDeceased) targetBucket.l_m += 1;
            else targetBucket.l_p += 1;
        } else {
            if (isDeceased) targetBucket.p_m += 1;
            else targetBucket.p_p += 1;
        }

        // PE status
        if (r.peId && r.peStatus && ['COMPLETED', 'VERIFIED'].includes(r.peStatus)) {
            group.diPeReports.add(r.id);
            if (r.abj) {
                const abjVal = parseFloat(String(r.abj));
                if (!isNaN(abjVal)) {
                    group.abjSum += abjVal;
                    group.abjCount += 1;
                }
            }
        }

        // Larvasidasi
        if (r.abateUsedKg && parseFloat(String(r.abateUsedKg)) > 0) {
            group.larvasidasiReports.add(r.id);
        }

        // Fogging
        if (
            (r.foggingId && r.foggingStatus === 'DONE') ||
            ['SIKLUS_1_DONE', 'SIKLUS_2_DONE', 'CLOSED'].includes(r.status)
        ) {
            group.difoggingReports.add(r.id);
        }
    }

    // Build Rows & Grand Totals
    const rows: SurveillanceRow[] = [];
    const totalAccumulator = {
        under1: createEmptyAgeCounts(),
        age1_4: createEmptyAgeCounts(),
        age5_14: createEmptyAgeCounts(),
        age15_44: createEmptyAgeCounts(),
        over44: createEmptyAgeCounts(),
        totalGender: createEmptyAgeCounts(),
        totalCases: { p: 0, m: 0, all: 0 },
        diPe: 0,
        larvasidasi: 0,
        difogging: 0,
        totalAbjSum: 0,
        totalAbjCount: 0,
    };

    let counter = 1;
    const sortedGroups = Array.from(groupMap.values()).sort((a, b) => {
        if (a.kelurahan && b.kelurahan) {
            if (a.kelurahan !== b.kelurahan) return a.kelurahan.localeCompare(b.kelurahan);
            if (a.rw !== b.rw) return (a.rw || '').localeCompare(b.rw || '');
            return (a.rt || '').localeCompare(b.rt || '');
        }
        return a.name.localeCompare(b.name);
    });

    for (const g of sortedGroups) {
        const totalGender = createEmptyAgeCounts();
        addAgeCounts(totalGender, g.under1);
        addAgeCounts(totalGender, g.age1_4);
        addAgeCounts(totalGender, g.age5_14);
        addAgeCounts(totalGender, g.age15_44);
        addAgeCounts(totalGender, g.over44);

        const totalP = totalGender.l_p + totalGender.p_p;
        const totalM = totalGender.l_m + totalGender.p_m;
        const totalAll = totalP + totalM;

        const rowAbj = g.abjCount > 0 ? Number((g.abjSum / g.abjCount).toFixed(1)) : null;

        rows.push({
            id: g.id,
            no: counter++,
            name: g.name,
            kelurahan: g.kelurahan,
            rw: g.rw,
            rt: g.rt,
            rsPenemu: Array.from(g.rsPenemuSet).join(', ') || '-',
            under1: g.under1,
            age1_4: g.age1_4,
            age5_14: g.age5_14,
            age15_44: g.age15_44,
            over44: g.over44,
            totalGender,
            totalCases: {
                p: totalP,
                m: totalM,
                all: totalAll,
            },
            diPe: g.diPeReports.size,
            larvasidasi: g.larvasidasiReports.size,
            difogging: g.difoggingReports.size,
            abj: rowAbj,
            abjSamples: g.abjCount,
        });

        addAgeCounts(totalAccumulator.under1, g.under1);
        addAgeCounts(totalAccumulator.age1_4, g.age1_4);
        addAgeCounts(totalAccumulator.age5_14, g.age5_14);
        addAgeCounts(totalAccumulator.age15_44, g.age15_44);
        addAgeCounts(totalAccumulator.over44, g.over44);
        addAgeCounts(totalAccumulator.totalGender, totalGender);

        totalAccumulator.totalCases.p += totalP;
        totalAccumulator.totalCases.m += totalM;
        totalAccumulator.totalCases.all += totalAll;

        totalAccumulator.diPe += g.diPeReports.size;
        totalAccumulator.larvasidasi += g.larvasidasiReports.size;
        totalAccumulator.difogging += g.difoggingReports.size;
        totalAccumulator.totalAbjSum += g.abjSum;
        totalAccumulator.totalAbjCount += g.abjCount;
    }

    const monthStr = MONTH_NAMES[month] || `BULAN ${month}`;
    const periodLabel = `BULAN ${monthStr} TAHUN ${year}`;
    const locationName =
        level === 'kota'
            ? 'KOTA CIREBON'
            : puskesmasName
              ? `PUSKESMAS ${puskesmasName.toUpperCase()}`
              : 'WILAYAH KERJA PUSKESMAS';

    const faskesPenemu = Array.from(faskesPenemuMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    return {
        title: 'LAPORAN PENDERITA DBD MENURUT GOLONGAN UMUR',
        subtitle: `${locationName} — ${periodLabel}`,
        locationName,
        periodLabel,
        month,
        year,
        level,
        puskesmasName,
        faskesPenemu,
        rows,
        totals: {
            under1: totalAccumulator.under1,
            age1_4: totalAccumulator.age1_4,
            age5_14: totalAccumulator.age5_14,
            age15_44: totalAccumulator.age15_44,
            over44: totalAccumulator.over44,
            totalGender: totalAccumulator.totalGender,
            totalCases: totalAccumulator.totalCases,
            diPe: totalAccumulator.diPe,
            larvasidasi: totalAccumulator.larvasidasi,
            difogging: totalAccumulator.difogging,
            avgAbj:
                totalAccumulator.totalAbjCount > 0
                    ? Number((totalAccumulator.totalAbjSum / totalAccumulator.totalAbjCount).toFixed(1))
                    : null,
        },
    };
}

/**
 * Builds an ExcelJS Workbook formatted to match official Kemenkes / Dinas Kesehatan
 * age-bracket surveillance format (Image #17).
 */
export async function generateSurveillanceWorkbook(
    data: SurveillanceReportResult,
): Promise<ExcelJS.Workbook> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'WALI-EPI Surveilans DBD';
    wb.created = new Date();

    const isPuskesmasLevel = data.level === 'puskesmas';
    const sheetName = isPuskesmasLevel ? 'Rekap DBD per RT-RW' : 'Rekap DBD per Puskesmas';
    const ws = wb.addWorksheet(sheetName, {
        views: [{ state: 'frozen', ySplit: 6 }],
    });

    const totalCols = isPuskesmasLevel ? 34 : 32;

    // Helper for borders
    const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
    };

    const headerFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' }, // Slate 200
    };

    const headerFont: Partial<ExcelJS.Font> = {
        name: 'Arial',
        size: 9,
        bold: true,
        color: { argb: 'FF0F172A' },
    };

    // Row 1: Title
    ws.mergeCells(1, 1, 1, totalCols);
    const r1 = ws.getCell(1, 1);
    r1.value = data.title;
    r1.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF0F172A' } };
    r1.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 24;

    // Row 2: Subtitle
    ws.mergeCells(2, 1, 2, totalCols);
    const r2 = ws.getCell(2, 1);
    r2.value = data.subtitle;
    r2.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF334155' } };
    r2.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 18;

    // Blank row 3
    ws.getRow(3).height = 8;

    // Table Header starts at Row 4, 5, 6
    // R4: Top header
    // R5: Sub-age & gender groups
    // R6: P / M subcolumns

    const offset = isPuskesmasLevel ? 4 : 2;

    // Set Column Widths
    ws.getColumn(1).width = 5; // NO
    if (isPuskesmasLevel) {
        ws.getColumn(2).width = 22; // KELURAHAN
        ws.getColumn(3).width = 8; // RW
        ws.getColumn(4).width = 8; // RT
    } else {
        ws.getColumn(2).width = 26; // PUSKESMAS
    }

    // Age & metric columns
    for (let c = offset + 1; c <= totalCols; c++) {
        ws.getColumn(c).width = c >= totalCols - 3 ? 9 : 4.5;
    }

    // 1. NO header
    ws.mergeCells(4, 1, 6, 1);
    const noCell = ws.getCell(4, 1);
    noCell.value = 'NO';
    noCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // 2. Location header(s)
    if (isPuskesmasLevel) {
        ws.mergeCells(4, 2, 6, 2);
        ws.getCell(4, 2).value = 'KELURAHAN';
        ws.getCell(4, 2).alignment = { horizontal: 'center', vertical: 'middle' };

        ws.mergeCells(4, 3, 6, 3);
        ws.getCell(4, 3).value = 'RW';
        ws.getCell(4, 3).alignment = { horizontal: 'center', vertical: 'middle' };

        ws.mergeCells(4, 4, 6, 4);
        ws.getCell(4, 4).value = 'RT';
        ws.getCell(4, 4).alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
        ws.mergeCells(4, 2, 6, 2);
        const pCell = ws.getCell(4, 2);
        pCell.value = 'PUSKESMAS';
        pCell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // 3. GOLONGAN UMUR (Span 20 cols)
    const ageStartCol = offset + 1;
    const ageEndCol = offset + 20;
    ws.mergeCells(4, ageStartCol, 4, ageEndCol);
    const ageHead = ws.getCell(4, ageStartCol);
    ageHead.value = 'GOLONGAN UMUR';
    ageHead.alignment = { horizontal: 'center', vertical: 'middle' };

    const ageBrackets = [
        { label: '< 1 th', span: 4 },
        { label: '1 - 4 th', span: 4 },
        { label: '5 - 14 th', span: 4 },
        { label: '15 - 44 th', span: 4 },
        { label: '> 44 th', span: 4 },
    ];

    let currCol = ageStartCol;
    for (const b of ageBrackets) {
        ws.mergeCells(5, currCol, 5, currCol + b.span - 1);
        const bCell = ws.getCell(5, currCol);
        bCell.value = b.label;
        bCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Gender row 5 / 6: L (P, M), P (P, M)
        // L
        ws.mergeCells(6, currCol, 6, currCol);
        ws.getCell(6, currCol).value = 'L';
        ws.getCell(6, currCol).alignment = { horizontal: 'center', vertical: 'middle' };

        ws.mergeCells(6, currCol + 1, 6, currCol + 1);
        ws.getCell(6, currCol + 1).value = 'M';
        ws.getCell(6, currCol + 1).alignment = { horizontal: 'center', vertical: 'middle' };

        // P
        ws.mergeCells(6, currCol + 2, 6, currCol + 2);
        ws.getCell(6, currCol + 2).value = 'P';
        ws.getCell(6, currCol + 2).alignment = { horizontal: 'center', vertical: 'middle' };

        ws.mergeCells(6, currCol + 3, 6, currCol + 3);
        ws.getCell(6, currCol + 3).value = 'M';
        ws.getCell(6, currCol + 3).alignment = { horizontal: 'center', vertical: 'middle' };

        currCol += b.span;
    }

    // 4. TOTAL (4 cols: L(P, M), P(P, M))
    const totalStartCol = currCol;
    ws.mergeCells(4, totalStartCol, 4, totalStartCol + 3);
    const totHead = ws.getCell(4, totalStartCol);
    totHead.value = 'TOTAL';
    totHead.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells(5, totalStartCol, 5, totalStartCol + 1);
    ws.getCell(5, totalStartCol).value = 'L';
    ws.getCell(5, totalStartCol).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells(5, totalStartCol + 2, 5, totalStartCol + 3);
    ws.getCell(5, totalStartCol + 2).value = 'P';
    ws.getCell(5, totalStartCol + 2).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(6, totalStartCol).value = 'P';
    ws.getCell(6, totalStartCol).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(6, totalStartCol + 1).value = 'M';
    ws.getCell(6, totalStartCol + 1).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(6, totalStartCol + 2).value = 'P';
    ws.getCell(6, totalStartCol + 2).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(6, totalStartCol + 3).value = 'M';
    ws.getCell(6, totalStartCol + 3).alignment = { horizontal: 'center', vertical: 'middle' };

    currCol += 4;

    // 5. JUMLAH KASUS (2 cols: P, M)
    ws.mergeCells(4, currCol, 5, currCol + 1);
    const jmHead = ws.getCell(4, currCol);
    jmHead.value = 'JUMLAH KASUS';
    jmHead.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(6, currCol).value = 'P';
    ws.getCell(6, currCol).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(6, currCol + 1).value = 'M';
    ws.getCell(6, currCol + 1).alignment = { horizontal: 'center', vertical: 'middle' };

    currCol += 2;

    // 6. DI PE
    ws.mergeCells(4, currCol, 6, currCol);
    ws.getCell(4, currCol).value = 'DI PE';
    ws.getCell(4, currCol).alignment = { horizontal: 'center', vertical: 'middle' };
    currCol += 1;

    // 7. LARVASIDASI
    ws.mergeCells(4, currCol, 6, currCol);
    ws.getCell(4, currCol).value = 'LARVASIDASI';
    ws.getCell(4, currCol).alignment = { horizontal: 'center', vertical: 'middle' };
    currCol += 1;

    // 8. DIFOGGING
    ws.mergeCells(4, currCol, 6, currCol);
    ws.getCell(4, currCol).value = 'DIFOGGING';
    ws.getCell(4, currCol).alignment = { horizontal: 'center', vertical: 'middle' };
    currCol += 1;

    // 9. ABJ
    ws.mergeCells(4, currCol, 6, currCol);
    ws.getCell(4, currCol).value = 'ABJ (%)';
    ws.getCell(4, currCol).alignment = { horizontal: 'center', vertical: 'middle' };

    // Apply header style and borders across all header cells in R4, R5, R6
    for (let r = 4; r <= 6; r++) {
        ws.getRow(r).height = 18;
        for (let c = 1; c <= totalCols; c++) {
            const cell = ws.getCell(r, c);
            cell.font = headerFont;
            cell.fill = headerFill;
            cell.border = thinBorder;
        }
    }

    // Populate Data Rows starting at Row 7
    let rowIdx = 7;
    for (const r of data.rows) {
        ws.getRow(rowIdx).height = 18;
        ws.getCell(rowIdx, 1).value = r.no;
        ws.getCell(rowIdx, 1).alignment = { horizontal: 'center', vertical: 'middle' };

        if (isPuskesmasLevel) {
            ws.getCell(rowIdx, 2).value = r.kelurahan || '-';
            ws.getCell(rowIdx, 2).alignment = { horizontal: 'left', vertical: 'middle' };
            ws.getCell(rowIdx, 3).value = r.rw || '-';
            ws.getCell(rowIdx, 3).alignment = { horizontal: 'center', vertical: 'middle' };
            ws.getCell(rowIdx, 4).value = r.rt || '-';
            ws.getCell(rowIdx, 4).alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
            ws.getCell(rowIdx, 2).value = r.name;
            ws.getCell(rowIdx, 2).alignment = { horizontal: 'left', vertical: 'middle' };
        }

        const counts = [
            r.under1.l_p,
            r.under1.l_m,
            r.under1.p_p,
            r.under1.p_m,
            r.age1_4.l_p,
            r.age1_4.l_m,
            r.age1_4.p_p,
            r.age1_4.p_m,
            r.age5_14.l_p,
            r.age5_14.l_m,
            r.age5_14.p_p,
            r.age5_14.p_m,
            r.age15_44.l_p,
            r.age15_44.l_m,
            r.age15_44.p_p,
            r.age15_44.p_m,
            r.over44.l_p,
            r.over44.l_m,
            r.over44.p_p,
            r.over44.p_m,
            r.totalGender.l_p,
            r.totalGender.l_m,
            r.totalGender.p_p,
            r.totalGender.p_m,
            r.totalCases.p,
            r.totalCases.m,
            r.diPe,
            r.larvasidasi,
            r.difogging,
        ];

        for (let i = 0; i < counts.length; i++) {
            const col = offset + 1 + i;
            const val = counts[i];
            const cell = ws.getCell(rowIdx, col);
            cell.value = val === 0 ? 0 : val;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // ABJ column
        const abjCell = ws.getCell(rowIdx, totalCols);
        abjCell.value = r.abj !== null ? `${r.abj}%` : '-';
        abjCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Apply borders & font
        for (let c = 1; c <= totalCols; c++) {
            const cell = ws.getCell(rowIdx, c);
            cell.font = { name: 'Arial', size: 9 };
            cell.border = thinBorder;
        }

        rowIdx++;
    }

    // Summary / Grand Total Row
    ws.getRow(rowIdx).height = 20;
    ws.mergeCells(rowIdx, 1, rowIdx, offset);
    const sumLabel = ws.getCell(rowIdx, 1);
    sumLabel.value = 'JUMLAH';
    sumLabel.alignment = { horizontal: 'center', vertical: 'middle' };

    const totCounts = [
        data.totals.under1.l_p,
        data.totals.under1.l_m,
        data.totals.under1.p_p,
        data.totals.under1.p_m,
        data.totals.age1_4.l_p,
        data.totals.age1_4.l_m,
        data.totals.age1_4.p_p,
        data.totals.age1_4.p_m,
        data.totals.age5_14.l_p,
        data.totals.age5_14.l_m,
        data.totals.age5_14.p_p,
        data.totals.age5_14.p_m,
        data.totals.age15_44.l_p,
        data.totals.age15_44.l_m,
        data.totals.age15_44.p_p,
        data.totals.age15_44.p_m,
        data.totals.over44.l_p,
        data.totals.over44.l_m,
        data.totals.over44.p_p,
        data.totals.over44.p_m,
        data.totals.totalGender.l_p,
        data.totals.totalGender.l_m,
        data.totals.totalGender.p_p,
        data.totals.totalGender.p_m,
        data.totals.totalCases.p,
        data.totals.totalCases.m,
        data.totals.diPe,
        data.totals.larvasidasi,
        data.totals.difogging,
    ];

    for (let i = 0; i < totCounts.length; i++) {
        const col = offset + 1 + i;
        const val = totCounts[i];
        const cell = ws.getCell(rowIdx, col);
        cell.value = val;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    const totAbjCell = ws.getCell(rowIdx, totalCols);
    totAbjCell.value = data.totals.avgAbj !== null ? `${data.totals.avgAbj}%` : '-';
    totAbjCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const sumFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFCBD5E1' }, // Slate 300
    };

    for (let c = 1; c <= totalCols; c++) {
        const cell = ws.getCell(rowIdx, c);
        cell.font = { name: 'Arial', size: 9, bold: true };
        cell.fill = sumFill;
        cell.border = thinBorder;
    }

    return wb;
}

// =========================================================================
// 1. REKOMENDASI 1: SURVEILANS MINGGUAN SKDR (W1 - W52 / SHEET L2)
// =========================================================================

export function getEpiWeek(d: Date): number {
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    return Math.min(Math.max(week, 1), 52);
}

export type EpiWeekRow = {
    id: string;
    no: number;
    name: string;
    kelurahan?: string;
    rw?: string;
    rt?: string;
    rsPenemu?: string;
    weeks: number[]; // 52 columns
    total: number;
};

export type EpiWeekReportResult = {
    title: string;
    subtitle: string;
    year: number;
    level: 'kota' | 'puskesmas';
    puskesmasName?: string;
    faskesPenemu?: FaskesPenemuItem[];
    rows: EpiWeekRow[];
    totalWeeks: number[];
    grandTotal: number;
};

export async function getEpiWeekReportData(
    actor: Actor,
    params: {
        year: number;
        level?: 'kota' | 'puskesmas';
        puskesmasId?: string;
    },
): Promise<EpiWeekReportResult> {
    const db = getDb();
    const year = params.year;
    const level = actor.role === 'PUSKESMAS' ? 'puskesmas' : params.level ?? 'kota';
    const puskesmasId = actor.role === 'PUSKESMAS' ? actor.institutionId : params.puskesmasId;

    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const conditions: SQL[] = [
        gte(reportsRS.createdAt, startDate),
        lte(reportsRS.createdAt, endDate),
        ne(reportsRS.status, 'ARCHIVED_CROSS_BORDER'),
    ];

    const puskesmasList =
        level === 'kota'
            ? await db
                  .select({ id: institutions.id, name: institutions.name })
                  .from(institutions)
                  .where(eq(institutions.type, 'PUSKESMAS'))
                  .orderBy(institutions.name)
            : [];

    if (level === 'puskesmas' && puskesmasId) {
        conditions.push(eq(reportsRS.assignedPuskesmasId, puskesmasId));
    }

    const reports = await db
        .select({
            id: reportsRS.id,
            assignedPuskesmasId: reportsRS.assignedPuskesmasId,
            patientAddressEncrypted: reportsRS.patientAddressEncrypted,
            kelurahan: reportsRS.kelurahan,
            rt: reportsRS.rt,
            rw: reportsRS.rw,
            peRt: reportsPE.rt,
            peRw: reportsPE.rw,
            rsName: institutions.name,
            createdAt: reportsRS.createdAt,
        })
        .from(reportsRS)
        .leftJoin(institutions, eq(institutions.id, reportsRS.institutionId))
        .leftJoin(reportsPE, eq(reportsPE.reportRSId, reportsRS.id))
        .where(and(...conditions));

    const groupMap = new Map<
        string,
        {
            id: string;
            name: string;
            kelurahan?: string;
            rw?: string;
            rt?: string;
            rsPenemuSet: Set<string>;
            weeks: number[];
            total: number;
        }
    >();

    const faskesPenemuMap = new Map<string, number>();

    if (level === 'kota') {
        for (const p of puskesmasList) {
            groupMap.set(p.id, {
                id: p.id,
                name: p.name,
                rsPenemuSet: new Set(),
                weeks: new Array(52).fill(0),
                total: 0,
            });
        }
    }

    for (const r of reports) {
        const rsName = r.rsName || 'Faskes Luar / Mandiri';
        faskesPenemuMap.set(rsName, (faskesPenemuMap.get(rsName) || 0) + 1);

        let key = '';
        let name = '';
        let kel: string | undefined;
        let rw: string | undefined;
        let rt: string | undefined;

        if (level === 'kota') {
            key = r.assignedPuskesmasId ?? 'UNASSIGNED';
            if (!groupMap.has(key)) {
                groupMap.set(key, {
                    id: key,
                    name: 'Luar Wilayah / Belum Terpetakan',
                    rsPenemuSet: new Set(),
                    weeks: new Array(52).fill(0),
                    total: 0,
                });
            }
        } else {
            let parsedRt = (r.peRt || r.rt || '').trim();
            let parsedRw = (r.peRw || r.rw || '').trim();
            if (!parsedRt || !parsedRw) {
                let decryptedAddress = '';
                try {
                    decryptedAddress = decryptPii(r.patientAddressEncrypted);
                } catch {
                    decryptedAddress = '';
                }
                const parsed = extractRtRw(decryptedAddress);
                if (!parsedRt && parsed.rt && parsed.rt !== '-') parsedRt = parsed.rt;
                if (!parsedRw && parsed.rw && parsed.rw !== '-') parsedRw = parsed.rw;
            }
            kel = r.kelurahan || 'Kelurahan Lain';
            rw = parsedRw ? `RW ${parsedRw.replace(/\D/g, '').padStart(2, '0')}` : 'RW -';
            rt = parsedRt ? `RT ${parsedRt.replace(/\D/g, '').padStart(2, '0')}` : 'RT -';
            key = `${rw}__${rt}__${kel}`;
            name = `${kel} - ${rw} / ${rt}`;

            if (!groupMap.has(key)) {
                groupMap.set(key, {
                    id: key,
                    name,
                    kelurahan: kel,
                    rw,
                    rt,
                    rsPenemuSet: new Set(),
                    weeks: new Array(52).fill(0),
                    total: 0,
                });
            }
        }

        const week = getEpiWeek(r.createdAt);
        const entry = groupMap.get(key);
        if (entry) {
            entry.weeks[week - 1]++;
            entry.total++;
            if (r.rsName) {
                entry.rsPenemuSet.add(r.rsName);
            }
        }
    }

    const rows: EpiWeekRow[] = Array.from(groupMap.values()).map((g, idx) => ({
        id: g.id,
        no: idx + 1,
        name: g.name,
        kelurahan: g.kelurahan,
        rw: g.rw,
        rt: g.rt,
        rsPenemu: Array.from(g.rsPenemuSet).join(', ') || '-',
        weeks: g.weeks,
        total: g.total,
    }));

    const totalWeeks = new Array(52).fill(0);
    let grandTotal = 0;
    for (const row of rows) {
        for (let w = 0; w < 52; w++) {
            totalWeeks[w] += row.weeks[w];
        }
        grandTotal += row.total;
    }

    let pkmName: string | undefined;
    if (level === 'puskesmas' && puskesmasId) {
        const pkm = await db
            .select({ name: institutions.name })
            .from(institutions)
            .where(eq(institutions.id, puskesmasId))
            .limit(1);
        pkmName = pkm[0]?.name;
    }

    const faskesPenemu = Array.from(faskesPenemuMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    return {
        title: 'LAPORAN MINGGUAN EPIDEMIOLOGI SKDR (W1 - W52)',
        subtitle:
            level === 'kota'
                ? `KOTA CIREBON — TAHUN ${year}`
                : `PUSKESMAS ${(pkmName ?? '').toUpperCase()} — TAHUN ${year}`,
        year,
        level,
        puskesmasName: pkmName,
        faskesPenemu,
        rows,
        totalWeeks,
        grandTotal,
    };

    return {
        title: 'LAPORAN KASUS DEMAM BERDARAH MINGGUAN (SKDR W1-W52)',
        subtitle:
            level === 'puskesmas'
                ? `Puskesmas ${pkmName ?? ''} - Tahun ${year}`
                : `Kota Bandung - Berdasarkan Puskesmas Tahun ${year}`,
        year,
        level,
        puskesmasName: pkmName,
        rows,
        totalWeeks,
        grandTotal,
    };
}

// =========================================================================
// 2. REKOMENDASI 2: STRATIFIKASI ENDEMISITAS 3-TAHUN (SHEET SOS)
// =========================================================================

export type EndemicityStatus = 'ENDEMIS' | 'SPORADIS' | 'POTENSIAL' | 'BEBAS';

export type EndemicityRow = {
    no: number;
    kelurahan: string;
    kecamatan: string;
    casesN2: number;
    casesN1: number;
    casesN0: number;
    total3Years: number;
    avgAbj: number | null;
    status: EndemicityStatus;
    statusLabel: string;
};

export type EndemicityResult = {
    title: string;
    subtitle: string;
    currentYear: number;
    years: [number, number, number];
    rows: EndemicityRow[];
    summary: {
        endemis: number;
        sporadis: number;
        potensial: number;
        bebas: number;
        totalKelurahan: number;
    };
};

export async function getEndemicityStratification(
    actor: Actor,
    currentYear: number = new Date().getFullYear(),
): Promise<EndemicityResult> {
    const db = getDb();
    const y0 = currentYear;
    const y1 = currentYear - 1;
    const y2 = currentYear - 2;

    const start3Years = new Date(Date.UTC(y2, 0, 1));
    const end3Years = new Date(Date.UTC(y0, 11, 31, 23, 59, 59, 999));

    const reports = await db
        .select({
            id: reportsRS.id,
            kelurahan: reportsRS.kelurahan,
            kecamatan: reportsRS.kecamatan,
            createdAt: reportsRS.createdAt,
        })
        .from(reportsRS)
        .where(
            and(
                gte(reportsRS.createdAt, start3Years),
                lte(reportsRS.createdAt, end3Years),
                ne(reportsRS.status, 'ARCHIVED_CROSS_BORDER'),
            ),
        );

    const peData = await db
        .select({
            abj: reportsPE.abj,
            kelurahan: reportsRS.kelurahan,
        })
        .from(reportsPE)
        .innerJoin(reportsRS, eq(reportsPE.reportRSId, reportsRS.id))
        .where(gte(reportsPE.createdAt, start3Years));

    const kelMap = new Map<
        string,
        {
            kelurahan: string;
            kecamatan: string;
            n2: number;
            n1: number;
            n0: number;
            abjSum: number;
            abjCount: number;
        }
    >();

    for (const r of reports) {
        const kel = r.kelurahan?.trim() || 'Wilayah Lain';
        const kec = r.kecamatan?.trim() || '-';
        if (!kelMap.has(kel)) {
            kelMap.set(kel, {
                kelurahan: kel,
                kecamatan: kec,
                n2: 0,
                n1: 0,
                n0: 0,
                abjSum: 0,
                abjCount: 0,
            });
        }
        const item = kelMap.get(kel)!;
        const repYear = r.createdAt.getFullYear();
        if (repYear === y2) item.n2++;
        else if (repYear === y1) item.n1++;
        else if (repYear === y0) item.n0++;
    }

    for (const p of peData) {
        const kel = p.kelurahan?.trim() || 'Wilayah Lain';
        if (p.abj !== null && kelMap.has(kel)) {
            const item = kelMap.get(kel)!;
            const num = parseFloat(p.abj);
            if (!isNaN(num)) {
                item.abjSum += num;
                item.abjCount++;
            }
        }
    }

    const summary = {
        endemis: 0,
        sporadis: 0,
        potensial: 0,
        bebas: 0,
        totalKelurahan: kelMap.size,
    };

    const rows: EndemicityRow[] = Array.from(kelMap.values())
        .map((k, idx) => {
            const total3Years = k.n2 + k.n1 + k.n0;
            const avgAbj = k.abjCount > 0 ? Math.round((k.abjSum / k.abjCount) * 10) / 10 : null;

            let status: EndemicityStatus = 'BEBAS';
            let statusLabel = 'Bebas Kasus DBD (3 Tahun Terakhir)';

            if (k.n2 > 0 && k.n1 > 0 && k.n0 > 0) {
                status = 'ENDEMIS';
                statusLabel = 'Endemis (Kasus Tiap Tahun)';
                summary.endemis++;
            } else if (total3Years > 0) {
                status = 'SPORADIS';
                statusLabel = 'Sporadis (Kasus Tidak Berturut)';
                summary.sporadis++;
            } else if (avgAbj !== null && avgAbj < 95) {
                status = 'POTENSIAL';
                statusLabel = 'Potensial (0 Kasus, ABJ < 95%)';
                summary.potensial++;
            } else {
                status = 'BEBAS';
                statusLabel = 'Bebas DBD (0 Kasus & ABJ >= 95%)';
                summary.bebas++;
            }

            return {
                no: idx + 1,
                kelurahan: k.kelurahan,
                kecamatan: k.kecamatan,
                casesN2: k.n2,
                casesN1: k.n1,
                casesN0: k.n0,
                total3Years,
                avgAbj,
                status,
                statusLabel,
            };
        })
        .sort((a, b) => b.total3Years - a.total3Years);

    return {
        title: 'STRATIFIKASI ENDEMISITAS DBD TINGKAT KELURAHAN (ANALISIS 3 TAHUN)',
        subtitle: `Evaluasi Tren Kasus DBD ${y2}, ${y1}, dan ${y0}`,
        currentYear: y0,
        years: [y2, y1, y0],
        rows,
        summary,
    };
}

// =========================================================================
// 3. REKOMENDASI 3: REKAP KEPATUHAN WAKTU RESPON PE (SHEET LPESO)
// =========================================================================

export type PeComplianceRow = {
    no: number;
    puskesmasId: string;
    puskesmasName: string;
    totalCases: number;
    investigatedCount: number;
    under24h: number;
    hours24to72: number;
    over72h: number;
    notInvestigated: number;
    complianceRate: number;
};

export type PeComplianceResult = {
    title: string;
    subtitle: string;
    periodLabel: string;
    year: number;
    month?: number;
    rows: PeComplianceRow[];
    totals: {
        totalCases: number;
        investigatedCount: number;
        under24h: number;
        hours24to72: number;
        over72h: number;
        notInvestigated: number;
        avgComplianceRate: number;
    };
};

export async function getPeComplianceReport(
    actor: Actor,
    params: { year: number; month?: number },
): Promise<PeComplianceResult> {
    const db = getDb();
    const { year, month } = params;

    let start: Date;
    let end: Date;
    let periodLabel = `Tahun ${year}`;

    if (month) {
        start = new Date(Date.UTC(year, month - 1, 1));
        end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
        const monthNames = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        periodLabel = `Bulan ${monthNames[month - 1]} ${year}`;
    } else {
        start = new Date(Date.UTC(year, 0, 1));
        end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    }

    const puskesmasList = await db
        .select({ id: institutions.id, name: institutions.name })
        .from(institutions)
        .where(eq(institutions.type, 'PUSKESMAS'))
        .orderBy(institutions.name);

    const reports = await db
        .select({
            id: reportsRS.id,
            assignedPuskesmasId: reportsRS.assignedPuskesmasId,
            createdAt: reportsRS.createdAt,
            peDate: reportsPE.peDate,
            peStatus: reportsPE.status,
        })
        .from(reportsRS)
        .leftJoin(reportsPE, eq(reportsPE.reportRSId, reportsRS.id))
        .where(
            and(
                gte(reportsRS.createdAt, start),
                lte(reportsRS.createdAt, end),
                ne(reportsRS.status, 'ARCHIVED_CROSS_BORDER'),
            ),
        );

    const pkmMap = new Map<
        string,
        {
            id: string;
            name: string;
            total: number;
            investigated: number;
            under24: number;
            h24to72: number;
            over72: number;
            notInv: number;
        }
    >();

    for (const p of puskesmasList) {
        pkmMap.set(p.id, {
            id: p.id,
            name: p.name,
            total: 0,
            investigated: 0,
            under24: 0,
            h24to72: 0,
            over72: 0,
            notInv: 0,
        });
    }

    for (const r of reports) {
        const key = r.assignedPuskesmasId ?? 'UNASSIGNED';
        if (!pkmMap.has(key)) {
            pkmMap.set(key, {
                id: key,
                name: 'Luar Wilayah / Belum Ditugaskan',
                total: 0,
                investigated: 0,
                under24: 0,
                h24to72: 0,
                over72: 0,
                notInv: 0,
            });
        }

        const item = pkmMap.get(key)!;
        item.total++;

        if (r.peDate) {
            item.investigated++;
            const diffHours = (r.peDate.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60);
            if (diffHours <= 24) {
                item.under24++;
            } else if (diffHours <= 72) {
                item.h24to72++;
            } else {
                item.over72++;
            }
        } else {
            item.notInv++;
        }
    }

    const rows: PeComplianceRow[] = Array.from(pkmMap.values()).map((p, idx) => {
        const compliantCount = p.under24 + p.h24to72;
        const rate = p.total > 0 ? Math.round((compliantCount / p.total) * 1000) / 10 : 100;
        return {
            no: idx + 1,
            puskesmasId: p.id,
            puskesmasName: p.name,
            totalCases: p.total,
            investigatedCount: p.investigated,
            under24h: p.under24,
            hours24to72: p.h24to72,
            over72h: p.over72,
            notInvestigated: p.notInv,
            complianceRate: rate,
        };
    });

    const totals = {
        totalCases: 0,
        investigatedCount: 0,
        under24h: 0,
        hours24to72: 0,
        over72h: 0,
        notInvestigated: 0,
        avgComplianceRate: 0,
    };

    for (const r of rows) {
        totals.totalCases += r.totalCases;
        totals.investigatedCount += r.investigatedCount;
        totals.under24h += r.under24h;
        totals.hours24to72 += r.hours24to72;
        totals.over72h += r.over72h;
        totals.notInvestigated += r.notInvestigated;
    }

    const totalCompliant = totals.under24h + totals.hours24to72;
    totals.avgComplianceRate =
        totals.totalCases > 0 ? Math.round((totalCompliant / totals.totalCases) * 1000) / 10 : 100;

    return {
        title: 'LAPORAN REKAPITULASI KEPATUHAN WAKTU RESPON PE PUSKESMAS',
        subtitle: `Standar Kemenkes RI: Maksimal 72 Jam dari Laporan Masuk (${periodLabel})`,
        periodLabel,
        year,
        month,
        rows,
        totals,
    };
}

// =========================================================================
// EXCEL EXPORTERS FOR RECOMMENDATIONS 1, 2, 3
// =========================================================================

export async function generateEpiWeekWorkbook(
    data: EpiWeekReportResult,
): Promise<ExcelJS.Workbook> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'WALI-EPI Surveilans Kemenkes';
    wb.created = new Date();

    const ws = wb.addWorksheet('SKDR Mingguan W1-W52', {
        pageSetup: { orientation: 'landscape', paperSize: 9 },
    });

    const isPuskesmas = data.level === 'puskesmas';
    const locCols = isPuskesmas ? 2 : 1; // Kelurahan + RW or Puskesmas
    const totalCols = 1 + locCols + 52 + 1; // NO + Location + W1..W52 + TOTAL

    const headerFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0D9488' }, // Teal 600
    };

    const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };

    // Title
    ws.mergeCells(1, 1, 1, totalCols);
    const r1 = ws.getCell(1, 1);
    r1.value = data.title;
    r1.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF0F172A' } };
    r1.alignment = { horizontal: 'center', vertical: 'middle' };

    // Subtitle
    ws.mergeCells(2, 1, 2, totalCols);
    const r2 = ws.getCell(2, 1);
    r2.value = data.subtitle;
    r2.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF334155' } };
    r2.alignment = { horizontal: 'center', vertical: 'middle' };

    // Header Row 4
    ws.getRow(4).height = 22;
    ws.getCell(4, 1).value = 'NO';
    ws.getColumn(1).width = 5;

    let col = 2;
    if (isPuskesmas) {
        ws.getCell(4, col).value = 'KELURAHAN';
        ws.getColumn(col).width = 20;
        col++;
        ws.getCell(4, col).value = 'RW';
        ws.getColumn(col).width = 12;
        col++;
    } else {
        ws.getCell(4, col).value = 'PUSKESMAS';
        ws.getColumn(col).width = 24;
        col++;
    }

    for (let w = 1; w <= 52; w++) {
        ws.getCell(4, col).value = `W${w}`;
        ws.getColumn(col).width = 4.5;
        col++;
    }

    ws.getCell(4, col).value = 'TOTAL';
    ws.getColumn(col).width = 8;

    for (let c = 1; c <= totalCols; c++) {
        const cell = ws.getCell(4, c);
        cell.fill = headerFill;
        cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder;
    }

    let rIdx = 5;
    for (const row of data.rows) {
        ws.getCell(rIdx, 1).value = row.no;
        ws.getCell(rIdx, 1).alignment = { horizontal: 'center', vertical: 'middle' };

        let c = 2;
        if (isPuskesmas) {
            ws.getCell(rIdx, c).value = row.kelurahan || '-';
            c++;
            ws.getCell(rIdx, c).value = row.rw || '-';
            ws.getCell(rIdx, c).alignment = { horizontal: 'center', vertical: 'middle' };
            c++;
        } else {
            ws.getCell(rIdx, c).value = row.name;
            c++;
        }

        for (let w = 0; w < 52; w++) {
            ws.getCell(rIdx, c).value = row.weeks[w] || 0;
            ws.getCell(rIdx, c).alignment = { horizontal: 'center', vertical: 'middle' };
            c++;
        }

        ws.getCell(rIdx, c).value = row.total;
        ws.getCell(rIdx, c).alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getCell(rIdx, c).font = { name: 'Arial', size: 9, bold: true };

        for (let j = 1; j <= totalCols; j++) {
            ws.getCell(rIdx, j).border = thinBorder;
            if (j !== totalCols) ws.getCell(rIdx, j).font = { name: 'Arial', size: 9 };
        }
        rIdx++;
    }

    // Grand Totals Row
    ws.mergeCells(rIdx, 1, rIdx, isPuskesmas ? 3 : 2);
    ws.getCell(rIdx, 1).value = 'TOTAL KASUS MINGGUAN';
    ws.getCell(rIdx, 1).alignment = { horizontal: 'center', vertical: 'middle' };

    let c = isPuskesmas ? 4 : 3;
    for (let w = 0; w < 52; w++) {
        ws.getCell(rIdx, c).value = data.totalWeeks[w];
        ws.getCell(rIdx, c).alignment = { horizontal: 'center', vertical: 'middle' };
        c++;
    }

    ws.getCell(rIdx, c).value = data.grandTotal;
    ws.getCell(rIdx, c).alignment = { horizontal: 'center', vertical: 'middle' };

    const sumFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFCBD5E1' },
    };

    for (let j = 1; j <= totalCols; j++) {
        const cell = ws.getCell(rIdx, j);
        cell.fill = sumFill;
        cell.font = { name: 'Arial', size: 9, bold: true };
        cell.border = thinBorder;
    }

    return wb;
}

export async function generateEndemicityWorkbook(
    data: EndemicityResult,
): Promise<ExcelJS.Workbook> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'WALI-EPI Surveilans Kemenkes';
    const ws = wb.addWorksheet('Stratifikasi Endemisitas', {
        pageSetup: { orientation: 'portrait', paperSize: 9 },
    });

    const totalCols = 9;

    ws.mergeCells(1, 1, 1, totalCols);
    ws.getCell(1, 1).value = data.title;
    ws.getCell(1, 1).font = { name: 'Arial', size: 12, bold: true };
    ws.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells(2, 1, 2, totalCols);
    ws.getCell(2, 1).value = data.subtitle;
    ws.getCell(2, 1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF334155' } };
    ws.getCell(2, 1).alignment = { horizontal: 'center', vertical: 'middle' };

    const headerFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0D9488' },
    };

    const headers = [
        'NO',
        'KELURAHAN',
        'KECAMATAN',
        `KASUS ${data.years[0]}`,
        `KASUS ${data.years[1]}`,
        `KASUS ${data.years[2]}`,
        'TOTAL 3 TH',
        'ABJ RATA2',
        'STATUS STRATIFIKASI',
    ];

    ws.getRow(4).height = 24;
    headers.forEach((h, i) => {
        const cell = ws.getCell(4, i + 1);
        cell.value = h;
        cell.fill = headerFill;
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 24;
    ws.getColumn(3).width = 20;
    ws.getColumn(4).width = 12;
    ws.getColumn(5).width = 12;
    ws.getColumn(6).width = 12;
    ws.getColumn(7).width = 12;
    ws.getColumn(8).width = 12;
    ws.getColumn(9).width = 32;

    let rIdx = 5;
    for (const r of data.rows) {
        ws.getCell(rIdx, 1).value = r.no;
        ws.getCell(rIdx, 2).value = r.kelurahan;
        ws.getCell(rIdx, 3).value = r.kecamatan;
        ws.getCell(rIdx, 4).value = r.casesN2;
        ws.getCell(rIdx, 5).value = r.casesN1;
        ws.getCell(rIdx, 6).value = r.casesN0;
        ws.getCell(rIdx, 7).value = r.total3Years;
        ws.getCell(rIdx, 8).value = r.avgAbj !== null ? `${r.avgAbj}%` : '-';
        ws.getCell(rIdx, 9).value = r.statusLabel;

        for (let c = 1; c <= totalCols; c++) {
            const cell = ws.getCell(rIdx, c);
            cell.font = { name: 'Arial', size: 9 };
            if (c === 1 || (c >= 4 && c <= 8)) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            };
        }
        rIdx++;
    }

    return wb;
}

export async function generatePeComplianceWorkbook(
    data: PeComplianceResult,
): Promise<ExcelJS.Workbook> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'WALI-EPI Surveilans Kemenkes';
    const ws = wb.addWorksheet('Kepatuhan Respon PE', {
        pageSetup: { orientation: 'landscape', paperSize: 9 },
    });

    const totalCols = 9;

    ws.mergeCells(1, 1, 1, totalCols);
    ws.getCell(1, 1).value = data.title;
    ws.getCell(1, 1).font = { name: 'Arial', size: 12, bold: true };
    ws.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells(2, 1, 2, totalCols);
    ws.getCell(2, 1).value = data.subtitle;
    ws.getCell(2, 1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF334155' } };
    ws.getCell(2, 1).alignment = { horizontal: 'center', vertical: 'middle' };

    const headerFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0D9488' },
    };

    const headers = [
        'NO',
        'PUSKESMAS',
        'TOTAL KASUS',
        'SUDAH DI-PE',
        '< 24 JAM (DINI)',
        '24-72 JAM (STANDAR)',
        '> 72 JAM (LEWAT SLA)',
        'BELUM PE',
        '% KEPATUHAN (<= 72 JAM)',
    ];

    ws.getRow(4).height = 24;
    headers.forEach((h, i) => {
        const cell = ws.getCell(4, i + 1);
        cell.value = h;
        cell.fill = headerFill;
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 26;
    ws.getColumn(3).width = 14;
    ws.getColumn(4).width = 14;
    ws.getColumn(5).width = 16;
    ws.getColumn(6).width = 18;
    ws.getColumn(7).width = 18;
    ws.getColumn(8).width = 14;
    ws.getColumn(9).width = 24;

    let rIdx = 5;
    for (const r of data.rows) {
        ws.getCell(rIdx, 1).value = r.no;
        ws.getCell(rIdx, 2).value = r.puskesmasName;
        ws.getCell(rIdx, 3).value = r.totalCases;
        ws.getCell(rIdx, 4).value = r.investigatedCount;
        ws.getCell(rIdx, 5).value = r.under24h;
        ws.getCell(rIdx, 6).value = r.hours24to72;
        ws.getCell(rIdx, 7).value = r.over72h;
        ws.getCell(rIdx, 8).value = r.notInvestigated;
        ws.getCell(rIdx, 9).value = `${r.complianceRate}%`;

        for (let c = 1; c <= totalCols; c++) {
            const cell = ws.getCell(rIdx, c);
            cell.font = { name: 'Arial', size: 9 };
            if (c === 1 || c >= 3) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            };
        }
        rIdx++;
    }

    // Totals
    ws.mergeCells(rIdx, 1, rIdx, 2);
    ws.getCell(rIdx, 1).value = 'TOTAL KOTA';
    ws.getCell(rIdx, 3).value = data.totals.totalCases;
    ws.getCell(rIdx, 4).value = data.totals.investigatedCount;
    ws.getCell(rIdx, 5).value = data.totals.under24h;
    ws.getCell(rIdx, 6).value = data.totals.hours24to72;
    ws.getCell(rIdx, 7).value = data.totals.over72h;
    ws.getCell(rIdx, 8).value = data.totals.notInvestigated;
    ws.getCell(rIdx, 9).value = `${data.totals.avgComplianceRate}%`;

    const sumFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFCBD5E1' },
    };

    for (let c = 1; c <= totalCols; c++) {
        const cell = ws.getCell(rIdx, c);
        cell.fill = sumFill;
        cell.font = { name: 'Arial', size: 9, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
    }

    return wb;
}
