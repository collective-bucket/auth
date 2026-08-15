# Collective Bucket Auth

`auth.collectivebucket.com`, Collective Bucket altındaki projeler için merkezi
e-posta/şifre girişi ve tek oturum (SSO) sağlar.

## Mimari

- Kalıcı Firebase Authentication oturumu yalnızca `auth.collectivebucket.com`
  origin'inde saklanır.
- Diğer Collective Bucket siteleri `client.js` dosyasını yükler.
- `client.js`, `session.html` sayfasını görünmez iframe olarak açar.
- Oturum bilgisi yalnızca izin verilen `collectivebucket.com` origin'lerine
  `postMessage` ile aktarılır.
- Uzun ömürlü refresh token alt projelerle paylaşılmaz; kısa ömürlü ID token
  tüketici uygulamanın belleğinde tutulur.

## Tüketici site entegrasyonu

```html
<div data-cb-auth></div>
<script src="https://auth.collectivebucket.com/client.js" defer></script>
```

Oturumu programatik olarak almak için:

```js
const session = await window.CollectiveBucketAuth.getSession();
```

`session.idToken`, Firestore REST API gibi Firebase kaynaklarına yapılan
isteklerde kullanılabilir. Veriyi koruyan asıl yetkilendirme katmanı Firebase
Security Rules olmalıdır.

## Yerel geliştirme

```bash
npm install
npm run check
npm run serve
```

## Yayın

- Firebase projesi: `collective-bucket`
- Hosting target: `auth`
- Hosting site: `cbucket-auth`
- Custom domain: `auth.collectivebucket.com`

```bash
npm run deploy
```
