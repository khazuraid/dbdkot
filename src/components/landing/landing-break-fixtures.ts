import type { PublicCaseGeoPoint } from '@/lib/domain/map-data';
import type {
    PublicPortalBranding,
    PublicSurveillanceSummary,
} from '@/components/landing/public-surveillance-hero';

export type LandingBreakMode = 'live' | 'thousands' | 'worst' | 'empty' | 'one';

export const LANDING_BREAK_MODES: readonly {
    id: LandingBreakMode;
    label: string;
}[] = [
    { id: 'live', label: 'Live' },
    { id: 'thousands', label: 'Ribuan' },
    { id: 'worst', label: 'Worst case' },
    { id: 'empty', label: 'Empty' },
    { id: 'one', label: 'One' },
];

export function parseLandingBreakMode(
    raw: string | undefined,
): LandingBreakMode {
    if (
        raw === 'thousands' ||
        raw === 'worst' ||
        raw === 'empty' ||
        raw === 'one'
    ) {
        return raw;
    }
    return 'live';
}

function makeSyntheticCases(count: number): PublicCaseGeoPoint[] {
    const kelurahans = [
        'Kalijaga Harjamukti Perbatasan Timur',
        'Kejaksan',
        'Pegambiran Pelabuhan',
        'Kesambi Barat',
        'Argasunya',
    ];
    return Array.from({ length: count }, (_, i) => {
        const ring = Math.floor(i / 24);
        const angle = (i % 24) * ((Math.PI * 2) / 24);
        const radius = 0.004 + ring * 0.003;
        const isClustered = i % 3 === 0;
        return {
            id: `break-${i}`,
            lat: -6.72 + Math.sin(angle) * radius,
            lng: 108.55 + Math.cos(angle) * radius,
            caseType: i % 5 === 0 ? 'DSS' : 'DBD',
            kelurahan: kelurahans[i % kelurahans.length] ?? null,
            clusterId: isClustered ? `cluster-${i % 7}` : null,
            createdAt: new Date(Date.now() - i * 3_600_000),
        };
    });
}

export function getLandingBreakFixture(
    mode: Exclude<LandingBreakMode, 'live'>,
    baseBranding: PublicPortalBranding,
): {
    cases: PublicCaseGeoPoint[];
    summary: PublicSurveillanceSummary;
    branding: PublicPortalBranding;
} {
    if (mode === 'empty') {
        return {
            cases: [],
            summary: {
                totalThisMonth: 0,
                peCompleted: 0,
                foggingActive: 0,
                closedCases: 0,
                topKecamatan: [],
            },
            branding: baseBranding,
        };
    }

    if (mode === 'one') {
        return {
            cases: makeSyntheticCases(1),
            summary: {
                totalThisMonth: 1,
                peCompleted: 1,
                foggingActive: 1,
                closedCases: 1,
                topKecamatan: [{ kecamatan: 'Kejaksan', count: 1 }],
            },
            branding: baseBranding,
        };
    }

    if (mode === 'thousands') {
        return {
            cases: makeSyntheticCases(300),
            summary: {
                totalThisMonth: 128450,
                peCompleted: 94310,
                foggingActive: 18640,
                closedCases: 75670,
                topKecamatan: [
                    { kecamatan: 'Harjamukti', count: 42180 },
                    { kecamatan: 'Kesambi', count: 31940 },
                    { kecamatan: 'Lemahwungkuk', count: 24890 },
                ],
            },
            branding: baseBranding,
        };
    }

    // mode === 'worst': realistic schema-backed upper bounds (brandingSchema max lengths + broken logo + high counts)
    return {
        cases: makeSyntheticCases(300),
        summary: {
            totalThisMonth: 1248950,
            peCompleted: 982410,
            foggingActive: 148320,
            closedCases: 834090,
            topKecamatan: [
                {
                    kecamatan: 'Harjamukti Selatan Perbatasan Wilayah Timur',
                    count: 412890,
                },
                {
                    kecamatan: 'Lemahwungkuk Pesisir Pelabuhan Utara',
                    count: 318420,
                },
                {
                    kecamatan: 'Kejaksan Pusat Administrasi Kota',
                    count: 204115,
                },
            ],
        },
        branding: {
            title: 'WALI-EPI KOTA CIREBON SURVEILANS TERPADU',
            tagline:
                'Sistem Kewaspadaan Dini & Respons Cepat Demam Berdarah Dengue Terintegrasi',
            logoUrl: '/_break-ui-missing-logo.png',
            institutionName:
                'Dinas Kesehatan Pemerintah Daerah Kota Cirebon — Bidang P2P Surveilans Epidemiologi',
            emergencyHotline: '119 / (0231) 204-819 ext. 102',
            supportEmail:
                'surveilans.epidemiologi.p2p-terpadu@dinkes-kota-cirebon.example.org',
        },
    };
}
