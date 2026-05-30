import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
import fs_sync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SQL_DB_PATH = path.join(__dirname, "production.db");
const db = new Database(SQL_DB_PATH);

// Initialize SQL Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    of TEXT,
    refProduct TEXT,
    quantityToProduce INTEGER,
    numberOfLabels INTEGER,
    scanRequired INTEGER,
    status TEXT,
    createdAt INTEGER,
    lotNumber TEXT,
    standardBoxSize INTEGER,
    numberOfBoxes INTEGER,
    completedAt INTEGER,
    operatorId TEXT,
    destination TEXT,
    snStart INTEGER,
    snEnd INTEGER
  );

  CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    orderId TEXT,
    serialNumber TEXT,
    scannedAt INTEGER,
    operatorId TEXT,
    FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    content TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Support existing databases with migrations
try {
  db.exec("ALTER TABLE orders ADD COLUMN snStart INTEGER;");
} catch (e) {}

try {
  db.exec("ALTER TABLE orders ADD COLUMN snEnd INTEGER;");
} catch (e) {}

// Cleanup existing duplicates before adding unique index
try {
  const duplicates = db.prepare(`
    SELECT of, COUNT(*) as count 
    FROM orders 
    WHERE status != 'deleted' 
    GROUP BY of 
    HAVING count > 1
  `).all() as any[];

  if (duplicates.length > 0) {
    console.log(`[DB] Found ${duplicates.length} duplicate OF numbers. Cleaning up...`);
    for (const dup of duplicates) {
      const items = db.prepare("SELECT id FROM orders WHERE of = ? AND status != 'deleted' ORDER BY createdAt DESC").all(dup.of) as any[];
      if (items.length > 1) {
        const toDelete = items.slice(1).map(i => i.id);
        const deleteStmt = db.prepare("DELETE FROM orders WHERE id = ?");
        const deleteScansStmt = db.prepare("DELETE FROM scans WHERE orderId = ?");
        db.transaction(() => {
          for (const id of toDelete) {
            deleteScansStmt.run(id);
            deleteStmt.run(id);
          }
        })();
        console.log(`[DB] Cleaned duplicates for OF ${dup.of}: kept newest, deleted ${toDelete.length} old ones.`);
      }
    }
  }
} catch (e) {}

try {
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_of_active ON orders(of) WHERE status != 'deleted';");
} catch (e) {}

try {
  db.exec("ALTER TABLE scans RENAME COLUMN timestamp TO scannedAt;");
} catch (e) {}

