import { databaseSyncService } from './sync';
import type { Product } from '@shared/schema';

/**
 * RouterAPI class provides methods for interacting with the router's API
 * This is used by customers who are connected to the router to scan products
 */
export class RouterAPI {
  /**
   * Get a product by barcode
   * @param barcode The product barcode
   * @returns The product if found, null otherwise
   */
  static async getProductByBarcode(barcode: string): Promise<Product | null> {
    try {
      // Use the database sync service to get the product
      return await databaseSyncService.getProductByBarcode(barcode);
    } catch (error) {
      console.error('Error fetching product by barcode:', error);
      return null;
    }
  }

  /**
   * Check if the device is connected to the router
   * @returns True if connected, false otherwise
   */
  static async isConnectedToRouter(): Promise<boolean> {
    return await databaseSyncService.checkServerConnection();
  }

  /**
   * Get all products from the router
   * @returns Array of products
   */
  static async getAllProducts(): Promise<Product[]> {
    try {
      const baseUrl = databaseSyncService.getBaseUrl();
      if (!baseUrl) {
        return [];
      }

      const response = await fetch(`${baseUrl}/api/products`);
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching all products:', error);
      return [];
    }
  }
}