/**
 * ForensicLens i18n — Auto-detects browser language
 * Supported: ko, en, zh, ja, th, id, es/pt (Latin)
 */
const TRANSLATIONS = {
  ko: {
    heroEyebrow: "AI 포렌식 탐지 엔진 v2.0 · Gemini 2.5 Flash",
    heroTitle: "사진 조작,<br/><span class='gradient-text'>AI가 전부 봅니다</span>",
    heroSub: "ELA · 노이즈 · Copy-Move · FFT · EXIF 썸네일 복원으로 조작 흔적을 찾고 Gemini Vision이 원본을 추정합니다. 모든 점수는 논문 근거 기반.",
    uploadTitle: "사진을 드래그하거나 클릭하여 업로드",
    uploadSub: "JPG · PNG · WEBP · BMP / 최대 20MB",
    uploadBtn: "사진 선택하기",
    analyzeBtn: "포렌식 분석 시작",
    resetBtn: "✕ 다시 선택",
    panel1: "① ORIGINAL",
    panel2: "② MANIPULATION DETECTED",
    panel3: "③ ESTIMATED ORIGINAL",
    panel1Cap: "업로드된 사진",
    panel2Cap: "복합 조작 히트맵",
    panel3Cap: "AI 분석 진행 중",
    threePanelTitle: "🖼 3패널 비교",
    threePanelSub: "원본 · 조작 감지 복합 히트맵 · AI 추정 원본을 나란히 비교하세요",
    sliderTitle: "◀▶ Before / After 슬라이더",
    sliderSub: "슬라이더를 드래그해 원본과 추정 원본을 비교하세요",
    videoTitle: "🎬 트랜지션 영상",
    videoSub: "원본 → 조작 감지 → 추정 원본으로 변화하는 과정",
    loadingTitle: "포렌식 분석 + AI 원본 추정 중...",
    steps: ["ELA 오류 레벨 분석","노이즈 패턴 분석","Copy-Move 탐지 (SIFT+RANSAC)","FFT 스펙트럼 분석","EXIF 메타데이터 추출","복합 히트맵 생성","Gemini 2.5 Flash Vision 분석","트랜지션 영상 생성"],
    scoreLabel: "종합 조작 가능성 (베이지안 추론)",
    historyTitle: "📁 분석 기록",
    historyEmpty: "아직 분석 기록이 없습니다",
    historyClear: "기록 삭제",
    newAnalysis: "🔄 새 사진 분석하기",
    consentTitle: "개인정보 처리 동의",
    consentBody: "업로드하신 이미지는 포렌식 분석 목적으로만 일시적으로 처리되며 서버에 영구 저장되지 않습니다.",
    consent1: "이미지가 분석 목적으로만 처리되며 서버에 저장되지 않음에 동의합니다. (필수)",
    consent2: "본인이 업로드 권한을 가진 이미지임을 확인하며, 타인의 초상권을 침해하지 않음에 동의합니다. (필수)",
    consent3: "만 14세 이상이며, 해당 분석 서비스 이용에 동의합니다. (필수)",
    consentGDPR: "EU GDPR · 캘리포니아 CCPA · 한국 개인정보보호법 준수",
    consentAccept: "동의하고 분석 시작",
    consentDecline: "취소",
    privacyLink: "개인정보 처리방침",
    footerNote: "분석 결과는 참고용이며 법적 증거로 사용될 수 없습니다. 모든 점수는 논문 기반 알고리즘입니다.",
  },
  en: {
    heroEyebrow: "AI Forensic Detection Engine v2.0 · Gemini 2.5 Flash",
    heroTitle: "Photo Manipulation,<br/><span class='gradient-text'>AI Sees It All</span>",
    heroSub: "ELA · Noise · Copy-Move · FFT · EXIF Thumbnail Recovery to detect tampering. Gemini Vision estimates the original. All scores are paper-based.",
    uploadTitle: "Drag & drop or click to upload",
    uploadSub: "JPG · PNG · WEBP · BMP / Max 20MB",
    uploadBtn: "Select Photo",
    analyzeBtn: "Start Forensic Analysis",
    resetBtn: "✕ Upload New",
    panel1: "① ORIGINAL",
    panel2: "② MANIPULATION DETECTED",
    panel3: "③ ESTIMATED ORIGINAL",
    panel1Cap: "Uploaded photo",
    panel2Cap: "Composite manipulation heatmap",
    panel3Cap: "AI analysis in progress",
    threePanelTitle: "🖼 3-Panel Comparison",
    threePanelSub: "Compare Original · Manipulation Heatmap · AI Estimated Original side by side",
    sliderTitle: "◀▶ Before / After Slider",
    sliderSub: "Drag to compare original and estimated original",
    videoTitle: "🎬 Transition Video",
    videoSub: "Original → Manipulation Detected → Estimated Original",
    loadingTitle: "Forensic Analysis + AI Restoration...",
    steps: ["ELA Error Level Analysis","Noise Pattern Analysis","Copy-Move Detection (SIFT+RANSAC)","FFT Spectrum Analysis","EXIF Metadata Extraction","Composite Heatmap Generation","Gemini 2.5 Flash Vision Analysis","Transition Video Generation"],
    scoreLabel: "Overall Manipulation Probability (Bayesian)",
    historyTitle: "📁 Analysis History",
    historyEmpty: "No analysis history yet",
    historyClear: "Clear History",
    newAnalysis: "🔄 Analyze New Photo",
    consentTitle: "Privacy Consent",
    consentBody: "Uploaded images are processed temporarily for forensic analysis only and are NOT stored permanently on our servers.",
    consent1: "I agree that my image is processed for analysis only and not stored on the server. (Required)",
    consent2: "I confirm I have the right to upload this image and it does not infringe on others' rights. (Required)",
    consent3: "I am 14 years of age or older. (Required)",
    consentGDPR: "GDPR · CCPA · Korean PIPA Compliant",
    consentAccept: "Agree & Start Analysis",
    consentDecline: "Cancel",
    privacyLink: "Privacy Policy",
    footerNote: "Analysis results are for reference only and cannot be used as legal evidence. All scores use peer-reviewed algorithms.",
  },
  zh: {
    heroEyebrow: "AI 取证检测引擎 v2.0 · Gemini 2.5 Flash",
    heroTitle: "照片篡改，<br/><span class='gradient-text'>AI 全部看见</span>",
    heroSub: "ELA · 噪声 · 复制移动 · FFT · EXIF缩略图恢复检测篡改痕迹。Gemini Vision估算原始图像。所有分数基于论文。",
    uploadTitle: "拖放或点击上传照片",
    uploadSub: "JPG · PNG · WEBP · BMP / 最大20MB",
    uploadBtn: "选择照片",
    analyzeBtn: "开始取证分析",
    resetBtn: "✕ 重新选择",
    panel1: "① 原始图像",
    panel2: "② 篡改检测",
    panel3: "③ 估算原始",
    panel1Cap: "上传的照片",
    panel2Cap: "复合篡改热力图",
    panel3Cap: "AI分析中",
    threePanelTitle: "🖼 三面板比较",
    threePanelSub: "并排比较原始·篡改热力图·AI估算原始",
    sliderTitle: "◀▶ 前后对比滑块",
    sliderSub: "拖动滑块比较原始和估算原始",
    videoTitle: "🎬 过渡视频",
    videoSub: "原始 → 检测篡改 → 估算原始",
    loadingTitle: "取证分析 + AI原始估算...",
    steps: ["ELA误差级别分析","噪声模式分析","复制移动检测","FFT频谱分析","EXIF元数据提取","复合热力图生成","Gemini Vision分析","过渡视频生成"],
    scoreLabel: "综合篡改概率 (贝叶斯推断)",
    historyTitle: "📁 分析历史",
    historyEmpty: "暂无分析历史",
    historyClear: "清除历史",
    newAnalysis: "🔄 分析新照片",
    consentTitle: "隐私同意",
    consentBody: "您上传的图像仅用于取证分析，不会永久存储在我们的服务器上。",
    consent1: "我同意图像仅用于分析目的，不存储在服务器上。（必填）",
    consent2: "我确认我有权上传此图像，不侵犯他人权利。（必填）",
    consent3: "我年满14岁。（必填）",
    consentGDPR: "符合GDPR · CCPA · 韩国个人信息保护法",
    consentAccept: "同意并开始分析",
    consentDecline: "取消",
    privacyLink: "隐私政策",
    footerNote: "分析结果仅供参考，不能作为法律证据。所有分数使用经过同行评审的算法。",
  },
  ja: {
    heroEyebrow: "AI フォレンジック検出エンジン v2.0 · Gemini 2.5 Flash",
    heroTitle: "写真の改ざん、<br/><span class='gradient-text'>AIがすべてを見る</span>",
    heroSub: "ELA・ノイズ・コピームーブ・FFT・EXIF サムネイル復元で改ざん痕跡を検出。Gemini Visionが元画像を推定。すべてのスコアは論文に基づく。",
    uploadTitle: "ドラッグまたはクリックしてアップロード",
    uploadSub: "JPG · PNG · WEBP · BMP / 最大20MB",
    uploadBtn: "写真を選択",
    analyzeBtn: "フォレンジック分析開始",
    resetBtn: "✕ やり直す",
    panel1: "① オリジナル",
    panel2: "② 改ざん検出",
    panel3: "③ 推定オリジナル",
    panel1Cap: "アップロードした写真",
    panel2Cap: "複合改ざんヒートマップ",
    panel3Cap: "AI分析中",
    threePanelTitle: "🖼 3パネル比較",
    threePanelSub: "オリジナル・改ざんヒートマップ・AI推定オリジナルを並べて比較",
    sliderTitle: "◀▶ Before / After スライダー",
    sliderSub: "スライダーをドラッグしてオリジナルと推定オリジナルを比較",
    videoTitle: "🎬 トランジション動画",
    videoSub: "オリジナル → 改ざん検出 → 推定オリジナル",
    loadingTitle: "フォレンジック分析 + AI復元中...",
    steps: ["ELAエラーレベル分析","ノイズパターン分析","コピームーブ検出","FFTスペクトル分析","EXIFメタデータ抽出","複合ヒートマップ生成","Gemini Vision分析","トランジション動画生成"],
    scoreLabel: "総合改ざん確率（ベイズ推論）",
    historyTitle: "📁 分析履歴",
    historyEmpty: "分析履歴はまだありません",
    historyClear: "履歴を削除",
    newAnalysis: "🔄 新しい写真を分析",
    consentTitle: "プライバシー同意",
    consentBody: "アップロードされた画像はフォレンジック分析のみに一時的に処理され、サーバーに永続的に保存されません。",
    consent1: "画像が分析目的のみに処理され、サーバーに保存されないことに同意します。（必須）",
    consent2: "この画像をアップロードする権利があり、他者の権利を侵害しないことを確認します。（必須）",
    consent3: "14歳以上であることを確認します。（必須）",
    consentGDPR: "GDPR · CCPA · 韓国個人情報保護法 準拠",
    consentAccept: "同意して分析開始",
    consentDecline: "キャンセル",
    privacyLink: "プライバシーポリシー",
    footerNote: "分析結果は参考用であり、法的証拠として使用することはできません。",
  },
  th: {
    heroEyebrow: "เอนจิ้นตรวจจับนิติวิทยา AI v2.0 · Gemini 2.5 Flash",
    heroTitle: "การตกแต่งภาพ,<br/><span class='gradient-text'>AI เห็นทุกอย่าง</span>",
    heroSub: "ตรวจจับร่องรอยการตกแต่งด้วย ELA · Noise · Copy-Move · FFT · EXIF Gemini Vision ประมาณภาพต้นฉบับ คะแนนทั้งหมดอิงตามงานวิจัย",
    uploadTitle: "ลากวางหรือคลิกเพื่ออัปโหลด",
    uploadSub: "JPG · PNG · WEBP · BMP / สูงสุด 20MB",
    uploadBtn: "เลือกรูปภาพ",
    analyzeBtn: "เริ่มการวิเคราะห์นิติวิทยา",
    resetBtn: "✕ อัปโหลดใหม่",
    panel1: "① ต้นฉบับ",
    panel2: "② ตรวจจับการตกแต่ง",
    panel3: "③ ประมาณต้นฉบับ",
    panel1Cap: "รูปภาพที่อัปโหลด",
    panel2Cap: "แผนที่ความร้อนการตกแต่ง",
    panel3Cap: "AI กำลังวิเคราะห์",
    threePanelTitle: "🖼 เปรียบเทียบ 3 พาเนล",
    threePanelSub: "เปรียบเทียบต้นฉบับ · แผนที่ความร้อน · ประมาณต้นฉบับเคียงข้างกัน",
    sliderTitle: "◀▶ แถบเลื่อนก่อน/หลัง",
    sliderSub: "ลากแถบเลื่อนเพื่อเปรียบเทียบ",
    videoTitle: "🎬 วิดีโอการเปลี่ยนแปลง",
    videoSub: "ต้นฉบับ → ตรวจจับ → ประมาณต้นฉบับ",
    loadingTitle: "กำลังวิเคราะห์ + ประมาณต้นฉบับ...",
    steps: ["วิเคราะห์ ELA","วิเคราะห์ Noise","ตรวจจับ Copy-Move","วิเคราะห์ FFT","ดึงข้อมูล EXIF","สร้าง Heatmap","Gemini Vision","สร้างวิดีโอ"],
    scoreLabel: "ความน่าจะเป็นการตกแต่ง (Bayesian)",
    historyTitle: "📁 ประวัติการวิเคราะห์",
    historyEmpty: "ยังไม่มีประวัติการวิเคราะห์",
    historyClear: "ล้างประวัติ",
    newAnalysis: "🔄 วิเคราะห์รูปใหม่",
    consentTitle: "ความยินยอมด้านความเป็นส่วนตัว",
    consentBody: "รูปภาพที่อัปโหลดจะถูกประมวลผลชั่วคราวเพื่อการวิเคราะห์เท่านั้น ไม่มีการจัดเก็บถาวร",
    consent1: "ฉันยินยอมให้ประมวลผลรูปภาพเพื่อการวิเคราะห์เท่านั้น (จำเป็น)",
    consent2: "ฉันยืนยันว่ามีสิทธิ์อัปโหลดรูปภาพนี้ (จำเป็น)",
    consent3: "ฉันอายุ 14 ปีขึ้นไป (จำเป็น)",
    consentGDPR: "สอดคล้องกับ GDPR · CCPA · กฎหมายคุ้มครองข้อมูลส่วนบุคคล",
    consentAccept: "ยินยอมและเริ่มการวิเคราะห์",
    consentDecline: "ยกเลิก",
    privacyLink: "นโยบายความเป็นส่วนตัว",
    footerNote: "ผลการวิเคราะห์ใช้เป็นข้อมูลอ้างอิงเท่านั้น",
  },
  id: {
    heroEyebrow: "Mesin Deteksi Forensik AI v2.0 · Gemini 2.5 Flash",
    heroTitle: "Manipulasi Foto,<br/><span class='gradient-text'>AI Melihat Semuanya</span>",
    heroSub: "ELA · Noise · Copy-Move · FFT · Pemulihan Thumbnail EXIF untuk mendeteksi manipulasi. Gemini Vision memperkirakan gambar asli. Semua skor berdasarkan penelitian.",
    uploadTitle: "Seret & lepas atau klik untuk unggah",
    uploadSub: "JPG · PNG · WEBP · BMP / Maks 20MB",
    uploadBtn: "Pilih Foto",
    analyzeBtn: "Mulai Analisis Forensik",
    resetBtn: "✕ Unggah Ulang",
    panel1: "① ASLI",
    panel2: "② MANIPULASI TERDETEKSI",
    panel3: "③ ESTIMASI ASLI",
    panel1Cap: "Foto yang diunggah",
    panel2Cap: "Peta panas manipulasi komposit",
    panel3Cap: "AI sedang menganalisis",
    threePanelTitle: "🖼 Perbandingan 3 Panel",
    threePanelSub: "Bandingkan Asli · Peta Panas · Estimasi Asli secara berdampingan",
    sliderTitle: "◀▶ Slider Sebelum/Sesudah",
    sliderSub: "Seret slider untuk membandingkan",
    videoTitle: "🎬 Video Transisi",
    videoSub: "Asli → Terdeteksi → Estimasi Asli",
    loadingTitle: "Analisis Forensik + Estimasi Asli AI...",
    steps: ["Analisis ELA","Analisis Noise","Deteksi Copy-Move","Analisis FFT","Ekstraksi EXIF","Heatmap Komposit","Analisis Gemini Vision","Pembuatan Video"],
    scoreLabel: "Probabilitas Manipulasi (Bayesian)",
    historyTitle: "📁 Riwayat Analisis",
    historyEmpty: "Belum ada riwayat analisis",
    historyClear: "Hapus Riwayat",
    newAnalysis: "🔄 Analisis Foto Baru",
    consentTitle: "Persetujuan Privasi",
    consentBody: "Gambar yang diunggah diproses sementara hanya untuk analisis forensik dan tidak disimpan secara permanen.",
    consent1: "Saya setuju gambar diproses hanya untuk analisis, tidak disimpan. (Wajib)",
    consent2: "Saya mengonfirmasi bahwa saya berhak mengunggah gambar ini. (Wajib)",
    consent3: "Saya berusia 14 tahun ke atas. (Wajib)",
    consentGDPR: "Sesuai GDPR · CCPA · UU Perlindungan Data Pribadi",
    consentAccept: "Setuju & Mulai Analisis",
    consentDecline: "Batal",
    privacyLink: "Kebijakan Privasi",
    footerNote: "Hasil analisis hanya untuk referensi dan tidak dapat digunakan sebagai bukti hukum.",
  },
  es: {
    heroEyebrow: "Motor de Detección Forense AI v2.0 · Gemini 2.5 Flash",
    heroTitle: "Manipulación de Fotos,<br/><span class='gradient-text'>La IA Lo Ve Todo</span>",
    heroSub: "ELA · Ruido · Copy-Move · FFT · Recuperación EXIF para detectar manipulaciones. Gemini Vision estima la imagen original. Todas las puntuaciones basadas en investigación.",
    uploadTitle: "Arrastra o haz clic para subir",
    uploadSub: "JPG · PNG · WEBP · BMP / Máx 20MB",
    uploadBtn: "Seleccionar Foto",
    analyzeBtn: "Iniciar Análisis Forense",
    resetBtn: "✕ Nueva Foto",
    panel1: "① ORIGINAL",
    panel2: "② MANIPULACIÓN DETECTADA",
    panel3: "③ ORIGINAL ESTIMADO",
    panel1Cap: "Foto subida",
    panel2Cap: "Mapa de calor de manipulación",
    panel3Cap: "IA analizando",
    threePanelTitle: "🖼 Comparación de 3 Paneles",
    threePanelSub: "Compara Original · Mapa de Calor · Original Estimado uno al lado del otro",
    sliderTitle: "◀▶ Control deslizante Antes/Después",
    sliderSub: "Arrastra para comparar",
    videoTitle: "🎬 Video de Transición",
    videoSub: "Original → Detectado → Original Estimado",
    loadingTitle: "Análisis Forense + Estimación IA...",
    steps: ["Análisis ELA","Análisis de Ruido","Detección Copy-Move","Análisis FFT","Extracción EXIF","Mapa de Calor Compuesto","Análisis Gemini Vision","Generación de Video"],
    scoreLabel: "Probabilidad de Manipulación (Bayesiano)",
    historyTitle: "📁 Historial de Análisis",
    historyEmpty: "Aún no hay historial",
    historyClear: "Borrar historial",
    newAnalysis: "🔄 Analizar Nueva Foto",
    consentTitle: "Consentimiento de Privacidad",
    consentBody: "Las imágenes subidas se procesan temporalmente solo para análisis forense y NO se almacenan permanentemente.",
    consent1: "Acepto que mi imagen se procese solo para análisis y no se almacene. (Requerido)",
    consent2: "Confirmo que tengo derecho a subir esta imagen. (Requerido)",
    consent3: "Tengo 14 años o más. (Requerido)",
    consentGDPR: "Cumple con GDPR · CCPA · Leyes de Protección de Datos",
    consentAccept: "Aceptar e Iniciar Análisis",
    consentDecline: "Cancelar",
    privacyLink: "Política de Privacidad",
    footerNote: "Los resultados son solo de referencia y no pueden usarse como evidencia legal.",
  },
};

