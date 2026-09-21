# İlke Saha

İlke Akü saha satış rutini için web/PWA prototipi.

## Şu an çalışan özellikler
- Bayi listesi ve mevcut rut planı
- Bayi konumunu haritadan elle işaretleme ve sonradan değiştirme
- Tahmini / doğrulanmış / konum girilmedi durumu
- Ev konumunu harita üzerinden seçme
- Ziyaret ve görüşme notları
- Takip tarihi
- Ödeme sözü ve gecikme takibi
- 08:30 başlangıç / 18:30 bitiş
- Gün sonunda eve yaklaşmayı dikkate alan rut mantığı
- Telefonda ana ekrana eklenebilen PWA yapısı

## Yayınlama
Vercel üzerinde GitHub reposunu bağlayıp Framework Preset olarak **Other** seçmek yeterlidir.
Build Command ve Output Directory boş bırakılabilir.

## Sonraki teknik adımlar
1. Supabase veri tabanı
2. Kullanıcı girişi ve bulut senkronizasyonu
3. Gerçek yol ağı / sürüş süresi API'si
4. Trafik destekli rut optimizasyonu
5. Bildirim ve ödeme hatırlatma sistemi


## Çok Kullanıcılı Ekip Geçişi

Yeni yönetim paneli altyapısı güvenli ve kademeli taşınır.

1. Önce `supabase-team-migration.sql` Supabase SQL Editor'da çalıştırılır.
2. Script mevcut `dealers`, `visits`, `payment_promises`, `meeting_notes` ve `user_settings` tablolarının sabit legacy yedeklerini oluşturur.
3. Mevcut owner RLS politikaları ilk aşamada kaldırılmaz; bugünkü çalışan saha uygulaması etkilenmez.
4. Sonraki sürüm organizasyon ve rol bağlamını etkinleştirir; eski veriler silinmeden İlke Akü organizasyonuna bağlanır.
5. MANAGER rolü Yönetim menüsünü görür; FIELD_STAFF mevcut saha ekranlarını kullanır.
