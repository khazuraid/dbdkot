import Link from 'next/link';
import {
    Activity,
    ArrowRight,
    Building2,
    Database,
    FolderOpen,
    Globe2,
    Lock,
    MapPin,
    Radio,
    Shield,
    ShieldAlert,
    Sliders,
    Users,
} from 'lucide-react';
import { requireRole } from '@/lib/session';
import { getDb } from '@/db';
import { institutions, kelurahan, users, auditLogs, attachments } from '@/db/schema';
import { count } from 'drizzle-orm';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { Stat, StatRow } from '@/components/shell/stat';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const instant = false;

export default async function AdminHubPage() {
    const actor = await requireRole('ADMIN');
    const db = getDb();

    const isAdmin = actor.role === 'ADMIN';

    // Query stats
    const [[instCount], [kelCount], [userCount], [logCount], [fileCount]] = await Promise.all([
        db.select({ value: count() }).from(institutions),
        db.select({ value: count() }).from(kelurahan),
        isAdmin
            ? db.select({ value: count() }).from(users)
            : Promise.resolve([{ value: 0 }]),
        isAdmin
            ? db.select({ value: count() }).from(auditLogs)
            : Promise.resolve([{ value: 0 }]),
        isAdmin
            ? db.select({ value: count() }).from(attachments)
            : Promise.resolve([{ value: 0 }]),
    ]);

    const adminModules = [
        {
            title: 'Manajemen Pengguna',
            description:
                'Kelola akun operator Dinkes, surveilans Puskesmas, petugas RS, dan hak akses RBAC.',
            href: '/admin/pengguna',
            icon: Users,
            stat: isAdmin ? `${userCount.value} Akun` : 'Terkunci',
            roles: ['ADMIN'],
            badge: 'Admin Only',
            tone: 'brand',
            allowed: isAdmin,
        },
        {
            title: 'Master Fasilitas Kesehatan (Institusi)',
            description:
                'Database Rumah Sakit rujukan, Puskesmas pembina, dan jejaring fasilitas kesehatan.',
            href: '/admin/institusi',
            icon: Building2,
            stat: `${instCount.value} Faskes`,
            roles: ['ADMIN', 'DINKES'],
            badge: 'Admin & Dinkes',
            tone: 'good',
            allowed: true,
        },
        {
            title: 'Master Kelurahan & Zonasi Wilayah',
            description:
                'Peta batas administratif, koordinat GeoJSON, dan perimeter endemisitas vektor.',
            href: '/admin/kelurahan',
            icon: MapPin,
            stat: `${kelCount.value} Kelurahan`,
            roles: ['ADMIN', 'DINKES'],
            badge: 'Admin & Dinkes',
            tone: 'good',
            allowed: true,
        },
        {
            title: 'Koreksi Wilayah & Pelaporan Silang',
            description:
                'Triage dan verifikasi kasus DBD yang terlapor di luar kelurahan atau lintas faskes.',
            href: '/admin/koreksi-wilayah',
            icon: Radio,
            stat: 'Triage Aktif',
            roles: ['ADMIN', 'DINKES'],
            badge: 'Admin & Dinkes',
            tone: 'warn',
            allowed: true,
        },
        {
            title: 'Audit Log & Jejak Keamanan',
            description:
                'Rekam jejak forensik seluruh operasi pembuatan data, update, dan ekspor berkas.',
            href: '/admin/audit-log',
            icon: ShieldAlert,
            stat: isAdmin ? `${logCount.value} Entri` : 'Terkunci',
            roles: ['ADMIN'],
            badge: 'Admin Only',
            tone: 'bad',
            allowed: isAdmin,
        },
        {
            title: 'Berkas Unggahan',
            description:
                'Daftar lengkap seluruh lampiran PDF & gambar yang terunggah beserta pengunggah, laporan terkait, dan kontrol penghapusan.',
            href: '/admin/berkas',
            icon: FolderOpen,
            stat: isAdmin ? `${fileCount.value} Berkas` : 'Terkunci',
            roles: ['ADMIN'],
            badge: 'Admin Only',
            tone: 'brand',
            allowed: isAdmin,
        },
        {
            title: 'Konfigurasi API Wilayah & Integrasi',
            description:
                'Pengaturan endpoint API wilayah Kemendagri / SatuData dan integrasi data.',
            href: '/pengaturan',
            icon: Sliders,
            stat: 'Integrasi',
            roles: ['ADMIN', 'DINKES'],
            badge: 'Sistem',
            tone: 'neutral',
            allowed: true,
        },
    ];

    return (
        <PageBody>
            <PageHeader
                title="Pusat Administrasi & Master Data"
                context={`Panel kendali master data, hak akses sistem, dan parameter surveilans epidemiologi — ${actor.role === 'ADMIN' ? 'Administrator Sistem' : 'Dinas Kesehatan Kota Cirebon'}`}
            />

            <PageContent>
                <StatRow className="grid-cols-2 lg:grid-cols-4">
                    <Stat
                        label="Faskes Terdaftar"
                        value={instCount.value}
                        signal="neutral"
                        hint="RS & Puskesmas aktif"
                        icon={Building2}
                    />
                    <Stat
                        label="Kelurahan Binaan"
                        value={kelCount.value}
                        signal="good"
                        hint="Wilayah administratif kota"
                        icon={MapPin}
                    />
                    <Stat
                        label="Pengguna Sistem"
                        value={isAdmin ? userCount.value : '—'}
                        signal={isAdmin ? 'neutral' : 'neutral'}
                        hint={isAdmin ? 'Total akun pengguna' : 'Hak akses terbatas'}
                        icon={Users}
                    />
                    <Stat
                        label="Audit Keamanan"
                        value={isAdmin ? logCount.value : 'Aktif'}
                        signal="good"
                        hint="Jejak operasi tercatat"
                        icon={Shield}
                    />
                </StatRow>

                <Panel title="Modul Administrasi & Kontrol Akses">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                        {adminModules.map((mod) => {
                            const Icon = mod.icon;
                            return (
                                <div
                                    key={mod.title}
                                    className={cn(
                                        'group relative flex flex-col justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 transition-all',
                                        mod.allowed
                                            ? 'hover:border-[var(--accent)] hover:shadow-sm'
                                            : 'opacity-70 bg-[var(--muted)]/20',
                                    )}
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-3">
                                            <div
                                                className={cn(
                                                    'flex size-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)]',
                                                    mod.tone === 'brand' &&
                                                        'bg-[var(--accent)]/10 text-[var(--accent)]',
                                                    mod.tone === 'good' &&
                                                        'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                                                    mod.tone === 'warn' &&
                                                        'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                                                    mod.tone === 'bad' &&
                                                        'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                                                    mod.tone === 'neutral' &&
                                                        'bg-[var(--raised)] text-foreground',
                                                )}
                                            >
                                                <Icon className="size-5" />
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    'text-[11px] font-mono',
                                                    !mod.allowed &&
                                                        'border-amber-500/30 text-amber-600',
                                                )}
                                            >
                                                {mod.badge}
                                            </Badge>
                                        </div>

                                        <h3 className="text-base font-semibold text-foreground group-hover:text-[var(--accent)] transition-colors">
                                            {mod.title}
                                        </h3>
                                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                                            {mod.description}
                                        </p>
                                    </div>

                                    <div className="mt-5 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
                                        <span className="font-mono font-medium text-muted-foreground">
                                            {mod.stat}
                                        </span>
                                        {mod.allowed ? (
                                            <Link
                                                href={mod.href}
                                                className="inline-flex items-center gap-1 font-medium text-[var(--accent)] hover:underline"
                                            >
                                                Buka Modul
                                                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                                            </Link>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                                                <Lock className="size-3" />
                                                Khusus Admin
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Panel>
            </PageContent>
        </PageBody>
    );
}
