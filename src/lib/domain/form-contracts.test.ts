import { describe, expect, it } from 'vitest';
import { createAccountSchema } from './form-contracts';

const base = {
    name: 'Siti Rahayu',
    email: 'SITI@Puskesmas.Go.Id',
    password: 'rahasia-panjang',
    role: 'PUSKESMAS' as const,
};

describe('createAccountSchema', () => {
    it('lowercases the email so the unique index sees one identity', () => {
        const parsed = createAccountSchema.parse({
            ...base,
            institutionId: '3f6f6f2e-0000-4000-8000-000000000001',
        });
        expect(parsed.email).toBe('siti@puskesmas.go.id');
    });

    it('rejects a puskesmas or hospital account without an institution', () => {
        expect(createAccountSchema.safeParse(base).success).toBe(false);
        expect(
            createAccountSchema.safeParse({ ...base, role: 'RUMAH_SAKIT' })
                .success,
        ).toBe(false);
    });

    it('allows ADMIN and DINKES to have no institution', () => {
        expect(
            createAccountSchema.safeParse({ ...base, role: 'ADMIN' }).success,
        ).toBe(true);
    });

    it('refuses a password under the auth minimum', () => {
        expect(
            createAccountSchema.safeParse({
                ...base,
                password: 'short',
                institutionId: '3f6f6f2e-0000-4000-8000-000000000001',
            }).success,
        ).toBe(false);
    });
});
