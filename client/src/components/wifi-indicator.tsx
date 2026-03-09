import { useEffect, useState } from 'react';
import { CheckCircle, WifiOff } from 'lucide-react';

interface WiFiStatus {
  connected: boolean;
  ssid?: string;
  signalStrength?: number;
  ipAddress?: string;
}

export function WiFiIndicator() {
  const [status, setStatus] = useState<WiFiStatus | null>(null);
  
  useEffect(() => {
    // Get initial status
    fetchStatus();
    
    // Set up polling
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);
  
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/wifi/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Error fetching WiFi status:', error);
    }
  };
  
  // Render signal strength bars
  const renderSignalBars = (strength: number = -90) => {
    const absStrength = Math.abs(strength);
    return (
      <div className="flex items-center">
        {[0, 1, 2, 3].map(i => {
          const isActive = absStrength > 30 + (i * 15);
          return (
            <div 
              key={i} 
              className={`h-${i+1} w-1 mx-px rounded-sm ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}
            />
          );
        })}
      </div>
    );
  };
  
  return (
    <div className="flex items-center space-x-2 p-2 border rounded-md bg-muted/20">
      {status?.connected ? (
        <>
          <CheckCircle className="h-5 w-5 text-green-500" />
          <div className="flex flex-col">
            <span className="font-medium">Connected to {status.ssid}</span>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground">{status.ipAddress}</span>
              {renderSignalBars(status.signalStrength)}
            </div>
          </div>
        </>
      ) : (
        <>
          <WifiOff className="h-5 w-5 text-gray-500" />
          <span>Not connected to any network</span>
        </>
      )}
    </div>
  );
}