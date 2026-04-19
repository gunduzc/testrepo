---
geometry: margin=2.5cm
fontsize: 11pt
header-includes:
  - \usepackage{longtable}
  - \usepackage{booktabs}
  - \usepackage{array}
  - \setlength{\parskip}{0.6em}
  - \setlength{\parindent}{0pt}
  - \renewcommand{\arraystretch}{1.5}
  - \setlength{\LTpre}{1em}
  - \setlength{\LTpost}{1em}
  - \setlength{\tabcolsep}{6pt}
---

\begin{center}

{\Large TOBB Ekonomi ve Teknoloji Üniversitesi}

{\large Bilgisayar Mühendisliği Bölümü}

\vspace{0.5em}

Bitirme Projesi --- BİL496

\vspace{2em}

{\LARGE \textbf{Programlanabilir Aralıklı Tekrar Öğrenme Platformu}}

\vspace{0.5em}

{\large Proje Kısıt ve Etkiler Dokümanı}

\vspace{2em}

{\large Grup KORN}

\vspace{1em}

\begin{tabular}{ll}
Ahmet Babagil & 211101067 \\
Cemil Gündüz & 211101015 \\
Emre Ekşi & 211104087 \\
Seda Naz Dolu & 201104084 \\
\end{tabular}

\vspace{2em}

Nisan 2026

\end{center}

\newpage

## Uyulan Mühendislik Standartları

### 1. OWASP Top 10 (2021) [1]

Platformda eğitimciler tarafından yazılan JavaScript kodu sunucu tarafında çalıştırılmakta, kullanıcı kimlik doğrulaması ve yetkilendirme uygulanmaktadır.

| Madde | Uygulanabilirlik | Durum | Kanıt |
|:------|:-----------------|:------|:------|
| A01: Broken Access Control | Rol tabanlı erişim kontrolü (Admin, Educator, Student). API rotalarında yetki kontrolleri. | Uyumlu | Kod incelemesi: tüm API route dosyalarında `session.user.role` kontrolleri. 15+ test dosyası. |
| A03: Injection | Eğitimci kaynaklı JavaScript kodunun sunucuda çalıştırılması. | Uyumlu | QuickJS WASM sandbox: 8 MB bellek, 1s zaman aşımı, host API erişimi yok. `sandbox.service.test.ts` |
| A04: Insecure Design | Doğru cevapların istemciye gönderilmemesi (sunucu tarafı doğrulama). | Uyumlu | Mimari inceleme: `StudyService` akışı, `ActiveStudySession` modeli. Cevaplar sunucu tarafında saklanır. |
| A07: Auth Failures | Kimlik doğrulama, oturum yönetimi, 2FA. | Uyumlu | NextAuth.js v5, bcrypt (12 round), TOTP 2FA opsiyonel; etkinleştirildiğinde oturum açmada zorunlu. |

\vspace{1em}

### 2. KVKK (6698 sayılı Kişisel Verilerin Korunması Kanunu) [2]

Platform self-host mimarisiyle tasarlanmıştır. Dağıtımı yapan kurum (okul, üniversite, şirket vb.) KVKK kapsamında veri sorumlusudur (Madde 3). Yazılım geliştiricisi, veriye erişmediğinden veri sorumlusu veya veri işleyen sıfatı taşımamaktadır [12]. Platform, dağıtımcı kurumun KVKK yükümlülüklerini yerine getirmesini kolaylaştıran teknik altyapıyı sağlamaktadır.

Öğrenme performans verileri (cevap geçmişi, çalışma süreleri, başarı oranları) Madde 6 kapsamında özel nitelikli kişisel veri değildir; olağan kişisel veri olarak Madde 5 kapsamında işlenmektedir. Kurumlar bu verileri açık rıza olmaksızın işleyebilir: sözleşmenin ifası (Md. 5/2-c: kayıt/hizmet sözleşmesi), hukuki yükümlülük (Md. 5/2-ç: MEB/YÖK düzenlemeleri) veya meşru menfaat (Md. 5/2-f: öğrenme optimizasyonu, denge testi ile) temelinde [2].

