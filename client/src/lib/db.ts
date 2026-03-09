import Dexie, { Table } from 'dexie';
import bcrypt from 'bcryptjs';
import type {
    User, Product, Sale, Staff, CartItem, SaleItem, Expense, Purchase, Creditor, Variant
} from '@shared/schema';
import { getUnitMultiplier } from './utils';

// Helper function for generating UUIDs in browser environment
function generateUUID() {
  // Check if crypto.randomUUID is available
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // Fallback implementation for browsers without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Optimized password hashing for browser environment
async function hashPassword(password: string): Promise<string> {
  try {
    // Use a lower cost factor for better performance in browser
    return await bcrypt.hash(password, 8);
  } catch (error) {
    console.error('Error hashing password:', error);
    throw new Error('Failed to hash password');
  }
}

// Optimized password verification for browser environment
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

export class SmartPOSDB extends Dexie {
  users!: Table<User>;
  products!: Table<Product>;
  sales!: Table<Sale>;
  saleItems!: Table<SaleItem>;
  staff!: Table<Staff>;
  expenses!: Table<Expense>;
  purchases!: Table<Purchase>;
  creditors!: Table<Creditor>;
  variants!: Table<Variant>;

  constructor() {
    super('SmartPOSDB');
    this.version(1).stores({
      users: 'id, username, email, mobile, role, staffId',
      products: 'id, &barcode, name, category',
      sales: 'id, staffId, createdAt',
      saleItems: 'id, saleId, productId',
      staff: 'id, &staffId, name, createdBy',
      expenses: 'id, description, category, date',
      purchases: 'id, productName, date',
      creditors: 'id, name, dueDate, isPaid',
    });
    this.version(3).stores({
      users: 'id, username, email, mobile, role, staffId',
      products: 'id, &barcode, name, category',
      sales: 'id, staffId, createdAt',
      saleItems: 'id, saleId, productId',
      staff: 'id, &staffId, name, createdBy',
      expenses: 'id, description, category, date',
      purchases: 'id, productName, date, supplier',
      creditors: 'id, name, dueDate, isPaid',
      variants: 'id, productId, name, barcode',
    });
  }

  async resetDatabase() {
    await this.delete();
    await this.open();
  }
}

export const db = new SmartPOSDB();

// NOTE: When running in Electron native mode we'll replace or augment this
// Dexie-backed `db` with a native SQLite adapter via IPC. The migration
// utility and adapter will be added under `electron/` and wired to the
// renderer through the `nativeApi` preload bridge.

// Auth service
export class AuthService {
  static async createAdmin(userData: {
    businessName: string;
    ownerName: string;
    mobile: string;
    password: string;
  }): Promise<User> {
    // Check if mobile number is already used
    const existingUser = await db.users.where('mobile').equals(userData.mobile).first();
    if (existingUser) {
      throw new Error('Mobile number already registered');
    }
    
    // Check if username (mobile) is already used
    const existingUsername = await db.users.where('username').equals(userData.mobile).first();
    if (existingUsername) {
      throw new Error('Username already registered');
    }

    const hashedPassword = await hashPassword(userData.password);
    
    const user: User = {
      id: generateUUID(),
      username: userData.mobile,
      email: null,
      mobile: userData.mobile,
      password: hashedPassword,
      role: 'admin',
      staffId: null,
      businessName: userData.businessName,
      ownerName: userData.ownerName,
      profileImage: null,
      createdAt: new Date(),
    };

    await db.users.add(user);
    return user;
  }

  static async loginAdmin(username: string, password: string): Promise<User | null> {
    // Find user by username (which is the mobile number)
    const user = await db.users.where('username').equals(username).first();
    if (!user || user.role !== 'admin') {
      // If not found by username, try finding by mobile number for backward compatibility
      const userByMobile = await db.users.where('mobile').equals(username).first();
      if (!userByMobile || userByMobile.role !== 'admin') return null;
      
      const isValid = await verifyPassword(password, userByMobile.password);
      return isValid ? userByMobile : null;
    }
    
    const isValid = await verifyPassword(password, user.password);
    return isValid ? user : null;
  }

  static async loginStaff(staffId: string, passkey: string): Promise<User | null> {
    const staffMember = await db.staff.where('staffId').equals(staffId).first();
    if (!staffMember) return null;
    
    const isValid = await verifyPassword(passkey, staffMember.passkey);
    if (!isValid) return null;

    // Return a user-like object for staff
    return {
      id: staffMember.id,
      username: staffMember.name,
      email: '',
      mobile: '',
      password: '',
      role: 'staff' as const,
      staffId: staffMember.staffId,
      businessName: '',
      ownerName: staffMember.name,
      profileImage: null,
      createdAt: staffMember.createdAt,
    };
  }

  static async requestPasswordReset(usernameOrMobile: string): Promise<boolean> {
    try {
      // Find user by username or mobile
      const user = await db.users.where('username').equals(usernameOrMobile).first() ||
                  await db.users.where('mobile').equals(usernameOrMobile).first();
      
      if (!user) return false;
      
      // In a real application, we would:
      // 1. Generate a secure reset token
      // 2. Store the token and expiration time in the database
      // 3. Send the token to the user's email or mobile number
      
      // For this demo, we'll just simulate success
      console.log(`Password reset requested for user: ${user.username || user.mobile}`);
      
      return true;
    } catch (error) {
      console.error('Error requesting password reset:', error);
      return false;
    }
  }

  static async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      // In a real application, we would:
      // 1. Verify the token is valid and not expired
      // 2. Find the user associated with the token
      // 3. Update the user's password
      // 4. Invalidate the token
      
      // For this demo, we'll just simulate success
      console.log(`Password reset with token: ${token}`);
      
      // In a real implementation, we would update the user's password here
      // const user = await db.users.where('resetToken').equals(token).first();
      // if (!user) return false;
      // 
      // const hashedPassword = await hashPassword(newPassword);
      // await db.users.update(user.id, { 
      //   password: hashedPassword,
      //   resetToken: null,
      //   resetTokenExpiry: null
      // });
      
      return true;
    } catch (error) {
      console.error('Error resetting password:', error);
      return false;
    }
  }

  static async createStaff(staffData: {
    name: string;
    staffId: string;
    passkey: string;
    createdBy: string;
  }): Promise<Staff> {
    // Check if staff ID already exists
    const existingStaff = await db.staff.where('staffId').equals(staffData.staffId).first();
    if (existingStaff) {
      throw new Error('Staff ID already exists');
    }

    const hashedPasskey = await hashPassword(staffData.passkey);
    
    const staff: Staff = {
      id: generateUUID(),
      name: staffData.name,
      staffId: staffData.staffId,
      passkey: hashedPasskey,
      createdBy: staffData.createdBy,
      createdAt: new Date(),
    };

    await db.staff.add(staff);

    // Attempt to push to server immediately
    try {
      const url = typeof window !== 'undefined' ? window.location.origin : '';
      fetch(`${url}/api/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([staff])
      }).catch(err => console.warn('Background staff sync failed:', err));
    } catch (e) {
      // Ignore sync errors during creation, local save is priority
    }

    return staff;
  }

  static async updateUser(id: string, updates: Partial<User>): Promise<void> {
    await db.users.update(id, updates);
  }

  static async updateProfileImage(id: string, profileImage: string): Promise<void> {
    await db.users.update(id, { profileImage });
  }
}

// Product service
export class ProductService {
  static async getAllProducts(): Promise<Product[]> {
    return await db.products.toArray();
  }

  static async getProductById(id: string): Promise<Product | undefined> {
    return await db.products.get(id);
  }

  static async getProductByBarcode(barcode: string): Promise<Product | undefined> {
    return await db.products.where('barcode').equals(barcode).first();
  }

  // Sync all local products to the server database for customer scanning
  static async syncAllProductsToServer(): Promise<boolean> {
    try {
      const products = await db.products.toArray();
      
      // If no products, return success immediately
      if (products.length === 0) {
        console.log('No products to sync');
        return true;
      }
      
      const formattedProducts = products.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        cost: (p as any).cost ?? 0,
        barcode: p.barcode,
        category: p.category ?? 'general',
        // Minimize image data size - only include if absolutely necessary
        image: null, // Remove image data to reduce payload size
        quantity: p.quantity ?? 0,
        createdAt: (p as any).createdAt instanceof Date ? (p as any).createdAt.toISOString() : new Date().toISOString(),
        updatedAt: (p as any).updatedAt instanceof Date ? (p as any).updatedAt.toISOString() : new Date().toISOString(),
      }));

      // Use smaller chunks to avoid "request entity too large" errors
      const CHUNK_SIZE = 3; // Reduced from 10 to 3
      let allSuccess = true;
      
      // Process products in smaller chunks
      for (let i = 0; i < formattedProducts.length; i += CHUNK_SIZE) {
        const chunk = formattedProducts.slice(i, i + CHUNK_SIZE);
        
        try {
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
          const primaryUrl = `${origin}/api/products`;
          const fallbackUrl = `http://${host}:5000/api/products`;

          let res = await fetch(primaryUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chunk),
          });

          if (!res.ok) {
            try {
              res = await fetch(fallbackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chunk),
              });
            } catch {}
            if (!res.ok) {
              const errorText = await res.text();
              console.error(`Product sync failed for chunk ${i}-${i+chunk.length}:`, errorText);
              allSuccess = false;
            } else {
              console.log(`Successfully synced products ${i+1}-${i+chunk.length} of ${formattedProducts.length}`);
            }
          } else {
            console.log(`Successfully synced products ${i+1}-${i+chunk.length} of ${formattedProducts.length}`);
          }
        } catch (error) {
          console.error(`Network error syncing chunk ${i}-${i+chunk.length}:`, error);
          allSuccess = false;
        }
        
        // Add a small delay between chunks to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Sync variants as well
      await ProductService.syncVariantsToServer();

      return allSuccess;
    } catch (error) {
      console.error('Error syncing products to server:', error);
      return false;
    }
  }

  // Sync all local variants to the server database
  static async syncVariantsToServer(): Promise<boolean> {
    try {
      const variants = await db.variants.toArray();
      
      if (variants.length === 0) {
        return true;
      }
      
      const formattedVariants = variants.map(v => ({
        id: v.id,
        productId: v.productId,
        name: v.name,
        barcode: v.barcode,
        price: v.price,
        cost: v.cost,
        image: null, // Minimize payload
        quantity: v.quantity ?? 0,
        createdAt: (v as any).createdAt instanceof Date ? (v as any).createdAt.toISOString() : new Date().toISOString(),
        updatedAt: (v as any).updatedAt instanceof Date ? (v as any).updatedAt.toISOString() : new Date().toISOString(),
      }));

      const CHUNK_SIZE = 5;
      let allSuccess = true;
      
      for (let i = 0; i < formattedVariants.length; i += CHUNK_SIZE) {
        const chunk = formattedVariants.slice(i, i + CHUNK_SIZE);
        
        try {
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
          const primaryUrl = `${origin}/api/variants`;
          const fallbackUrl = `http://${host}:5000/api/variants`;

          let res = await fetch(primaryUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chunk),
          });

          if (!res.ok) {
            try {
              res = await fetch(fallbackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chunk),
              });
            } catch {}
            if (!res.ok) {
              allSuccess = false;
            }
          }
        } catch (error) {
          allSuccess = false;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      return allSuccess;
    } catch (error) {
      console.error('Error syncing variants to server:', error);
      return false;
    }
  }

  static async addProduct(productData: {
    name: string;
    barcode: string;
    price: number;
    cost?: number;
    quantity: number;
    category?: string;
    image?: string;
  }): Promise<Product> {
    // Check if product with same barcode already exists
    const existingProduct = await db.products.where('barcode').equals(productData.barcode).first();
    if (existingProduct) {
      throw new Error('Product with this barcode already exists');
    }

    // Validate data
    if (productData.price <= 0) {
      throw new Error('Price must be greater than 0');
    }
    
    if (productData.quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }

    const product: Product = {
      id: generateUUID(),
      name: productData.name.trim(),
      barcode: productData.barcode.trim(),
      price: Math.round(productData.price * 100) / 100, // Round to 2 decimal places
      cost: productData.cost ? Math.round(productData.cost * 100) / 100 : 0,
      quantity: Math.floor(productData.quantity), // Ensure integer
      category: productData.category?.trim() || 'general',
      image: productData.image || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.products.add(product);
    try {
      await ProductService.syncAllProductsToServer();
    } catch (error) {
      console.error('Error syncing products after add:', error);
    }
    return product;
  }

  static async updateProduct(id: string, updates: Partial<Product>): Promise<void> {
    const existingProduct = await db.products.get(id);
    if (!existingProduct) {
      throw new Error('Product not found');
    }

    // If updating barcode, check for duplicates
    if (updates.barcode && updates.barcode !== existingProduct.barcode) {
      const duplicateProduct = await db.products.where('barcode').equals(updates.barcode).first();
      if (duplicateProduct && duplicateProduct.id !== id) {
        throw new Error('Product with this barcode already exists');
      }
    }

    // Validate updates
    if (updates.price !== undefined && updates.price <= 0) {
      throw new Error('Price must be greater than 0');
    }
    
    if (updates.quantity !== undefined && updates.quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }

    // Clean and validate string fields
    const cleanUpdates: Partial<Product> = { ...updates };
    if (cleanUpdates.name) cleanUpdates.name = cleanUpdates.name.trim();
    if (cleanUpdates.barcode) cleanUpdates.barcode = cleanUpdates.barcode.trim();
    if (cleanUpdates.category) cleanUpdates.category = cleanUpdates.category.trim();
    if (cleanUpdates.price) cleanUpdates.price = Math.round(cleanUpdates.price * 100) / 100;
    if (cleanUpdates.cost !== undefined && cleanUpdates.cost !== null) cleanUpdates.cost = Math.round(cleanUpdates.cost * 100) / 100;
    if (cleanUpdates.quantity) cleanUpdates.quantity = Math.floor(cleanUpdates.quantity);

    await db.products.update(id, { ...cleanUpdates, updatedAt: new Date() });
    try {
      await ProductService.syncAllProductsToServer();
    } catch (error) {
      console.error('Error syncing products after update:', error);
    }
  }

  static async deleteProduct(id: string): Promise<void> {
    await db.products.delete(id);
    try {
      await ProductService.syncAllProductsToServer();
    } catch (error) {
      console.error('Error syncing products after delete:', error);
    }
  }

  static async updateStock(productId: string, quantityChange: number): Promise<void> {
    const product = await db.products.get(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    const newQuantity = product.quantity + quantityChange;
    if (newQuantity < 0) {
      throw new Error('Insufficient stock');
    }

    await db.products.update(productId, {
      quantity: newQuantity,
      updatedAt: new Date(),
    });
  }

  static async addVariant(productId: string, data: { name: string; price: number; cost: number; quantity?: number; barcode?: string; image?: string | null }): Promise<Variant> {
    const variant: Variant = {
      id: generateUUID(),
      productId,
      name: data.name.trim(),
      price: Math.round(data.price * 100) / 100,
      cost: Math.round(data.cost * 100) / 100,
      barcode: data.barcode?.trim() || null,
      image: data.image || null,
      quantity: Math.floor(data.quantity ?? 0),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Variant;
    await db.variants.add(variant);
    try {
      await ProductService.syncVariantsToServer();
    } catch (e) {
      console.error('Failed to sync variant', e);
    }
    return variant;
  }

  static async getVariants(productId: string): Promise<Variant[]> {
    return await db.variants.where('productId').equals(productId).toArray();
  }
  
  static async getVariantById(variantId: string): Promise<Variant | undefined> {
    return await db.variants.get(variantId);
  }

  static async updateVariant(id: string, updates: Partial<Variant>): Promise<void> {
    await db.variants.update(id, { ...updates, updatedAt: new Date() });
    try {
      await ProductService.syncVariantsToServer();
    } catch (e) {
      console.error('Failed to sync variant update', e);
    }
  }
}

// Sales service
export class SalesService {
  static async processSale(saleData: {
    items: CartItem[];
    total: number;
    paymentType: 'cash' | 'ewallet' | 'credits';
    paymentAmount: number;
    staffId?: string;
  }): Promise<Sale> {
    // Validate sale data
    if (!saleData.items || saleData.items.length === 0) {
      throw new Error('Cannot process sale with empty cart');
    }

    if (saleData.total <= 0) {
      throw new Error('Sale total must be greater than 0');
    }

    if (saleData.paymentType === 'cash' && saleData.paymentAmount < saleData.total) {
      throw new Error('Insufficient payment amount for cash transaction');
    }
    // For credits, paymentAmount represents amount paid now (usually 0)
    if (saleData.paymentType === 'credits' && saleData.paymentAmount < 0) {
      throw new Error('Payment amount cannot be negative');
    }

    // Check stock availability for all items before processing
    for (const item of saleData.items) {
      if ((item as any).isNonInventory) continue;

      const product = await ProductService.getProductByBarcode(item.productId) ||
                     await db.products.get(item.productId);

      const multiplier = getUnitMultiplier(item.unit);
      const actualQuantity = item.quantity * multiplier;

      if (!product) {
        // Check if it is a variant
        const variant = await db.variants.get(item.productId);
        if (variant) {
          const variantQty = (variant as any).quantity ?? 0;
          if (variantQty < actualQuantity) {
            throw new Error(`Insufficient stock for variant ${item.name}. Available: ${variantQty}, Required: ${actualQuantity}`);
          }
          continue;
        }
        throw new Error(`Product ${item.name} no longer exists`);
      }

      if (product.quantity < actualQuantity) {
        throw new Error(`Insufficient stock for ${item.name}. Available: ${product.quantity}, Required: ${actualQuantity}`);
      }
    }

    const sale: Omit<Sale, 'items'> = {
      id: generateUUID(),
      total: Math.round(saleData.total * 100) / 100,
      paymentType: saleData.paymentType,
      paymentAmount: Math.round(saleData.paymentAmount * 100) / 100,
      staffId: saleData.staffId || null,
      createdAt: new Date(),
    };

    await db.sales.add(sale as Sale);

    // Add sale items
    for (const item of saleData.items) {
        const saleItem: SaleItem = {
            id: generateUUID(),
            saleId: sale.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            unit: item.unit,
            productName: item.name,
            isNonInventory: !!item.isNonInventory
        };
        await db.saleItems.add(saleItem);
    }

    // Update inventory (use a transaction-like approach)
    try {
      for (const item of saleData.items) {
        if (item.isNonInventory) continue;
        const multiplier = getUnitMultiplier(item.unit);
        const actualQuantity = item.quantity * multiplier;
        try {
          await ProductService.updateStock(item.productId, -actualQuantity);
        } catch (e) {
          // If product update fails, try updating variant stock
          const variant = await db.variants.get(item.productId);
          if (variant) {
            const currentQty = (variant as any).quantity ?? 0;
            const newQty = currentQty - actualQuantity;
            if (newQty < 0) throw new Error(`Insufficient stock for variant ${variant.name}`);
            await ProductService.updateVariant(variant.id, { quantity: newQty });
          } else {
            throw e;
          }
        }
      }
    } catch (error) {
      // If stock update fails, remove the sale record to maintain consistency
      await db.sales.delete(sale.id);
      await db.saleItems.where('saleId').equals(sale.id).delete();
      throw new Error(`Failed to update inventory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return sale as Sale;
  }

  static async getTodaysSales(): Promise<Sale[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return await db.sales.where('createdAt').above(today).toArray();
  }

  static async getTotalSales(): Promise<number> {
    const sales = await db.sales.toArray();
    return sales.reduce((total, sale) => total + (sale.total || 0), 0);
  }

  static async addIncome(total: number, paymentType: 'cash' | 'ewallet', staffId?: string): Promise<Sale> {
    if (total <= 0) {
      throw new Error('Income total must be greater than 0');
    }
    const sale: Sale = {
      id: generateUUID(),
      total: Math.round(total * 100) / 100,
      paymentType,
      paymentAmount: Math.round(total * 100) / 100,
      staffId: staffId || null,
      createdAt: new Date(),
    } as Sale;
    await db.sales.add(sale);
    return sale;
  }
}

// Staff service
export class StaffService {
  static async getAllStaff(): Promise<Staff[]> {
    return await db.staff.toArray();
  }

  static async getActiveStaff(): Promise<Staff[]> {
    // Return all staff, filtering is handled by the UI based on real-time status
    return await db.staff.toArray();
  }

  static async getInactiveStaff(): Promise<Staff[]> {
    // Return all staff, filtering is handled by the UI based on real-time status
    return await db.staff.toArray();
  }

  static async deleteStaff(id: string): Promise<void> {
    await db.staff.delete(id);
  }
}

// Expense service
export class ExpenseService {
    static async addExpense(expenseData: Omit<Expense, 'id'>): Promise<Expense> {
        const expense: Expense = {
            id: generateUUID(),
            ...expenseData,
        };
        await db.expenses.add(expense);
        return expense;
    }

    static async getAllExpenses(): Promise<Expense[]> {
        return await db.expenses.toArray();
    }
}

// Purchase service
export class PurchaseService {
    static async addPurchase(purchaseData: Omit<Purchase, 'id'>): Promise<Purchase> {
        const purchase: Purchase = {
            id: generateUUID(),
            ...purchaseData,
        };
        await db.purchases.add(purchase);
        return purchase;
    }

    static async getAllPurchases(): Promise<Purchase[]> {
        return await db.purchases.toArray();
    }
}

// Creditor service
export class CreditorService {
    static async addCreditor(creditorData: Omit<Creditor, 'id'>): Promise<Creditor> {
        const creditor: Creditor = {
            id: generateUUID(),
            ...creditorData,
        };
        await db.creditors.add(creditor);
        return creditor;
    }

  static async getAllCreditors(): Promise<Creditor[]> {
    return await db.creditors.toArray();
  }

  static async getCreditorById(id: string): Promise<Creditor | undefined> {
    return await db.creditors.get(id);
  }

  static async markAsPaid(id: string): Promise<void> {
    await db.creditors.update(id, { isPaid: true });
  }

  static async applyCredit(creditorId: string, items: CartItem[], total: number): Promise<void> {
    const creditor = await db.creditors.get(creditorId);
    if (!creditor) throw new Error('Creditor not found');

    const newAmount = (creditor.amount || 0) + Math.round(total * 100) / 100;
    // Append transaction details into description as JSON array
    let txns: Array<{ date: string; total: number; items: Array<{ name: string; quantity: number; unit: CartItem['unit']; subtotal: number }> }> = [];
    try {
      if (creditor.description) {
        const parsed = JSON.parse(creditor.description);
        if (Array.isArray(parsed)) txns = parsed;
      }
    } catch {}
    txns.push({
      date: new Date().toISOString(),
      total: Math.round(total * 100) / 100,
      items: items.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit, subtotal: Math.round(i.subtotal * 100) / 100 }))
    });

    await db.creditors.update(creditorId, { amount: newAmount, description: JSON.stringify(txns) });
  }

  static async recordPayment(creditorId: string, amount: number, paymentType: 'cash' | 'ewallet'): Promise<void> {
    const creditor = await db.creditors.get(creditorId);
    if (!creditor) throw new Error('Creditor not found');
    const current = Math.round((creditor.amount || 0) * 100) / 100;
    const pay = Math.round(amount * 100) / 100;
    
    if (pay <= 0) throw new Error('Payment amount must be greater than 0');
    if (pay > current) throw new Error('Payment amount exceeds current balance');

    let creditsArr: Array<any> = [];
    let paymentsArr: Array<{ date: string; amount: number; method: string }> = [];
    try {
      if (creditor.description) {
        const parsed = JSON.parse(creditor.description);
        if (Array.isArray(parsed)) {
          creditsArr = parsed;
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.credits)) creditsArr = parsed.credits;
          if (Array.isArray(parsed.payments)) paymentsArr = parsed.payments;
        }
      }
    } catch {}

    paymentsArr.push({ date: new Date().toISOString(), amount: pay, method: paymentType });
    const nextDesc = JSON.stringify({ credits: creditsArr, payments: paymentsArr });
    
    const newBalance = Math.round((current - pay) * 100) / 100;
    const isPaid = newBalance <= 0;
    
    await db.creditors.update(creditorId, { amount: newBalance, isPaid: isPaid, description: nextDesc });
    await SalesService.addIncome(pay, paymentType);
  }
}
