# WALI-EPI — SiLapor DBD

Sistem surveilans Demam Berdarah Dengue (DBD). Alur: RS melapor → auto-assign ke Puskesmas
berdasarkan kelurahan → Puskesmas accept/reject → PE (Penyelidikan Epidemiologi) → verifikasi Dinkes.

Rewrite dari prototipe `khazuraid/dbd` (NestJS + Next.js terpisah) menjadi **satu aplikasi Next.js
full-stack**. Alasan rewrite & temuan audit prototipe ada di rencana di `~/.claude/plans/`.

## Stack

| Layer       | Pilihan                                         |
| ----------- | ----------------------------------------------- |
| Framework   | Next.js 16 App Router (`src/`), React 19        |
| Bahasa      | TypeScript (strict)                             |
| UI          | Tailwind CSS 4 + `clsx`/`tailwind-merge` (`cn`) |
| DB          | PostgreSQL (PostGIS)                            |
| ORM         | Drizzle ORM + Drizzle Kit                       |
| Auth        | better-auth (email+password)                    |
| Validasi    | Zod 4                                           |
| Data klien  | TanStack Query + TanStack Table                 |
| Form        | react-hook-form + `@hookform/resolvers`         |
| Chart/Peta  | Recharts + react-leaflet                        |
| Export      | exceljs                                         |
| Test        | Vitest + Testing Library (jsdom)                |
| Lint/Format | ESLint 9 (`eslint-config-next`) + Prettier      |

## Perintah

```bash
npm run dev          # dev server
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run format       # prettier --write
npm run test         # vitest run

npm run db:generate  # drizzle-kit generate -> drizzle/*.sql
npm run db:migrate   # drizzle-kit migrate
npm run db:push      # drizzle-kit push (dev cepat)
npm run db:studio    # drizzle-kit studio
```

Setup awal: buat `.env` sendiri (file ini **tidak** ada di repo) dengan key berikut, lalu `npm run db:migrate`.

```bash
NEXT_PUBLIC_APP_NAME=WALI-EPI
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=postgresql://wali_epi:wali_epi_password@localhost:5432/wali_epi_db
BETTER_AUTH_SECRET=      # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
BETTER_AUTH_URL=http://localhost:3000
PII_ENCRYPTION_KEY=      # openssl rand -base64 32   (harus tepat 32 byte)
PII_HASH_KEY=            # openssl rand -hex 32
REDIS_URL=redis://localhost:6379
WORKER_CONCURRENCY=5     # opsional, default 5
```

`PII_ENCRYPTION_KEY` dan `PII_HASH_KEY` mengenkripsi NIK/nama/alamat pasien dan mencari NIK lewat
hash. **Menggantinya membuat data PII lama tidak terbaca** — simpan di secret manager, jangan di repo.

Worker terpisah (penugasan laporan, SLA 4 hari, notifikasi, export):

```bash
npm run worker       # produksi
npm run worker:dev   # tsx watch
```

Tanpa worker, laporan tetap tersimpan tetapi tidak ditugaskan otomatis; pekerjaan menumpuk di Redis.
Tanpa `REDIS_URL` aplikasi tetap jalan — `createReport` mencatat kegagalan enqueue ke log.

## Struktur

```
src/
  app/                 # App Router (halaman + API route handler)
    api/auth/[...all]/ # better-auth catch-all
  db/
    schema.ts          # seluruh tabel + enum (sumber kebenaran)
    index.ts           # klien Drizzle (postgres-js)
  lib/
    auth.ts            # konfigurasi better-auth + 4 role
    auth-client.ts     # klien auth sisi browser
    roles.ts           # ADMIN | DINKES | PUSKESMAS | RUMAH_SAKIT
    utils.ts           # cn()
drizzle/               # SQL migrasi hasil generate
```

## Peran

`ADMIN`, `DINKES`, `PUSKESMAS`, `RUMAH_SAKIT`. Role **server-owned** — registrasi tidak boleh
menentukan role sendiri (celah C1 pada prototipe lama).

## Aturan kerja

- Perubahan schema lewat `npm run db:generate`; migrasi di-commit, `db:push` hanya untuk dev lokal.
- Setiap perubahan perilaku disertai test Vitest.
- Tidak merge tanpa `npm run typecheck && npm run lint && npm run test && npm run build` hijau.