// Helper to seed default settings if empty
const defaultSettings = {
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
^FO450,330^BY2^BCN,100,Y,N,N^FD{SN}^FS
^FO60,460^A0N,25,25^FDQTY: 1 / {QTY_TOTAL}^FS
^FO450,480^A0N,20,20^FD{DATE}^FS
^XZ`,
  supervisorPassword: 'admin',
  operatorPassword: 'user',
  engineeringPassword: 'eng',
  defaultLotPrefix: 'L-',
  operatorAccounts: [
    { login: 'Operateur1', password: 'op1' },
    { login: 'Operateur2', password: 'op2' }
  ]
};

const checkSettings = db.prepare("SELECT COUNT(*) as count FROM settings").get() as { count: number };
if (checkSettings.count === 0) {
  const insert = db.prepare("INSERT INTO settings (key, value) VALUES ('global', ?)");
  insert.run(JSON.stringify(defaultSettings));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log(`[SQL] Better-sqlite3 database connected at ${SQL_DB_PATH}`);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV || 'development', db: 'sqlite' });
  });

  app.get("/api/settings", (req, res) => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'global'").get() as { value: string };
    res.json(JSON.parse(row.value));
  });

  app.post("/api/settings", (req, res) => {
    const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('global', ?)");
    upsert.run(JSON.stringify(req.body));
    res.json({ status: "ok" });
  });

  app.get("/api/orders", (req, res) => {
    const rows = db.prepare("SELECT * FROM orders ORDER BY createdAt DESC").all() as any[];
    // Convert boolean-like values back
    const orders = rows.map(r => ({
      ...r,
      scanRequired: !!r.scanRequired
    }));
    res.json(orders);
  });

  app.post("/api/orders", (req, res) => {
    const orders = Array.isArray(req.body) ? req.body : [req.body];
    
    try {
      const stmt = db.prepare(`
        INSERT INTO orders 
        (id, of, refProduct, quantityToProduce, numberOfLabels, scanRequired, status, createdAt, lotNumber, standardBoxSize, numberOfBoxes, completedAt, operatorId, destination, snStart, snEnd)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = db.transaction((orderList) => {
        for (const o of orderList) {
          stmt.run(
            o.id,
            o.of,
            o.refProduct,
            o.quantityToProduce,
            o.numberOfLabels,
            o.scanRequired ? 1 : 0,
            o.status,
            o.createdAt,
            o.lotNumber || null,
            o.standardBoxSize || null,
            o.numberOfBoxes || null,
            o.completedAt || null,
            o.operatorId || null,
            o.destination || null,
            o.snStart ?? null,
            o.snEnd ?? null
          );
        }
      });
      transaction(orders);
      res.json({ status: "ok" });
    } catch (err: any) {
      if (err.message.includes('UNIQUE constraint failed')) {
        res.status(409).json({ error: "L'OF existe déjà." });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  app.put("/api/orders/:id", (req, res) => {
    const { id } = req.params;
    const o = req.body;
    const stmt = db.prepare(`
      UPDATE orders 
      SET of = ?, refProduct = ?, quantityToProduce = ?, numberOfLabels = ?, 
          scanRequired = ?, status = ?, lotNumber = ?, standardBoxSize = ?, 
          numberOfBoxes = ?, completedAt = ?, operatorId = ?, destination = ?,
          snStart = ?, snEnd = ?
      WHERE id = ?
    `);
    stmt.run(
      o.of, o.refProduct, o.quantityToProduce, o.numberOfLabels,
      o.scanRequired ? 1 : 0, o.status, o.lotNumber, o.standardBoxSize || null,
      o.numberOfBoxes || null, o.completedAt || null, o.operatorId || null, 
      o.destination || null, o.snStart ?? null, o.snEnd ?? null, id
    );
    res.json({ status: "ok" });
  });

  app.delete("/api/orders/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM orders WHERE id = ?").run(id);
    db.prepare("DELETE FROM scans WHERE orderId = ?").run(id);
    res.json({ status: "ok" });
  });

  app.get("/api/scans", (req, res) => {
    const rows = db.prepare("SELECT * FROM scans").all();
    res.json(rows);
  });

  app.post("/api/scans", (req, res) => {
    const s = req.body;
    const stmt = db.prepare("INSERT INTO scans (id, orderId, serialNumber, scannedAt, operatorId) VALUES (?, ?, ?, ?, ?)");
    stmt.run(s.id, s.orderId, s.serialNumber, s.scannedAt || s.timestamp || Date.now(), s.operatorId);
    res.json({ status: "ok" });
  });

  app.delete("/api/scans/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM scans WHERE id = ?").run(id);
    res.json({ status: "ok" });
  });

  app.get("/api/reports", (req, res) => {
    const rows = db.prepare("SELECT content FROM reports").all() as { content: string }[];
    res.json(rows.map(r => JSON.parse(r.content)));
  });

  app.post("/api/reports", (req, res) => {
    const id = Date.now().toString();
    const content = JSON.stringify({ ...req.body, id });
    db.prepare("INSERT INTO reports (id, content) VALUES (?, ?)").run(id, content);
    res.json({ status: "ok" });
  });

  app.post("/api/orders/:id/close", (req, res) => {
    try {
      const { id } = req.params;
      const { operatorName, destination } = req.body;
      
      console.log(`[API] Closing order ${id} requested by ${operatorName}`);

      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as any;
      if (!order) {
        console.error(`[API] Order ${id} not found`);
        return res.status(404).json({ error: "Order not found" });
      }

      const scans = db.prepare("SELECT serialNumber FROM scans WHERE orderId = ?").all(id) as { serialNumber: string }[];
      const settingsRow = db.prepare("SELECT value FROM settings WHERE key = 'global'").get() as { value: string };
      const settings = JSON.parse(settingsRow.value);

      let completedAt = order.completedAt;
      if (order.status !== 'completed') {
        completedAt = Date.now();
        db.prepare(`
          UPDATE orders 
          SET status = 'completed', 
              completedAt = ?, 
              operatorId = ?, 
              destination = ? 
          WHERE id = ?
        `).run(
          completedAt,
          operatorName || 'System',
          destination || 'Direct',
          id
        );
        console.log(`[API] Order ${id} marked as completed at ${completedAt}`);
      }

      const reportId = Date.now().toString();
      const reportData = {
        id: reportId,
        orderId: order.id,
        orderOf: order.of,
        refProduct: order.refProduct,
        qtyRequested: order.quantityToProduce,
        qtyScanned: order.scanRequired ? scans.length : order.quantityToProduce,
        startTime: order.createdAt,
        endTime: completedAt || Date.now(),
        operatorName: operatorName,
        destination: destination,
        lotNumber: order.lotNumber || `${settings.defaultLotPrefix || new Date().getFullYear() + '-'}${order.of.slice(-4)}`,
        scans: scans.map(s => s.serialNumber),
      };

      res.json(reportData);
    } catch (error: any) {
      console.error(`[API] Error closing order:`, error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  app.get("/api/samples/:filename", async (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(__dirname, "import_samples", filename);
    if (fs_sync.existsSync(filePath)) {
      res.download(filePath);
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  app.get("/api/maintenance/export", (req, res) => {
    const orders = db.prepare("SELECT * FROM orders").all();
    const scans = db.prepare("SELECT * FROM scans").all();
    const reports = db.prepare("SELECT content FROM reports").all().map((r: any) => JSON.parse(r.content));
    const settings = JSON.parse((db.prepare("SELECT value FROM settings WHERE key = 'global'").get() as any).value);
    
    res.json({
      orders,
      scans,
      reports,
      settings
    });
  });

  app.post("/api/maintenance/reset", (req, res) => {
    db.prepare("DELETE FROM orders").run();
    db.prepare("DELETE FROM scans").run();
    res.json({ status: "ok", message: "Toutes les données de production ont été effacées." });
  });

  app.post("/api/maintenance/purge", (req, res) => {
    const months = parseInt(req.query.months as string) || 3;
    const cutoffDate = Date.now() - (months * 30 * 24 * 60 * 60 * 1000);
    
    const purged = db.prepare("DELETE FROM orders WHERE createdAt < ? AND status = 'completed'").run(cutoffDate);
    db.prepare("DELETE FROM scans WHERE orderId NOT IN (SELECT id FROM orders)").run();
    
    res.json({ 
      status: "ok", 
      purgedCount: purged.changes,
      message: `Nettoyage terminé. ${purged.changes} anciens OFs supprimés.`
    });
  });

  const distPath = path.resolve(__dirname, 'dist');
  const isProduction = process.env.NODE_ENV === 'production' || fs_sync.existsSync(path.join(distPath, 'index.html'));

  if (isProduction) {
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.url.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

