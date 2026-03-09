import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

type ReceiptSettings = {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  headerNote: string;
  footerNote: string;
  autoPrintOnSale: boolean;
  printerDeviceName: string;
  paperWidth: '58mm' | '80mm';
  showDateTime: boolean;
  showStaffName: boolean;
};

type SettingsResponse = {
  receipt?: Partial<ReceiptSettings>;
  [key: string]: any;
};

const defaultReceiptSettings: ReceiptSettings = {
  storeName: 'SmartPOS+ Store',
  storeAddress: '',
  storePhone: '',
  headerNote: 'Thank you for your purchase!',
  footerNote: 'No refunds without receipt.',
  autoPrintOnSale: false,
  printerDeviceName: '',
  paperWidth: '58mm',
  showDateTime: true,
  showStaffName: true,
};

export default function AdminSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>(defaultReceiptSettings);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch('/api/settings');
        if (r.ok) {
          const data: SettingsResponse = await r.json();
          const merged: ReceiptSettings = {
            ...defaultReceiptSettings,
            ...(data.receipt || {}),
          };
          if (mounted) {
            setReceiptSettings(merged);
          }
        }
      } catch {
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt: receiptSettings }),
      });
      if (!res.ok) {
        throw new Error('Failed to save settings');
      }
      toast({
        title: 'Settings Saved',
        description: 'Receipt settings have been updated.',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Could not save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = async () => {
    try {
      const res = await fetch('/api/print/test-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        throw new Error('Printer is not configured or test failed');
      }
      toast({
        title: 'Test Receipt Sent',
        description: 'Check your connected printer for the test receipt.',
      });
    } catch (error) {
      toast({
        title: 'Test Print Failed',
        description: error instanceof Error ? error.message : 'Could not send test receipt',
        variant: 'destructive',
      });
    }
  };

  return (
    <Layout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-800">Admin Settings</h1>
        </div>

        <Card className="p-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Receipt Configuration</h2>
            <p className="text-sm text-gray-500">
              Customize how receipts look when printing from the scanner and sales screen.
            </p>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500">Loading settings…</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="storeName">Store Name</Label>
                  <Input
                    id="storeName"
                    value={receiptSettings.storeName}
                    onChange={(e) =>
                      setReceiptSettings((s) => ({ ...s, storeName: e.target.value }))
                    }
                    placeholder="SmartPOS+ Store"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storePhone">Store Phone</Label>
                  <Input
                    id="storePhone"
                    value={receiptSettings.storePhone}
                    onChange={(e) =>
                      setReceiptSettings((s) => ({ ...s, storePhone: e.target.value }))
                    }
                    placeholder="+63 900 000 0000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="storeAddress">Store Address</Label>
                <Textarea
                  id="storeAddress"
                  value={receiptSettings.storeAddress}
                  onChange={(e) =>
                    setReceiptSettings((s) => ({ ...s, storeAddress: e.target.value }))
                  }
                  placeholder="Street, City, Province, ZIP"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="headerNote">Header Note</Label>
                  <Textarea
                    id="headerNote"
                    value={receiptSettings.headerNote}
                    onChange={(e) =>
                      setReceiptSettings((s) => ({ ...s, headerNote: e.target.value }))
                    }
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="footerNote">Footer Note</Label>
                  <Textarea
                    id="footerNote"
                    value={receiptSettings.footerNote}
                    onChange={(e) =>
                      setReceiptSettings((s) => ({ ...s, footerNote: e.target.value }))
                    }
                    rows={2}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="printerDeviceName">Printer Name</Label>
                  <Input
                    id="printerDeviceName"
                    value={receiptSettings.printerDeviceName}
                    onChange={(e) =>
                      setReceiptSettings((s) => ({ ...s, printerDeviceName: e.target.value }))
                    }
                    placeholder="Leave empty for system default"
                  />
                  <p className="text-xs text-gray-500">
                    Optional. Use the exact printer name from your system.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Paper Width</Label>
                  <Select
                    value={receiptSettings.paperWidth}
                    onValueChange={(value: '58mm' | '80mm') =>
                      setReceiptSettings((s) => ({ ...s, paperWidth: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="58mm">58mm</SelectItem>
                      <SelectItem value="80mm">80mm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Auto Print on Sale</Label>
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span className="text-sm text-gray-700">Automatically print after confirm</span>
                    <Switch
                      checked={receiptSettings.autoPrintOnSale}
                      onCheckedChange={(checked) =>
                        setReceiptSettings((s) => ({ ...s, autoPrintOnSale: checked }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <div className="text-sm font-medium text-gray-800">Show Date & Time</div>
                    <div className="text-xs text-gray-500">
                      Include transaction timestamp on receipt.
                    </div>
                  </div>
                  <Switch
                    checked={receiptSettings.showDateTime}
                    onCheckedChange={(checked) =>
                      setReceiptSettings((s) => ({ ...s, showDateTime: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <div className="text-sm font-medium text-gray-800">Show Staff Name</div>
                    <div className="text-xs text-gray-500">
                      Print the staff name who processed the sale.
                    </div>
                  </div>
                  <Switch
                    checked={receiptSettings.showStaffName}
                    onCheckedChange={(checked) =>
                      setReceiptSettings((s) => ({ ...s, showStaffName: checked }))
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestPrint}
                  disabled={saving}
                >
                  Print Test Receipt
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Settings'}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
