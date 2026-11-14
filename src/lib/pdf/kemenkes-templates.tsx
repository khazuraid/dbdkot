import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ReportDetail } from '@/lib/domain/report-detail';

const styles = StyleSheet.create({
    page: {
        paddingTop: 32,
        paddingBottom: 40,
        paddingHorizontal: 38,
        fontSize: 9.5,
        fontFamily: 'Helvetica',
        color: '#111827',
        lineHeight: 1.4,
    },
    kopWrapper: {
        borderBottomWidth: 2,
        borderBottomColor: '#111827',
        paddingBottom: 6,
        marginBottom: 3,
        alignItems: 'center',
    },
    kopThinLine: {
        borderBottomWidth: 0.75,
        borderBottomColor: '#111827',
        marginBottom: 12,
    },
    kopLine1: {
        fontSize: 10.5,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    kopLine2: {
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 1,
    },
    kopLine3: {
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginTop: 1,
    },
    kopSub: {
        fontSize: 8,
        color: '#374151',
        marginTop: 2,
    },
    docHeadingCenter: {
        textAlign: 'center',
        marginBottom: 10,
    },
    docTitle: {
        fontSize: 11.5,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    docSubtitle: {
        fontSize: 9,
        color: '#374151',
        marginTop: 2,
    },
    lampiranTag: {
        fontSize: 8.5,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    metaGrid: {
        marginBottom: 8,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 2.5,
        alignItems: 'flex-start',
    },
    numCol: { width: 16, fontSize: 9.5 },
    label: { width: 165, fontSize: 9.5, color: '#1f2937' },
    colon: { width: 10, fontSize: 9.5 },
    value: { flex: 1, fontSize: 9.5, fontWeight: 'bold' },
    valueRegular: { flex: 1, fontSize: 9.5 },
    section: {
        marginTop: 8,
        marginBottom: 4,
    },
    sectionHeader: {
        fontSize: 9.5,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        backgroundColor: '#f3f4f6',
        borderWidth: 0.75,
        borderColor: '#111827',
        paddingVertical: 3.5,
        paddingHorizontal: 6,
        marginBottom: 5,
    },
    table: {
        borderWidth: 0.75,
        borderColor: '#111827',
        marginTop: 3,
        marginBottom: 4,
    },
    tableRowHeader: {
        flexDirection: 'row',
        backgroundColor: '#e5e7eb',
        borderBottomWidth: 0.75,
        borderBottomColor: '#111827',
        fontWeight: 'bold',
        fontSize: 8.5,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#6b7280',
        fontSize: 8.5,
    },
    tableRowLast: {
        flexDirection: 'row',
        fontSize: 8.5,
    },
    cell: {
        paddingVertical: 3,
        paddingHorizontal: 4,
        borderRightWidth: 0.5,
        borderRightColor: '#6b7280',
    },
    cellLast: {
        paddingVertical: 3,
        paddingHorizontal: 4,
    },
    noteText: {
        fontSize: 8,
        fontStyle: 'italic',
        color: '#374151',
        marginTop: 2,
    },
    box: {
        borderWidth: 1,
        borderColor: '#111827',
        padding: 8,
        marginTop: 8,
        marginBottom: 6,
    },
    checkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 3,
    },
    checkBox: {
        width: 11,
        height: 11,
        borderWidth: 0.85,
        borderColor: '#111827',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 4,
    },
    checkMark: {
        fontSize: 8,
        fontWeight: 'bold',
        lineHeight: 1,
    },
    sigContainer: {
        marginTop: 18,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    sigBox: {
        width: '45%',
        alignItems: 'center',
    },
    sigSpace: {
        height: 44,
    },
    sigName: {
        fontWeight: 'bold',
        textDecoration: 'underline',
    },
    sigNip: {
        fontSize: 8.5,
        marginTop: 2,
    },
    letterHeaderTable: {
        marginBottom: 10,
    },
    letterBody: {
        fontSize: 9.5,
        lineHeight: 1.5,
        textAlign: 'justify',
        marginBottom: 8,
    },
    pageFooter: {
        position: 'absolute',
        bottom: 16,
        left: 38,
        right: 38,
        flexDirection: 'row',
        justifyContent: 'space-between',
        fontSize: 7.5,
        color: '#6b7280',
        borderTopWidth: 0.5,
        borderTopColor: '#d1d5db',
        paddingTop: 4,
    },
});

export type PeHouseholdPdfRow = {
    address: string;
    houseCount: number;
    population: number;
    larvaCount: number;
    larvaType: string | null;
    abateUsed: boolean;
};

type PeFormData = {
    clinicalSymptoms?: string[];
    labRdtNs1?: string;
    labIgm?: string;
    labIgg?: string;
    labPlatelet?: number | null;
    labHematocrit?: number | null;
    hasOtherDenguePatients?: boolean;
    respondentAge?: number | null;
    respondentAddress?: string | null;
    respondentJob?: string | null;
    patientJob?: string | null;
    mainComplaint?: string | null;
    symptomOnsetDate?: string | null;
    firstActionTaken?: string | null;
    dengueAttackOrder?: string | null;
    comorbidity?: string | null;
    treatmentGiven?: string | null;
    currentPatientCondition?: string | null;
    additionalNotes?: string | null;
    sourceLocation?: string | null;
    [key: string]: unknown;
};

function fmtDate(val: Date | string | null | undefined): string {
    if (!val) return '-';
    const d = val instanceof Date ? val : new Date(val);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}

function fmtShortDate(val: Date | string | null | undefined): string {
    if (!val) return '-';
    const d = val instanceof Date ? val : new Date(val);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function fmtLabResult(val: string | null | undefined): string {
    if (!val || val === 'TIDAK_DIPERIKSA') return 'Tidak Diperiksa';
    if (val === 'POSITIF') return 'POSITIF (+)';
    if (val === 'NEGATIF') return 'NEGATIF (-)';
    return val;
}

function getFormData(report: ReportDetail): PeFormData {
    return (report.pe?.formData ?? {}) as PeFormData;
}

function KopSurat({
    report,
    unitTitle,
}: {
    report: ReportDetail;
    unitTitle?: string;
}) {
    const cityLabel = report.kota
        ? `PEMERINTAH ${report.kota.toUpperCase()}`
        : 'PEMERINTAH KABUPATEN / KOTA';
    const unit =
        unitTitle ??
        (report.assignedPuskesmasName
            ? `UPTD ${report.assignedPuskesmasName.toUpperCase()}`
            : 'UPTD PUSKESMAS WILAYAH KERJA');

    return (
        <View>
            <View style={styles.kopWrapper}>
                <Text style={styles.kopLine1}>{cityLabel}</Text>
                <Text style={styles.kopLine2}>DINAS KESEHATAN</Text>
                <Text style={styles.kopLine3}>{unit}</Text>
                <Text style={styles.kopSub}>
                    Sistem Surveilans Epidemiologi Demam Berdarah Dengue
                    (WALI-EPI) · Standar Kemenkes RI
                </Text>
            </View>
            <View style={styles.kopThinLine} />
        </View>
    );
}

function CheckBox({ checked }: { checked: boolean }) {
    return (
        <View style={styles.checkBox}>
            <Text style={styles.checkMark}>{checked ? 'V' : ''}</Text>
        </View>
    );
}

function renderPeFormulirPages(
    report: ReportDetail,
    households: PeHouseholdPdfRow[],
) {
    const fd = getFormData(report);
    const abj = report.pe?.abj ?? '-';
    const hi = report.pe?.houseIndex ?? '-';
    const ci = report.pe?.containerIndex ?? '-';
    const bi = report.pe?.breteauIndex ?? '-';
    const isPositif = report.pe?.transmissionRisk === 'POSITIF_PENULARAN';
    const fogging = Boolean(report.pe?.foggingRecommended);
    const symptoms = Array.isArray(fd.clinicalSymptoms)
        ? fd.clinicalSymptoms
        : [];
    const baseSymptoms = [
        'Demam',
        'Mual',
        'Muntah',
        'Sakit kepala',
        'Tidak nafsu makan',
    ];
    const extraSymptoms = symptoms.filter(
        (s) => !baseSymptoms.some((b) => b.toLowerCase() === s.toLowerCase()),
    );
    const allSymptomRows = [...baseSymptoms, ...extraSymptoms];

    const ns1 = fd.labRdtNs1 ?? report.dengueBlot;
    const igm = fd.labIgm ?? report.igm;
    const igg = fd.labIgg ?? report.igg;
    const platelet = fd.labPlatelet ?? report.plateletCount;
    const hematocrit = fd.labHematocrit ?? report.hematocrit;
    const onsetDate = fd.symptomOnsetDate ?? report.symptomOnsetDate;

    const totalAbate = households.filter((h) => h.abateUsed).length;
    const totalPositiveHouses = report.pe?.housesPositive ?? households.filter((h) => h.larvaCount > 0).length;

    const pages: React.ReactNode[] = [];

    // PAGE 1: Formulir Utama (Identitas Responden, Penderita, Penyakit, Lab, Ringkasan Jentik & Pengesahan)
    pages.push(
        <Page key="pe-main-1" size="A4" style={styles.page}>
            <KopSurat report={report} />

            <View style={styles.docHeadingCenter}>
                <Text style={styles.docTitle}>
                    FORMAT PENYELIDIKAN EPIDEMIOLOGI KASUS DEMAM BERDARAH DENGUE
                </Text>
                <Text style={styles.docSubtitle}>
                    Nomor Kasus: {report.reportNumber} · Tanggal Penyelidikan:{' '}
                    {fmtDate(report.pe?.peDate)}
                </Text>
            </View>

            {/* A. IDENTITAS KEPALA KELUARGA (RESPONDEN) */}
            <View style={styles.section}>
                <Text style={styles.sectionHeader}>
                    I. Identitas Kepala Keluarga (Responden)
                </Text>
                <View style={styles.row}>
                    <Text style={styles.numCol}>1.</Text>
                    <Text style={styles.label}>Nama Kepala Keluarga / Responden</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.value}>
                        {report.pe?.respondentName ?? '-'}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.numCol}>2.</Text>
                    <Text style={styles.label}>Umur</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>
                        {fd.respondentAge ? `${fd.respondentAge} tahun` : '-'}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.numCol}>3.</Text>
                    <Text style={styles.label}>Alamat Lengkap</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>
                        {fd.respondentAddress ?? report.patient.address}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.numCol}>4.</Text>
                    <Text style={styles.label}>Kelurahan / Kecamatan</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>
                        Kel. {report.kelurahan ?? '-'} / Kec.{' '}
                        {report.kecamatan ?? '-'}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.numCol}>5.</Text>
                    <Text style={styles.label}>Kota / Kabupaten</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>
                        {report.kota ?? '-'}, {report.provinsi ?? '-'}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.numCol}>6.</Text>
                    <Text style={styles.label}>Pekerjaan Responden</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>
                        {fd.respondentJob ?? '-'}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.numCol}>7.</Text>
                    <Text style={styles.label}>Hubungan dengan Penderita</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>
                        {report.pe?.respondentRelation ?? '-'}
                    </Text>
                </View>
            </View>

            {/* B. IDENTITAS PENDERITA */}
            <View style={styles.section}>
                <Text style={styles.sectionHeader}>
                    II. Identitas Penderita (Kasus Indeks)
                </Text>
                <View style={styles.row}>
                    <Text style={styles.numCol}>1.</Text>
                    <Text style={styles.label}>Nama Penderita</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.value}>{report.patient.name}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.numCol}>2.</Text>
                    <Text style={styles.label}>NIK</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>{report.patient.nik}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.numCol}>3.</Text>
                    <Text style={styles.label}>Umur / Jenis Kelamin</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>
                        {report.patient.age} tahun /{' '}
                        {report.patient.gender === 'L'
                            ? 'Laki-laki'
                            : 'Perempuan'}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.numCol}>4.</Text>
                    <Text style={styles.label}>Pekerjaan / Sekolah</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>
                        {fd.patientJob ?? '-'}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.numCol}>5.</Text>
                    <Text style={styles.label}>Fasilitas Pelapor & Diagnosis</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>
                        {report.institutionName ?? '-'} ({report.caseType}
                        {report.diagnosis ? ` · ${report.diagnosis}` : ''})
                    </Text>
                </View>
            </View>

            {/* C. IDENTITAS PENYAKIT */}
            <View style={styles.section}>
                <Text style={styles.sectionHeader}>
                    III. Identitas Penyakit & Riwayat Klinis
                </Text>
                <View style={styles.row}>
                    <Text style={styles.numCol}>1.</Text>
                    <Text style={styles.label}>Keluhan / Gejala Utama</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>
                        {fd.mainComplaint ?? '-'}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.numCol}>2.</Text>
                    <Text style={styles.label}>Tanggal Mulai Gejala (Onset)</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>
                        {fmtDate(onsetDate)}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.numCol}>3.</Text>
                    <Text style={styles.label}>Tindakan Pertama Saat Sakit</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>
                        {fd.firstActionTaken ?? '-'}
                    </Text>
                </View>

                <Text style={{ fontSize: 9, fontWeight: 'bold', marginTop: 4, marginBottom: 2 }}>
                    4. Daftar Gejala Klinis yang Timbul:
                </Text>
                <View style={styles.table}>
                    <View style={styles.tableRowHeader}>
                        <Text style={[styles.cell, { width: 28, textAlign: 'center' }]}>
                            No.
                        </Text>
                        <Text style={[styles.cell, { flex: 2 }]}>Gejala</Text>
                        <Text style={[styles.cell, { width: 95, textAlign: 'center' }]}>
                            Status
                        </Text>
                        <Text style={[styles.cellLast, { flex: 1 }]}>
                            Keterangan
                        </Text>
                    </View>
                    {allSymptomRows.map((sym, idx) => {
                        const present = symptoms.some(
                            (s) => s.toLowerCase() === sym.toLowerCase(),
                        );
                        const isLast = idx === allSymptomRows.length - 1;
                        return (
                            <View
                                key={sym}
                                style={isLast ? styles.tableRowLast : styles.tableRow}
                            >
                                <Text style={[styles.cell, { width: 28, textAlign: 'center' }]}>
                                    {idx + 1}
                                </Text>
                                <Text style={[styles.cell, { flex: 2 }]}>{sym}</Text>
                                <Text
                                    style={[
                                        styles.cell,
                                        {
                                            width: 95,
                                            textAlign: 'center',
                                            fontWeight: present ? 'bold' : 'normal',
                                        },
                                    ]}
                                >
                                    {present ? 'Ada (Ya)' : 'Tidak'}
                                </Text>
                                <Text style={[styles.cellLast, { flex: 1 }]}>
                                    {present ? fmtShortDate(onsetDate) : '-'}
                                </Text>
                            </View>
                        );
                    })}
                </View>

                <View style={styles.row}>
                    <Text style={styles.numCol}>5.</Text>
                    <Text style={styles.label}>Serangan DBD yang ke berapa</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>
                        {fd.dengueAttackOrder ?? 'Kesatu'}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.numCol}>6.</Text>
                    <Text style={styles.label}>Penyakit Penyerta (Komorbid)</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>
                        {fd.comorbidity ? `Ya (${fd.comorbidity})` : 'Tidak ada'}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.numCol}>7.</Text>
                    <Text style={styles.label}>
                        Penderita DBD/Demam lain di sekitar
                    </Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>
                        {fd.hasOtherDenguePatients
                            ? `Ada (${report.pe?.otherFeverCasesCount ?? 0} kasus demam serupa)`
                            : `Tidak (${report.pe?.otherFeverCasesCount ?? 0} kasus demam lain)`}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.numCol}>8.</Text>
                    <Text style={styles.label}>
                        Riwayat Bepergian (7–14 hari terakhir)
                    </Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>
                        {report.pe?.travelHistory14d
                            ? `Ya — ${report.pe.travelHistory14d}`
                            : 'Tidak bepergian'}
                    </Text>
                </View>
            </View>

            <View style={styles.pageFooter} fixed>
                <Text>
                    WALI-EPI · Format Penyelidikan Epidemiologi DBD ({report.reportNumber})
                </Text>
                <Text
                    render={({ pageNumber, totalPages }) =>
                        `Halaman ${pageNumber} dari ${totalPages}`
                    }
                />
            </View>
        </Page>,
    );

    // PAGE 2: Spesimen Diperiksa, Ringkasan Pemeriksaan Jentik, Pengobatan & Kondisi Terakhir, Pengesahan
    pages.push(
        <Page key="pe-main-2" size="A4" style={styles.page}>
            <KopSurat report={report} />

            {/* D. SPESIMEN DIPERIKSA */}
            <View style={styles.section}>
                <Text style={styles.sectionHeader}>
                    IV. Spesimen Diperiksa & Hasil Laboratorium
                </Text>
                <View style={styles.table}>
                    <View style={styles.tableRowHeader}>
                        <Text style={[styles.cell, { width: 28, textAlign: 'center' }]}>
                            No.
                        </Text>
                        <Text style={[styles.cell, { flex: 1.5 }]}>
                            Jenis Sampel Diperiksa
                        </Text>
                        <Text style={[styles.cell, { flex: 1.2 }]}>
                            Hasil Laboratorium
                        </Text>
                        <Text style={[styles.cellLast, { flex: 1.3 }]}>
                            Keterangan
                        </Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={[styles.cell, { width: 28, textAlign: 'center' }]}>1</Text>
                        <Text style={[styles.cell, { flex: 1.5 }]}>Dengue IgG</Text>
                        <Text style={[styles.cell, { flex: 1.2, fontWeight: 'bold' }]}>
                            {fmtLabResult(igg)}
                        </Text>
                        <Text style={[styles.cellLast, { flex: 1.3 }]}>
                            RDT / Serologi RS/PKM
                        </Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={[styles.cell, { width: 28, textAlign: 'center' }]}>2</Text>
                        <Text style={[styles.cell, { flex: 1.5 }]}>Dengue IgM</Text>
                        <Text style={[styles.cell, { flex: 1.2, fontWeight: 'bold' }]}>
                            {fmtLabResult(igm)}
                        </Text>
                        <Text style={[styles.cellLast, { flex: 1.3 }]}>
                            RDT / Serologi RS/PKM
                        </Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={[styles.cell, { width: 28, textAlign: 'center' }]}>3</Text>
                        <Text style={[styles.cell, { flex: 1.5 }]}>NS1 (Antigen Dengue)</Text>
                        <Text style={[styles.cell, { flex: 1.2, fontWeight: 'bold' }]}>
                            {fmtLabResult(ns1)}
                        </Text>
                        <Text style={[styles.cellLast, { flex: 1.3 }]}>
                            Pemeriksaan Antigen Awal
                        </Text>
                    </View>
                    <View style={styles.tableRowLast}>
                        <Text style={[styles.cell, { width: 28, textAlign: 'center' }]}>4</Text>
                        <Text style={[styles.cell, { flex: 1.5 }]}>
                            Trombosit / Hematokrit
                        </Text>
                        <Text style={[styles.cell, { flex: 1.2, fontWeight: 'bold' }]}>
                            {platelet ? `${platelet.toLocaleString('id-ID')} /uL` : '-'} |{' '}
                            {hematocrit ? `${hematocrit}%` : '-'}
                        </Text>
                        <Text style={[styles.cellLast, { flex: 1.3 }]}>
                            Parameter Hematologi
                        </Text>
                    </View>
                </View>
                <Text style={styles.noteText}>
                    * Ambil darah dari ujung jari teteskan ke &quot;popper disc&quot; hingga penuh apabila dilakukan pemeriksaan RDT ulang di lapangan.
                </Text>
            </View>

            {/* E. RINGKASAN PEMERIKSAAN JENTIK */}
            <View style={styles.section}>
                <Text style={styles.sectionHeader}>
                    V. Rekapitulasi Pemeriksaan Jentik (Radius 100 Meter)
                </Text>
                <View style={styles.table}>
                    <View style={styles.tableRowHeader}>
                        <Text style={[styles.cell, { flex: 1.4 }]}>Parameter Survei</Text>
                        <Text style={[styles.cell, { width: 85, textAlign: 'right' }]}>
                            Hasil
                        </Text>
                        <Text style={[styles.cellLast, { flex: 1.6 }]}>
                            Standar / Keterangan
                        </Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={[styles.cell, { flex: 1.4 }]}>
                            Jumlah Rumah Diperiksa / Positif Jentik
                        </Text>
                        <Text style={[styles.cell, { width: 85, textAlign: 'right', fontWeight: 'bold' }]}>
                            {report.pe?.housesInspected ?? households.length} / {totalPositiveHouses}
                        </Text>
                        <Text style={[styles.cellLast, { flex: 1.6 }]}>
                            Rincian per rumah pada Lampiran 1
                        </Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={[styles.cell, { flex: 1.4 }]}>
                            Kontainer (TPA) Diperiksa / Positif
                        </Text>
                        <Text style={[styles.cell, { width: 85, textAlign: 'right', fontWeight: 'bold' }]}>
                            {report.pe?.containersInspected ?? '-'} /{' '}
                            {report.pe?.containersPositive ?? '-'}
                        </Text>
                        <Text style={[styles.cellLast, { flex: 1.6 }]}>
                            TPA dalam &amp; luar rumah
                        </Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={[styles.cell, { flex: 1.4 }]}>
                            Angka Bebas Jentik (ABJ)
                        </Text>
                        <Text style={[styles.cell, { width: 85, textAlign: 'right', fontWeight: 'bold' }]}>
                            {abj}%
                        </Text>
                        <Text style={[styles.cellLast, { flex: 1.6 }]}>
                            Target Nasional Kemenkes &gt;= 95%
                        </Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={[styles.cell, { flex: 1.4 }]}>
                            House Index (HI) / Container Index (CI)
                        </Text>
                        <Text style={[styles.cell, { width: 85, textAlign: 'right', fontWeight: 'bold' }]}>
                            {hi}% / {ci}%
                        </Text>
                        <Text style={[styles.cellLast, { flex: 1.6 }]}>
                            Ambang batas penularan HI &gt;= 5%
                        </Text>
                    </View>
                    <View style={styles.tableRowLast}>
                        <Text style={[styles.cell, { flex: 1.4 }]}>
                            Breteau Index (BI) / Abatisasi
                        </Text>
                        <Text style={[styles.cell, { width: 85, textAlign: 'right', fontWeight: 'bold' }]}>
                            {bi}% / {totalAbate} rmn
                        </Text>
                        <Text style={[styles.cellLast, { flex: 1.6 }]}>
                            Sumber jentik: {(fd.sourceLocation as string | undefined) ?? '-'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* F. PENGOBATAN DAN KONDISI TERAKHIR */}
            <View style={styles.section}>
                <Text style={styles.sectionHeader}>
                    VI. Pengobatan dan Kondisi Terakhir Penderita
                </Text>
                <View style={styles.row}>
                    <Text style={styles.numCol}>1.</Text>
                    <Text style={styles.label}>Perawatan yang diberikan</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>
                        {fd.treatmentGiven ?? '-'}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.numCol}>2.</Text>
                    <Text style={styles.label}>Keadaan penderita saat ini</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.value}>
                        {fd.currentPatientCondition ?? 'Dalam perawatan'}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.numCol}>3.</Text>
                    <Text style={styles.label}>Kesimpulan & Rekomendasi PE</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.value}>
                        {isPositif
                            ? 'POSITIF PENULARAN'
                            : 'NEGATIF PENULARAN'}{' '}
                        — {report.pe?.recommendation ?? '-'}
                    </Text>
                </View>
            </View>

            {/* PENGESAHAN 2 KOLOM */}
            <View style={styles.sigContainer}>
                <View style={styles.sigBox}>
                    <Text>Mengetahui,</Text>
                    <Text>
                        Kepala UPTD{' '}
                        {report.assignedPuskesmasName ?? 'Puskesmas'}
                    </Text>
                    <View style={styles.sigSpace} />
                    <Text style={styles.sigName}>
                        {report.pe?.headOfPuskesmasName ||
                            '( _________________________ )'}
                    </Text>
                    <Text style={styles.sigNip}>
                        NIP.{' '}
                        {report.pe?.headOfPuskesmasNip ||
                            '..............................'}
                    </Text>
                </View>

                <View style={styles.sigBox}>
                    <Text>
                        {report.kota ?? 'Setempat'}, {fmtDate(report.pe?.peDate)}
                    </Text>
                    <Text>Pengelola Program Surveilans / DBD</Text>
                    <View style={styles.sigSpace} />
                    <Text style={styles.sigName}>
                        {report.pe?.officerName ??
                            '( _________________________ )'}
                    </Text>
                    <Text style={styles.sigNip}>
                        NIP.{' '}
                        {report.pe?.officerNip ||
                            '..............................'}
                    </Text>
                </View>
            </View>

            <View style={styles.pageFooter} fixed>
                <Text>
                    WALI-EPI · Format Penyelidikan Epidemiologi DBD ({report.reportNumber})
                </Text>
                <Text
                    render={({ pageNumber, totalPages }) =>
                        `Halaman ${pageNumber} dari ${totalPages}`
                    }
                />
            </View>
        </Page>,
    );

    // PAGE 3+: LAMPIRAN 1 - FORMULIR PENYELIDIKAN EPIDEMIOLOGIS (PE) TABEL 40+ RUMAH
    pages.push(
        <Page key="pe-lampiran-1" size="A4" style={styles.page}>
            <Text style={styles.lampiranTag}>Lampiran 1 (Formulir PE)</Text>
            <View style={styles.docHeadingCenter}>
                <Text style={styles.docTitle}>
                    FORMULIR PENYELIDIKAN EPIDEMIOLOGIS (PE)
                </Text>
                <Text style={styles.docSubtitle}>
                    Pemeriksaan Jentik Rumah &amp; Pemantauan Kontak Radius 100
                    Meter
                </Text>
            </View>

            <View style={styles.metaGrid}>
                <View style={styles.row}>
                    <Text style={styles.label}>Nama Penderita / No. Kasus</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.value}>
                        {report.patient.name} ({report.reportNumber})
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Nama KK / Responden</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>
                        {report.pe?.respondentName ?? '-'}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Alamat</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>
                        {report.patient.address}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Kelurahan/Desa · Kecamatan</Text>
                    <Text style={styles.colon}>:</Text>
                    <Text style={styles.valueRegular}>
                        Kel. {report.kelurahan ?? '-'} · Kec.{' '}
                        {report.kecamatan ?? '-'}
                    </Text>
                </View>
            </View>

            <View style={styles.table}>
                <View style={styles.tableRowHeader} fixed>
                    <Text style={[styles.cell, { width: 26, textAlign: 'center' }]}>
                        No.
                    </Text>
                    <Text style={[styles.cell, { flex: 2.3 }]}>
                        Nama KK / Alamat Rumah
                    </Text>
                    <Text style={[styles.cell, { width: 46, textAlign: 'right' }]}>
                        Rumah
                    </Text>
                    <Text style={[styles.cell, { width: 52, textAlign: 'right' }]}>
                        Penghuni
                    </Text>
                    <Text style={[styles.cell, { width: 54, textAlign: 'center' }]}>
                        Jentik (+/-)
                    </Text>
                    <Text style={[styles.cell, { flex: 1.1 }]}>
                        Jenis Jentik
                    </Text>
                    <Text style={[styles.cellLast, { width: 52, textAlign: 'center' }]}>
                        Abatisasi
                    </Text>
                </View>

                {households.length === 0 ? (
                    <View style={styles.tableRowLast}>
                        <Text style={[styles.cellLast, { flex: 1, textAlign: 'center', padding: 8 }]}>
                            Belum ada baris rumah pemeriksaan jentik tercatat.
                        </Text>
                    </View>
                ) : (
                    households.map((h, idx) => {
                        const isLast = idx === households.length - 1;
                        return (
                            <View
                                key={`${h.address}-${idx}`}
                                wrap={false}
                                style={isLast ? styles.tableRowLast : styles.tableRow}
                            >
                                <Text style={[styles.cell, { width: 26, textAlign: 'center' }]}>
                                    {idx + 1}
                                </Text>
                                <Text style={[styles.cell, { flex: 2.3 }]}>
                                    {h.address}
                                </Text>
                                <Text style={[styles.cell, { width: 46, textAlign: 'right' }]}>
                                    {h.houseCount}
                                </Text>
                                <Text style={[styles.cell, { width: 52, textAlign: 'right' }]}>
                                    {h.population}
                                </Text>
                                <Text
                                    style={[
                                        styles.cell,
                                        {
                                            width: 54,
                                            textAlign: 'center',
                                            fontWeight: h.larvaCount > 0 ? 'bold' : 'normal',
                                        },
                                    ]}
                                >
                                    {h.larvaCount > 0 ? `+ (${h.larvaCount})` : '- (0)'}
                                </Text>
                                <Text style={[styles.cell, { flex: 1.1 }]}>
                                    {h.larvaCount > 0 ? h.larvaType ?? 'Aedes' : '-'}
                                </Text>
                                <Text style={[styles.cellLast, { width: 52, textAlign: 'center' }]}>
                                    {h.abateUsed ? 'Ya' : 'Tidak'}
                                </Text>
                            </View>
                        );
                    })
                )}
            </View>

            <Text style={styles.noteText}>
                *) Termasuk yang menderita panas +/- 1 minggu yang lalu · Total diperiksa:{' '}
                {report.pe?.housesInspected ?? households.length} rumah · Positif jentik:{' '}
                {totalPositiveHouses} rumah · ABJ: {abj}% · HI: {hi}% · CI: {ci}% · BI: {bi}%
            </Text>

            <View wrap={false}>
                <View style={[styles.row, { marginTop: 8 }]}>
                    <Text style={{ fontWeight: 'bold', fontSize: 10 }}>
                        Hasil PE :{' '}
                        {isPositif ? 'POSITIF **' : 'NEGATIF'}
                    </Text>
                </View>

                <View style={styles.box}>
                    <View
                        style={{
                            flexDirection: 'row',
                            borderBottomWidth: 0.5,
                            borderBottomColor: '#d1d5db',
                            paddingBottom: 4,
                            marginBottom: 5,
                        }}
                    >
                        <Text style={{ flex: 2, fontWeight: 'bold' }}>
                            Kesimpulan Tindak Lanjut:
                        </Text>
                        <Text style={{ width: 55, textAlign: 'center', fontWeight: 'bold' }}>
                            Ya
                        </Text>
                        <Text style={{ width: 55, textAlign: 'center', fontWeight: 'bold' }}>
                            Tidak
                        </Text>
                    </View>

                    {[
                        { label: '- Perlu pengasapan (fogging)', yes: fogging },
                        { label: '- Larvasidasi (abatisasi)', yes: true },
                        { label: '- PSN 3M Plus serentak', yes: true },
                        { label: '- Penyuluhan masyarakat', yes: true },
                    ].map((item) => (
                        <View
                            key={item.label}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                marginBottom: 3,
                            }}
                        >
                            <Text style={{ flex: 2 }}>{item.label}</Text>
                            <View style={{ width: 55, alignItems: 'center' }}>
                                <CheckBox checked={item.yes} />
                            </View>
                            <View style={{ width: 55, alignItems: 'center' }}>
                                <CheckBox checked={!item.yes} />
                            </View>
                        </View>
                    ))}
                </View>

                <Text style={styles.noteText}>
                    **) Positif : Jika ada 1 penderita infeksi dengue lainnya dan/atau ada 3 suspek infeksi dengue, dan ada jentik &gt;= 5%.
                </Text>

                <View style={styles.sigContainer}>
                    <View style={styles.sigBox} />
                    <View style={styles.sigBox}>
                        <Text>
                            {report.kota ?? 'Setempat'}, {fmtDate(report.pe?.peDate)}
                        </Text>
                        <Text>Petugas Pelaksana PE</Text>
                        <View style={styles.sigSpace} />
                        <Text style={styles.sigName}>
                            {report.pe?.officerName ?? '( ______________________ )'}
                        </Text>
                        <Text style={styles.sigNip}>
                            NIP.{' '}
                            {report.pe?.officerNip ||
                                '..............................'}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.pageFooter} fixed>
                <Text>
                    Lampiran 1 (Formulir PE) · {report.reportNumber}
                </Text>
                <Text
                    render={({ pageNumber, totalPages }) =>
                        `Halaman ${pageNumber} dari ${totalPages}`
                    }
                />
            </View>
        </Page>,
    );

    return pages;
}

