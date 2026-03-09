import { db } from './db';
import type { Product, Variant } from '@shared/schema';

interface SyncResponse {
  products: Product[];
  variants?: Variant[];
  timestamp: string;
}

interface StaffSyncResponse {
  staff: Array<{
    id: string;
    name: string;
    staffId: string;
    createdBy: string;
    createdAt: Date | null;
  }>;
  timestamp: string;
}

export class DatabaseSyncService {
  private baseUrl: string;
  private lastSyncTimestamp: string | null = null;
  private isSyncing: boolean = false;

  constructor(baseUrl: string = '') {
    // Default to VITE_BACKEND_URL or current origin if no baseUrl provided
    const defaultUrl = (import.meta as any).env?.VITE_BACKEND_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    this.baseUrl = baseUrl || defaultUrl;
    
    // Try to load last sync timestamp from localStorage
    if (typeof window !== 'undefined') {
      this.lastSyncTimestamp = localStorage.getItem('lastSyncTimestamp');
    }
  }

  /**
   * Set the base URL for the sync service
   * This should be the URL of the router when connected to it
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Get the current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Check if the service is currently syncing
   */
  isCurrentlySyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Get the last sync timestamp
   */
  getLastSyncTimestamp(): string | null {
    return this.lastSyncTimestamp;
  }