| Madde | Platform Katkısı | Durum | Kanıt |
|:------|:-----------------|:------|:------|
| Md. 4 (Genel İlkeler) | Toplanan veriler yalnızca öğrenme optimizasyonu amacıyla kullanılmaktadır. Veri minimizasyonu: IP, cihaz, konum bilgisi toplanmamaktadır. | Uyumlu | Veri modeli: `ReviewLog`, `StudentCardState` şemaları |
| Md. 10 (Aydınlatma) | Admin paneli üzerinden yapılandırılabilir aydınlatma metni desteği sunulmaktadır. Metin yapılandırıldığında kayıt sırasında kullanıcılara gösterilir ve onay istenir. | Uyumlu | Admin ayarları API'si, kayıt sayfası entegrasyonu |
| Md. 11 (Kişi Hakları) | Veri dışa aktarım endpoint'i, admin panelinden düzeltme/silme (isim, e-posta, parola, 2FA). Community modunda self-servis planlanmaktadır. | Uyumlu | `GET /api/user/export`, `PATCH/DELETE /api/admin/users/:id` |
| Md. 12 (Veri Güvenliği) | Parola hash'leme, 2FA şifreleme, WASM sandbox izolasyonu. Veriler kurum altyapısında kalır. | Uyumlu | bcrypt (12 round), AES şifreleme, QuickJS WASM |

\vspace{1em}

### 3. ISO/IEC/IEEE 12207:2017 — Yazılım Yaşam Döngüsü Süreçleri [3]

Standardın teknik süreçler bölümü (Clause 6.4) kapsamında aşağıdaki süreçler uygulanmıştır:

| Süreç | Uygulanabilirlik | Durum | Kanıt |
|:------|:-----------------|:------|:------|
| Gereksinim Tanımlama | LLD dokümanı ile gereksinimler tanımlanmıştır. | Uyumlu | `LLD_Report.md` |
| Mimari Tanımlama | Katmanlı mimari (Core / UX Layer) tasarlanmıştır. | Uyumlu | `docs/ARCHITECTURE.md` |
| Doğrulama | Birim ve entegrasyon testleri ile doğrulama yapılmıştır. | Uyumlu | 15 test dosyası, 276 test (`*.test.ts`) |

\vspace{1em}

### 4. WCAG 2.1 — Web İçerik Erişilebilirlik Yönergeleri [4]

| Madde | Uygulanabilirlik | Durum | Kanıt |
|:------|:-----------------|:------|:------|
| 1.4.1 Renk Kullanımı | Karanlık/aydınlık tema desteği. | Kısmi Uyum | Tema değiştirme bileşeni, Tailwind CSS. Kapsamlı erişilebilirlik denetimi yapılamamıştır. |
| 2.1.1 Klavye Erişimi | Çalışma oturumu ve form arayüzleri. | Uyumlu | Tüm formlar ve çalışma akışı klavye ile kullanılabilir. |

\vspace{1em}

### 5. RFC 6238 — TOTP: Time-Based One-Time Password Algorithm [11]

| Madde | Uygulanabilirlik | Durum | Kanıt |
|:------|:-----------------|:------|:------|
| Section 4 (Algorithm) | İki faktörlü kimlik doğrulama. | Uyumlu | `otpauth` kütüphanesi ile TOTP üretimi, QR kod, yedek kodlar. Etkinleştirildiğinde oturum açma akışında zorunlu kılınmaktadır. |

\newpage

## Proje Kısıtları ve Yönetimi

### Kısıt 1: Güvenlik — Güvenilmeyen Kod Çalıştırma

- **Tanım:** Eğitimciler platforma JavaScript fonksiyonları yüklemektedir. Bu fonksiyonlar sunucu tarafında çalıştırıldığından, kötü niyetli veya hatalı kodun sunucuyu etkilemesi engellenmelidir.
- **Etki Alanı:** Sunucu güvenliği, veri bütünlüğü, platform kararlılığı. Tüm kart çalıştırma akışını (çalışma oturumları, kart testi, içe aktarma doğrulaması) etkiler.

