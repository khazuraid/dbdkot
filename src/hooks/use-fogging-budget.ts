'use client';

import { useMemo } from 'react';
import {
    calculateFoggingBudget,
    type FoggingBudgetBreakdown,
    type FoggingBudgetInput,
} from '@/lib/fogging-budget';

export function useFoggingBudget(
    input: FoggingBudgetInput,
): FoggingBudgetBreakdown {
    return useMemo(() => calculateFoggingBudget(input), [input]);
}
