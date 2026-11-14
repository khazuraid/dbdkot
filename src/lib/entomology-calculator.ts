export interface HouseholdSurveyRow {
    houseNumber: number;
    houseOwner: string;
    isInsideContainerPositive: boolean;
    isOutsideContainerPositive: boolean;
    totalContainersChecked: number;
    totalPositiveContainers: number;
}

export interface EntomologySummary {
    totalHousesChecked: number;
    positiveHousesCount: number;
    negativeHousesCount: number;
    totalContainersChecked: number;
    positiveContainersCount: number;
    abj: number; // Angka Bebas Jentik (%)
    hi: number; // House Index (%)
    ci: number; // Container Index (%)
    bi: number; // Breteau Index (%)
    transmissionRisk: 'POSITIF_PENULARAN' | 'NEGATIF_PENULARAN';
    foggingRecommended: boolean;
    actionPlan: string;
}

export function calculateEntomologyMetrics(
    surveys: HouseholdSurveyRow[],
    hasOtherDenguePatients: boolean,
    suspectedFeverCount: number,
): EntomologySummary {
    const totalHousesChecked = surveys.length || 1; // Cegah divide-by-zero

    let positiveHousesCount = 0;
    let totalContainersChecked = 0;
    let positiveContainersCount = 0;

    for (const s of surveys) {
        if (s.isInsideContainerPositive || s.isOutsideContainerPositive) {
            positiveHousesCount++;
        }
        totalContainersChecked += s.totalContainersChecked || 0;
        positiveContainersCount += s.totalPositiveContainers || 0;
    }

    const negativeHousesCount = Math.max(
        0,
        totalHousesChecked - positiveHousesCount,
    );
    const abj = Number(
        ((negativeHousesCount / totalHousesChecked) * 100).toFixed(2),
    );
    const hi = Number(
        ((positiveHousesCount / totalHousesChecked) * 100).toFixed(2),
    );
    const ci =
        totalContainersChecked > 0
            ? Number(
                  ((positiveContainersCount / totalContainersChecked) * 100).toFixed(2),
              )
            : 0;
    const bi =
        surveys.length > 0
            ? Number(((positiveContainersCount / surveys.length) * 100).toFixed(2))
            : 0;

    // Standar Kemenkes RI:
    // Positif penularan bila: ada penderita DBD lain ATAU ada >= 3 penderita panas tanpa sebab lain,
    // DAN ditemukan jentik (HI >= 5% atau ABJ < 95%)
    const hasFeverCluster = hasOtherDenguePatients || suspectedFeverCount >= 3;
    const isLarvaDangerous = abj < 95 || hi >= 5;

    const isTransmissionPositive = hasFeverCluster && isLarvaDangerous;
    const foggingRecommended = isTransmissionPositive;

    const actionPlan = foggingRecommended
        ? 'FOGGING FOKUS (2 Siklus Interval 7 Hari) + PSN 3M PLUS MASSAL'
        : 'PSN 3M PLUS MASSAL & LARVASIDASI SELEKTIF (ABATISASI)';

    return {
        totalHousesChecked: surveys.length,
        positiveHousesCount,
        negativeHousesCount,
        totalContainersChecked,
        positiveContainersCount,
        abj,
        hi,
        ci,
        bi,
        transmissionRisk: isTransmissionPositive
            ? 'POSITIF_PENULARAN'
            : 'NEGATIF_PENULARAN',
        foggingRecommended,
        actionPlan,
    };
}
