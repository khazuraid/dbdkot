import { redirect } from 'next/navigation';

export const instant = false;

export default async function MonitoringRedirectPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const sp = await searchParams;
    const page = sp.page;
    if (page && page !== '1') {
        redirect(`/dasbor?page=${encodeURIComponent(page)}#monitoring`);
    }
    redirect('/dasbor#monitoring');
}
