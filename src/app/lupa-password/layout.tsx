import { AuthShell } from '@/components/shell/auth-shell';

export default function LupaPasswordLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <AuthShell>{children}</AuthShell>;
}
