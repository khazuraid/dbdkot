import { AuthShell } from '@/components/shell/auth-shell';

export default function DaftarLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <AuthShell>{children}</AuthShell>;
}
