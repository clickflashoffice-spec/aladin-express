// ==============================================================================
// Yassir Express Dispatch & Matching Engine
// Implements synchronized dispatch delay, candidate scoring & offer lifecycles
// ==============================================================================

import { CONFIG } from '../config';
import { Courier, CourierStatus, DispatchOffer, Order, OrderStatus } from '../types';
import { TelemetryService } from './telemetry-service';
import { LedgerService } from './ledger-service';

export class DispatchEngine {
  private activeOffers: Map<string, DispatchOffer> = new Map(); // offerId -> DispatchOffer
  private orderToOffer: Map<string, string> = new Map(); // orderId -> offerId

  constructor(
    private telemetryService: TelemetryService,
    private ledgerService: LedgerService
  ) {}

  /**
   * Calculate synchronized dispatch schedule time:
   * T_dispatch = T_now + max(0, PrepTime - CourierETA - SafetyBuffer)
   */
  public calculateDispatchDelayMinutes(
    merchantPrepMinutes: number,
    courierEtaMinutes: number
  ): number {
    const safetyBufferMinutes = Math.round(CONFIG.DISPATCH_SAFETY_BUFFER_SECONDS / 60);
    const delayMinutes = merchantPrepMinutes - courierEtaMinutes - safetyBufferMinutes;
    return Math.max(0, delayMinutes);
  }

  /**
   * Find and rank courier candidates for a given order.
   */
  public rankCandidates(order: Order, merchantLocation: { latitude: number; longitude: number }): {
    courier: Courier;
    distanceKm: number;
    etaMinutes: number;
    score: number;
  }[] {
    const allCouriers = this.telemetryService.getAllCouriers();
    const candidates: {
      courier: Courier;
      distanceKm: number;
      etaMinutes: number;
      score: number;
    }[] = [];

    for (const courier of allCouriers) {
      // Must be online and idle
      if (courier.status !== CourierStatus.ONLINE_IDLE) {
        continue;
      }

      // Must not exceed courier's cash debt limit
      if (courier.currentCashDebtCents >= courier.maxCashLimitCents) {
        continue;
      }

      const distanceKm = this.telemetryService.calculateDistanceKm(
        courier.currentLocation,
        merchantLocation
      );

      // Must be within operating radius
      if (distanceKm > CONFIG.MAX_SEARCH_RADIUS_KM) {
        continue;
      }

      const etaMinutes = this.telemetryService.estimateTravelTimeMinutes(distanceKm);

      // Scoring formula:
      // Lower score = higher preference (minimal distance + high acceptance + healthy debt headroom)
      const distanceWeight = 0.5;
      const acceptanceWeight = 0.3;
      const debtWeight = 0.2;

      const maxLimit = courier.maxCashLimitCents > 0 ? courier.maxCashLimitCents : 1;
      const debtRatio = courier.currentCashDebtCents / maxLimit;
      const score =
        distanceWeight * distanceKm +
        acceptanceWeight * (1.0 - courier.acceptanceRate) * 10 +
        debtWeight * debtRatio * 5;

      candidates.push({ courier, distanceKm, etaMinutes, score });
    }

    // Sort ascending by score
    return candidates.sort((a, b) => a.score - b.score);
  }

  /**
   * Create and broadcast an order offer to the top candidate.
   */
  public createOffer(
    order: Order,
    courierId: string,
    merchantLocation: { latitude: number; longitude: number }
  ): DispatchOffer {
    const offerId = `off-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const expiresAt = new Date(Date.now() + CONFIG.DISPATCH_OFFER_TIMEOUT_SECONDS * 1000);

    const guaranteedPayoutCents = Math.round(
      order.deliveryFeeCents * CONFIG.COURIER_EARNING_SHARE
    );

    const offer: DispatchOffer = {
      offerId,
      orderId: order.id,
      courierId,
      pickupLocation: merchantLocation,
      dropoffLocation: order.deliveryLocation,
      guaranteedPayoutCents,
      expiresAt,
    };

    this.activeOffers.set(offerId, offer);
    this.orderToOffer.set(order.id, offerId);
    this.telemetryService.setCourierStatus(courierId, CourierStatus.OFFER_PENDING);

    return offer;
  }

  public getOfferForOrder(orderId: string): DispatchOffer | undefined {
    const offerId = this.orderToOffer.get(orderId);
    if (!offerId) return undefined;
    return this.activeOffers.get(offerId);
  }

  public getAllOffers(): DispatchOffer[] {
    return Array.from(this.activeOffers.values());
  }

  public getOfferForCourier(courierId: string): DispatchOffer | undefined {
    for (const offer of this.activeOffers.values()) {
      if (offer.courierId === courierId) {
        return offer;
      }
    }
    return undefined;
  }

  public acceptOffer(offerId: string): { success: boolean; orderId?: string; courierId?: string } {
    const offer = this.activeOffers.get(offerId);
    if (!offer) return { success: false };

    if (new Date() > offer.expiresAt) {
      this.activeOffers.delete(offerId);
      this.orderToOffer.delete(offer.orderId);
      this.telemetryService.setCourierStatus(offer.courierId, CourierStatus.ONLINE_IDLE);
      return { success: false };
    }

    // Mark courier as assigned
    this.telemetryService.setCourierStatus(offer.courierId, CourierStatus.ASSIGNED_TO_ORDER);
    this.activeOffers.delete(offerId);
    this.orderToOffer.delete(offer.orderId);

    return {
      success: true,
      orderId: offer.orderId,
      courierId: offer.courierId,
    };
  }

  public declineOffer(offerId: string): boolean {
    const offer = this.activeOffers.get(offerId);
    if (!offer) return false;

    this.telemetryService.setCourierStatus(offer.courierId, CourierStatus.ONLINE_IDLE);
    this.activeOffers.delete(offerId);
    this.orderToOffer.delete(offer.orderId);
    return true;
  }
}
