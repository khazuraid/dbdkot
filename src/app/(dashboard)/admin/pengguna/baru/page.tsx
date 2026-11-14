import { requireRole } from '@/lib/session';
import { institutionOptions } from '@/lib/domain/accounts';
import { PageBody, PageContent, PageHeader } from '@/components/shell/page';
import { CreateAccountForm } from './create-account-form';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

export default async function NewAccountPage() {
    await requireRole('ADMIN');
    const institutions = await institutionOptions();

    return (
        <PageBody>
            <PageHeader
                title="Tambah akun"
                context="Akun dibuat langsung aktif; tidak perlu persetujuan lanjutan."
            />

            <PageContent>
                <CreateAccountForm institutions={institutions} />
            </PageContent>
        </PageBody>
    );
}