**Yapılanlar:** İlk aşamada `isolated-vm` (V8 izolasyonu) ile sandbox uygulandı. Geliştirme sürecinde `isolated-vm`'in bakım modunda olduğu, bilinen güvenlik açıklarının bulunduğu (CVE-2022-39266: cachedData yoluyla sandbox kaçışı, CVSS 9.8/NIST [5]; CVE-2021-21413: prototip zinciri üzerinden sandbox kaçışı, CVSS 9.6/NIST [6]) ve Node.js sürecini çökertebildiği tespit edildi.

**Sapma:** Planlanan V8 izolasyonundan QuickJS WASM tabanlı sandbox'a geçildi. WASM, V8 sürecinden bağımsız çalışarak daha sert bir izolasyon sınırı sağlamaktadır. Yerel derleme gerektirmemesi taşınabilirliği de artırmıştır.

**Sonuç ve Öğrenim:** Üçüncü parti güvenlik kritik bağımlılıkların CVE geçmişi ve bakım durumu, teknoloji seçiminde işlevsellik kadar önemlidir. WASM tabanlı sandbox'lar, yerel izolasyona kıyasla daha taşınabilir ve daha güvenli bir alternatif sunmaktadır.

\vspace{1em}

### Kısıt 2: Zaman — Tek Dönemlik Proje Süresi

- **Tanım:** Proje bir dönemlik bitirme projesi kapsamında geliştirilmektedir. Sınırlı süre, özelliklerin önceliklendirilmesini ve bilinçli kapsam kararlarını gerektirmektedir.
- **Etki Alanı:** Kapsam kararları, özellik önceliklendirmesi. Görsel DAG editörü ve FSRS parametre optimizasyonu gibi bazı ileri özellikler bilinçli olarak kapsam dışı bırakılmıştır.

**Yapılanlar:** Çekirdek çalışma döngüsü (kayıt, çalışma, FSRS zamanlama) önceliklendirildi. Eğitimci araçları (Monaco editör, LLM destekli kart oluşturma, sınıf yönetimi), içe/dışa aktarma ve 2FA tamamlandı.

**Sapma:** Görsel DAG editörü bilinçli olarak kapsam dışı bırakıldı. Kullanıcı testi yapılamadı.

**Sonuç ve Öğrenim:** Erken ve bilinçli kapsam kararları, çekirdek işlevselliğin kaliteli tamamlanmasını sağlamıştır. "Yapmayacaklarımız" listesi (ROADMAP.md) kapsam kaymasını önlemede etkili olmuştur.

\vspace{1em}

### Kısıt 3: Ekonomik — Sıfır Bütçe

- **Tanım:** Proje herhangi bir mali kaynak olmaksızın geliştirilmektedir. Ücretli API'ler, sunucu altyapısı veya lisanslı yazılım kullanılamamaktadır.
- **Etki Alanı:** Teknoloji seçimleri, dağıtım modeli. Veritabanı (SQLite), sandbox (yerleşik WASM), LLM (opsiyonel) kararlarını etkiler.

**Yapılanlar:** Tüm teknoloji yığını açık kaynak araçlardan oluşturuldu (Next.js, Prisma, ts-fsrs, QuickJS). Geliştirme veritabanı olarak SQLite kullanıldı. LLM özellikleri opsiyonel tutularak API anahtarı olmadan platformun tam işlevsel kalması sağlandı. LLM entegrasyonu sağlayıcıdan bağımsız olarak tasarlandı: OpenAI uyumlu API protokolü üzerinden herhangi bir sağlayıcıyla (yerel modeller dahil) çalışabilmektedir; belirli bir sağlayıcı önerilmemektedir.

**Sapma:** Yok. Planlanan sıfır bütçe yaklaşımı başarıyla uygulandı.

**Sonuç ve Öğrenim:** Açık kaynak ekosistemin olgunluğu, sıfır bütçeyle üretim kalitesinde bir platform geliştirmeyi mümkün kılmıştır. AGPL lisansı bu modelin sürdürülebilirliğini garanti altına almaktadır.

\newpage

## Beklenen ve Gerçekleşen Etkiler

### Beklenen Etkiler

