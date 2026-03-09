import React, { useState, useEffect, useRef } from 'react';
import { motion, useDragControls, PanInfo } from 'framer-motion';
import { Home, Trash2, CreditCard, AlertTriangle, LogOut, Search, ArrowLeft, Edit } from 'lucide-react';
import { useLocation } from 'wouter';
import Layout from '@/components/Layout';
import Scanner from '@/components/Scanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { ProductService, SalesService, AuthService, db, CreditorService } from '@/lib/db';
import type { CartItem } from '@shared/schema';

// Local interfaces for Product and Variant
interface Product {
  id: string;
  name: string;
  barcode: string;
  price: number;
  cost?: number;
  quantity: number;
  category?: string;
  image?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface Variant {
  id: string;
  productId: string;
  name: string;
  barcode?: string | null;
  price: number;
  cost: number;
  image?: string | null;
}

const ScannerSales: React.FC = () => {
  const [, setLocation] = useLocation();
  const { user, isAdmin, isStaff, logout } = useAuth();
  const { cart, addToCart, removeFromCart, updateCartItem, clearCart, getCartTotal } = useApp();
  const { toast } = useToast();
  const dragControls = useDragControls();
  
  const [mode, setMode] = useState<'scanner' | 'manual'>('scanner');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<'pieces' | 'dozen' | 'carton'>('pieces');
  const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
  const [paymentType, setPaymentType] = useState<'cash' | 'ewallet' | 'credits'>('cash');
  const [paymentError, setPaymentError] = useState(false);
  const [isCreditorDialogOpen, setIsCreditorDialogOpen] = useState(false);
  const [creditors, setCreditors] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCreditor, setSelectedCreditor] = useState<{ id: string; name: string } | null>(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isCartCollapsed, setIsCartCollapsed] = useState(false);
  
  // Non-Inventory State
  const [isNonInventoryOpen, setIsNonInventoryOpen] = useState(false);
  const [nonInvName, setNonInvName] = useState("");
  const [nonInvPrice, setNonInvPrice] = useState("");
  const [nonInvQty, setNonInvQty] = useState("1");
  
