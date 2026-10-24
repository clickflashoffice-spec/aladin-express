// ==============================================================================
// Yassir Express Telemetry & Real-Time Tracking Service
// Manages real-time courier GPS pings, distance calculations & WebSocket broadcasts
// ==============================================================================

import { WebSocketServer, WebSocket } from 'ws';
import { Courier, CourierStatus, GeoCoordinate } from '../types';

export class TelemetryService {
  private couriers: Map<string, Courier> = new Map();
  private subscribers: Map<string, Set<WebSocket>> = new Map(); // orderId -> WebSockets
  private globalSubscribers: Set<WebSocket> = new Set();

  constructor() {
    this.seedDefaultCouriers();
  }

  private seedDefaultCouriers() {
    // Seed 3 couriers around Algiers (Hydra, Ben Aknoun, El Biar)
    const couriers: Courier[] = [
      {
        id: 'courier-001',
        fullName: 'Karim Mansouri',
        phoneNumber: '+213551889900',
        vehicleType: 'MOTORCYCLE' as any,
        status: CourierStatus.ONLINE_IDLE,
        currentLocation: { latitude: 36.7430, longitude: 3.0450 }, // Hydra center (~0.3km from merchant)
        lastPingAt: new Date(),
        acceptanceRate: 0.95,
        currentCashDebtCents: 420000, // 4,200 DZD held
        maxCashLimitCents: 1500000, // 15,000 DZD limit
      },
      {
        id: 'courier-002',
        fullName: 'Amine Belkacem',
        phoneNumber: '+213552990011',
        vehicleType: 'MOTORCYCLE' as any,
        status: CourierStatus.ONLINE_IDLE,
        currentLocation: { latitude: 36.7520, longitude: 3.0280 }, // El Biar (~1.8km away)
        lastPingAt: new Date(),
        acceptanceRate: 0.88,
        currentCashDebtCents: 1450000, // 14,500 DZD held (almost at 15k limit!)
        maxCashLimitCents: 1500000,
      },
      {
        id: 'courier-003',
        fullName: 'Yacine Djebbar',
        phoneNumber: '+213553112244',
        vehicleType: 'SCOOTER' as any,
        status: CourierStatus.ONLINE_IDLE,
        currentLocation: { latitude: 36.7580, longitude: 3.0180 }, // Ben Aknoun (~3.2km away)
        lastPingAt: new Date(),
        acceptanceRate: 0.98,
        currentCashDebtCents: 100000, // 1,000 DZD held
        maxCashLimitCents: 1500000,
      },
      // Tunisian Couriers (Tunis / La Marsa / Lac 2)
      {
        id: 'courier-tn-001',
        fullName: 'Mehdi Trabelsi',
        phoneNumber: '+21698112233',
        vehicleType: 'MOTORCYCLE' as any,
        status: CourierStatus.ONLINE_IDLE,
        currentLocation: { latitude: 36.8410, longitude: 10.2390 }, // Lac 2, Tunis
        lastPingAt: new Date(),
        acceptanceRate: 0.96,
        currentCashDebtCents: 85000, // 85.000 TND held (85,000 millimes)
        maxCashLimitCents: 400000,  // 400.000 TND limit (400,000 millimes)
      },
      {
        id: 'courier-tn-002',
        fullName: 'Fares Ben Salem',
        phoneNumber: '+21698445566',
        vehicleType: 'SCOOTER' as any,
        status: CourierStatus.ONLINE_IDLE,
        currentLocation: { latitude: 36.8720, longitude: 10.3150 }, // Carthage / Marsa, Tunis
        lastPingAt: new Date(),
        acceptanceRate: 0.92,
        currentCashDebtCents: 380000, // 380.000 TND held (close to 400 TND limit)
        maxCashLimitCents: 400000,
      },
    ];

    for (const c of couriers) {
      this.couriers.set(c.id, c);
    }
  }

  public getCourier(courierId: string): Courier | undefined {
    return this.couriers.get(courierId);
  }

  public getAllCouriers(): Courier[] {
    return Array.from(this.couriers.values());
  }

  public updateCourierLocation(
    courierId: string,
    coords: GeoCoordinate,
    speedMps: number = 0,
    headingDeg: number = 0
  ): boolean {
    const courier = this.couriers.get(courierId);
    if (!courier) return false;

    courier.currentLocation = coords;
    courier.lastPingAt = new Date();

    // Broadcast to any active order subscribers
    this.broadcastToSubscribers(courierId, coords, speedMps, headingDeg);
    return true;
  }

  public setCourierStatus(courierId: string, status: CourierStatus): boolean {
    const courier = this.couriers.get(courierId);
    if (!courier) return false;
    courier.status = status;
    return true;
  }

  public updateCourierCashDebt(courierId: string, deltaCents: number) {
    const courier = this.couriers.get(courierId);
    if (!courier) return;
    courier.currentCashDebtCents += deltaCents;
  }

  // Haversine distance in Kilometers
  public calculateDistanceKm(c1: GeoCoordinate, c2: GeoCoordinate): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(c2.latitude - c1.latitude);
    const dLon = this.deg2rad(c2.longitude - c1.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(c1.latitude)) *
        Math.cos(this.deg2rad(c2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // Calculate ETA in minutes assuming average urban motorcycle speed of 25 km/h
  public estimateTravelTimeMinutes(distanceKm: number): number {
    const avgSpeedKmH = 25;
    const timeHours = distanceKm / avgSpeedKmH;
    return Math.max(2, Math.round(timeHours * 60));
  }

  // Real-time tracking WebSocket subscription
  public subscribeToOrder(orderId: string, ws: WebSocket) {
    if (!this.subscribers.has(orderId)) {
      this.subscribers.set(orderId, new Set());
    }
    this.subscribers.get(orderId)!.add(ws);

    ws.on('close', () => {
      this.subscribers.get(orderId)?.delete(ws);
    });
  }

  public subscribeGlobal(ws: WebSocket) {
    this.globalSubscribers.add(ws);
    ws.on('close', () => {
      this.globalSubscribers.delete(ws);
    });
  }

  public broadcastEvent(event: any) {
    const payload = JSON.stringify(event);
    for (const ws of this.globalSubscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  private broadcastToSubscribers(
    courierId: string,
    coords: GeoCoordinate,
    speedMps: number,
    headingDeg: number
  ) {
    const payload = JSON.stringify({
      type: 'COURIER_LOCATION_UPDATE',
      courierId,
      location: coords,
      speedMps,
      headingDeg,
      timestamp: new Date().toISOString(),
    });

    for (const ws of this.globalSubscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }

    for (const [_, sockets] of this.subscribers.entries()) {
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    }
  }
}
