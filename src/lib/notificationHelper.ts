import { Order, Scan } from '../types';

let knownScanIds: Set<string> | null = null;
let completedOrderIds: Set<string> | null = null;
let knownOrderIds: Set<string> | null = null;

/**
 * Requests Notification permission non-disruptively if not already granted.
 */
export function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return;
  }
  if (Notification.permission === 'default') {
    // Standard non-blocking permission request
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        try {
          new Notification("TrackFlow", {
            body: "Notifications de production activées avec succès !",
            icon: "/icon.svg"
          });
        } catch (e) {
          console.log("Notification error:", e);
        }
      }
    });
  }
}

/**
 * Compares latest orders and scans against cache to trigger native system notifications.
 */
export function checkForNotifications(orders: Order[], scans: Scan[]) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const isFirstRun = knownScanIds === null;

  // Initialize known caches on first load to prevent spamming old alerts
  if (knownScanIds === null) {
    knownScanIds = new Set(scans.map(s => s.id));
  }
  if (completedOrderIds === null) {
    completedOrderIds = new Set(orders.filter(o => o.status === 'completed').map(o => o.id));
  }
  if (knownOrderIds === null) {
    knownOrderIds = new Set(orders.map(o => o.id));
  }

  if (isFirstRun) {
    return;
  }

  // Check for newly completed, imported, or scannable items
  orders.forEach(o => {
    // 1. Newly completed orders
    if (o.status === 'completed' && !completedOrderIds!.has(o.id)) {
      completedOrderIds!.add(o.id);
      try {
        new Notification(`Clôture d'OF 🎉`, {
          body: `L'OF ${o.of} (${o.refProduct}) est maintenant terminé !`,
          icon: '/icon.svg',
          tag: `complete-${o.id}`
        });
      } catch (e) {}
    }

    // 2. Newly created orders
    if (!knownOrderIds!.has(o.id)) {
      knownOrderIds!.add(o.id);
      try {
        new Notification(`Nouvel OF créé 📋`, {
          body: `L'OF ${o.of} (${o.refProduct}) de ${o.quantityToProduce} pcs est prêt.`,
          icon: '/icon.svg',
          tag: `new-order-${o.id}`
        });
      } catch (e) {}
    }
  });

  // 3. New scan occurrences
  scans.forEach(s => {
    if (!knownScanIds!.has(s.id)) {
      knownScanIds!.add(s.id);
      const order = orders.find(o => o.id === s.orderId);
      if (order) {
        try {
          new Notification(`Nouveau Scan enregistré 🎯`, {
            body: `OF ${order.of} : S/N ${s.serialNumber} enregistré.`,
            icon: '/icon.svg',
            tag: `scan-${s.id}`
          });
        } catch (e) {}
      }
    }
  });
}