function detectLang() {
  const lang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
  if (lang.startsWith('ko')) return 'ko';
  if (lang.startsWith('zh')) return 'zh';
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('th')) return 'th';
  if (lang.startsWith('id')) return 'id';
  if (lang.startsWith('es') || lang.startsWith('pt')) return 'es';
  return 'en';
}

const LANG = detectLang();
const T = TRANSLATIONS[LANG] || TRANSLATIONS.en;

function applyTranslations() {
  // Hero
  document.querySelector('.hero-eyebrow').textContent = T.heroEyebrow;
  document.querySelector('.hero-title').innerHTML = T.heroTitle;
  document.querySelector('.hero-sub').innerHTML = T.heroSub;
  // Upload
  document.querySelector('.upload-title').textContent = T.uploadTitle;
  document.querySelector('.upload-sub').textContent = T.uploadSub;
  document.querySelector('.btn-upload').textContent = T.uploadBtn;
  document.querySelector('.btn-analyze').innerHTML = '<span class="btn-icon">🔬</span> ' + T.analyzeBtn;
  document.querySelector('.btn-reset').textContent = T.resetBtn;
  // Panels
  const badges = document.querySelectorAll('.panel-badge');
  if (badges[0]) badges[0].textContent = T.panel1;
  if (badges[1]) badges[1].textContent = T.panel2;
  if (badges[2]) badges[2].textContent = T.panel3;
  const caps = document.querySelectorAll('.panel-caption');
  if (caps[0]) caps[0].textContent = T.panel1Cap;
  if (caps[1]) caps[1].textContent = T.panel2Cap;
  // Section titles
  const sectionTitles = document.querySelectorAll('.section-title');
  if (sectionTitles[0]) {
    sectionTitles[0].querySelector('h2').textContent = T.threePanelTitle;
    sectionTitles[0].querySelector('p').textContent = T.threePanelSub;
  }
  if (sectionTitles[1]) {
    sectionTitles[1].querySelector('h2').textContent = T.sliderTitle;
    sectionTitles[1].querySelector('p').textContent = T.sliderSub;
  }
  if (sectionTitles[2]) {
    sectionTitles[2].querySelector('h2').textContent = T.videoTitle;
    sectionTitles[2].querySelector('p').textContent = T.videoSub;
  }
  // Loading
  document.querySelector('.loading-title').textContent = T.loadingTitle;
  document.querySelectorAll('.loading-step').forEach((el, i) => {
    if (T.steps[i]) el.textContent = T.steps[i];
  });
  // Score
  const sl = document.querySelector('.score-label');
  if (sl) sl.textContent = T.scoreLabel;
  // Buttons
  const newBtn = document.getElementById('newAnalysisBtn');
  if (newBtn) newBtn.textContent = T.newAnalysis;
  // Footer
  const fn = document.querySelector('.footer-note');
  if (fn) fn.textContent = T.footerNote;
  // History
  const ht = document.getElementById('historyTitle');
  if (ht) ht.textContent = T.historyTitle;
}