function renderSuratKadinkesPage(report: ReportDetail) {
    const isPositif = report.pe?.transmissionRisk === 'POSITIF_PENULARAN';
    const peDateStr = fmtDate(report.pe?.peDate ?? new Date());
    return (
        <Page key="surat-kadinkes" size="A4" style={styles.page}>
            <KopSurat report={report} />

            <View style={styles.letterHeaderTable}>
                <View style={styles.row}>
                    <Text style={{ width: 70 }}>Nomor</Text>
                    <Text style={{ width: 10 }}>:</Text>
                    <Text style={{ flex: 1 }}>
                        443.42 / PE-{report.reportNumber} / PKM
                    </Text>
                    <Text style={{ width: 170, textAlign: 'right' }}>
                        {report.kota ?? 'Setempat'}, {peDateStr}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={{ width: 70 }}>Lampiran</Text>
                    <Text style={{ width: 10 }}>:</Text>
                    <Text style={{ flex: 1 }}>1 (satu) berkas Formulir PE &amp; Lampiran 1</Text>
                </View>
                <View style={styles.row}>
                    <Text style={{ width: 70 }}>Perihal</Text>
                    <Text style={{ width: 10 }}>:</Text>
                    <Text style={{ flex: 1, fontWeight: 'bold' }}>
                        Laporan Hasil Penyelidikan Epidemiologi (PE) Kasus DBD
                    </Text>
                </View>
            </View>

            <View style={{ marginBottom: 10 }}>
                <Text>Kepada Yth.</Text>
                <Text style={{ fontWeight: 'bold' }}>
                    Kepala Dinas Kesehatan {report.kota ?? 'Kabupaten/Kota'}
                </Text>
                <Text>di Tempat</Text>
            </View>

            <Text style={styles.letterBody}>
                Dengan hormat,
            </Text>
            <Text style={styles.letterBody}>
                Menindaklanjuti laporan kasus Demam Berdarah Dengue (DBD) nomor{' '}
                {report.reportNumber} dari {report.institutionName ?? 'fasilitas kesehatan'} atas nama penderita{' '}
                {report.patient.name} ({report.patient.age} tahun) yang berdomisili di{' '}
                {report.patient.address}, Kel. {report.kelurahan ?? '-'}, Kec.{' '}
                {report.kecamatan ?? '-'}, Tim Surveilans Epidemiologi{' '}
                {report.assignedPuskesmasName ?? 'Puskesmas'} telah melaksanakan Penyelidikan Epidemiologi (PE) lapangan pada radius 100 meter pada tanggal {peDateStr} dengan hasil sebagai berikut:
            </Text>

            <View style={styles.table}>
                <View style={styles.tableRowHeader}>
                    <Text style={[styles.cell, { flex: 1.5 }]}>Indikator Entomologi &amp; Kasus</Text>
                    <Text style={[styles.cell, { width: 110, textAlign: 'right' }]}>Hasil Survei</Text>
                    <Text style={[styles.cellLast, { flex: 1.4 }]}>Keterangan</Text>
                </View>
                <View style={styles.tableRow}>
                    <Text style={[styles.cell, { flex: 1.5 }]}>Angka Bebas Jentik (ABJ)</Text>
                    <Text style={[styles.cell, { width: 110, textAlign: 'right', fontWeight: 'bold' }]}>
                        {report.pe?.abj ?? '-'}%
                    </Text>
                    <Text style={[styles.cellLast, { flex: 1.4 }]}>Target Kemenkes &gt;= 95%</Text>
                </View>
                <View style={styles.tableRow}>
                    <Text style={[styles.cell, { flex: 1.5 }]}>House Index (HI)</Text>
                    <Text style={[styles.cell, { width: 110, textAlign: 'right', fontWeight: 'bold' }]}>
                        {report.pe?.houseIndex ?? '-'}%
                    </Text>
                    <Text style={[styles.cellLast, { flex: 1.4 }]}>
                        {report.pe?.housesPositive ?? 0} dari {report.pe?.housesInspected ?? 0} rumah positif
                    </Text>
                </View>
                <View style={styles.tableRow}>
                    <Text style={[styles.cell, { flex: 1.5 }]}>Container Index (CI) / BI</Text>
                    <Text style={[styles.cell, { width: 110, textAlign: 'right', fontWeight: 'bold' }]}>
                        {report.pe?.containerIndex ?? '-'}% / {report.pe?.breteauIndex ?? '-'}%
                    </Text>
                    <Text style={[styles.cellLast, { flex: 1.4 }]}>
                        {report.pe?.containersPositive ?? 0} dari {report.pe?.containersInspected ?? 0} TPA positif
                    </Text>
                </View>
                <View style={styles.tableRowLast}>
                    <Text style={[styles.cell, { flex: 1.5 }]}>Status Risiko Penularan</Text>
                    <Text style={[styles.cell, { width: 110, textAlign: 'right', fontWeight: 'bold' }]}>
                        {isPositif ? 'POSITIF PENULARAN' : 'NEGATIF PENULARAN'}
                    </Text>
                    <Text style={[styles.cellLast, { flex: 1.4 }]}>
                        {report.pe?.foggingRecommended ? 'Direkomendasikan Fogging' : 'PSN 3M Plus'}
                    </Text>
                </View>
            </View>

            <View style={styles.box}>
                <Text style={{ fontWeight: 'bold', marginBottom: 3 }}>
                    Kesimpulan &amp; Rencana Tindak Lanjut:
                </Text>
                <Text>
                    {report.pe?.recommendation ??
                        (isPositif
                            ? 'Direkomendasikan pelaksanaan Fogging Fokus 2 Siklus (H+0 dan H+7), Larvasidasi (Abatisasi), serta gerakan PSN 3M Plus serentak di lokasi fokus.'
                            : 'Tidak diperlukan fogging fokus. Dilaksanakan PSN 3M Plus, abatisasi selektif, serta penyuluhan Jumantik mandiri di tingkat RT/RW.')}
                </Text>
            </View>

            <Text style={styles.letterBody}>
                Demikian laporan hasil penyelidikan epidemiologi ini kami sampaikan. Atas perhatian dan arahan lebih lanjut kami ucapkan terima kasih.
            </Text>

            <View style={styles.sigContainer}>
                <View style={styles.sigBox} />
                <View style={styles.sigBox}>
                    <Text>Kepala UPTD {report.assignedPuskesmasName ?? 'Puskesmas'}</Text>
                    <View style={styles.sigSpace} />
                    <Text style={styles.sigName}>
                        {report.pe?.headOfPuskesmasName ||
                            '( _________________________ )'}
                    </Text>
                    <Text style={styles.sigNip}>
                        NIP.{' '}
                        {report.pe?.headOfPuskesmasNip ||
                            '..............................'}
                    </Text>
                </View>
            </View>

            <View style={styles.pageFooter} fixed>
                <Text>Surat Hasil PE ke Kepala Dinas Kesehatan · {report.reportNumber}</Text>
                <Text
                    render={({ pageNumber, totalPages }) =>
                        `Halaman ${pageNumber} dari ${totalPages}`
                    }
                />
            </View>
        </Page>
    );
}

