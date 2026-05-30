
import { Order, Scan, Settings, Report } from '../types';

const STORAGE_KEYS = {
  ORDERS: 'trackflow_orders',
  SCANS: 'trackflow_scans',
  SETTINGS: 'trackflow_settings',
};

const DEFAULT_SETTINGS: Settings = {
  snRangeStart: 50000,
  snRangeEnd: 50500,
  zebraTemplate: `^XA
^CI28
^CF0,30
^FO50,50^GB700,1100,3^FS

^FO80,100^A0N,20,20^FDExpediteur:^FS
^FO80,130^A0N,35,35^FD{SENDER_NAME}^FS
^FO80,175^A0N,20,20^FD{SENDER_ADDR}^FS
^FO80,205^A0N,20,20^FD{SENDER_CITY}^FS

^FO50,250^GB700,1,3^FS

^FO80,280^A0N,20,20^FDDestinataire:^FS
^FO80,310^A0N,40,40^FD{DESTINATION}^FS
^FO80,360^A0N,25,25^FD{RECIPIENT_ADDR}^FS

^FO50,450^GB700,1,3^FS

^FO80,480^A0N,25,25^FDOrder nr. (OF):^FS
^FO80,515^A0N,60,60^FD{OF}^FS
^FO450,480^BY2^BCN,70,N,N,N^FD{OF}^FS

^FO50,620^GB700,1,3^FS

^FO80,650^A0N,25,25^FDRef Number:^FS
^FO80,685^A0N,45,45^FD{REF}^FS

^FO50,780^GB700,1,3^FS

^FO80,810^A0N,25,25^FDItem nr.:^FS
^FO80,845^A0N,45,45^FD{REF}^FS
^FO500,810^A0N,25,25^FDTotal Qty:^FS
^FO500,845^A0N,80,80^FD{QTY} PCS^FS

^FO80,980^BY4^BCN,100,Y,N,N^FD{REF}^FS

^FO80,1110^A0N,20,20^FDIst. {DATE}^FS
^FO450,1110^A0N,20,20^FDSuivi par {SENDER_NAME}^FS
^XZ`,
  unitZebraTemplate: `^XA
^CI28
^CF0,30
^FO40,40^GB720,520,3^FS
^FO60,60^A0N,30,30^FD{SENDER_NAME}^FS
^FO60,100^A0N,20,20^FD{SENDER_ADDR}, {SENDER_CITY}^FS
^FO40,140^GB720,1,3^FS
^FO60,165^A0B,20,20^FDOF:^FS
^FO100,165^A0N,45,45^FD{OF}^FS
^FO60,230^A0N,20,20^FDREF:^FS
^FO60,260^A0N,45,45^FD{REF}^FS
^FO60,330^A0N,20,20^FDS/N:^FS
^FO60,360^A0N,45,45^FD{SN}^FS
^FO450,165^BY2^BCN,100,Y,N,N^FD{OF}^FS
^FO450,330^BY2^BCN,100,N,N,N^FD{SN}^FS
^FO60,460^A0N,25,25^FDQTY: 1 / {QTY_TOTAL}^FS
^FO450,480^A0N,20,20^FD{DATE}^FS
^XZ`,
  supervisorPassword: 'admin',
  operatorPassword: 'user',
  engineeringPassword: 'eng',
  defaultLotPrefix: 'L-',
  operatorAccounts: [
    { login: 'Operateur1', password: 'op1' },
    { login: 'Operateur2', password: 'op2' },
    { login: 'Operateur3', password: 'op3' },
    { login: 'Scan1', password: 's1' },
    { login: 'Scan2', password: 's2' }
  ]
};

class DataService {
  // Settings
  async getSettings(): Promise<Settings> {
    const res = await fetch('/api/settings');
    return res.json();
  }

  async updateSettings(settings: Settings): Promise<void> {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
  }

  // Orders
  async getOrders(): Promise<Order[]> {
    const res = await fetch('/api/orders');
    return res.json();
  }

  async saveOrders(orders: Order[]): Promise<void> {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orders)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erreur lors de la sauvegarde des ordres');
    }
  }

  async addOrder(order: Order): Promise<void> {
    await this.saveOrders([order]);
  }

  async deleteOrder(orderId: string): Promise<void> {
    await fetch(`/api/orders/${orderId}`, {
      method: 'DELETE'
    });
  }

  async updateOrder(updatedOrder: Order): Promise<void> {
    const res = await fetch(`/api/orders/${updatedOrder.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedOrder)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erreur lors de la mise à jour de l\'ordre');
    }
  }

  // Scans
  async getScans(orderId?: string): Promise<Scan[]> {
    const res = await fetch('/api/scans');
    const scans: Scan[] = await res.json();
    if (orderId) {
      return scans.filter(s => s.orderId === orderId);
    }
    return scans;
  }

  async addScan(scan: Scan): Promise<void> {
    await fetch('/api/scans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scan)
    });
  }

  async deleteScan(scanId: string): Promise<void> {
    await fetch(`/api/scans/${scanId}`, {
      method: 'DELETE'
    });
  }

  // Complex Operations
  async closeOrder(orderId: string, operatorName: string, destination: string): Promise<Report> {
    const res = await fetch(`/api/orders/${orderId}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operatorName, destination })
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to close order');
    }
    return res.json();
  }

  // Maintenance
  async migrateFromLocalStorage(): Promise<void> {
    try {
      const localOrdersStr = localStorage.getItem(STORAGE_KEYS.ORDERS);
      const localScansStr = localStorage.getItem(STORAGE_KEYS.SCANS);
      const localSettingsStr = localStorage.getItem(STORAGE_KEYS.SETTINGS);

      if (!localOrdersStr && !localScansStr && !localSettingsStr) {
        return;
      }

      console.log("[Migration] Found local data, migrating to server...");

      if (localSettingsStr) {
        const localSettings = JSON.parse(localSettingsStr);
        await this.updateSettings(localSettings);
      }

      if (localOrdersStr) {
        const localOrders: Order[] = JSON.parse(localOrdersStr);
        // We use addOrder logic which calls /api/orders
        if (localOrders.length > 0) {
          await this.saveOrders(localOrders);
        }
      }

      if (localScansStr) {
        const localScans: Scan[] = JSON.parse(localScansStr);
        for (const scan of localScans) {
          await this.addScan(scan);
        }
      }

      // Clear local storage after successful migration
      localStorage.removeItem(STORAGE_KEYS.ORDERS);
      localStorage.removeItem(STORAGE_KEYS.SCANS);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      
      console.log("[Migration] Successfully migrated and cleared localStorage");
    } catch (error) {
      console.error("[Migration] Error migrating data:", error);
    }
  }

  async exportDatabase(): Promise<any> {
    const res = await fetch('/api/maintenance/export');
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Erreur lors de l\'exportation');
    }
    return res.json();
  }

  async resetProductionData(): Promise<void> {
    const res = await fetch('/api/maintenance/reset', { method: 'POST' });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Erreur lors de la réinitialisation');
    }
  }

  async purgeOldData(months: number): Promise<{ purgedCount: number; message: string }> {
    const res = await fetch(`/api/maintenance/purge?months=${months}`, { method: 'POST' });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Erreur lors du nettoyage');
    }
    return res.json();
  }

  // Reports
  async saveReport(report: Report): Promise<void> {
    await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    });
  }

  async getReports(): Promise<Report[]> {
    const res = await fetch('/api/reports');
    return res.json();
  }
}

export const dataService = new DataService();
