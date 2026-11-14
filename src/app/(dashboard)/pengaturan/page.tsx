import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { institutions, users } from '@/db/schema';
import { requireActor } from '@/lib/session';
import { listSettings } from '@/lib/domain/admin';
import { PageBody, PageContent, PageHeader } from '@/components/shell/page';
import { SettingsClient } from './settings-client';
import type { SettingRow } from './settings-editor';

// Data pasien / sesi: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

export default async function PengaturanPage() {
    const actor = await requireActor();
    const isAdmin = actor.role === 'ADMIN';
    const canManageSystem = actor.role === 'ADMIN' || actor.role === 'DINKES';

    const db = getDb();

    const [userRows, settingsData] = await Promise.all([
        db
            .select({
                id: users.id,
                name: users.name,
                email: users.email,
                role: users.role,
                status: users.status,
                institutionId: users.institutionId,
                whatsappPhone: users.whatsappPhone,
                whatsappOptIn: users.whatsappOptIn,
                createdAt: users.createdAt,
            })
            .from(users)
            .where(eq(users.id, actor.userId))
            .limit(1),
        canManageSystem
            ? listSettings(!isAdmin)
            : Promise.resolve({ rows: [] as SettingRow[], total: 0 }),
    ]);

    const me = userRows[0];
    let institutionName: string | null = null;

    if (me?.institutionId) {
        const [inst] = await db
            .select({ name: institutions.name })
            .from(institutions)
            .where(eq(institutions.id, me.institutionId))
            .limit(1);
        institutionName = inst?.name ?? null;
    }

    const { rows: systemSettings, total: totalSettings } = settingsData;
    const categorySet = new Set<string>();
    for (const s of systemSettings) {
        if (s.category) categorySet.add(s.category);
    }
    const categories = Array.from(categorySet).sort();

    return (
        <PageBody>
            <PageHeader
                title="Pengaturan"
                context="Pusat konfigurasi akun, preferensi notifikasi, keamanan, dan parameter operasional surveilans."
            />

            <PageContent>
                <SettingsClient
                    user={{
                        id: actor.userId,
                        name: me?.name ?? 'Petugas Surveilans',
                        email: actor.email,
                        role: actor.role,
                        status: me?.status ?? 'APPROVED',
                        institution: institutionName,
                        whatsappPhone: me?.whatsappPhone ?? '',
                        whatsappOptIn: me?.whatsappOptIn ?? true,
                        createdAt: me?.createdAt,
                    }}
                    systemSettings={systemSettings as SettingRow[]}
                    totalSettings={totalSettings}
                    categories={categories}
                    canManageSystem={canManageSystem}
                    isAdmin={isAdmin}
                />
            </PageContent>
        </PageBody>
    );
}
