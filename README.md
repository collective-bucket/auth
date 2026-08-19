# Auth

Collective Bucket altında merkezi giriş ve tek oturum (SSO).

## Özellikler

- E-posta ve şifre ile giriş
- Google ile giriş
- Collective Bucket siteleri arasında oturum paylaşımı
- Diğer uygulamalara `client.js` ile entegrasyon

## Adresler

- Canlı: `https://auth.collectivebucket.com`
- Hosting site: `cbucket-auth`
- İstemci: `https://auth.collectivebucket.com/client.js`

## Yerel

```bash
npm install
npm run check
npm run serve
```

## Entegrasyon

Sayfaya `<div data-cb-auth></div>` ekleyin ve `client.js` yükleyin. Örnek için
`public/index.html` dosyasına bakın.
