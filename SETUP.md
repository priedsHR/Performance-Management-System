# Setup OKR App

## 1. Buat Database di Neon (gratis)

1. Buka https://neon.tech → Sign up / Login
2. Buat project baru
3. Copy **Connection String** (format: `postgresql://user:pass@host/db?sslmode=require`)

## 2. Isi file `.env`

Edit file `.env` di root project:

```
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
AUTH_SECRET="buat_secret_random_panjang"
```

Untuk `AUTH_SECRET`, buat dengan: `openssl rand -base64 32`
Atau pakai generator online random string (min 32 karakter).

## 3. Setup Database

```bash
# Generate Prisma client
npx prisma generate

# Jalankan migrasi
npx prisma migrate dev --name init

# Seed akun admin pertama
npm run db:seed
```

Akun admin default:
- Email: `admin@okr.com`
- Password: `admin123`

**Ganti password setelah login pertama!**

## 4. Jalankan Lokal

```bash
npm run dev
```

Buka http://localhost:3000

## 5. Deploy ke Vercel

1. Push code ke GitHub
2. Buka https://vercel.com → Import repository
3. Tambah **Environment Variables** di Vercel:
   - `DATABASE_URL` → connection string Neon
   - `AUTH_SECRET` → secret yang sama
4. Deploy!

Vercel otomatis jalankan `prisma generate` via `postinstall` script.

## Alur Penggunaan

1. **Admin** login → buat Quarter → aktifkan Quarter
2. **Admin** tambah pengguna di menu Pengguna
3. **Member** login → buka "OKR Saya" → tambah Objective & Key Result
4. **Member** isi progress di setiap Key Result
5. **Dashboard** tampil pencapaian otomatis
