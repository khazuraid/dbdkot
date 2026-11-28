import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { getDb } from '@/db';
import { institutions } from '@/db/schema';
import type { Role } from '@/lib/roles';
import { getPortalBranding } from '@/lib/branding';
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
    let session;
    try {
        session = await auth.api.getSession({ headers: await headers() });
    } catch {
        redirect('/masuk');
    }

    if (!session?.user) {
        redirect('/masuk');
    }

    const user = session.user as typeof session.user & {
        role?: Role;
        institutionId?: string | null;
        isActive?: boolean;
        status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    };

    if (user.isActive === false) {
        redirect('/masuk?error=disabled');
    }

    if (user.status && user.status !== 'APPROVED') {
        redirect('/masuk?error=pending');
    }

    const [institutionRow, branding] = await Promise.all([
        user.institutionId
            ? getDb()
                  .select({ name: institutions.name })
                  .from(institutions)
                  .where(eq(institutions.id, user.institutionId))
                  .limit(1)
            : Promise.resolve([]),
        getPortalBranding(),
    ]);
    const institution: string | null = institutionRow[0]?.name ?? null;

    const role = (user.role ?? 'PUSKESMAS') as Role;
    const name = user.name ?? 'Pengguna';
    const email = user.email ?? '';
    const shellBranding = {
        title: branding.title,
        tagline: branding.tagline,
        logoUrl: branding.logoUrl,
    };

    return (
        <div className="flex min-h-dvh flex-col bg-[var(--ground)] md:fixed md:inset-0 md:h-dvh md:max-h-dvh md:flex-row md:gap-3 md:overflow-hidden md:p-3">
            <a href="#main-content" className="skip-link">
                Lewati ke konten utama
            </a>

            <MobileNav
                role={role}
                name={name}
                email={email}
                institution={institution}
                branding={shellBranding}
            />

            <aside className="hidden shrink-0 md:flex md:h-full md:flex-col md:overflow-hidden">
                <Sidebar
                    role={role}
                    name={name}
                    email={email}
                    institution={institution}
                    branding={shellBranding}
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
                    className="flex min-w-0 flex-1 flex-col overflow-x-clip pb-[calc(5rem+env(safe-area-inset-bottom,0px))] outline-none md:overflow-x-hidden md:overflow-y-auto md:overscroll-contain md:pb-0"
                >
                    {children}
                </main>
            </div>

            <MobileBottomDock role={role} />
            <CommandPalette role={role} />
        </div>
    );
}
