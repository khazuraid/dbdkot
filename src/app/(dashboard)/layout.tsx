import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { getDb } from '@/db';
import { institutions } from '@/db/schema';
import type { Role } from '@/lib/roles';
import { Sidebar } from '@/components/shell/sidebar';

/**
 * Server-side gate. The prototype's middleware matched every path as public
 * (`pathname.startsWith("/")`), so this is where authorisation actually starts:
 * no session, no shell.
 */
export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
        redirect('/masuk');
    }

    const user = session.user as typeof session.user & {
        role?: Role;
        institutionId?: string | null;
        isActive?: boolean;
    };

    if (user.isActive === false) {
        redirect('/masuk?error=disabled');
    }

    let institution: string | null = null;

    if (user.institutionId) {
        const [row] = await getDb()
            .select({ name: institutions.name })
            .from(institutions)
            .where(eq(institutions.id, user.institutionId))
            .limit(1);
        institution = row?.name ?? null;
    }

    return (
        <div className="flex min-h-dvh">
            <Sidebar
                role={(user.role ?? 'PUSKESMAS') as Role}
                name={user.name}
                email={user.email}
                institution={institution}
            />
            <main className="min-w-0 flex-1">{children}</main>
        </div>
    );
}
