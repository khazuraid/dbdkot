import { describe, it, expect } from 'vitest';
import { isValidUsername, loginSchema, registerSchema } from '../auth-schemas';
import {
    buildDefaultManualNotifyMessage,
    buildManualNotifyTargets,
    validateTransitionNote,
} from '../domain/report-labels';

describe('username & identifier auth validation', () => {
    it('validates allowed username format', () => {
        expect(isValidUsername('petugas.pkm01')).toBe(true);
        expect(isValidUsername('dinkes_admin-1')).toBe(true);
        expect(isValidUsername('ab')).toBe(false);
        expect(isValidUsername('bad user')).toBe(false);
        expect(isValidUsername('user@domain.id')).toBe(false);
    });

    it('accepts email or username in loginSchema and trims whitespace', () => {
        const asEmail = loginSchema.safeParse({
            identifier: '  Admin@Dinkes.go.id ',
            password: 'secret',
        });
        expect(asEmail.success).toBe(true);
        if (asEmail.success) {
            expect(asEmail.data.identifier).toBe('Admin@Dinkes.go.id');
        }

        const asUser = loginSchema.safeParse({
            identifier: '  Petugas.Pkm1 ',
            password: 'secret',
        });
        expect(asUser.success).toBe(true);
        if (asUser.success) {
            expect(asUser.data.identifier).toBe('Petugas.Pkm1');
        }

        expect(
            loginSchema.safeParse({ identifier: 'a', password: 'secret' })
                .success,
        ).toBe(false);
        expect(
            loginSchema.safeParse({
                identifier: 'bad@email',
                password: 'secret',
            }).success,
        ).toBe(false);
    });

    it('treats username as optional in registerSchema and validates when provided', () => {
        const base = {
            name: 'Petugas Surveilans',
            email: 'petugas@dinkes.go.id',
            password: 'Password123!',
            confirm: 'Password123!',
            role: 'PUSKESMAS' as const,
            institutionId: '550e8400-e29b-41d4-a716-446655440000',
        };

        expect(
            registerSchema.safeParse({ ...base, username: '' }).success,
        ).toBe(true);
        const withUser = registerSchema.safeParse({
            ...base,
            username: ' PKM.Kejaksan ',
        });
        expect(withUser.success).toBe(true);
        if (withUser.success) {
            expect(withUser.data.username).toBe('pkm.kejaksan');
        }
        expect(
            registerSchema.safeParse({ ...base, username: 'x' }).success,
        ).toBe(false);
    });
});

describe('rejection note enforcement', () => {
    it('requires at least 5 non-whitespace characters for REJECT and REJECT_BY_DINKES', () => {
        expect(validateTransitionNote('REJECT')).toEqual({
            ok: false,
            reason: 'NOTE_REQUIRED',
        });
        expect(validateTransitionNote('REJECT', '   abc  ')).toEqual({
            ok: false,
            reason: 'NOTE_REQUIRED',
        });
        expect(validateTransitionNote('REJECT_BY_DINKES', '1234')).toEqual({
            ok: false,
            reason: 'NOTE_REQUIRED',
        });
        expect(
            validateTransitionNote('REJECT', '  Luar wilayah kerja kami  '),
        ).toEqual({
            ok: true,
            note: 'Luar wilayah kerja kami',
        });
    });

    it('allows empty note for non-rejection transitions', () => {
        expect(validateTransitionNote('ACCEPT')).toEqual({
            ok: true,
            note: null,
        });
        expect(validateTransitionNote('VERIFY')).toEqual({
            ok: true,
            note: null,
        });
    });
});

describe('manual notification targets & default messages', () => {
    it('builds role-appropriate targets for RS, Puskesmas, and Dinkes', () => {
        const rsTargets = buildManualNotifyTargets({
            actorRole: 'RUMAH_SAKIT',
            actorInstitutionId: 'rs-1',
            reportInstitutionId: 'rs-1',
            reportInstitutionName: 'RSUD Gunung Jati',
            puskesmasId: 'pkm-1',
            puskesmasName: 'PKM Kejaksan',
        });
        expect(rsTargets.map((t) => t.value)).toEqual([
            'DINKES',
            'PUSKESMAS',
            'PUSKESMAS_AND_DINKES',
        ]);

        const rsUnassigned = buildManualNotifyTargets({
            actorRole: 'RUMAH_SAKIT',
            actorInstitutionId: 'rs-1',
            reportInstitutionId: 'rs-1',
            reportInstitutionName: 'RSUD Gunung Jati',
            puskesmasId: null,
            puskesmasName: null,
        });
        expect(rsUnassigned.map((t) => t.value)).toEqual(['DINKES']);

        const pkmTargets = buildManualNotifyTargets({
            actorRole: 'PUSKESMAS',
            actorInstitutionId: 'pkm-1',
            reportInstitutionId: 'rs-1',
            reportInstitutionName: 'RSUD Gunung Jati',
            puskesmasId: 'pkm-1',
            puskesmasName: 'PKM Kejaksan',
        });
        expect(pkmTargets.map((t) => t.value)).toEqual([
            'PUSKESMAS',
            'DINKES',
            'FASKES',
            'PUSKESMAS_AND_DINKES',
        ]);

        const pkmUnassigned = buildManualNotifyTargets({
            actorRole: 'PUSKESMAS',
            actorInstitutionId: 'pkm-1',
            reportInstitutionId: 'rs-1',
            reportInstitutionName: 'RSUD Gunung Jati',
            puskesmasId: null,
            puskesmasName: null,
        });
        expect(pkmUnassigned.map((t) => t.value)).toEqual(['DINKES', 'FASKES']);

        const dinkesTargets = buildManualNotifyTargets({
            actorRole: 'DINKES',
            actorInstitutionId: 'dinkes-1',
            reportInstitutionId: 'rs-1',
            reportInstitutionName: 'RSUD Gunung Jati',
            puskesmasId: 'pkm-1',
            puskesmasName: 'PKM Kejaksan',
        });
        expect(dinkesTargets.map((t) => t.value)).toEqual([
            'PUSKESMAS',
            'FASKES',
            'DINKES',
            'PUSKESMAS_AND_DINKES',
        ]);
    });

    it('builds context-specific default messages for REPORT, unconfirmed location, PE, and FOGGING', () => {
        expect(
            buildDefaultManualNotifyMessage({
                context: 'REPORT',
                reportId: 'rep-1',
                reportNumber: 'DBD-2026-001',
                kelurahan: 'Kejaksan',
                locationUnconfirmed: true,
            }),
        ).toContain('konfirmasi lokasi/koordinat');

        expect(
            buildDefaultManualNotifyMessage({
                context: 'PE',
                reportId: 'rep-1',
                reportNumber: 'DBD-2026-001',
                kelurahan: 'Kejaksan',
            }),
        ).toContain('Penyelidikan Epidemiologi (PE)');

        expect(
            buildDefaultManualNotifyMessage({
                context: 'FOGGING',
                reportId: 'rep-1',
                reportNumber: 'DBD-2026-001',
                kelurahan: 'Kejaksan',
            }),
        ).toContain('Fogging Fokus');
    });
});
