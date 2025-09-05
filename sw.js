const CACHE_NAME = 'luidigitals-wallet-v1.0.0';
const urlsToCache = [
    '/',
    '/dashboard.php',
    '/login.php',
    '/transactions.php',
    '/bills.php',
    '/budgets.php',
    '/reports.php',
    '/settings.php',
    '/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then((cache) => {
            console.log('Opened cache');
            return cache.addAll(urlsToCache);
        })
        .catch((error) => {
            console.log('Cache install failed:', error);
        })
    );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
        .then((response) => {
            // Return cached version or fetch from network
            if (response) {
                return response;
            }

            // Clone the request because it's a stream
            const fetchRequest = event.request.clone();

            return fetch(fetchRequest).then((response) => {
                // Check if valid response
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }

                // Clone the response because it's a stream
                const responseToCache = response.clone();

                caches.open(CACHE_NAME)
                    .then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                return response;
            }).catch(() => {
                // Return offline page for navigation requests
                if (event.request.destination === 'document') {
                    return caches.match('/offline.html');
                }
            });
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Background sync for offline transactions
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    try {
        // Get pending transactions from IndexedDB
        const pendingTransactions = await getPendingTransactions();

        for (const transaction of pendingTransactions) {
            try {
                const response = await fetch('/ajax/add_transaction.php', {
                    method: 'POST',
                    body: transaction.data
                });

                if (response.ok) {
                    // Remove from pending queue
                    await removePendingTransaction(transaction.id);
                }
            } catch (error) {
                console.log('Sync failed for transaction:', transaction.id);
            }
        }
    } catch (error) {
        console.log('Background sync failed:', error);
    }
}

// Push notifications
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'New notification from Luidigitals Wallet',
        icon: '/assets/icon-192.png',
        badge: '/assets/icon-72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [{
                action: 'explore',
                title: 'View Details',
                icon: '/assets/icon-192.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/assets/icon-192.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('Luidigitals Wallet', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/dashboard.php')
        );
    } else if (event.action === 'close') {
        // Just close the notification
        return;
    } else {
        // Default action - open app
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// IndexedDB helper functions for offline support
async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('LuidigitalsWallet', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains('pendingTransactions')) {
                const store = db.createObjectStore('pendingTransactions', { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

async function getPendingTransactions() {
    const db = await openDB();
    const transaction = db.transaction(['pendingTransactions'], 'readonly');
    const store = transaction.objectStore('pendingTransactions');

    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function removePendingTransaction(id) {
    const db = await openDB();
    const transaction = db.transaction(['pendingTransactions'], 'readwrite');
    const store = transaction.objectStore('pendingTransactions');

    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});