function renderSuratCamatLurahPage(report: ReportDetail) {
    const isPositif = report.pe?.transmissionRisk === 'POSITIF_PENULARAN';
    const peDateStr = fmtDate(report.pe?.peDate ?? new Date());
    return (
        <Page key="surat-camat-lurah" size="A4" style={styles.page}>
            <KopSurat report={report} />

            <View style={styles.letterHeaderTable}>
                <View style={styles.row}>
                    <Text style={{ width: 70 }}>Nomor</Text>
                    <Text style={{ width: 10 }}>:</Text>
                    <Text style={{ flex: 1 }}>
                        443.42 / PEMBERITAHUAN-{report.reportNumber} / PKM
                    </Text>
                    <Text style={{ width: 170, textAlign: 'right' }}>
                        {report.kota ?? 'Setempat'}, {peDateStr}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={{ width: 70 }}>Sifat</Text>
                    <Text style={{ width: 10 }}>:</Text>
                    <Text style={{ flex: 1, fontWeight: 'bold' }}>Segera / Penting</Text>
                </View>
                <View style={styles.row}>
                    <Text style={{ width: 70 }}>Perihal</Text>
                    <Text style={{ width: 10 }}>:</Text>
                    <Text style={{ flex: 1, fontWeight: 'bold' }}>
                        Pemberitahuan Penanggulangan Fokus Kasus DBD
                    </Text>
                </View>
            </View>

            <View style={{ marginBottom: 10 }}>
                <Text>Kepada Yth.</Text>
                <Text style={{ fontWeight: 'bold' }}>
                    1. Camat {report.kecamatan ?? '-'}
                </Text>
                <Text style={{ fontWeight: 'bold' }}>
                    2. Lurah / Kepala Desa {report.kelurahan ?? '-'}
                </Text>
                <Text>di Tempat</Text>
            </View>

            <Text style={styles.letterBody}>
                Dengan hormat,
            </Text>
            <Text style={styles.letterBody}>
                Berdasarkan hasil Penyelidikan Epidemiologi (PE) atas kasus Demam Berdarah Dengue (DBD) nomor laporan {report.reportNumber} di wilayah Kelurahan {report.kelurahan ?? '-'}, Kecamatan {report.kecamatan ?? '-'}, bersama ini kami sampaikan ringkasan situasi penularan dan rencana tindakan penanggulangan fokus di lapangan:
            </Text>

            <View style={styles.table}>
                <View style={styles.tableRowHeader}>
                    <Text style={[styles.cell, { width: 170 }]}>Parameter Lapangan</Text>
                    <Text style={[styles.cellLast, { flex: 1 }]}>Keterangan</Text>
                </View>
                <View style={styles.tableRow}>
                    <Text style={[styles.cell, { width: 170 }]}>Status Risiko Penularan</Text>
                    <Text style={[styles.cellLast, { flex: 1, fontWeight: 'bold' }]}>
                        {isPositif
                            ? 'POSITIF PENULARAN (Wajib Penanggulangan Fokus)'
                            : 'NEGATIF PENULARAN (Pemantauan & PSN 3M Plus)'}
                    </Text>
                </View>
                <View style={styles.tableRow}>
                    <Text style={[styles.cell, { width: 170 }]}>ABJ / House Index (HI)</Text>
                    <Text style={[styles.cellLast, { flex: 1 }]}>
                        ABJ {report.pe?.abj ?? '-'}% | HI {report.pe?.houseIndex ?? '-'}% (
                        {report.pe?.housesPositive ?? 0} dari {report.pe?.housesInspected ?? 0} rumah positif jentik)
                    </Text>
                </View>
                <View style={styles.tableRowLast}>
                    <Text style={[styles.cell, { width: 170 }]}>Jadwal Pengasapan (Fogging)</Text>
                    <Text style={[styles.cellLast, { flex: 1 }]}>
                        {report.foggingCycles.length > 0
                            ? report.foggingCycles
                                  .map(
                                      (c) =>
                                          `Siklus ${c.cycleNumber}: ${fmtShortDate(c.scheduledDate)} (${c.status})`,
                                  )
                                  .join(' | ')
                            : isPositif
                              ? 'Menunggu penjadwalan Siklus 1 (H+0) dan Siklus 2 (H+7)'
                              : 'Tidak dilakukan fogging; fokus pada PSN 3M Plus & abatisasi'}
                    </Text>
                </View>
            </View>

            <View style={styles.box}>
                <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>
                    Mohon dukungan Pemerintah Kecamatan, Kelurahan, serta Pengurus RT/RW setempat untuk:
                </Text>
                <Text style={{ marginBottom: 2 }}>
                    1. Menggerakkan masyarakat melaksanakan Pemberantasan Sarang Nyamuk (PSN) 3M Plus serentak di sekitar lokasi kasus (radius 100–200 meter).
                </Text>
                <Text style={{ marginBottom: 2 }}>
                    2. Mengamankan makanan, minuman, peralatan makan, serta hewan peliharaan apabila dilaksanakan pengasapan (fogging).
                </Text>
                <Text>
                    3. Membantu pemantauan warga sekitar yang mengalami demam mendadak untuk segera memeriksakan diri ke Puskesmas.
                </Text>
            </View>

            <Text style={styles.letterBody}>
                Demikian pemberitahuan ini kami sampaikan. Atas kerja sama dan dukungannya kami ucapkan terima kasih.
            </Text>

            <View style={styles.sigContainer}>
                <View style={styles.sigBox}>
                    <Text>Mengetahui,</Text>
                    <Text>Kepala UPTD {report.assignedPuskesmasName ?? 'Puskesmas'}</Text>
                    <View style={styles.sigSpace} />
                    <Text style={styles.sigName}>
                        {report.pe?.headOfPuskesmasName ||
                            '( _________________________ )'}
                    </Text>
                    <Text style={styles.sigNip}>
                        NIP.{' '}
                        {report.pe?.headOfPuskesmasNip ||
                            '..............................'}
                    </Text>
                </View>
                <View style={styles.sigBox}>
                    <Text>Petugas Penanggung Jawab Surveilans</Text>
                    <Text>UPTD {report.assignedPuskesmasName ?? 'Puskesmas'}</Text>
                    <View style={styles.sigSpace} />
                    <Text style={styles.sigName}>
                        {report.pe?.officerName ?? '( ______________________ )'}
                    </Text>
                    <Text style={styles.sigNip}>
                        NIP.{' '}
                        {report.pe?.officerNip ||
                            '..............................'}
                    </Text>
                </View>
            </View>

            <View style={styles.pageFooter} fixed>
                <Text>Pemberitahuan Camat &amp; Lurah · {report.reportNumber}</Text>
                <Text
                    render={({ pageNumber, totalPages }) =>
                        `Halaman ${pageNumber} dari ${totalPages}`
                    }
                />
            </View>
        </Page>
    );
}

