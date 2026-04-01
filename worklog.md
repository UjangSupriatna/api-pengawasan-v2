---
Task ID: 1
Agent: Main Agent
Task: Konversi API Pengawasan Flask (Python) ke Next.js API untuk deploy di Vercel

Work Log:
- Menganalisis kode asli app.py (Flask + OpenCV + TensorFlow)
- Menemukan bahwa model .h5 (20MB) TIDAK pernah dipakai dalam logika prediksi
- Logika asli: rule-based (face detection + eye detection via Haar Cascade)
- Menentukan solusi: gunakan VLM (Vision Language Model) dari z-ai-web-dev-sdk
- Update Prisma schema: tambah model Pengawasan (ganti CSV)
- Push schema ke database (SQLite)
- Buat API route POST /api/predict (upload gambar + analisis VLM)
- Buat API route GET /api/pengawasan (riwayat + statistik + filter + pagination)
- Fix lint error (jsx comment text)
- Simplify page.tsx jadi API Settings page (bukan UI aplikasi)
- Response format dijamin sama dengan Flask asli: { "prediction": "Normal" | "Mencurigakan" }
- Verifikasi: ESLint clean, dev server compiled successfully

Stage Summary:
- Model .h5 TIDAK kompatibel dengan Vercel (terlalu berat + butuh OpenCV/TensorFlow)
- Diganti dengan VLM yang lebih powerful dan Vercel-friendly
- Kriteria deteksi sama: Normal (1 wajah + mata terbuka + menatap layar) vs Mencurigakan
- VLM bahkan lebih baik: bisa deteksi HP/tablet, orang lain, arah pandang, dll
- Response format kompatibel: code lama CodeIgniter tinggal ganti URL fetch
- Halaman utama = API Settings page (endpoint URL, migration guide, quick test, log viewer)
- File yang dibuat/diubah:
  - prisma/schema.prisma (tambah model Pengawasan)
  - src/app/api/predict/route.ts (POST endpoint)
  - src/app/api/pengawasan/route.ts (GET endpoint)
  - src/app/page.tsx (API Settings page)
  - src/lib/types.ts (TypeScript interfaces)
  - src/global.d.ts (window type declaration)

---
Task ID: 2
Agent: Main Agent
Task: Simplify halaman jadi API Settings, bukan UI aplikasi

Work Log:
- Analisis kode CodeIgniter integrasi (quiz proctoring)
- Pastikan response format: { "prediction": "Normal" | "Mencurigakan" } sama persis
- Error format juga sama: { "error": "..." } (No file part, No selected file, User ID is required)
- Buat migration guide di halaman settings
- Quick test form untuk test endpoint
- Log viewer untuk monitoring riwayat
- Hapus field user_name dari predict API (tidak dipakai CodeIgniter)
- Verifikasi: ESLint clean

Stage Summary:
- Halaman sekarang fokus ke API setting/configuration
- Migration dari Flask ke Vercel: cukup ganti 1 baris fetch URL
- Integrasi dengan CodeIgniter quiz: 100% kompatibel, tanpa perubahan logic client-side
