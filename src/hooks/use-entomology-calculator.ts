'use client';

import { useMemo } from 'react';
import {
    calculateEntomologyMetrics,
    type EntomologySummary,
    type HouseholdSurveyRow,
} from '@/lib/entomology-calculator';

export function useEntomologyCalculator(
    surveys: HouseholdSurveyRow[],
    hasOtherDenguePatients: boolean,
    suspectedFeverCount: number,
): EntomologySummary {
    return useMemo(
        () =>
            calculateEntomologyMetrics(
                surveys,
                hasOtherDenguePatients,
                suspectedFeverCount,
            ),
        [surveys, hasOtherDenguePatients, suspectedFeverCount],
    );
}
