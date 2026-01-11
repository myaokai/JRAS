const CACHE_NAME = 'quiz-app-v1';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './questions.js',
    './manifest.json',
    './icons/icon-192.svg',
    './icons/icon-512.svg'
];

// インストール時にキャッシュ
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

// 古いキャッシュの削除
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// リクエスト時にキャッシュから返す（なければネットワーク）
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
