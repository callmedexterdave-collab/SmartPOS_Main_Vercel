const CACHE_NAME = 'smartpos-v1.0.1';
const RUNTIME = 'runtime';

// Static assets to cache immediately
// We only cache the root and manifest, other assets will be cached on-demand
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

// Network-first resources (API calls, dynamic content)
const NETWORK_FIRST_URLS = [
  '/api/'
];

// Cache-first resources (images, static assets from external CDN)
const CACHE_FIRST_URLS = [
  'https://images.unsplash.com/',
  'https://fonts.googleapis.com/',
  'https://fonts.gstatic.com/',
  'https://cdnjs.cloudflare.com/'
];

// Install event - precache essential assets
self.addEventListener('install', event => {
  console.log('[SW] Install event - Version: ' + CACHE_NAME);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Precaching core assets');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log('[SW] Core assets precached');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Precaching failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  
  const currentCaches = [CACHE_NAME, RUNTIME];
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return cacheNames.filter(cacheName => !currentCaches.includes(cacheName));
      })
      .then(cachesToDelete => {
        return Promise.all(
          cachesToDelete.map(cacheToDelete => {
            console.log('[SW] Deleting old cache:', cacheToDelete);
            return caches.delete(cacheToDelete);
          })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Handle external resources with cache-first strategy
  if (url.origin !== location.origin) {
    if (CACHE_FIRST_URLS.some(pattern => request.url.includes(pattern))) {
      event.respondWith(cacheFirst(request));
    }
    return;
  }

  // Handle API calls with network-first strategy
  if (NETWORK_FIRST_URLS.some(pattern => url.pathname.startsWith(pattern))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Handle Vite assets (JS, CSS, etc.) with cache-first then network
  // These usually have hashes in them, so they are safe to cache long-term
  if (url.pathname.includes('/assets/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Handle navigation requests (opening the app)
  // We use stale-while-revalidate for the main HTML to ensure it opens offline
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default: stale-while-revalidate for everything else
  event.respondWith(staleWhileRevalidate(request));
});

// Network-first strategy (for APIs)
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    throw error;
  }
}

// Cache-first strategy (for static assets with hashes)
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache-first network fallback failed:', error);
    return new Response('Asset not available offline', { status: 404 });
  }
}

// Stale-while-revalidate strategy (for the app shell/HTML)
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then(async networkResponse => {
    if (networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(err => {
    console.warn('[SW] Offline fallback for:', request.url);
    return cachedResponse; // Return cache if network fails (offline)
  });
  
  // If we have a cached version (e.g. navigation /), return it immediately for offline startup
  // If not, wait for the network
  return cachedResponse || fetchPromise;
}

// Background sync for offline sales
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-sales') {
    event.waitUntil(syncOfflineSales());
  }
});

// Sync offline sales when network is available
async function syncOfflineSales() {
  try {
    // This would typically sync with a backend server
    // For now, we'll just log that sync is happening
    console.log('[SW] Syncing offline sales data');
    
    // In a real implementation, you would:
    // 1. Get offline sales from IndexedDB
    // 2. Send them to your backend
    // 3. Mark them as synced
    // 4. Update local state
    
    return Promise.resolve();
  } catch (error) {
    console.error('[SW] Sync failed:', error);
    throw error;
  }
}

// Push notifications (future feature)
self.addEventListener('push', event => {
  console.log('[SW] Push received:', event);
  
  const options = {
    body: event.data ? event.data.text() : 'New notification from SmartPOS+',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    tag: 'smartpos-notification',
    requireInteraction: false,
    data: {
      url: '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('SmartPOS+', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window if app is not open
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Message handling for communication with main app
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Error handling
self.addEventListener('error', event => {
  console.error('[SW] Error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});

// Periodic background sync (for compatible browsers)
self.addEventListener('periodicsync', event => {
  console.log('[SW] Periodic sync:', event.tag);
  
  if (event.tag === 'inventory-sync') {
    event.waitUntil(syncInventoryData());
  }
});

async function syncInventoryData() {
  try {
    console.log('[SW] Syncing inventory data in background');
    // Implement periodic inventory sync logic here
    return Promise.resolve();
  } catch (error) {
    console.error('[SW] Periodic sync failed:', error);
    throw error;
  }
}

// Cache management utilities
function cleanupCache() {
  return caches.keys().then(cacheNames => {
    const oldCaches = cacheNames.filter(name => 
      name.startsWith('smartpos-') && name !== CACHE_NAME
    );
    
    return Promise.all(
      oldCaches.map(cacheName => caches.delete(cacheName))
    );
  });
}

// Log service worker lifecycle
console.log('[SW] Service Worker loaded');
