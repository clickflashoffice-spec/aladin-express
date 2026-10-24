"use strict";
// ==============================================================================
// Yassir Express Order Management Service & FSM
// Handles order creation, kitchen acceptance, courier dispatching, and delivery
// ==============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
const config_1 = require("../config");
const types_1 = require("../types");
class OrderService {
    catalogService;
    telemetryService;
    dispatchEngine;
    ledgerService;
    orders = new Map();
    constructor(catalogService, telemetryService, dispatchEngine, ledgerService) {
        this.catalogService = catalogService;
        this.telemetryService = telemetryService;
        this.dispatchEngine = dispatchEngine;
        this.ledgerService = ledgerService;
    }
    /**
     * Create and place a new order from a customer.
     */
    createOrder(params) {
        const merchant = this.catalogService.getMerchantById(params.merchantId);
        if (!merchant) {
            return { success: false, error: 'Merchant not found' };
        }
        if (!merchant.isOpen) {
            return { success: false, error: 'Merchant is currently closed' };
        }
        // Resolve items and calculate subtotal
        let subtotalCents = 0;
        const resolvedItems = [];
        for (const itemReq of params.items) {
            const menuItem = this.catalogService.getMenuItem(merchant.id, itemReq.menuItemId);
            if (!menuItem) {
                return { success: false, error: `Menu item ${itemReq.menuItemId} not found` };
            }
            if (!menuItem.isAvailable) {
                return { success: false, error: `Item "${menuItem.title}" is out of stock` };
            }
            const itemTotal = menuItem.priceCents * itemReq.quantity;
            subtotalCents += itemTotal;
            resolvedItems.push({
                menuItemId: menuItem.id,
                title: menuItem.title,
                quantity: itemReq.quantity,
                unitPriceCents: menuItem.priceCents,
                totalPriceCents: itemTotal,
            });
        }
        // Calculate delivery fee based on distance & currency
        const distanceKm = this.telemetryService.calculateDistanceKm(merchant.location, params.deliveryLocation);
        const isTunisia = merchant.countryCode === 'TN';
        const currency = isTunisia ? 'TND' : config_1.CONFIG.DEFAULT_CURRENCY;
        const deliveryFeeCents = isTunisia
            ? 2500 + Math.round(distanceKm * 500) // 2.500 TND base + 0.500 TND/km (in millimes)
            : config_1.CONFIG.BASE_DELIVERY_FEE_CENTS + Math.round(distanceKm * config_1.CONFIG.PER_KM_DELIVERY_FEE_CENTS);
        const totalAmountCents = subtotalCents + deliveryFeeCents;
        // Generate random 4-digit OTP for contactless / verified handover
        const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
        const orderId = `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const order = {
            id: orderId,
            customerId: params.customerId,
            customerName: params.customerName,
            merchantId: merchant.id,
            status: types_1.OrderStatus.SUBMITTED,
            paymentMethod: params.paymentMethod,
            items: resolvedItems,
            itemsSubtotalCents: subtotalCents,
            deliveryFeeCents,
            totalAmountCents,
            currency,
            deliveryAddress: params.deliveryAddress,
            deliveryLocation: params.deliveryLocation,
            placedAt: new Date(),
            deliveryOtp,
        };
        this.orders.set(orderId, order);
        return { success: true, order };
    }
    getOrder(orderId) {
        return this.orders.get(orderId);
    }
    getAllOrders() {
        return Array.from(this.orders.values());
    }
    /**
     * Merchant accepts order and confirms kitchen prep duration.
     */
    merchantAcceptOrder(orderId, merchantId, prepTimeMinutes) {
        const order = this.orders.get(orderId);
        if (!order)
            return { success: false, error: 'Order not found' };
        if (order.merchantId !== merchantId)
            return { success: false, error: 'Unauthorized merchant' };
        order.status = types_1.OrderStatus.RESTAURANT_ACCEPTED;
        order.readyByTime = new Date(Date.now() + prepTimeMinutes * 60 * 1000);
        // Trigger candidate matching
        this.triggerDispatch(order);
        return { success: true };
    }
    /**
     * Trigger candidate discovery and offer creation.
     */
    triggerDispatch(order) {
        const merchant = this.catalogService.getMerchantById(order.merchantId);
        if (!merchant)
            return { candidateFound: false };
        const candidates = this.dispatchEngine.rankCandidates(order, merchant.location);
        if (candidates.length === 0) {
            return { candidateFound: false };
        }
        const topCandidate = candidates[0];
        this.dispatchEngine.createOffer(order, topCandidate.courier.id, merchant.location);
        return { candidateFound: true, courierId: topCandidate.courier.id };
    }
    /**
     * Courier accepts dispatch offer.
     */
    courierAcceptOffer(offerId) {
        const result = this.dispatchEngine.acceptOffer(offerId);
        if (!result.success || !result.orderId || !result.courierId) {
            return { success: false, error: 'Offer expired or invalid' };
        }
        const order = this.orders.get(result.orderId);
        if (!order)
            return { success: false, error: 'Order not found' };
        order.courierId = result.courierId;
        order.status = types_1.OrderStatus.COURIER_ASSIGNED;
        return { success: true };
    }
    /**
     * Courier arrives at restaurant.
     */
    courierArrivedAtRestaurant(orderId, courierId) {
        const order = this.orders.get(orderId);
        if (!order || order.courierId !== courierId)
            return false;
        order.status = types_1.OrderStatus.COURIER_AT_RESTAURANT;
        return true;
    }
    /**
     * Courier confirms pickup from restaurant.
     */
    courierPickedUpOrder(orderId, courierId) {
        const order = this.orders.get(orderId);
        if (!order || order.courierId !== courierId)
            return false;
        order.status = types_1.OrderStatus.PICKED_UP;
        return true;
    }
    /**
     * Courier completes delivery, validates OTP, and triggers COD settlement.
     */
    courierDeliverOrder(orderId, courierId, enteredOtp) {
        const order = this.orders.get(orderId);
        if (!order)
            return { success: false, error: 'Order not found' };
        if (order.courierId !== courierId)
            return { success: false, error: 'Unauthorized courier' };
        if (order.deliveryOtp !== enteredOtp)
            return { success: false, error: 'Invalid delivery OTP' };
        order.status = types_1.OrderStatus.DELIVERED;
        // Free courier back to ONLINE_IDLE status
        this.telemetryService.setCourierStatus(courierId, types_1.CourierStatus.ONLINE_IDLE);
        // Ledger double-entry record
        const settlement = this.ledgerService.recordOrderDelivery(order, courierId);
        // Update courier cash debt on hand
        this.telemetryService.updateCourierCashDebt(courierId, settlement.courierCashCollectedCents - settlement.courierNetEarningCents);
        return { success: true, settlement };
    }
}
exports.OrderService = OrderService;
