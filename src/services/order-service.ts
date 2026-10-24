// ==============================================================================
// Yassir Express Order Management Service & FSM
// Handles order creation, kitchen acceptance, courier dispatching, and delivery
// ==============================================================================

import * as crypto from 'crypto';
import { CONFIG } from '../config';
import {
  CourierStatus,
  GeoCoordinate,
  Order,
  OrderItem,
  OrderItemRequest,
  OrderStatus,
  PaymentMethod,
} from '../types';
import { CatalogService } from './catalog-service';
import { DispatchEngine } from './dispatch-engine';
import { LedgerService } from './ledger-service';
import { TelemetryService } from './telemetry-service';

export class OrderService {
  private orders: Map<string, Order> = new Map();

  constructor(
    private catalogService: CatalogService,
    private telemetryService: TelemetryService,
    private dispatchEngine: DispatchEngine,
    private ledgerService: LedgerService
  ) {}

  /**
   * Create and place a new order from a customer.
   */
  public createOrder(params: {
    customerId: string;
    customerName: string;
    merchantId: string;
    items: OrderItemRequest[];
    deliveryLocation: GeoCoordinate;
    deliveryAddress: string;
    paymentMethod: PaymentMethod;
  }): { success: boolean; order?: Order; error?: string } {
    const merchant = this.catalogService.getMerchantById(params.merchantId);
    if (!merchant) {
      return { success: false, error: 'Merchant not found' };
    }
    if (!merchant.isOpen) {
      return { success: false, error: 'Merchant is currently closed' };
    }
    if (!params.items || params.items.length === 0) {
      return { success: false, error: 'Order must contain at least one item' };
    }

    // Resolve items and calculate subtotal
    let subtotalCents = 0;
    const resolvedItems: OrderItem[] = [];

    for (const itemReq of params.items) {
      if (!itemReq.quantity || itemReq.quantity <= 0 || !Number.isInteger(itemReq.quantity)) {
        return { success: false, error: `Invalid quantity for item ${itemReq.menuItemId}` };
      }

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
    const distanceKm = this.telemetryService.calculateDistanceKm(
      merchant.location,
      params.deliveryLocation
    );
    const isTunisia = merchant.countryCode === 'TN';
    const currency = isTunisia ? 'TND' : CONFIG.DEFAULT_CURRENCY;
    const deliveryFeeCents = isTunisia
      ? 2500 + Math.round(distanceKm * 500) // 2.500 TND base + 0.500 TND/km (in millimes)
      : CONFIG.BASE_DELIVERY_FEE_CENTS + Math.round(distanceKm * CONFIG.PER_KM_DELIVERY_FEE_CENTS);

    const totalAmountCents = subtotalCents + deliveryFeeCents;

    // Generate cryptographically secure 4-digit OTP for contactless / verified handover
    const deliveryOtp = crypto.randomInt(1000, 10000).toString();
    const orderId = `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const order: Order = {
      id: orderId,
      customerId: params.customerId,
      customerName: params.customerName,
      merchantId: merchant.id,
      status: OrderStatus.SUBMITTED,
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

  public getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  public getAllOrders(): Order[] {
    return Array.from(this.orders.values());
  }

  /**
   * Merchant accepts order and confirms kitchen prep duration.
   */
  public merchantAcceptOrder(
    orderId: string,
    merchantId: string,
    prepTimeMinutes: number
  ): { success: boolean; error?: string } {
    const order = this.orders.get(orderId);
    if (!order) return { success: false, error: 'Order not found' };
    if (order.merchantId !== merchantId) return { success: false, error: 'Unauthorized merchant' };

    order.status = OrderStatus.RESTAURANT_ACCEPTED;
    order.readyByTime = new Date(Date.now() + prepTimeMinutes * 60 * 1000);

    // Trigger candidate matching
    this.triggerDispatch(order);
    return { success: true };
  }

  /**
   * Trigger candidate discovery and offer creation.
   */
  public triggerDispatch(order: Order): { candidateFound: boolean; courierId?: string } {
    const merchant = this.catalogService.getMerchantById(order.merchantId);
    if (!merchant) return { candidateFound: false };

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
  public courierAcceptOffer(offerId: string): { success: boolean; error?: string } {
    const result = this.dispatchEngine.acceptOffer(offerId);
    if (!result.success || !result.orderId || !result.courierId) {
      return { success: false, error: 'Offer expired or invalid' };
    }

    const order = this.orders.get(result.orderId);
    if (!order) return { success: false, error: 'Order not found' };

    order.courierId = result.courierId;
    order.status = OrderStatus.COURIER_ASSIGNED;
    return { success: true };
  }

  /**
   * Courier arrives at restaurant.
   */
  public courierArrivedAtRestaurant(orderId: string, courierId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order || order.courierId !== courierId) return false;
    order.status = OrderStatus.COURIER_AT_RESTAURANT;
    return true;
  }

  /**
   * Courier confirms pickup from restaurant.
   */
  public courierPickedUpOrder(orderId: string, courierId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order || order.courierId !== courierId) return false;
    order.status = OrderStatus.PICKED_UP;
    return true;
  }

  /**
   * Courier completes delivery, validates OTP, and triggers COD settlement.
   */
  public courierDeliverOrder(
    orderId: string,
    courierId: string,
    enteredOtp: string
  ): { success: boolean; error?: string; settlement?: any } {
    const order = this.orders.get(orderId);
    if (!order) return { success: false, error: 'Order not found' };
    if (order.courierId !== courierId) return { success: false, error: 'Unauthorized courier' };
    if (order.deliveryOtp !== enteredOtp) return { success: false, error: 'Invalid delivery OTP' };

    order.status = OrderStatus.DELIVERED;

    // Free courier back to ONLINE_IDLE status
    this.telemetryService.setCourierStatus(courierId, CourierStatus.ONLINE_IDLE);

    // Ledger double-entry record
    const settlement = this.ledgerService.recordOrderDelivery(order, courierId);

    // Update courier cash debt on hand
    this.telemetryService.updateCourierCashDebt(
      courierId,
      settlement.courierCashCollectedCents - settlement.courierNetEarningCents
    );

    return { success: true, settlement };
  }
}