**Ekonomik:** Platform, kurumsal düzeyde aralıklı tekrar yazılımının lisans maliyetini ortadan kaldırmayı hedeflemektedir. Mevcut ticari çözümler (örn. Quizlet for Schools) kullanıcı başına ücretlendirme modeliyle çalışmaktadır [7]. AGPL-3.0 lisanslı, self-host edilebilir bir platform olarak okullar ve şirketler yalnızca altyapı maliyetiyle aynı işlevselliğe erişebilecektir. AGPL-3.0 lisansı, yazılımın değiştirilmiş sürümlerinin ağ üzerinden sunulması durumunda kaynak kodunun paylaşılmasını zorunlu kılarak [8] platformun açık kalmasını garanti altına almaktadır.

**Sosyal:** Aralıklı tekrar (distributed practice), Dunlosky et al. (2013) tarafından incelenen on öğrenme stratejisi arasında "yüksek fayda" derecesi alan yalnızca iki teknikten biridir [9]. Buna rağmen kurumsal eğitimde yaygınlaşamamıştır; çünkü mevcut araçlar (örn. Anki) bireysel kullanıma yöneliktir ve sınıf yönetimi, müfredat yapısı, eğitimci içerik oluşturma gibi kurumsal ihtiyaçları karşılamamaktadır. Bu platform, programlanabilir kartlar ile sonsuz soru varyasyonu üreterek ezber yerine kavramsal öğrenmeyi desteklemekte, önkoşul DAG'ı ile pedagojik ilerleme sıralamasını zorunlu kılmaktadır.

**Çevresel:** Doğrudan çevresel etkisi minimal düzeydedir. Kağıt tabanlı bilgi kartlarına dijital bir alternatif sunmaktadır. Mevcut sunucu altyapısı üzerinde çalıştırılabilir olması ek donanım ihtiyacını ortadan kaldırmaktadır.

**Hukuki:** AGPL-3.0 lisansı, yazılımın dağıtılması veya değiştirilmiş sürümlerinin ağ üzerinden sunulması durumunda kaynak kodunun kullanıcılara açılmasını zorunlu kılmaktadır (Bölüm 13) [8]. Self-host mimarisi, verilerin kurum bünyesinde kalmasını sağlayarak KVKK [2] ve GDPR uyumluluğunu kolaylaştırmaktadır. Dağıtımcı kurum (okul, şirket, STK vb.) veri sorumlusu sıfatıyla aydınlatma, saklama süresi ve veri sahibi haklarını kendi süreçleriyle yönetir; platform bu yükümlülükleri teknik olarak destekleyen araçları (veri dışa aktarım, admin paneli, yapılandırılabilir aydınlatma metni) sağlamaktadır. Kodun denetlenebilir olması kurumların veri işleme süreçlerini doğrulamasına olanak tanımaktadır.

**Sağlık:** FSRS algoritması [10], tekrar zamanlamasını optimize ederek çalışma yükünü daha kısa oturumlara dağıtmakta ve yoğun çalışmaya (massed practice) kıyasla zihinsel yorgunluğu azaltmaktadır. Araştırmalar, aralıklı tekrarın daha az toplam tekrar ile aynı veya daha yüksek kalıcılığa ulaşılmasını sağladığını göstermektedir [9].

**Güvenlik:** WASM sandbox'ı güvenilmeyen kodu ana süreçten tamamen izole etmektedir. Doğru cevaplar sunucu tarafında saklanarak istemciye hiçbir zaman gönderilmemektedir. İki faktörlü kimlik doğrulama, rol tabanlı erişim kontrolü ve şifreli veri saklama ile güvenlik katmanlı olarak sağlanmaktadır.

\vspace{1.5em}

### Gerçekleşen Etkiler

Proje kapsamında kullanıcı testi veya pilot uygulama yapılamamıştır. Bu nedenle kullanıcı geri bildirimi, kullanım metrikleri veya ölçülebilir etki verileri bulunmamaktadır. Aşağıdaki değerlendirme, uygulanan teknik yeteneklere dayanmaktadır:

- **Ekonomik:** Platform AGPL-3.0 ile yayımlanmış, self-host edilebilir durumdadır. Ticari lisans maliyeti gerektirmeden kurumsal düzeyde aralıklı tekrar işlevselliği sunmaktadır. Gerçek maliyet tasarrufu, kurumsal dağıtım sonrasında ölçülebilecektir.

