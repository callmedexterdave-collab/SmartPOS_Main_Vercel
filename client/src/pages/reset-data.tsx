import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db';

export default function ResetDataPage() {
  const { toast } = useToast();
  const [localCleared, setLocalCleared] = useState(false);
  const [serverCleared, setServerCleared] = useState<null | { productsDeleted: number; staffDeleted: number }>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-run on visit to immediately clear local data and then server
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await db.resetDatabase();
        if (!mounted) return;
        setLocalCleared(true);
        toast({ title: 'Local data cleared', description: 'IndexedDB (users, products, sales, staff, etc.) wiped.' });

        // Clear server database
        const res = await fetch('/api/admin/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirm: 'CLEAR_ALL' })
        });

        if (res.ok) {
          const data = await res.json();
          setServerCleared({ productsDeleted: data.productsDeleted ?? 0, staffDeleted: data.staffDeleted ?? 0 });
          toast({ title: 'Server data cleared', description: `Products: ${data.productsDeleted ?? 0}, Staff: ${data.staffDeleted ?? 0}` });
        } else {
          const text = await res.text();
          setError(`Server clear failed: ${text}`);
        }
      } catch (e: any) {
        console.error('Error clearing data:', e);
        setError(e?.message || 'Unknown error');
      }
    })();
    return () => { mounted = false; };
  }, [toast]);

  return (
    <Layout>
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <h1 className="text-xl font-bold text-gray-900">Reset Application Data</h1>
            <p className="mt-2 text-sm text-gray-600">
              This page clears ALL local data (IndexedDB) and server data (SQLite products & staff).
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div>Local IndexedDB cleared: {localCleared ? 'Yes' : 'Pending…'}</div>
              <div>Server cleared: {serverCleared ? `Yes (products ${serverCleared.productsDeleted}, staff ${serverCleared.staffDeleted})` : 'Pending…'}</div>
              {error && <div className="text-red-600">Error: {error}</div>}
            </div>
            <div className="mt-6">
              <Button onClick={() => window.location.assign('/')}>Go to Splash</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