export function PeLampiranDocument({
    report,
    households,
}: {
    report: ReportDetail;
    households: PeHouseholdPdfRow[];
}) {
    return (
        <Document
            title={`Formulir PE & Lampiran 1 — ${report.reportNumber}`}
            author="WALI-EPI Surveilans DBD"
        >
            {renderPeFormulirPages(report, households)}
        </Document>
    );
}

export function SuratHasilKadinkesDocument({
    report,
}: {
    report: ReportDetail;
}) {
    return (
        <Document
            title={`Surat Hasil PE Kadinkes — ${report.reportNumber}`}
            author="WALI-EPI Surveilans DBD"
        >
            {renderSuratKadinkesPage(report)}
        </Document>
    );
}

export function SuratCamatLurahDocument({ report }: { report: ReportDetail }) {
    return (
        <Document
            title={`Surat Pemberitahuan Camat & Lurah — ${report.reportNumber}`}
            author="WALI-EPI Surveilans DBD"
        >
            {renderSuratCamatLurahPage(report)}
        </Document>
    );
}

export function PeLengkapDocument({
    report,
    households,
}: {
    report: ReportDetail;
    households: PeHouseholdPdfRow[];
}) {
    return (
        <Document
            title={`Berkas Lengkap PE DBD — ${report.reportNumber}`}
            author="WALI-EPI Surveilans DBD"
        >
            {renderPeFormulirPages(report, households)}
            {renderSuratKadinkesPage(report)}
            {renderSuratCamatLurahPage(report)}
        </Document>
    );
}
