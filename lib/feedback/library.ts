// 360 Feedback — default competency library and configuration.
// Transcribed from the prototype. Admin can edit/add/remove competencies later;
// this only provides the initial seed (loaded lazily on first use).

export type Category = "CORE" | "LEADERSHIP" | "JOB_FAMILY" | "TECHNICAL";

export interface SeedCompetency {
  code: string;
  name: string;
  category: Category;
  department: string | null; // for JOB_FAMILY / TECHNICAL; null = all departments
  definition: string;
  levels: [string, string, string, string]; // L1..L4 anchors
}

export const DEPARTMENTS = ["Tech", "Commercial", "Operations", "Executive"];

export const LEVELS = [
  "Internship",
  "Part Time",
  "Officer",
  "Sr Officer",
  "Leader",
  "Manager",
  "Vice President",
  "C-Suites",
  "Direktur",
];

export const DEFAULT_LEVEL_TARGETS: Record<string, number> = {
  Internship: 1,
  "Part Time": 1,
  Officer: 1,
  "Sr Officer": 2,
  Leader: 2,
  Manager: 2,
  "Vice President": 3,
  "C-Suites": 4,
  Direktur: 4,
};

export const DEFAULT_WEIGHTS = { super: 0.4, peer: 0.3, sub: 0.3 };

// Bands evaluated in order: first band whose `max` is greater than the score wins.
export type Band = {
  key: string;
  label: string;
  max: number; // upper bound (exclusive); last band uses a large number
  color: string; // tailwind-ish token used in UI
};
export const DEFAULT_BANDS: Band[] = [
  { key: "unsat", label: "Unsatisfactory", max: 2, color: "red" },
  { key: "need", label: "Need Improvement", max: 3, color: "amber" },
  { key: "meet", label: "Meet Expectation", max: 3.5001, color: "teal" },
  { key: "exceed", label: "Exceed Expectation", max: 9999, color: "green" },
];

// 1-4 rating scale shown on the form.
export const SCALE: { value: number; label: string; hint: string }[] = [
  { value: 1, label: "Unsatisfactory", hint: "Tidak memenuhi standar / kompetensi belum tampak" },
  { value: 2, label: "Need Improvement", hint: "Sebagian memenuhi; masih perlu pengembangan" },
  { value: 3, label: "Meet Expectation", hint: "Memenuhi standar yang diharapkan" },
  { value: 4, label: "Exceed Expectation", hint: "Konsisten melampaui standar" },
];

export const CATEGORY_LABEL: Record<Category, string> = {
  CORE: "Core",
  LEADERSHIP: "Leadership",
  JOB_FAMILY: "Job Family",
  TECHNICAL: "Technical",
};

export const RELATION_LABEL: Record<string, string> = {
  SELF: "Diri sendiri",
  PEER: "Rekan (peer)",
  SUPERORDINATE: "Atasan",
  SUBORDINATE: "Bawahan",
};

const GENERIC: [string, string, string, string] = [
  "Basic — menjalankan tugas sederhana dengan bimbingan",
  "Applied — bekerja mandiri pada kasus rutin",
  "Professional — menangani kasus kompleks & memberi arahan",
  "Strategic — menetapkan standar & mendorong perbaikan sistemik",
];

