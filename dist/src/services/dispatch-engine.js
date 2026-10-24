"use strict";
// ==============================================================================
// Yassir Express Dispatch & Matching Engine
// Implements synchronized dispatch delay, candidate scoring & offer lifecycles
// ==============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.DispatchEngine = void 0;
const config_1 = require("../config");
const types_1 = require("../types");
class DispatchEngine {
    telemetryService;
    ledgerService;
    activeOffers = new Map(); // offerId -> DispatchOffer
    orderToOffer = new Map(); // orderId -> offerId
    constructor(telemetryService, ledgerService) {
        this.telemetryService = telemetryService;
        this.ledgerService = ledgerService;
    }
    /**
     * Calculate synchronized dispatch schedule time:
     * T_dispatch = T_now + max(0, PrepTime - CourierETA - SafetyBuffer)
     */
    calculateDispatchDelayMinutes(merchantPrepMinutes, courierEtaMinutes) {
        const safetyBufferMinutes = Math.round(config_1.CONFIG.DISPATCH_SAFETY_BUFFER_SECONDS / 60);
        const delayMinutes = merchantPrepMinutes - courierEtaMinutes - safetyBufferMinutes;
        return Math.max(0, delayMinutes);
    }
    /**
     * Find and rank courier candidates for a given order.
     */
    rankCandidates(order, merchantLocation) {
        const allCouriers = this.telemetryService.getAllCouriers();
        const candidates = [];
        for (const courier of allCouriers) {
            // Must be online and idle
            if (courier.status !== types_1.CourierStatus.ONLINE_IDLE) {
                continue;
            }
            // Must not exceed courier's cash debt limit
            if (courier.currentCashDebtCents >= courier.maxCashLimitCents) {
                continue;
            }
            const distanceKm = this.telemetryService.calculateDistanceKm(courier.currentLocation, merchantLocation);
            // Must be within operating radius
            if (distanceKm > config_1.CONFIG.MAX_SEARCH_RADIUS_KM) {
                continue;
            }
            const etaMinutes = this.telemetryService.estimateTravelTimeMinutes(distanceKm);
            // Scoring formula:
            // Lower score = higher preference (minimal distance + high acceptance + healthy debt headroom)
            const distanceWeight = 0.5;
            const acceptanceWeight = 0.3;
            const debtWeight = 0.2;
            const debtRatio = courier.currentCashDebtCents / courier.maxCashLimitCents;
            const score = distanceWeight * distanceKm +
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
    createOffer(order, courierId, merchantLocation) {
        const offerId = `off-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const expiresAt = new Date(Date.now() + config_1.CONFIG.DISPATCH_OFFER_TIMEOUT_SECONDS * 1000);
        const guaranteedPayoutCents = Math.round(order.deliveryFeeCents * config_1.CONFIG.COURIER_EARNING_SHARE);
        const offer = {
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
        this.telemetryService.setCourierStatus(courierId, types_1.CourierStatus.OFFER_PENDING);
        return offer;
    }
    getOfferForOrder(orderId) {
        const offerId = this.orderToOffer.get(orderId);
        if (!offerId)
            return undefined;
        return this.activeOffers.get(offerId);
    }
    getAllOffers() {
        return Array.from(this.activeOffers.values());
    }
    getOfferForCourier(courierId) {
        for (const offer of this.activeOffers.values()) {
            if (offer.courierId === courierId) {
                return offer;
            }
        }
        return undefined;
    }
    acceptOffer(offerId) {
        const offer = this.activeOffers.get(offerId);
        if (!offer)
            return { success: false };
        if (new Date() > offer.expiresAt) {
            this.activeOffers.delete(offerId);
            this.orderToOffer.delete(offer.orderId);
            this.telemetryService.setCourierStatus(offer.courierId, types_1.CourierStatus.ONLINE_IDLE);
            return { success: false };
        }
        // Mark courier as assigned
        this.telemetryService.setCourierStatus(offer.courierId, types_1.CourierStatus.ASSIGNED_TO_ORDER);
        this.activeOffers.delete(offerId);
        this.orderToOffer.delete(offer.orderId);
        return {
            success: true,
            orderId: offer.orderId,
            courierId: offer.courierId,
        };
    }
    declineOffer(offerId) {
        const offer = this.activeOffers.get(offerId);
        if (!offer)
            return false;
        this.telemetryService.setCourierStatus(offer.courierId, types_1.CourierStatus.ONLINE_IDLE);
        this.activeOffers.delete(offerId);
        this.orderToOffer.delete(offer.orderId);
        return true;
    }
}
exports.DispatchEngine = DispatchEngine;
