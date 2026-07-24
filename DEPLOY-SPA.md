# SPA yo'naltirish (sahifa yangilanganda 404 bo'lmasligi uchun)

React Router ichki yo'llarni brauzerda boshqaradi. Sahifa
yangilanganda server `/menu` degan faylni qidiradi va topolmaydi —
shuning uchun 404 chiqadi.

Yechim: barcha so'rovlarni `index.html` ga yo'naltirish.

## Vercel
`vercel.json` fayli loyiha ildizida — avtomatik ishlaydi.

## Netlify
`public/_redirects` fayli — avtomatik ishlaydi.

## Nginx (o'z VPS'ingizda)

```nginx
server {
    server_name lokma.uz;
    root /var/www/lokmago-client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Muhim qator: `try_files $uri $uri/ /index.html;`

## Apache
`public/.htaccess`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```