- **Sosyal:** Çekirdek çalışma döngüsü (programlanabilir kartlar, FSRS zamanlama, önkoşul DAG'ı) tam işlevseldir. Eğitimci araçları (sınıf yönetimi, müfredat oluşturma, LLM destekli kart yazma) kurumsal kullanıma hazırdır. Eğitim ortamlarındaki gerçek etkisi dağıtım ve benimseme sonrasında değerlendirilebilecektir.

- **Çevresel:** Ölçülebilir çevresel etki bulunmamaktadır.

- **Hukuki:** AGPL-3.0 lisansı uygulanmıştır. KVKK uyumlu veri dışa aktarım endpoint'i ve yapılandırılabilir aydınlatma metni mevcuttur. Self-host mimarisi veri egemenliğini teknik olarak mümkün kılmaktadır. LLM entegrasyonu sağlayıcıdan bağımsızdır: OpenAI uyumlu API protokolü kullanılmakta olup kurum kendi sağlayıcısını (yerel modeller dahil) seçebilmektedir; üçüncü taraf veri paylaşımı tamamen kurumun kararındadır. Hukuki uyumluluk beyanı, kurum bazında hukuki danışmanlık gerektirecektir.

- **Sağlık:** FSRS-5 algoritması (ts-fsrs v5.2.3) uygulanmış ve çalışma oturumlarında aktiftir [10]. Zihinsel yorgunluk azaltımına ilişkin etki, kullanıcı çalışmalarıyla ölçülebilecektir.

- **Güvenlik:** QuickJS WASM sandbox'ı, bilinen güvenlik açıklarına karşı proaktif geçiş ile güçlendirilmiştir [5][6]. Sunucu tarafı cevap doğrulama, 2FA ve rol tabanlı erişim kontrolü uygulanmıştır. Penetrasyon testi yapılmamıştır.

\newpage

## Kaynaklar

[1] OWASP Foundation, "OWASP Top 10:2021." <https://owasp.org/Top10/>

[2] T.C. Resmî Gazete, "6698 Sayılı Kişisel Verilerin Korunması Kanunu," 7 Nisan 2016. <https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6698.pdf>

[3] ISO/IEC/IEEE, "ISO/IEC/IEEE 12207:2017 — Systems and software engineering — Software life cycle processes." <https://www.iso.org/standard/63712.html>

[4] W3C, "Web Content Accessibility Guidelines (WCAG) 2.1," 5 Haziran 2018. <https://www.w3.org/TR/WCAG21/>

[5] NIST, "CVE-2022-39266 — isolated-vm sandbox escape via CachedDataOptions," CVSS 9.8. <https://nvd.nist.gov/vuln/detail/CVE-2022-39266>

[6] NIST, "CVE-2021-21413 — isolated-vm prototype chain sandbox escape," CVSS 9.6. <https://nvd.nist.gov/vuln/detail/CVE-2021-21413>

[7] Quizlet, "Quizlet for Schools — Volume Pricing." <https://quizlet.com/features/quizletforschools>

[8] Free Software Foundation, "GNU Affero General Public License, Version 3," Section 13: Remote Network Interaction. <https://www.gnu.org/licenses/agpl-3.0.en.html>

[9] Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013). "Improving Students' Learning With Effective Learning Techniques." *Psychological Science in the Public Interest*, 14(1), 4--58. <https://doi.org/10.1177/1529100612453266>

[10] Ye, J. (2022). "A Stochastic Shortest Path Algorithm for Optimizing Spaced Repetition Scheduling." *Proc. 28th ACM SIGKDD*; Ye, J. (2023). "Optimizing Spaced Repetition Schedule by Capturing the Dynamics of Memory." *IEEE TKDE*. Uygulama: ts-fsrs v5.2.3. <https://github.com/open-spaced-repetition/ts-fsrs>

[11] IETF, "RFC 6238 — TOTP: Time-Based One-Time Password Algorithm," Mayıs 2011. <https://datatracker.ietf.org/doc/html/rfc6238>

[12] KVKK Kurul Kararı 2020/71 — Veri sorumlusu belirleme kriterleri. <https://www.kvkk.gov.tr/Icerik/6874/2020-71>
