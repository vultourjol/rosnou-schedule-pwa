const CACHE_NAME = "schedule-v2";
const urlsToCache = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/parser.js",
  "./js/calendar.js",
  "./manifest.json",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
];

// Установка Service Worker
self.addEventListener("install", (event) => {
  console.log("Service Worker: Установка...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Service Worker: Кэширование файлов");
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()),
  );
});

// Активация Service Worker
self.addEventListener("activate", (event) => {
  console.log("Service Worker: Активация...");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log("Service Worker: Удаление старого кэша", name);
              return caches.delete(name);
            }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// Перехват запросов
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => {
        // Возвращаем кэшированный ответ или делаем сетевой запрос
        if (response) {
          return response;
        }

        return fetch(event.request).then((response) => {
          // Не кэшируем если это не GET запрос
          if (
            !response ||
            response.status !== 200 ||
            response.type !== "basic"
          ) {
            return response;
          }

          // Клонируем ответ для кэширования
          const responseToCache = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      })
      .catch(() => {
        // Оффлайн fallback
        if (event.request.destination === "document") {
          return caches.match("/index.html");
        }
      }),
  );
});
