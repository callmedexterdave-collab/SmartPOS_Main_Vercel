import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Card } from '@/components/ui/card';

interface ReminderLog {
  id: string;
  customer_id: string;
  message_type: string;
  message: string;
  status: string;
  created_at: string;
}

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  useEffect(() => {
    // Example: no public endpoint to list all reminders; this page will be expanded later.
  }, []);
  return (
    <Layout>
      <div className="p-4 space-y-3">
        <Card className="p-4">
          <div className="text-lg font-semibold">Audit Log</div>
          <div className="text-sm text-gray-600">Reminder delivery logs and system activities will appear here.</div>
        </Card>
      </div>
    </Layout>
  );
}