  // Manual Mode State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isVariantSelectionOpen, setIsVariantSelectionOpen] = useState(false);
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null);
  const [productVariants, setProductVariants] = useState<Variant[]>([]);

  // Pop-up state for quantity input
  const [showQuantityDialog, setShowQuantityDialog] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<any>(null);
  const [tempQuantity, setTempQuantity] = useState(1);
  const [tempUnit, setTempUnit] = useState<'pieces' | 'dozen' | 'carton'>('pieces');

  // Pay Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [editQuantityStr, setEditQuantityStr] = useState('');

  const [scannerSettings, setScannerSettings] = useState<{ enabled: boolean; timeout: number }>({
    enabled: true,
    timeout: 150
  });

  const scannerBufRef = useRef<string>('');
  const bufferTimerRef = useRef<any>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.externalScanner) {
            setScannerSettings({
              enabled: data.externalScanner.enabled !== false,
              timeout: data.externalScanner.timeout || 150
            });
          }
        }
      } catch (err) {
        console.error('Failed to load scanner settings', err);
      }
    };
    loadSettings();
  }, []);

  const handleAddNonInventory = () => {
    if (!nonInvName || !nonInvPrice) return;
    const price = parseFloat(nonInvPrice);
    const qty = parseInt(nonInvQty) || 1;
    if (isNaN(price) || price <= 0) return;

    const newItem: CartItem = {
      productId: 'NON_INVENTORY_' + Math.random().toString(36).substr(2, 9),
      name: nonInvName,
      price: price,
      quantity: qty,
      unit: 'pieces',
      subtotal: price * qty,
      isNonInventory: true
    };
    
    addToCart(newItem);
    
    setNonInvName("");
    setNonInvPrice("");
    setNonInvQty("1");
    setIsNonInventoryOpen(false);
  };

  useEffect(() => {
    if (mode === 'manual') {
      loadProducts();
    }
  }, [mode]);

  const loadProducts = async () => {
    try {
      // Cast the result to unknown first then to Product[] to match our local interface
      const allProducts = (await ProductService.getAllProducts()) as unknown as Product[];
      setProducts(allProducts);
      const cats = Array.from(new Set(allProducts.map(p => p.category || 'Uncategorized')));
      setCategories(['all', ...cats]);
    } catch (error) {
      console.error('Failed to load products', error);
    }
  };

  useEffect(() => {
    let result = products;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(lower) || p.barcode.includes(searchTerm));
    }
    if (selectedCategory !== 'all') {
      result = result.filter(p => (p.category || 'Uncategorized') === selectedCategory);
    }
    setFilteredProducts(result);
  }, [searchTerm, selectedCategory, products]);

  // Handle product click in manual mode
  const handleProductClick = async (product: Product) => {
    try {
      const variants = (await ProductService.getVariants(product.id)) as unknown as Variant[];
      if (variants && variants.length > 0) {
        setSelectedProductForVariant(product);
        setProductVariants(variants);
        setIsVariantSelectionOpen(true);
      } else {
        setScannedProduct(product);
        setTempQuantity(1);
        setTempUnit('pieces');
        setShowQuantityDialog(true);
      }
    } catch (e) {
      console.error("Error fetching variants", e);
      // Fallback to simple add if variant fetch fails
      setScannedProduct(product);
      setTempQuantity(1);
      setTempUnit('pieces');
      setShowQuantityDialog(true);
    }
  };

  const handleVariantSelect = (variant: Variant) => {
    setIsVariantSelectionOpen(false);
    
    // Create a product-like object for the cart
    // Use variant ID to ensure uniqueness in cart
    const variantProduct = {
      ...selectedProductForVariant,
      id: variant.id, 
      name: `${selectedProductForVariant?.name} (${variant.name})`,
      price: variant.price,
      quantity: (variant as any).quantity ?? 0,
      barcode: variant.barcode,
    };
    
    setScannedProduct(variantProduct);
    setTempQuantity(1);
    setTempUnit('pieces');
    setShowQuantityDialog(true);
  };

  useEffect(() => {
    if (!scannerSettings.enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // If user is typing in an input or textarea, don't capture for scanner
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'Enter') {
        const code = scannerBufRef.current.trim();
        if (code) {
          handleBarcodeScan(code);
          scannerBufRef.current = '';
        }
        return;
      }
      if (e.key.length === 1) {
        scannerBufRef.current += e.key;
        if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
        bufferTimerRef.current = setTimeout(() => {
          const code = scannerBufRef.current.trim();
          if (code) handleBarcodeScan(code);
          scannerBufRef.current = '';
        }, scannerSettings.timeout);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
    };
  }, [scannerSettings]);

  // Helper function to get unit multiplier
  const getUnitMultiplier = (unit: 'pieces' | 'dozen' | 'carton') => {
    switch (unit) {
      case 'dozen': return 12;
      case 'carton': return 24;
      case 'pieces': return 1;
    }
  };

  const handleBarcodeScan = async (barcode: string) => {
    try {
      // Validate barcode format
      if (!barcode || barcode.trim().length === 0) {
        toast({
          title: 'Invalid Barcode',
          description: 'Scanned barcode is empty or invalid',
          variant: 'destructive',
        });
        return;
      }

      const product = await ProductService.getProductByBarcode(barcode.trim());
      
      if (!product) {
        toast({
          title: 'Product Not Found',
          description: `No product found with barcode: ${barcode}`,
          variant: 'destructive',
        });
        return;
      }


      // Show pop-up for quantity and unit input
      setScannedProduct(product);
      setTempQuantity(1);
      setTempUnit('pieces');
      setShowQuantityDialog(true);
    } catch (error) {
      console.error('Error processing barcode scan:', error);
      toast({
        title: 'Scan Error',
        description: error instanceof Error ? error.message : 'Failed to process barcode scan',
        variant: 'destructive',
      });
    }
  };

  // Handle confirmation from quantity dialog
  const handleConfirmQuantity = () => {
    if (!scannedProduct) return;

    // Validate quantity
    if (tempQuantity < 1) {
      toast({
        title: 'Invalid Quantity',
        description: 'Quantity must be at least 1',
        variant: 'destructive',
      });
      return;
    }

    // Convert quantity based on unit
    const unitMultiplier = getUnitMultiplier(tempUnit);
    const actualQuantity = tempQuantity * unitMultiplier;

    // Check stock availability
    if (scannedProduct.quantity < actualQuantity) {
      toast({
        title: 'Insufficient Stock',
        description: `Only ${scannedProduct.quantity} pieces available`,
        variant: 'destructive',
      });
      return;
    }

    // Check existing cart items
    const existingCartItem = cart.find(item => item.productId === scannedProduct.id);
    const currentCartQuantity = existingCartItem ? existingCartItem.quantity : 0;
    
    if (currentCartQuantity + actualQuantity > scannedProduct.quantity) {
      toast({
        title: 'Insufficient Stock',
        description: `Cannot add ${actualQuantity} more. Only ${scannedProduct.quantity - currentCartQuantity} pieces available`,
        variant: 'destructive',
      });
      return;
    }

    // Add to cart with unit information
    const cartItem: CartItem = {
      productId: scannedProduct.id,
      name: scannedProduct.name,
      price: scannedProduct.price,
      quantity: tempQuantity,
      unit: tempUnit,
      subtotal: Math.round(scannedProduct.price * actualQuantity * 100) / 100,
    };

    addToCart(cartItem);
    
    toast({
      title: 'Product Added',
      description: `${scannedProduct.name} (${tempQuantity} ${tempUnit}) added to cart`,
    });

    // Close dialog and reset
    setShowQuantityDialog(false);
    setScannedProduct(null);
    setTempQuantity(1);
    setTempUnit('pieces');
  };

  const handleCancelQuantity = () => {
    setShowQuantityDialog(false);
    setScannedProduct(null);
    setTempQuantity(1);
    setTempUnit('pieces');
  };

  const handleDeleteItem = async (productId: string) => {
    if (isStaff) {
      // Staff needs admin password to delete
      setDeleteItemId(productId);
      return;
    }
    
    // Admin can delete directly
    removeFromCart(productId);
  };

  const confirmDeleteWithPassword = async () => {
    if (!adminPassword || !deleteItemId) return;

    try {
      // Get all admin users and verify password against any of them
      const adminUsers = await db.users.where('role').equals('admin').toArray();
      let adminVerified = false;
      
      for (const admin of adminUsers) {
        if (admin.username && await AuthService.loginAdmin(admin.username, adminPassword)) {
          adminVerified = true;
          break;
        }
      }
      
      if (adminVerified) {
        removeFromCart(deleteItemId);
        setDeleteItemId(null);
        setAdminPassword('');
        toast({
          title: 'Item Removed',
          description: 'Item removed from cart',
        });
      } else {
        toast({
          title: 'Access Denied',
          description: 'Invalid admin password',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to verify admin password',
        variant: 'destructive',
      });
    }
  };

  const handlePayClick = () => {
    if (cart.length === 0) {
      toast({
        title: 'Empty Cart',
        description: 'Add products to cart before processing sale',
        variant: 'destructive',
      });
      return;
    }
    setIsPayModalOpen(true);
  };

  const handleEditItem = (item: CartItem) => {
    setEditingItem(item);
    setEditQuantityStr(item.quantity.toString());
  };

  const saveEditedQuantity = () => {
    if (!editingItem) return;
    const qty = parseInt(editQuantityStr);
    if (isNaN(qty) || qty < 1) {
       toast({ title: 'Invalid Quantity', description: 'Quantity must be at least 1', variant: 'destructive' });
       return;
    }
    
    updateCartItem(editingItem.productId, qty);
    setEditingItem(null);
  };

  const handleProcessSale = async () => {
    if (cart.length === 0) {
      toast({
        title: 'Empty Cart',
        description: 'Add products to cart before processing sale',
        variant: 'destructive',
      });
      return;
    }

    const total = getCartTotal();
    
    const effectivePaymentAmount =
      paymentType === 'cash'
        ? (paymentAmount ?? 0)
        : paymentType === 'ewallet'
          ? total
          : 0;

    if (paymentType === 'cash' && paymentAmount === null) {
      setPaymentError(true);
      toast({
        title: 'Payment Required',
        description: 'Please input the Total Amount',
        variant: 'destructive',
      });
      return;
    }

    if (paymentType === 'cash' && effectivePaymentAmount < total) {
      toast({
        title: 'Insufficient Payment',
        description: `Payment amount must be at least ₱${total.toFixed(2)}`,
        variant: 'destructive',
      });
      return;
    }
    if (paymentType === 'credits' && !selectedCreditor) {
      toast({
        title: 'Select Creditor',
        description: 'Please select a creditor for credit (utang) payment',
        variant: 'destructive',
      });
      setIsCreditorDialogOpen(true);
      return;
    }

    if (paymentError) {
      setPaymentError(false);
    }

    setIsProcessing(true);

    try {
      const sale = await SalesService.processSale({
        items: cart,
        total,
        paymentType,
        paymentAmount: effectivePaymentAmount,
        staffId: user?.staffId || undefined,
      });
      if (paymentType === 'credits' && selectedCreditor) {
        await CreditorService.applyCredit(selectedCreditor.id, cart, total);
      }

      const change =
        paymentType === 'cash' && effectivePaymentAmount > total
          ? effectivePaymentAmount - total
          : 0;

      if (paymentType !== 'credits') {
        try {
          await fetch('/api/print/sale', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: cart,
              total,
              paymentType,
              paymentAmount: effectivePaymentAmount,
              change,
              staffName: user?.name || null,
              createdAt: sale?.createdAt || new Date().toISOString(),
            }),
          });
        } catch (e) {
          console.error('Failed to send receipt to printer:', e);
        }
      }

      toast({
        title: 'Sale Completed',
        description: paymentType === 'credits' ? `Credits of ₱${total.toFixed(2)} applied to ${selectedCreditor?.name}` : `Sale of ₱${total.toFixed(2)} processed successfully!`,
      });

      // Clear cart and reset form
      clearCart();
      setPaymentAmount(0);
      setSelectedCreditor(null);
      setQuantity(1);
      setIsPayModalOpen(false);

    } catch (error) {
      console.error('Error processing sale:', error);
      toast({
        title: 'Sale Failed',
        description: 'Failed to process sale. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Layout showNavigation={false}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-screen overflow-hidden bg-background flex flex-col"
      >
        {/* Header */}
        <div className="text-gray-800 p-4 flex-1 min-h-0 flex flex-col">
          <div className="flex justify-between items-center mb-4 flex-none">
            <h2 className="text-lg font-semibold">Scanner & Sales</h2>
            <button
              onClick={() => {
                if (isStaff) {
                  setShowLogoutConfirm(true);
                } else if (isAdmin) {
                  setLocation('/admin-main');
                }
              }}
              data-testid="button-home"
              className="bg-[#7D6C7D] p-2 rounded-lg touch-feedback hover:bg-[#D89D9D] transition-colors flex items-center justify-center"
              style={{ width: '40px', height: '40px' }}
            >
              {isStaff ? (
                <LogOut className="w-5 h-5" />
              ) : isAdmin ? (
                <Home className="w-5 h-5" />
              ) : (
                <Home className="w-5 h-5" />
              )}
            </button>
          </div>
          
          {/* Toggle Switch */}
          <div className="flex bg-gray-100 p-1 rounded-lg mb-4 flex-none">
             <button
               className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${mode === 'scanner' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
               onClick={() => setMode('scanner')}
             >
               Scanner
             </button>
             <button
               className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${mode === 'manual' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
               onClick={() => setMode('manual')}
             >
               Manual
             </button>
          </div>

          {mode === 'scanner' ? (
            <div className="flex-1 overflow-y-auto">
              {/* Scanner Component */}
              <Scanner
                onResult={handleBarcodeScan}
                onError={(error) => {
                  console.error('Scanner error:', error);
                  toast({
                    title: 'Scanner Error',
                    description: 'Camera access failed or barcode scanning error',
                    variant: 'destructive',
                  });
                }}
                initialMirrorMode={true}
              />
              {/* Manual Barcode Input */}
              <div className="mt-4">
                <label className="block text-gray-800 text-sm font-medium mb-2">Manual Barcode Entry</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    placeholder="Enter barcode manually"
                    className="bg-white text-gray-800 border-gray-300 focus:border-[#FF8882] focus:ring-2 focus:ring-[#FF8882]/20 shadow-sm flex-1"
                    data-testid="input-manual-barcode"
                  />
                  <Button 
                    onClick={() => {
                      if (manualBarcode.trim()) {
                        handleBarcodeScan(manualBarcode.trim());
                        setManualBarcode('');
                      }
                    }}
                    className="bg-[#FF8882] hover:bg-[#D89D9D] text-white shadow-md"
                    disabled={!manualBarcode.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Payment Type */}
              <div className="mt-4">
                <label className="block text-gray-800 text-sm font-medium mb-2">Payment Type</label>
                <Select value={paymentType} onValueChange={async (value: 'cash' | 'ewallet' | 'credits') => {
                  setPaymentType(value);
                  if (value === 'credits') {
                    try {
                      const list = await CreditorService.getAllCreditors();
                      setCreditors(list.map(c => ({ id: c.id, name: c.name })));
                    } catch {}
                    setIsCreditorDialogOpen(true);
                  } else {
                    setIsCreditorDialogOpen(false);
                  }
                }}>
                  <SelectTrigger data-testid="select-payment-type" className="bg-white text-gray-800 border-gray-300 focus:border-[#FF8882] focus:ring-2 focus:ring-[#FF8882]/20 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="ewallet">E-Wallet</SelectItem>
                    <SelectItem value="credits">Credits (Utang)</SelectItem>
                  </SelectContent>
                </Select>
                {paymentType === 'credits' && selectedCreditor && (
                  <div className="mt-2 text-sm text-gray-700">
                    (Utang) Credits to: <span className="font-semibold">{selectedCreditor.name}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
               {/* Search & Category */}
               <div className="flex gap-2 mb-2 p-1 bg-white z-10 flex-none border-b border-gray-100">
                 <div className="relative flex-1">
                   <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                   <Input
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     placeholder="Search product..."
                     className="pl-9 bg-gray-50 border-gray-200"
                   />
                 </div>
                 <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[130px] bg-gray-50 border-gray-200">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c} value={c}>{c === 'all' ? 'All' : c}</SelectItem>
                      ))}
                    </SelectContent>
                 </Select>
               </div>
               
               {/* Product Grid */}
               <div className="flex-1 overflow-y-auto pr-1 pb-4">
                 <div className="grid grid-cols-3 gap-3 p-1">
                  {filteredProducts.map(product => (
                    <div 
                      key={product.id}
                      className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm active:scale-95 transition-transform cursor-pointer"
                      onClick={() => handleProductClick(product)}
                    >
                      <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden relative">
                        {product.image ? (
                           <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                           <div className="text-gray-300">
                             <CreditCard className="w-8 h-8 opacity-20" />
                           </div>
                        )}
                        <div className="absolute top-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                           {product.quantity}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-medium text-sm text-gray-900 leading-tight line-clamp-2 min-h-[2.5em]">{product.name}</h3>
                        <div className="flex justify-between items-end">
                           <span className="font-bold text-[#FF8882]">₱{product.price.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                 </div>
               </div>
            </div>
          )}
        </div>
        
        {/* Sales Cart */}
        <motion.div
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info: PanInfo) => {
            if (info.offset.y < -50 && isCartCollapsed) {
              setIsCartCollapsed(false);
            } else if (info.offset.y > 50 && !isCartCollapsed) {
              setIsCartCollapsed(true);
            }
          }}
          animate={{ 
            height: isCartCollapsed ? '50px' : 'auto',
            flex: isCartCollapsed ? '0 0 auto' : '0 1 50%' 
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="bg-white rounded-t-3xl p-4 flex flex-col shadow-[0_-8px_16px_-2px_rgba(0,0,0,0.15)] z-20 relative"
          style={{ minHeight: isCartCollapsed ? '50px' : '300px' }}
        >
          {/* Collapse Handle */}
          <div 
            className="w-full flex justify-center -mt-2 mb-2 cursor-pointer py-1 touch-none"
            onPointerDown={(e) => dragControls.start(e)}
            onClick={() => setIsCartCollapsed(!isCartCollapsed)}
          >
            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </div>

          <div className="flex justify-between items-center mb-3 flex-none">
            <h3 className="text-lg font-semibold text-gray-800">Sales Cart</h3>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs border-[#FF8882] text-[#FF8882] hover:bg-[#FF8882] hover:text-white"
              onClick={() => setIsNonInventoryOpen(true)}
            >
              Add Non-Inventory
            </Button>
          </div>
          
          {!isCartCollapsed && (
            <>
              {mode === 'manual' && (
                <div className="flex gap-2 mb-3 flex-none border-b pb-3 border-gray-100">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Amount (₱)</label>
                    <Input
                      type="number"
                      value={paymentAmount ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setPaymentAmount(null);
                        } else {
                          const parsed = parseFloat(val);
                          setPaymentAmount(Number.isNaN(parsed) ? null : parsed);
                        }
                        if (paymentError) {
                          setPaymentError(false);
                        }
                      }}
                      placeholder="0.00"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Type</label>
                    <Select value={paymentType} onValueChange={async (value: 'cash' | 'ewallet' | 'credits') => {
                      setPaymentType(value);
                      if (value === 'credits') {
                        try {
                          const list = await CreditorService.getAllCreditors();
                          setCreditors(list.map(c => ({ id: c.id, name: c.name })));
                        } catch {}
                        setIsCreditorDialogOpen(true);
                      } else {
                        setIsCreditorDialogOpen(false);
                      }
                    }}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="ewallet">E-Wallet</SelectItem>
                        <SelectItem value="credits">Credits</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
          
          {cart.length === 0 ? (
            <div className="text-center text-gray-500 py-4 flex-1 flex flex-col justify-center">
              <div className="text-4xl mb-2">🛒</div>
              <p>Cart is empty</p>
              <p className="text-sm">Scan a product to get started</p>
            </div>
          ) : (
            <div className="space-y-2 mb-4 overflow-y-auto flex-1 min-h-0">
              {cart.map((item) => (
                <motion.div
                  key={item.productId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                  data-testid={`cart-item-${item.productId}`}
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">{item.name}</div>
                    <div className="text-sm text-gray-500">
                      ₱{item.price.toFixed(2)} × {item.quantity} {item.unit}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-800">₱{item.subtotal.toFixed(2)}</div>
                    <button
                      onClick={() => handleDeleteItem(item.productId)}
                      data-testid={`button-delete-${item.productId}`}
                      className="text-red-500 text-xs mt-1 touch-feedback"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
        

      </motion.div>
              ))}
            </div>
          )}
          
          {/* Total */}
          <div className="border-t pt-3 flex-none">
            <div className="flex justify-between items-center text-xl font-bold">
              <span>Total:</span>
              <span className="text-[#FF8882]" data-testid="text-cart-total">
                ₱{getCartTotal().toFixed(2)}
              </span>
            </div>
            
            {paymentType === 'cash' && paymentAmount !== null && paymentAmount > getCartTotal() && (
              <div className="flex justify-between items-center text-sm text-gray-600 mt-1">
                <span>Change:</span>
                <span data-testid="text-change">
                  ₱{((paymentAmount || 0) - getCartTotal()).toFixed(2)}
                </span>
              </div>
            )}
          </div>
          
          {/* Pay Button */}
          <Button
            onClick={handlePayClick}
            disabled={isProcessing || cart.length === 0}
            data-testid="button-pay"
            className="w-full bg-[#FF8882] text-white p-4 rounded-xl font-semibold shadow-lg hover:bg-[#D89D9D] mt-4 touch-feedback flex-none"
            style={{
              boxShadow: '0 4px 12px rgba(255, 136, 130, 0.3)',
            }}
          >
            {isProcessing ? 'Processing...' : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                PAY
              </>
            )}
          </Button>
            </>
          )}
        </motion.div>

        {/* Variant Dialog */}
        <Dialog open={isVariantSelectionOpen} onOpenChange={setIsVariantSelectionOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select Variant</DialogTitle>
              <DialogDescription>
                Choose a variant for {selectedProductForVariant?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto">
              {productVariants.map(variant => (
                <button
                  key={variant.id}
                  className="p-3 border rounded-lg hover:bg-gray-50 flex justify-between items-center transition-colors"
                  onClick={() => handleVariantSelect(variant)}
                >
                  <div className="text-left">
                     <div className="font-medium text-gray-900">{variant.name}</div>
                     <div className="text-xs text-gray-500">Barcode: {variant.barcode || 'N/A'}</div>
                  </div>
                  <div className="text-right">
                     <div className="text-[#FF8882] font-bold">₱{variant.price.toFixed(2)}</div>
                     <div className="text-xs text-gray-500">{(variant as any).quantity ?? 0} left</div>
                  </div>
                </button>
              ))}
            </div>
            <DialogFooter>
               <Button variant="outline" onClick={() => setIsVariantSelectionOpen(false)}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Admin Password Dialog for Staff Deletions */}
        <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-warning-500" />
                Admin Authorization Required
              </AlertDialogTitle>
              <AlertDialogDescription>
                Staff members need admin authorization to delete items from the cart.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Input
                type="password"
                placeholder="Enter admin password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                data-testid="input-admin-password"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDeleteWithPassword}
                data-testid="button-confirm-delete"
                className="bg-red-500 hover:bg-red-600"
              >
                Delete Item
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Logout Confirmation Dialog */}
        <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to log out?</AlertDialogTitle>
              <AlertDialogDescription>
                Confirm to end your current session.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowLogoutConfirm(false)}>No</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setShowLogoutConfirm(false); logout(); setLocation('/role-selection'); }}>Yes</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Quantity Input Dialog */}
        <Dialog open={showQuantityDialog} onOpenChange={handleCancelQuantity}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-gray-800">{scannedProduct?.name}</DialogTitle>
              <DialogDescription>
                Enter quantity and select unit type for this product
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Quantity Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                <Input
                  type="number"
                  value={tempQuantity}
                  onChange={(e) => setTempQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  className="w-full"
                  autoFocus
                />
              </div>

              {/* Unit Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
                <Select value={tempUnit} onValueChange={(value: 'pieces' | 'dozen' | 'carton') => setTempUnit(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pieces">Per Pieces</SelectItem>
                    <SelectItem value="dozen">Per Dozen</SelectItem>
                    <SelectItem value="carton">Per Carton</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Product Info */}
              {scannedProduct && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Unit Price:</span>
                      <span className="font-medium">₱{scannedProduct.price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Available Stock:</span>
                      <span className="font-medium">{scannedProduct.quantity} pieces</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelQuantity}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmQuantity}
                className="bg-[#FF8882] hover:bg-[#D89D9D] text-white"
              >
                Confirm & Add to Cart
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Creditor Selection Dialog */}
        <Dialog open={isCreditorDialogOpen} onOpenChange={setIsCreditorDialogOpen}>
          <DialogContent className="sm:max-w-md dark:bg-gray-800 dark:text-gray-200">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setIsCreditorDialogOpen(false)}
                  className="px-3 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-sm"
                >
                  Back
                </button>
                <DialogTitle>Select a Creditors</DialogTitle>
                <div className="w-[64px]" />
              </div>
            </DialogHeader>
            <div className="space-y-2">
              {creditors.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCreditor(c); setIsCreditorDialogOpen(false); }}
                  className="w-full flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3"
                >
                  <div className="text-gray-900 dark:text-gray-100 font-semibold">{c.name}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">ID: {c.id}</div>
                </button>
              ))}
              {creditors.length === 0 && (
                <div className="text-sm text-gray-600 dark:text-gray-400 p-2">No creditors found. Register creditors in Ledger.</div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Non-Inventory Product Dialog */}
        <Dialog open={isNonInventoryOpen} onOpenChange={setIsNonInventoryOpen}>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle className="text-center">Add Non-inventory Products</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label>Product Name</Label>
                <Input value={nonInvName} onChange={e => setNonInvName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Price</Label>
                <Input type="number" value={nonInvPrice} onChange={e => setNonInvPrice(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Qty</Label>
                <Input type="number" value={nonInvQty} onChange={e => setNonInvQty(e.target.value)} />
              </div>
            </div>
            <DialogFooter className="flex-row justify-between sm:justify-between">
              <Button variant="outline" onClick={() => setIsNonInventoryOpen(false)}>Cancel</Button>
              <Button onClick={handleAddNonInventory}>Okay</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Pay Modal - On Que Products */}
        <Dialog open={isPayModalOpen} onOpenChange={setIsPayModalOpen}>
          <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 overflow-hidden gap-0 outline-none">
            <div className="p-4 border-b flex items-center justify-between bg-white flex-none">
               <Button variant="ghost" size="sm" onClick={() => setIsPayModalOpen(false)} className="flex items-center gap-2">
                 <ArrowLeft className="w-5 h-5" />
                 Back
               </Button>
               <h2 className="text-xl font-bold text-center flex-1">On Que Products</h2>
               <div className="w-20" /> {/* Spacer */}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
               {cart.map((item) => (
                 <div key={item.productId} className="bg-white p-4 rounded-xl shadow-sm mb-3 flex justify-between items-center border border-gray-100">
                    <div className="flex-1">
                       <h3 className="font-semibold text-gray-900">{item.name}</h3>
                       <div className="text-sm text-gray-500 mt-1">
                          ₱{item.price.toFixed(2)} × {item.quantity} {item.unit}
                       </div>
                       <div className="text-[#FF8882] font-bold mt-1">
                          Total: ₱{item.subtotal.toFixed(2)}
                       </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <Button 
                         variant="outline" 
                         size="icon"
                         onClick={() => handleEditItem(item)}
                         className="h-10 w-10 rounded-full border-gray-200 text-gray-600 hover:text-[#FF8882] hover:border-[#FF8882]"
                       >
                         <Edit className="w-4 h-4" />
                       </Button>
                       <Button 
                         variant="outline" 
                         size="icon"
                         onClick={() => handleDeleteItem(item.productId)}
                         className="h-10 w-10 rounded-full border-gray-200 text-red-500 hover:bg-red-50 hover:border-red-500"
                       >
                         <Trash2 className="w-4 h-4" />
                       </Button>
                    </div>
                 </div>
               ))}
               {cart.length === 0 && (
                 <div className="text-center text-gray-500 mt-10">No items in queue</div>
               )}
            </div>
            
            <div className="p-4 bg-white border-t flex flex-col gap-2 flex-none">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-gray-800 text-sm font-medium">
                    Payment Amount (₱)
                  </label>
                  <Input
                    type="number"
                    value={paymentAmount ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setPaymentAmount(null);
                      } else {
                        const parsed = parseFloat(val);
                        setPaymentAmount(Number.isNaN(parsed) ? null : parsed);
                      }
                      if (paymentError) {
                        setPaymentError(false);
                      }
                    }}
                    placeholder="0.00"
                    step="0.01"
                    data-testid="input-payment"
                    className={`bg-white text-gray-800 border-gray-300 focus:border-[#FF8882] focus:ring-2 focus:ring-[#FF8882]/20 shadow-sm ${
                      paymentError ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''
                    }`}
                  />
                  {paymentError && (
                    <p className="mt-1 text-xs text-red-500">
                      Please input the Total Amount
                    </p>
                  )}
                </div>
                <div className="w-40 text-right">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Change
                  </div>
                  <div className="text-2xl font-bold text-[#FF8882]">
                    ₱{(
                      paymentType === 'cash' &&
                      paymentAmount !== null &&
                      paymentAmount > getCartTotal()
                        ? paymentAmount - getCartTotal()
                        : 0
                    ).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-white border-t flex justify-between items-center flex-none shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
               <Button 
                 variant="outline" 
                 onClick={() => setIsPayModalOpen(false)}
                 className="px-8 py-6 text-base rounded-xl"
               >
                 Back
               </Button>
               <div className="flex flex-col items-end mr-4">
                  <span className="text-sm text-gray-500">Total Amount</span>
                  <span className="text-xl font-bold text-[#FF8882]">₱{getCartTotal().toFixed(2)}</span>
               </div>
               <Button 
                 onClick={handleProcessSale}
                 disabled={isProcessing || cart.length === 0}
                 className="bg-[#FF8882] hover:bg-[#D89D9D] text-white px-8 py-6 text-base rounded-xl shadow-lg"
               >
                 {isProcessing ? 'Processing...' : 'Confirm'}
               </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Quantity Dialog */}
        <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
           <DialogContent className="sm:max-w-xs">
              <DialogHeader>
                 <DialogTitle>Edit Quantity</DialogTitle>
                 <DialogDescription>Update quantity for {editingItem?.name}</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                 <Input 
                   type="number" 
                   value={editQuantityStr} 
                   onChange={(e) => setEditQuantityStr(e.target.value)}
                   className="text-center text-lg"
                 />
              </div>
              <DialogFooter className="flex gap-2">
                 <Button variant="outline" onClick={() => setEditingItem(null)} className="flex-1">Cancel</Button>
                 <Button onClick={saveEditedQuantity} className="bg-[#FF8882] hover:bg-[#D89D9D] text-white flex-1">Save</Button>
              </DialogFooter>
           </DialogContent>
        </Dialog>

      </motion.div>
    </Layout>
  );
};

export default ScannerSales;
