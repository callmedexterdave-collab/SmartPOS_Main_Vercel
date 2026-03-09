import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { useLocation, useRoute } from 'wouter';
import { ArrowLeft, Image as ImageIcon, Edit } from 'lucide-react';
import { ProductService } from '@/lib/db';
import type { Product, Variant } from '@shared/schema';

export default function ProductDetails() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/inventory/product/:id');
  const id = match ? params?.id : undefined;
  const [product, setProduct] = useState<Product | undefined>(undefined);
  const [variants, setVariants] = useState<Variant[]>([]);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const p = await ProductService.getProductById(id);
      setProduct(p);
      const vs = await ProductService.getVariants(id);
      setVariants(vs);
    })();
  }, [id]);

  if (!id) {
    return (
      <Layout>
        <div className="p-4">
          <div className="text-sm text-gray-600">Invalid product route</div>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="p-4">
          <div className="text-sm text-gray-600">Loading product…</div>
        </div>
      </Layout>
    );
  }

  const variantLabel = product.category ? product.category : 'default';

  return (
    <Layout>
      <div className="bg-white dark:bg-gray-800 p-4 shadow-sm">
        <div className="flex items-center">
          <button
            onClick={() => setLocation('/inventory')}
            className="mr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">Product Details</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg flex items-center gap-4">
          <div className="flex-shrink-0">
            {product.image ? (
              <img src={product.image} alt={product.name} className="w-16 h-16 rounded-lg object-cover" />
            ) : (
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 truncate">{product.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Barcode: {product.barcode}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Category: {product.category || 'general'}</p>
            <p className="text-[#FF8882] font-medium">₱{product.price.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-700">Stock</div>
            <div className="text-lg font-semibold">{product.quantity}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-700 dark:text-gray-300">Product Variant</div>
            <button
              onClick={() => setLocation(`/inventory/product/${product.id}/variant/add`)}
              className="px-3 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-sm"
            >
              Add Variant
            </button>
          </div>
          {variants.length > 0 && (
            <div className="mt-3 space-y-2">
              {variants.map(v => (
                <div key={v.id} className="flex items-center border rounded-lg p-3">
                  <div className="flex items-center gap-3 flex-1">
                    {v.image ? (
                      <img src={v.image} alt={v.name} className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <div className="text-gray-800 dark:text-gray-200 font-medium">{v.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">₱{Number(v.price).toFixed(2)} • Cost ₱{Number(v.cost).toFixed(2)} • Stock {(v as any).quantity ?? 0}</div>
                      {v.barcode && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">Barcode: {v.barcode}</div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setLocation(`/inventory/product/${product.id}/variant/edit/${v.id}`)}
                    className="ml-2 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