export const COMPETENCY_LIBRARY: SeedCompetency[] = [
  // ---------- CORE ----------
  { code: "INT", name: "Initiative", category: "CORE", department: null,
    definition: "Mengukur inisiatif — bertindak cepat atas masalah/peluang tanpa menunggu instruksi, serta memunculkan ide perbaikan.",
    levels: ["Mengatasi masalah harian tanpa menunggu perintah", "Respons cepat & efektif dalam krisis (1–2 hari)", "Antisipasi peluang/kendala 1–3 bulan ke depan", "Transformasi inovatif sistem kerja jangka panjang"] },
  { code: "SCF", name: "Self-Confidence", category: "CORE", department: null,
    definition: "Rasa percaya diri yang seimbang — yakin mengambil keputusan namun terbuka pada kritik & terus belajar.",
    levels: ["Kemandirian operasional & tanggung jawab pribadi", "Resilien terhadap kritik tanpa defensif", "Integritas kapasitas — berani underpromise demi kualitas", "Intellectual humility & terus bertumbuh"] },
  { code: "ACH", name: "Achievement Orientation", category: "CORE", department: null,
    definition: "Dorongan berprestasi — bekerja dengan standar tinggi & hasil melebihi ekspektasi.",
    levels: ["Fokus kualitas (zero defect)", "Optimasi sumber daya & proses", "Target mandiri melampaui ekspektasi (overdeliver)", "Perbaikan sistemik berkelanjutan"] },
  { code: "OC", name: "Organizational Commitment", category: "CORE", department: null,
    definition: "Komitmen pada organisasi — menyelaraskan tindakan dengan tujuan & nilai perusahaan.",
    levels: ["Kepatuhan aktif pada aturan & nilai", "Keselarasan prioritas dengan tim", "Value advisor & teladan budaya", "Pengorbanan strategis demi perusahaan"] },
  { code: "FLX", name: "Flexibility", category: "CORE", department: null,
    definition: "Fleksibilitas — menyesuaikan diri dengan perubahan & menghargai perbedaan pendapat.",
    levels: ["Adaptasi tugas saat instruksi berubah", "Keterbukaan terhadap perspektif berbeda", "Modifikasi strategi untuk situasi kompleks", "Katalis perubahan organisasi"] },
  { code: "TW", name: "Teamwork & Cooperation", category: "CORE", department: null,
    definition: "Kerja sama tim — berbagi info, mendukung rekan, dan berkontribusi dalam kelompok.",
    levels: ["Partisipasi kooperatif & berbagi info", "Dukungan aktif ke rekan", "Kolaborasi lintas fungsi", "Team empowerment & sinergi"] },
  { code: "CSO", name: "Customer Service Orientation", category: "CORE", department: null,
    definition: "Orientasi melayani — keinginan membantu pelanggan/rekan sampai tuntas.",
    levels: ["Responsif & tanggap sesuai SLA", "Problem solver tuntas", "Advisor terpercaya jangka panjang", "Client-centric visionary"] },

  // ---------- LEADERSHIP ----------
  { code: "CT", name: "Conceptual Thinking", category: "LEADERSHIP", department: null,
    definition: "Berpikir strategis — memahami bisnis, pasar & angka untuk keputusan yang menguntungkan.",
    levels: ["Paham model bisnis & kontribusi tim", "Analisis tren pasar sederhana", "Strategi divisi dari data finansial/kompetitor", "Visi bisnis & model pendapatan baru"] },
  { code: "DEV", name: "Developing Others", category: "LEADERSHIP", department: null,
    definition: "Mengembangkan orang lain — membimbing, memberi feedback & menyiapkan kader.",
    levels: ["Instruksi jelas & bantu tugas harian", "Umpan balik & mentoring berkala", "Rencana karier tim & suksesor", "Budaya belajar & cetak pemimpin baru"] },
  { code: "IMP", name: "Impact & Influence", category: "LEADERSHIP", department: null,
    definition: "Pengaruh — memotivasi orang lain menerima & menjalankan perubahan.",
    levels: ["Terima & komunikasikan perubahan", "Bantu tim adaptasi transisi", "Strategi implementasi & atasi resistensi", "Agen perubahan budaya/model bisnis"] },
  { code: "DIR", name: "Directiveness", category: "LEADERSHIP", department: null,
    definition: "Ketegasan — menetapkan batas, mengambil keputusan tegas & memakai otoritas dengan tepat.",
    levels: ["Keputusan/instruksi harian jelas", "Keputusan mandiri saat mendesak", "Standar ketat & keputusan sulit", "Keputusan strategis arah baru perusahaan"] },

  // ---------- JOB FAMILY ----------
  { code: "AT", name: "Analytical Thinking", category: "JOB_FAMILY", department: "Tech",
    definition: "Berpikir analitis — memecah masalah teknis jadi bagian logis & melihat sebab-akibat.",
    levels: ["Pecah tugas & logika If-Then dasar", "Analisis hubungan antar modul/API", "Analisis multidimensi & prediksi bottleneck", "Arsitektur strategis & skalabilitas"] },
  { code: "EXP", name: "Technical Expertise", category: "JOB_FAMILY", department: "Tech",
    definition: "Kedalaman keahlian teknis pada bidang spesifik (mis. coding, desain, PM).",
    levels: ["Penguasaan tools dasar", "Praktisi mandiri", "Referensi teknis (code review/audit)", "Otoritas bidang & standar perusahaan"] },
  { code: "INF", name: "Information Seeking", category: "JOB_FAMILY", department: "Commercial",
    definition: "Menggali informasi — mencari data lebih dalam sebelum bertindak/memutuskan.",
    levels: ["Penggalian informasi standar", "Investigasi mendalam di luar sumber formal", "Riset lapangan & verifikasi", "Sistem intelijen strategis"] },
  { code: "IU", name: "Interpersonal Understanding", category: "JOB_FAMILY", department: "Commercial",
    definition: "Kepekaan interpersonal — memahami perasaan/maksud orang lain yang sering tak terucap.",
    levels: ["Menangkap pesan tersurat", "Membaca bahasa tubuh & emosi", "Memahami motif tersembunyi", "Memahami kompleksitas karakter & budaya"] },
  { code: "RB", name: "Relationship Building", category: "JOB_FAMILY", department: "Commercial",
    definition: "Membangun & menjaga jaringan hubungan yang mendukung pencapaian kerja.",
    levels: ["Menjalin kontak dasar", "Membangun kedekatan informal", "Pemeliharaan jaringan aktif", "Persahabatan strategis (advocate)"] },
  { code: "CO", name: "Concern for Order", category: "JOB_FAMILY", department: "Operations",
    definition: "Ketelitian & keteraturan — menjaga akurasi data, kepatuhan, dan kerapian.",
    levels: ["Pengecekan mandiri (akurasi data)", "Pemantauan akurasi & rekonsiliasi", "Penyusunan sistem kontrol (QA/audit)", "Tata kelola risiko (governance)"] },
  { code: "OA", name: "Organizational Awareness", category: "JOB_FAMILY", department: "Operations",
    definition: "Kesadaran organisasi — memahami struktur, budaya & dinamika 'politik' kantor.",
    levels: ["Paham struktur formal", "Paham struktur informal/influencer", "Paham iklim organisasi", "Navigasi strategis industri"] },
  { code: "SCT", name: "Self-Control", category: "JOB_FAMILY", department: "Operations",
    definition: "Pengendalian diri — tetap tenang & efektif di bawah tekanan atau konflik.",
    levels: ["Tetap tenang saat sibuk", "Menahan impulsivitas saat konflik", "Manajemen stres tinggi saat krisis", "Jangkar budaya saat transisi"] },

  // ---------- TECHNICAL ----------
  { code: "AIF", name: "AI Fluency", category: "TECHNICAL", department: null,
    definition: "Kefasihan AI — kemampuan & kemauan menggunakan, mengembangkan, dan membagikan pemanfaatan AI di pekerjaan.", levels: GENERIC },
  // Tech
  { code: "FEL", name: "Frontend Engineering & Logic", category: "TECHNICAL", department: "Tech", definition: "Frontend — membangun antarmuka responsif dengan pengelolaan state yang efisien.", levels: GENERIC },
  { code: "BSA", name: "Backend System Architecture", category: "TECHNICAL", department: "Tech", definition: "Backend — merancang logika server, API & alur sistem yang stabil.", levels: GENERIC },
  { code: "DBM", name: "Database Management", category: "TECHNICAL", department: "Tech", definition: "Database — menjaga & mengoptimalkan struktur penyimpanan data.", levels: GENERIC },
  { code: "UXD", name: "User Experience (UX) Design", category: "TECHNICAL", department: "Tech", definition: "UX — merancang pengalaman pengguna yang intuitif lewat riset & user journey.", levels: GENERIC },
  { code: "UID", name: "Interface Design (UI)", category: "TECHNICAL", department: "Tech", definition: "UI — menciptakan visual produk yang estetis, konsisten & fungsional.", levels: GENERIC },
  { code: "DAR", name: "Design Architecture", category: "TECHNICAL", department: "Tech", definition: "Arsitektur desain — menyusun struktur desain yang sistematis & scalable.", levels: GENERIC },
  { code: "PDV", name: "Product Discovery & Validation", category: "TECHNICAL", department: "Tech", definition: "Product discovery — menemukan masalah pengguna & memvalidasi solusi sebelum dibangun.", levels: GENERIC },
  { code: "POP", name: "Product Operations", category: "TECHNICAL", department: "Tech", definition: "Product operations — mengelola backlog, dokumentasi & alur rilis produk.", levels: GENERIC },
  { code: "PSA", name: "Product Strategy & Analytics", category: "TECHNICAL", department: "Tech", definition: "Strategi & analitik produk — mengolah data produk jadi roadmap berdampak bisnis.", levels: GENERIC },
  { code: "PPS", name: "Project Planning & Scheduling", category: "TECHNICAL", department: "Tech", definition: "Perencanaan proyek — menyusun jadwal, sprint & alokasi sumber daya.", levels: GENERIC },
  { code: "PGV", name: "Project Governance", category: "TECHNICAL", department: "Tech", definition: "Tata kelola proyek — menetapkan standar, kontrol & pelaporan keberhasilan proyek.", levels: GENERIC },
  { code: "AND", name: "Android Native Development", category: "TECHNICAL", department: "Tech", definition: "Android native — membangun aplikasi mobile berperforma tinggi.", levels: GENERIC },
  { code: "MSI", name: "Mobile System Integration", category: "TECHNICAL", department: "Tech", definition: "Integrasi sistem mobile — menghubungkan aplikasi dengan backend & layanan pihak ketiga.", levels: GENERIC },
  { code: "QAT", name: "Quality Assurance & Testing", category: "TECHNICAL", department: "Tech", definition: "QA & testing — merancang & menjalankan skenario uji untuk menjamin kualitas.", levels: GENERIC },
  { code: "DBG", name: "Systematic Debugging", category: "TECHNICAL", department: "Tech", definition: "Debugging sistematis — menelusuri & menemukan akar masalah teknis.", levels: GENERIC },
  { code: "DOI", name: "DevOps & Infrastructure", category: "TECHNICAL", department: "Tech", definition: "DevOps & infrastruktur — mengelola CI/CD & infrastruktur pendukung.", levels: GENERIC },
  { code: "COR", name: "Cloud Operations & Reliability", category: "TECHNICAL", department: "Tech", definition: "Keandalan cloud — menjaga ketersediaan & performa sistem di cloud.", levels: GENERIC },
  // Commercial
  { code: "CLC", name: "Commercial Law & Contracting", category: "TECHNICAL", department: "Commercial", definition: "Hukum komersial — memahami & menerapkan aspek legal kontrak untuk mitigasi risiko.", levels: GENERIC },
  { code: "CSP", name: "Commercial Software Proficiency", category: "TECHNICAL", department: "Commercial", definition: "Penguasaan software komersial (CRM/ERP/alat sales) untuk efisiensi & akurasi data.", levels: GENERIC },
  { code: "CSL", name: "Consultative Selling", category: "TECHNICAL", department: "Commercial", definition: "Consultative selling — menjual sebagai penasihat dengan solusi bernilai tambah.", levels: GENERIC },
  { code: "CPS", name: "Content Production & Storytelling", category: "TECHNICAL", department: "Commercial", definition: "Produksi konten & storytelling — membuat konten yang menyampaikan pesan merek secara persuasif.", levels: GENERIC },
  { code: "DCM", name: "Digital Campaign Management", category: "TECHNICAL", department: "Commercial", definition: "Manajemen kampanye digital — merencanakan, mengeksekusi & mengoptimalkan kampanye.", levels: GENERIC },
  { code: "DPE", name: "Digital Prospecting & Engagement", category: "TECHNICAL", department: "Commercial", definition: "Prospecting digital — mendekati & membangun interaksi awal dengan calon pelanggan.", levels: GENERIC },
  { code: "MKI", name: "Market Intelligence", category: "TECHNICAL", department: "Commercial", definition: "Market intelligence — menganalisis tren pasar, konsumen & kompetitor.", levels: GENERIC },
  { code: "MDA", name: "Marketing Data Analytics", category: "TECHNICAL", department: "Commercial", definition: "Analitik data marketing — mengubah metrik (ROI/CTR/CPA) jadi wawasan actionable.", levels: GENERIC },
  { code: "PSM", name: "Product & Solution Mastery", category: "TECHNICAL", department: "Commercial", definition: "Penguasaan produk & solusi — paham fitur, manfaat & nilai unik produk vs kompetitor.", levels: GENERIC },
  { code: "RM", name: "Relationship Management", category: "TECHNICAL", department: "Commercial", definition: "Relationship management — membina hubungan jangka panjang dengan klien/mitra.", levels: GENERIC },
  { code: "SEO", name: "Search Engine Optimization Mastery", category: "TECHNICAL", department: "Commercial", definition: "Penguasaan SEO — meningkatkan visibilitas & peringkat web (on/off-page & teknis).", levels: GENERIC },
  { code: "SCS", name: "SEO Content Strategy", category: "TECHNICAL", department: "Commercial", definition: "Strategi konten SEO — menyelaraskan konten dengan search intent untuk trafik organik.", levels: GENERIC },
  { code: "SNG", name: "Strategic Negotiation", category: "TECHNICAL", department: "Commercial", definition: "Negosiasi strategis — mencapai kesepakatan win-win sambil menjaga hubungan.", levels: GENERIC },
  { code: "VCO", name: "Visual Conceptualization", category: "TECHNICAL", department: "Commercial", definition: "Konseptualisasi visual — menerjemahkan brief jadi konsep visual sesuai merek.", levels: GENERIC },
  // Operations
  { code: "HRG", name: "HR Governance & Compliance", category: "TECHNICAL", department: "Operations", definition: "Tata kelola & kepatuhan HR — administrasi kepegawaian sesuai regulasi.", levels: GENERIC },
  { code: "PSME", name: "Performance Strategy & Metrics", category: "TECHNICAL", department: "Operations", definition: "Strategi & metrik performa — merancang sistem KPI/OKR selaras tujuan bisnis.", levels: GENERIC },
  { code: "ORGD", name: "Organizational Development", category: "TECHNICAL", department: "Operations", definition: "Organizational development — merancang struktur & budaya untuk efektivitas kerja.", levels: GENERIC },
  { code: "REC", name: "Recruitment & Selection", category: "TECHNICAL", department: "Operations", definition: "Rekrutmen & seleksi — menarik & memilih talenta terbaik.", levels: GENERIC },
  { code: "REM", name: "Remuneration Management", category: "TECHNICAL", department: "Operations", definition: "Manajemen remunerasi — mengelola penggajian, kompensasi & benefit yang kompetitif.", levels: GENERIC },
  { code: "SFP", name: "Strategic Financial Planning", category: "TECHNICAL", department: "Operations", definition: "Perencanaan keuangan strategis — analisis keuangan untuk proyeksi & keputusan investasi.", levels: GENERIC },
  { code: "FMD", name: "Financial Modeling", category: "TECHNICAL", department: "Operations", definition: "Financial modeling — membangun simulasi untuk memprediksi performa finansial.", levels: GENERIC },
  { code: "TCC", name: "Treasury & Cost Control", category: "TECHNICAL", department: "Operations", definition: "Treasury & cost control — mengelola arus kas, pengeluaran & likuiditas.", levels: GENERIC },
  { code: "FGA", name: "Financial Governance & Audit", category: "TECHNICAL", department: "Operations", definition: "Tata kelola & audit keuangan — menjaga integritas lewat kontrol & audit.", levels: GENERIC },
  { code: "TAX", name: "Taxation Management", category: "TECHNICAL", department: "Operations", definition: "Manajemen pajak — perencanaan, perhitungan & pelaporan kewajiban pajak.", levels: GENERIC },
];
