import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import type { Staff } from '@shared/schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const dbPath = path.join(dataDir, 'smartpos.db');
const db = new Database(dbPath);

// Database service
export const dbService = {
  // Initialize tables if they do not exist
  initSchema: () => {
    // Check for staff table schema mismatch (INTEGER id vs TEXT id)
    try {
      const staffInfo = db.prepare('PRAGMA table_info(staff)').all() as any[];
      const idCol = staffInfo.find(c => c.name === 'id');
      if (idCol && idCol.type === 'INTEGER') {
        console.log('Migrating staff table from INTEGER id to TEXT id...');
        db.transaction(() => {
          // Disable foreign keys temporarily to avoid issues during migration
          db.exec('PRAGMA foreign_keys = OFF');
          
          db.exec(`ALTER TABLE staff RENAME TO staff_old`);
          
          db.exec(`
            CREATE TABLE staff (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              staffId TEXT UNIQUE NOT NULL,
              passkey TEXT,
              createdBy TEXT,
              createdAt TEXT
            )
          `);
          
          // Try to copy data
          // We cast id to TEXT. If schema matches otherwise, this should work.
          // Note: staff_old might have staff_id vs staffId. 
          // If staff_old has staffId, use it. If not, try staff_id.
          const cols = staffInfo.map(c => c.name);
          const hasStaffId = cols.includes('staffId');
          const hasSnakeStaffId = cols.includes('staff_id');
          
          const sourceStaffId = hasStaffId ? 'staffId' : (hasSnakeStaffId ? 'staff_id' : "''");
          const sourcePasskey = cols.includes('passkey') ? 'passkey' : "''";
          
          db.exec(`
            INSERT INTO staff (id, name, staffId, passkey, createdBy, createdAt)
            SELECT CAST(id AS TEXT), name, ${sourceStaffId}, ${sourcePasskey}, createdBy, createdAt 
            FROM staff_old
          `);
          
          db.exec(`DROP TABLE staff_old`);
          
          // Re-enable foreign keys
          db.exec('PRAGMA foreign_keys = ON');
        })();
        console.log('Staff table migration completed.');
      }
    } catch (e) {
      console.error('Migration failed (non-critical if table doesnt exist):', e);
    }

    // Create base and ledger tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        cost REAL DEFAULT 0,
        barcode TEXT UNIQUE NOT NULL,
        category TEXT,
        image TEXT,
        quantity INTEGER DEFAULT 0,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS variants (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        name TEXT NOT NULL,
        barcode TEXT,
        price REAL NOT NULL,
        cost REAL NOT NULL,
        image TEXT,
        quantity INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS staff (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        staffId TEXT UNIQUE NOT NULL,
        passkey TEXT,
        createdBy TEXT,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        device_info TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL,
        last_active_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES staff(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT,
        credit_rating TEXT NOT NULL CHECK (credit_rating IN ('good','bad')),
        photo_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS credits (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        amount REAL NOT NULL CHECK (amount > 0),
        due_date TEXT,
        remarks TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        amount REAL NOT NULL CHECK (amount > 0),
        payment_method TEXT NOT NULL,
        remarks TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        message_type TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Perform lightweight migrations for missing columns
    const getColumns = (table: string) =>
      db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];

    const productCols = getColumns('products').map(c => c.name);
    const staffCols = getColumns('staff').map(c => c.name);
    const customerCols = getColumns('customers').map(c => c.name);
    const creditCols = getColumns('credits').map(c => c.name);
    const paymentCols = getColumns('payments').map(c => c.name);

    const migrate = db.transaction(() => {
      // Add missing columns to products
      if (!productCols.includes('updatedAt')) {
        db.exec(`ALTER TABLE products ADD COLUMN updatedAt TEXT`);
      }
      if (!productCols.includes('createdAt')) {
        db.exec(`ALTER TABLE products ADD COLUMN createdAt TEXT`);
      }
      if (!productCols.includes('cost')) {
        db.exec(`ALTER TABLE products ADD COLUMN cost REAL DEFAULT 0`);
      }

      // Ensure indexes exist (only after columns are present)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_products_updatedAt ON products(updatedAt)`);

      // Add missing columns to staff
      if (!staffCols.includes('staffId')) {
        db.exec(`ALTER TABLE staff ADD COLUMN staffId TEXT`);
      }
      if (!staffCols.includes('passkey')) {
        db.exec(`ALTER TABLE staff ADD COLUMN passkey TEXT`);
      }
      if (!staffCols.includes('createdBy')) {
        db.exec(`ALTER TABLE staff ADD COLUMN createdBy TEXT`);
      }
      if (!staffCols.includes('createdAt')) {
        db.exec(`ALTER TABLE staff ADD COLUMN createdAt TEXT`);
      }

      // Staff indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_staff_staffId ON staff(staffId)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_staff_createdAt ON staff(createdAt)`);

      // Sessions indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`);

      // Customers migrations and indexes
      if (!customerCols.includes('updated_at')) {
        db.exec(`ALTER TABLE customers ADD COLUMN updated_at TEXT`);
      }
      db.exec(`CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_customers_rating ON customers(credit_rating)`);

      // Credits indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_credits_customer ON credits(customer_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_credits_created_at ON credits(created_at)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_credits_due_date ON credits(due_date)`);

      // Payments indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at)`);

      // Reminders indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_reminders_customer ON reminders(customer_id)`);
    });

    migrate();
  },
  // Ledger: Customers
  createCustomer: (input: { id: string; name: string; phone: string; address?: string | null; credit_rating: 'good'|'bad'; photo_url?: string | null; }) => {
    const now = new Date().toISOString();
    const stmt = db.prepare(`INSERT INTO customers (id, name, phone, address, credit_rating, photo_url, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`);
    stmt.run(input.id, input.name, input.phone, input.address ?? null, input.credit_rating, input.photo_url ?? null, now, now);
    return db.prepare(`SELECT * FROM customers WHERE id = ?`).get(input.id);
  },
  updateCustomer: (id: string, updates: Partial<{ name: string; phone: string; address: string | null; credit_rating: 'good'|'bad'; photo_url: string | null; }>) => {
    const current = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id) as any;
    if (!current) return undefined;
    const next = {
      name: updates.name ?? current.name,
      phone: updates.phone ?? current.phone,
      address: updates.address ?? current.address,
      credit_rating: updates.credit_rating ?? current.credit_rating,
      photo_url: updates.photo_url ?? current.photo_url,
      updated_at: new Date().toISOString(),
    };
    db.prepare(`UPDATE customers SET name = ?, phone = ?, address = ?, credit_rating = ?, photo_url = ?, updated_at = ? WHERE id = ?`).run(
      next.name, next.phone, next.address, next.credit_rating, next.photo_url, next.updated_at, id
    );
    return db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
  },
  deleteCustomer: (id: string) => {
    const info = db.prepare(`DELETE FROM customers WHERE id = ?`).run(id);
    return info.changes ?? 0;
  },
  getCustomer: (id: string) => {
    return db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
  },
  listCustomers: () => {
    return db.prepare(`SELECT * FROM customers ORDER BY name ASC`).all();
  },
  updateCustomerPhoto: (id: string, photoUrl: string) => {
    db.prepare(`UPDATE customers SET photo_url = ?, updated_at = ? WHERE id = ?`).run(photoUrl, new Date().toISOString(), id);
    return db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
  },

  // Ledger: Credits
  addCredit: (input: { id: string; customer_id: string; amount: number; remarks?: string | null; created_at?: string }) => {
    const created = input.created_at ?? new Date().toISOString();
    db.prepare(`INSERT INTO credits (id, customer_id, amount, due_date, remarks, created_at) VALUES (?,?,?,?,?,?)`).run(
      input.id, input.customer_id, input.amount, null, input.remarks ?? null, created
    );
    return db.prepare(`SELECT * FROM credits WHERE id = ?`).get(input.id);
  },
  updateCredit: (id: string, updates: Partial<{ amount: number; due_date: string | null; remarks: string | null }>) => {
    const current = db.prepare(`SELECT * FROM credits WHERE id = ?`).get(id) as any;
    if (!current) return undefined;
    const next = {
      amount: updates.amount ?? current.amount,
      due_date: updates.due_date ?? current.due_date ?? null,
      remarks: updates.remarks ?? current.remarks,
    };
    db.prepare(`UPDATE credits SET amount = ?, due_date = ?, remarks = ? WHERE id = ?`).run(next.amount, next.due_date, next.remarks, id);
    return db.prepare(`SELECT * FROM credits WHERE id = ?`).get(id);
  },
  deleteCredit: (id: string) => {
    const info = db.prepare(`DELETE FROM credits WHERE id = ?`).run(id);
    return info.changes ?? 0;
  },
  listCredits: (customerId: string) => {
    return db.prepare(`SELECT * FROM credits WHERE customer_id = ? ORDER BY datetime(created_at) DESC`).all(customerId);
  },
  sumCredits: (customerId: string) => {
    const row = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM credits WHERE customer_id = ?`).get(customerId) as any;
    return row?.total ?? 0;
  },

  // Ledger: Payments
  addPayment: (input: { id: string; customer_id: string; amount: number; payment_method: string; remarks?: string | null; created_at?: string }) => {
    const created = input.created_at ?? new Date().toISOString();
    db.prepare(`INSERT INTO payments (id, customer_id, amount, payment_method, remarks, created_at) VALUES (?,?,?,?,?,?)`).run(
      input.id, input.customer_id, input.amount, input.payment_method, input.remarks ?? null, created
    );
    return db.prepare(`SELECT * FROM payments WHERE id = ?`).get(input.id);
  },
  updatePayment: (id: string, updates: Partial<{ amount: number; payment_method: string; remarks: string | null }>) => {
    const current = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(id) as any;
    if (!current) return undefined;
    const next = {
      amount: updates.amount ?? current.amount,
      payment_method: updates.payment_method ?? current.payment_method,
      remarks: updates.remarks ?? current.remarks,
    };
    db.prepare(`UPDATE payments SET amount = ?, payment_method = ?, remarks = ? WHERE id = ?`).run(next.amount, next.payment_method, next.remarks, id);
    return db.prepare(`SELECT * FROM payments WHERE id = ?`).get(id);
  },
  deletePayment: (id: string) => {
    const info = db.prepare(`DELETE FROM payments WHERE id = ?`).run(id);
    return info.changes ?? 0;
  },
  listPayments: (customerId: string) => {
    return db.prepare(`SELECT * FROM payments WHERE customer_id = ? ORDER BY datetime(created_at) DESC`).all(customerId);
  },
  sumPayments: (customerId: string) => {
    const row = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE customer_id = ?`).get(customerId) as any;
    return row?.total ?? 0;
  },

  // Balance
  getBalance: (customerId: string) => {
    const total_credit = (db.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM credits WHERE customer_id = ?`).get(customerId) as any)?.total ?? 0;
    const total_payment = (db.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE customer_id = ?`).get(customerId) as any)?.total ?? 0;
    return { total_credit, total_payment, balance: total_credit - total_payment };
  },
  customersCount: () => {
    const row = db.prepare(`SELECT COUNT(*) AS cnt FROM customers`).get() as any;
    return row?.cnt ?? 0;
  },
  totalCredits: () => {
    const row = db.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM credits`).get() as any;
    return row?.total ?? 0;
  },
  totalPayments: () => {
    const row = db.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM payments`).get() as any;
    return row?.total ?? 0;
  },
  // Reminders
  addReminder: (input: { id: string; customer_id: string; message_type: string; message: string; status: string; created_at?: string }) => {
    const created = input.created_at ?? new Date().toISOString();
    db.prepare(`INSERT INTO reminders (id, customer_id, message_type, message, status, created_at) VALUES (?,?,?,?,?,?)`).run(
      input.id, input.customer_id, input.message_type, input.message, input.status, created
    );
    return db.prepare(`SELECT * FROM reminders WHERE id = ?`).get(input.id);
  },
  listReminders: (customerId: string) => {
    return db.prepare(`SELECT * FROM reminders WHERE customer_id = ? ORDER BY datetime(created_at) DESC`).all(customerId);
  },
  // Settings
  getSettings: () => {
    const rows = db.prepare(`SELECT key, value FROM settings`).all() as any[];
    const obj: Record<string, any> = {};
    for (const r of rows) {
      try {
        obj[r.key] = JSON.parse(r.value);
      } catch {
        obj[r.key] = r.value;
      }
    }
    return obj;
  },
  upsertSettings: (settings: Record<string, any>) => {
    const stmt = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
    const tx = db.transaction(() => {
      for (const [k, v] of Object.entries(settings)) {
        const val = typeof v === 'string' ? v : JSON.stringify(v);
        stmt.run(k, val);
      }
    });
    tx();
    return dbService.getSettings();
  },
  // Clear all table data (products, staff)
  clearAllData: () => {
    const delProducts = db.prepare('DELETE FROM products').run();
    const delStaff = db.prepare('DELETE FROM staff').run();
    return {
      productsDeleted: delProducts.changes ?? 0,
      staffDeleted: delStaff.changes ?? 0,
    };
  },
  // Product methods
  getProducts: () => {
    return db.prepare('SELECT * FROM products').all();
  },

  getProductByBarcode: (barcode: string) => {
    return db.prepare('SELECT * FROM products WHERE barcode = ?').get(barcode);
  },

  saveProducts: (products: any[]) => {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO products 
      (id, name, price, cost, barcode, category, image, quantity, createdAt, updatedAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((products: any[]) => {
      for (const product of products) {
        try {
          const id = String(product.id);
          const name = String(product.name ?? '');
          const price = Number(product.price ?? 0);
          const cost = Number(product.cost ?? 0);
          const barcode = String(product.barcode ?? '').trim();
          const category = product.category != null ? String(product.category) : null;
          const image = product.image != null ? String(product.image) : null;
          const quantity = Number(product.quantity ?? 0);
          const createdAt = String(product.createdAt ?? new Date().toISOString());
          const updatedAt = String(product.updatedAt ?? new Date().toISOString());

          insert.run(
            id,
            name,
            price,
            cost,
            barcode,
            category,
            image,
            quantity,
            createdAt,
            updatedAt
          );
        } catch (e) {
          console.error('Failed to upsert product', product?.barcode, e);
        }
      }
    });
    
    insertMany(products);
    return products;
  },

  getProductsSince: (timestamp: Date) => {
    return db.prepare('SELECT * FROM products WHERE datetime(updatedAt) > datetime(?)').all(timestamp.toISOString());
  },

  // Variant methods
  getVariants: (productId: string) => {
    // Map snake_case columns to camelCase properties to match shared/schema
    const rows = db.prepare('SELECT * FROM variants WHERE product_id = ?').all(productId) as any[];
    return rows.map(r => ({
      id: r.id,
      productId: r.product_id,
      name: r.name,
      barcode: r.barcode,
      price: r.price,
      cost: r.cost,
      image: r.image,
      quantity: r.quantity,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  },

  getAllVariants: () => {
     return db.prepare('SELECT * FROM variants').all();
  },

  saveVariants: (variants: any[]) => {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO variants 
      (id, product_id, name, barcode, price, cost, image, quantity, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((variants: any[]) => {
      for (const v of variants) {
        try {
          insert.run(
            v.id,
            v.productId || v.product_id,
            v.name,
            v.barcode || null,
            v.price,
            v.cost,
            v.image || null,
            v.quantity || 0,
            v.createdAt || v.created_at || new Date().toISOString(),
            v.updatedAt || v.updated_at || new Date().toISOString()
          );
        } catch (e) {
          console.error('Failed to upsert variant', v?.id, e);
        }
      }
    });
    
    insertMany(variants);
    return variants;
  },

  getVariantsSince: (timestamp: Date) => {
    return db.prepare('SELECT * FROM variants WHERE datetime(updated_at) > datetime(?)').all(timestamp.toISOString());
  },

  // Staff methods
  getStaff: () => {
    return db.prepare('SELECT * FROM staff').all();
  },

  saveStaff: (staff: Staff[]) => {
    // Debug schema
    console.log('Staff table schema:', db.prepare('PRAGMA table_info(staff)').all());

    const insert = db.prepare(`
      INSERT OR REPLACE INTO staff 
      (id, name, staffId, passkey, createdBy, createdAt) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((staffMembers: Staff[]) => {
      for (const member of staffMembers) {
        insert.run(
          member.id,
          member.name,
          member.staffId,
          member.passkey,
          member.createdBy,
          member.createdAt || new Date().toISOString()
        );
      }
    });
    
    insertMany(staff);
    return staff;
  },

  getStaffSince: (timestamp: Date) => {
    return db.prepare('SELECT * FROM staff WHERE datetime(createdAt) > datetime(?)').all(timestamp.toISOString());
  },

  // Auth & Session methods
  getStaffByStaffId: (staffId: string) => {
    return db.prepare('SELECT * FROM staff WHERE staffId = ?').get(staffId);
  },

  verifyStaffCredentials: (staffId: string, passkey: string) => {
    return db.prepare('SELECT * FROM staff WHERE staffId = ? AND passkey = ?').get(staffId, passkey);
  },

  createSession: (session: { id: string; user_id: string; token: string; device_info: string; ip_address: string; created_at: string; last_active_at: string }) => {
    db.prepare(`
      INSERT INTO sessions (id, user_id, token, device_info, ip_address, created_at, last_active_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.id, session.user_id, session.token, session.device_info, session.ip_address, session.created_at, session.last_active_at
    );
    return session;
  },

  getSessionByToken: (token: string) => {
    return db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  },

  getUserSessions: (userId: string) => {
    return db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY last_active_at DESC').all(userId);
  },

  revokeSession: (token: string) => {
    return db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  },

  revokeUserSessions: (userId: string) => {
    return db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  },

  updateSessionActivity: (token: string) => {
    const now = new Date().toISOString();
    return db.prepare('UPDATE sessions SET last_active_at = ? WHERE token = ?').run(now, token);
  },
  
  // Admin clear all sessions
  clearAllSessions: () => {
    return db.prepare('DELETE FROM sessions').run();
  },

  cleanupExpiredSessions: (maxAgeHours: number = 24) => {
    // SQLite datetime is in UTC ISO string.
    // We delete sessions where last_active_at < (now - maxAgeHours)
    // SQLite modifiers: '-24 hours'
    return db.prepare(`
      DELETE FROM sessions 
      WHERE datetime(last_active_at) < datetime('now', '-' || ? || ' hours')
    `).run(maxAgeHours);
  },


};

export default dbService;
