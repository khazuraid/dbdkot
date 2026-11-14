import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { getDb } from '@/db';
import { institutions } from '@/db/schema';
import type { Role } from '@/lib/roles';
import { Sidebar } from '@/components/shell/sidebar';
import { MobileNav } from '@/components/shell/mobile-nav';
import { CommandPalette } from '@/components/shell/command-palette';
import { MobileBottomDock } from '@/components/shell/mobile-bottom-dock';
import { TopBar } from '@/components/shell/top-bar';

/**
 * Server-side gate. No session, no shell.
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

    const role = (user.role ?? 'PUSKESMAS') as Role;
    const name = user.name ?? 'Pengguna';
    const email = user.email ?? '';

    return (
        <div className="flex min-h-dvh flex-col bg-[var(--ground)] md:h-dvh md:max-h-dvh md:overflow-hidden md:flex-row md:gap-3 md:p-3">
            <a href="#main-content" className="skip-link">
                Lewati ke konten utama
            </a>

            <MobileNav
                role={role}
                name={name}
                email={email}
                institution={institution}
            />

            <aside className="hidden shrink-0 md:flex md:h-full md:flex-col md:overflow-hidden">
                <Sidebar
                    role={role}
                    name={name}
                    email={email}
                    institution={institution}
                />
            </aside>

            {/* Desktop Workstation Pane with Pinned Navbar */}
            <div className="flex min-w-0 flex-1 flex-col bg-[var(--surface)] md:h-full md:overflow-hidden md:rounded-[var(--radius-card)] md:border md:border-[var(--border)] md:shadow-[var(--elev-soft)]">
                <TopBar
                    role={role}
                    name={name}
                    email={email}
                    institution={institution}
                />
                <main
                    id="main-content"
                    tabIndex={-1}
                    className="flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto outline-none pb-20 md:pb-0"
                >
                    {children}
                </main>
            </div>

            <MobileBottomDock role={role} />
            <CommandPalette role={role} />
        </div>
    );
}