  /**
   * Sync the local database with the server
   */
  async syncDatabase(): Promise<boolean> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return false;
    }

    if (!this.baseUrl) {
      console.error('Base URL not set for sync service');
      throw new Error('Base URL not configured for sync service');
    }

    this.isSyncing = true;

    try {
      // Sync products and staff accounts
      await Promise.all([
        this.syncProducts(),
        this.syncStaff()
      ]);

      console.log('Full sync completed successfully.');
      return true;
    } catch (error) {
      console.error('Error during full sync:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync products from the server
   */
  private async syncProducts(): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(`${this.baseUrl}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lastSyncTimestamp: this.lastSyncTimestamp,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
    }

    const data: SyncResponse = await response.json();
    
    if (!data || typeof data !== 'object' || !Array.isArray(data.products)) {
      throw new Error('Invalid products data received from server');
    }
    
    // Update local database with received data
    await this.updateLocalDatabase(data.products);
    
    // Update variants if available
    if (data.variants && Array.isArray(data.variants)) {
      await this.updateLocalVariantsDatabase(data.variants);
    }
    
    // Update last sync timestamp
    this.lastSyncTimestamp = data.timestamp;
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastSyncTimestamp', data.timestamp);
    }

    console.log(`Products sync: Updated ${data.products.length} products.`);
  }

  /**
   * Sync staff accounts from the server
   */
  private async syncStaff(): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${this.baseUrl}/api/sync-staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lastSyncTimestamp: localStorage.getItem('lastStaffSyncTimestamp'),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Staff sync failed: ${response.status}`);
      return; // Don't throw, just log the warning
    }

    const data: StaffSyncResponse = await response.json();
    
    if (!data || typeof data !== 'object' || !Array.isArray(data.staff)) {
      console.warn('Invalid staff data received from server');
      return;
    }
    
    // Update local database with staff data
    await this.updateLocalStaffDatabase(data.staff);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastStaffSyncTimestamp', data.timestamp);
    }

    console.log(`Staff sync: Updated ${data.staff.length} staff accounts.`);
  }

  /**
   * Update local staff database with received data
   */
  private async updateLocalStaffDatabase(staffData: Array<{
    id: string;
    name: string;
    staffId: string;
    createdBy: string;
    createdAt: Date | null;
  }>): Promise<void> {
    if (!staffData || staffData.length === 0) {
      return;
    }

    await db.transaction('rw', db.staff, async () => {
      for (const staffMember of staffData) {
        const existingStaff = await db.staff.get(staffMember.id);
        
        if (!existingStaff) {
          // Add new staff member (without passkey for security)
          // Passkeys are stored locally when admin creates them
          await db.staff.add({
            ...staffMember,
            passkey: '', // Will be set locally by admin
          });
        }
      }
    });
  }

  /**
   * Fetch a product by barcode from the server
   */
  async getProductByBarcode(barcode: string): Promise<Product | null> {
    if (!barcode || typeof barcode !== 'string' || barcode.trim() === '') {
      throw new Error('Invalid barcode provided');
    }

    if (!this.baseUrl) {
      console.error('Base URL not set for sync service');
      throw new Error('Base URL not configured for sync service');
    }

    try {
      // First try to get from local database
      const localProduct = await db.products.where('barcode').equals(barcode.trim()).first();
      if (localProduct) {
        return localProduct;
      }

      // If not found locally, try to get from server with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${this.baseUrl}/api/products/${encodeURIComponent(barcode.trim())}`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Product not found
        } else if (response.status === 500) {
          throw new Error('Server error occurred while fetching product');
        } else {
          throw new Error(`Failed to fetch product: ${response.status} ${response.statusText}`);
        }
      }

      const product: Product = await response.json();
      
      if (!product || typeof product !== 'object' || !product.id) {
        throw new Error('Invalid product data received from server');
      }
      
      // Add the product to local database
      await db.products.put(product);
      
      return product;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('Product fetch request timed out');
          throw new Error('Request timed out. Please check your connection.');
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
          console.error('Network error during product fetch:', error);
          throw new Error('Network error. Please check your internet connection.');
        } else {
          console.error('Error fetching product by barcode:', error);
          throw error;
        }
      } else {
        console.error('Unknown error fetching product by barcode:', error);
        throw new Error('An unknown error occurred while fetching product');
      }
    }
  }

  /**
   * Check if the server is reachable
   */
  async checkServerConnection(): Promise<boolean> {
    if (!this.baseUrl) {
      return false;
    }

    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('Health check request timed out');
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
          console.error('Network error during health check:', error);
        } else {
          console.error('Error checking server connection:', error);
        }
      } else {
        console.error('Unknown error checking server connection:', error);
      }
      return false;
    }
  }

  /**
   * Update the local database with received data
   */
  private async updateLocalDatabase(products: Product[]): Promise<void> {
    if (!products || products.length === 0) {
      return;
    }

    // Use transaction for better performance and atomicity
    await db.transaction('rw', db.products, async () => {
      for (const product of products) {
        // Check if product exists
        const existingProduct = await db.products.get(product.id);
        
        if (existingProduct) {
          // If product exists, update it only if the server version is newer
          const existingDate = new Date(existingProduct.updatedAt || existingProduct.createdAt || new Date());
          const newDate = new Date(product.updatedAt || product.createdAt || new Date());
          
          if (newDate > existingDate) {
            await db.products.put(product);
          }
        } else {
          // If product doesn't exist, add it
          await db.products.add(product);
        }
      }
    });
  }

  /**
   * Update the local database with received variants
   */
  private async updateLocalVariantsDatabase(variants: Variant[]): Promise<void> {
    if (!variants || variants.length === 0) {
      return;
    }

    await db.transaction('rw', db.variants, async () => {
      for (const variant of variants) {
        // Check if variant exists
        const existingVariant = await db.variants.get(variant.id);
        
        if (existingVariant) {
          // If variant exists, update it only if the server version is newer
          const existingDate = new Date((existingVariant as any).updatedAt || (existingVariant as any).createdAt || new Date());
          const newDate = new Date((variant as any).updatedAt || (variant as any).createdAt || new Date());
          
          if (newDate > existingDate) {
            await db.variants.put(variant);
          }
        } else {
          // If variant doesn't exist, add it
          await db.variants.add(variant);
        }
      }
    });
  }
}

// Create a singleton instance
export const databaseSyncService = new DatabaseSyncService();