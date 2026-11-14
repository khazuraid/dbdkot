'use client';

import {
    parseAsInteger,
    parseAsString,
    useQueryStates,
} from 'nuqs';

export function useReportFilters() {
    return useQueryStates(
        {
            status: parseAsString.withDefault(''),
            search: parseAsString.withDefault(''),
            selected: parseAsString.withDefault(''),
            page: parseAsInteger.withDefault(1),
        },
        {
            shallow: false,
            history: 'replace',
        },
    );
}
