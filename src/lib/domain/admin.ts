import { count, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { systemSettings } from '@/db/schema';
import { isSecretSettingKey, MASKED_SECRET } from '@/lib/security';

/** Settings are global, but secrets must never render: `isPublic` gates them and secret keys are always masked. */
export async function listSettings(onlyPublic: boolean) {
    const where = onlyPublic ? eq(systemSettings.isPublic, true) : sql`true`;
    const [rawRows, [totals]] = await Promise.all([
        getDb()
            .select({
                id: systemSettings.id,
                key: systemSettings.key,
                value: systemSettings.value,
                type: systemSettings.type,
                category: systemSettings.category,
                description: systemSettings.description,
                isPublic: systemSettings.isPublic,
            })
            .from(systemSettings)
            .where(where)
            .orderBy(systemSettings.category, systemSettings.key)
            .limit(200),
        getDb().select({ n: count() }).from(systemSettings).where(where),
    ]);

    const rows = rawRows
        .filter((r) => !(onlyPublic && isSecretSettingKey(r.key)))
        .map((r) =>
            isSecretSettingKey(r.key)
                ? { ...r, value: r.value ? MASKED_SECRET : '', isPublic: false }
                : r,
        );

    // `total` lets the screen say when the cap hid keys, instead of showing
    // a partial list as the whole registry.
    return { rows, total: Number(totals?.n ?? 0) };
}
