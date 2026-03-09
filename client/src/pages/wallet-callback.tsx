import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle } from 'lucide-react';

const WalletCallback: React.FC = () => {
  const [provider, setProvider] = useState<string>('');
  const [status, setStatus] = useState<'success' | 'error' | 'pending'>('pending');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('provider') || '';
    const s = params.get('status') || '';
    setProvider(p);
    if (s === 'success') {
      setStatus('success');
      try {
        window.opener?.postMessage({ type: 'wallet_connected', provider: p }, window.location.origin);
      } catch {}
      setTimeout(() => { try { window.close(); } catch {} }, 500);
    } else {
      setStatus('error');
      try {
        window.opener?.postMessage({ type: 'wallet_error', provider: p }, window.location.origin);
      } catch {}
    }
  }, []);

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 w-full max-w-sm text-center">
          {status === 'success' ? (
            <div className="space-y-3">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
              <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">Wallet Connected</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{provider}</div>
              <Button onClick={() => { try { window.close(); } catch {} }} className="w-full">Close</Button>
            </div>
          ) : status === 'error' ? (
            <div className="space-y-3">
              <XCircle className="w-12 h-12 text-red-600 mx-auto" />
              <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">Connection Failed</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{provider}</div>
              <Button onClick={() => { try { window.close(); } catch {} }} className="w-full" variant="outline">Close</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">Processing</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Please wait…</div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default WalletCallback;
