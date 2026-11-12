import {
    LayoutDashboard,
    FileText,
    FilePlus2,
    Inbox,
    BarChart3,
    Bell,
    MessageSquare,
    ClipboardList,
    ClipboardCheck,
    CheckCheck,
    Search,
    TrendingUp,
    PlusCircle,
    Building2,
    MapPin,
    MapPinned,
    Users,
    ScrollText,
    Settings,
    type LucideIcon,
} from 'lucide-react';

/**
 * One icon per route, keyed by href, drawn at 16px on a 1.5px stroke — the
 * study's median (§3.2). Below `md` the sheet uses the same map, so a route
 * cannot gain an icon on one surface and lose it on the other.
 */
export const NAV_ICON: Record<string, LucideIcon> = {
    '/dasbor': LayoutDashboard,
    '/laporan': FileText,
    '/laporan/baru': FilePlus2,
    '/laporan/perlu-action': Inbox,
    '/laporan/analitik': BarChart3,
    '/laporan/monitoring': ClipboardList,
    '/notifikasi': Bell,
    '/pesan': MessageSquare,
    '/pe': Search,
    '/pe/tugas': ClipboardCheck,
    '/pe/baru': PlusCircle,
    '/pe/analitik': TrendingUp,
    '/pe/verifikasi': CheckCheck,
    '/aset': Building2,
    '/admin/institusi': Building2,
    '/admin/kelurahan': MapPin,
    '/admin/koreksi-wilayah': MapPinned,
    '/admin/pengguna': Users,
    '/admin/audit-log': ScrollText,
    '/pengaturan': Settings,
};
