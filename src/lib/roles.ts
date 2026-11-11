export const ROLES = ['ADMIN', 'DINKES', 'PUSKESMAS', 'RUMAH_SAKIT'] as const;
export type Role = (typeof ROLES)[number];
