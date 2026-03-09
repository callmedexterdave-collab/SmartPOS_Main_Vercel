/**
 * WiFi Network Type Definitions
 */

export interface WiFiNetwork {
  ssid: string;
  signal: number;
  security: string;
  connected?: boolean;
}

export interface WiFiStatus {
  connected: boolean;
  ssid?: string;
  signalStrength?: number;
  security?: string;
  ipAddress?: string;
  connectionTime?: string;
}