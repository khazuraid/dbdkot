import { describe, expect, it } from 'vitest';
import { ROLES } from './roles';

describe('roles', () => {
    it('exposes exactly the four legacy roles', () => {
        expect(ROLES).toEqual(['ADMIN', 'DINKES', 'PUSKESMAS', 'RUMAH_SAKIT']);
    });
});
