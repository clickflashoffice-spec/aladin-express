// ==============================================================================
// Yassir Express Production Automated Test Suite
// Rigorous verification of Invariants: Double-Entry Ledger, COD Debt, FSM & Dispatch
// ==============================================================================

import assert from 'node:assert';
import test from 'node:test';
import { CatalogService } from '../src/services/catalog-service';
import { DispatchEngine } from '../src/services/dispatch-engine';
import { LedgerService } from '../src/services/ledger-service';
import { OrderService } from '../src/services/order-service';
import { TelemetryService } from '../src/services/telemetry-service';
import { CourierStatus, OrderStatus, PaymentMethod } from '../src/types';

test('Double-Entry Ledger: Invariant balance and revenue distribution', () => {
  const ledger = new LedgerService();

  const mockOrder: any = {
    id: 'ord-test-001',
    merchantId: 'mch-alg-001',
    itemsSubtotalCents: 200000, // 2,000 DZD food
    deliveryFeeCents: 30000, // 300 DZD delivery
    totalAmountCents: 230000, // 2,300 DZD total collected
    paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    currency: 'DZD',
  };

  const settlement = ledger.recordOrderDelivery(mockOrder, 'courier-001');

  // Verify settlement calculations
  assert.strictEqual(settlement.success, true);
  assert.strictEqual(settlement.courierCashCollectedCents, 230000); // 2,300 DZD
  assert.strictEqual(settlement.merchantNetPayableCents, 170000); // 2,000 - 15% (300) = 1,700 DZD
  assert.strictEqual(settlement.courierNetEarningCents, 24000); // 80% of 300 = 240 DZD
  assert.strictEqual(settlement.platformTotalRevenueCents, 36000); // 300 comm + 60 fee take = 360 DZD

  // Verify Zero-Sum Equation: Total Cash Collected == Merchant Net + Courier Net + Platform Take
  const totalDistributed =
    settlement.merchantNetPayableCents +
    settlement.courierNetEarningCents +
    settlement.platformTotalRevenueCents;
  assert.strictEqual(totalDistributed, settlement.courierCashCollectedCents);

  // Verify journal entries exist
  const entries = ledger.getJournalEntries();
  assert.strictEqual(entries.length >= 2, true);
});

test('Fintech: Courier COD Debt Ceiling (15,000 DZD limit enforcement)', () => {
  const ledger = new LedgerService();

  // Below threshold
  assert.strictEqual(ledger.isCourierDebtExceeded(500000), false); // 5,000 DZD
  assert.strictEqual(ledger.isCourierDebtExceeded(1499900), false); // 14,999 DZD

  // At or above 15,000 DZD limit
  assert.strictEqual(ledger.isCourierDebtExceeded(1500000), true); // 15,000 DZD
  assert.strictEqual(ledger.isCourierDebtExceeded(2000000), true); // 20,000 DZD

  // Deposit clearing clears debt
  const depositRes = ledger.processCourierDeposit('courier-001', 500000, 'Algérie Poste', 'DEP-TEST-1');
  assert.strictEqual(depositRes.success, true);
});

test('Dispatch Engine: Synchronized delay calculation', () => {
  const telemetry = new TelemetryService();
  const ledger = new LedgerService();
  const dispatch = new DispatchEngine(telemetry, ledger);

  // If kitchen takes 20 mins, courier ETA is 5 mins, safety buffer is 2 mins
  // T_delay = 20 - 5 - 2 = 13 mins
  const delay = dispatch.calculateDispatchDelayMinutes(20, 5);
  assert.strictEqual(delay, 13);

  // If kitchen takes 5 mins, courier ETA is 10 mins
  // T_delay = max(0, 5 - 10 - 2) = 0 mins (immediate dispatch)
  const immediateDelay = dispatch.calculateDispatchDelayMinutes(5, 10);
  assert.strictEqual(immediateDelay, 0);
});

test('Order Service FSM: Lifecycle transitions and OTP verification', () => {
  const catalog = new CatalogService();
  const telemetry = new TelemetryService();
  const ledger = new LedgerService();
  const dispatch = new DispatchEngine(telemetry, ledger);
  const orderService = new OrderService(catalog, telemetry, dispatch, ledger);

  // 1. Create order
  const createRes = orderService.createOrder({
    customerId: 'cust-test',
    customerName: 'Test Customer',
    merchantId: 'mch-alg-001',
    items: [{ menuItemId: 'item-001', quantity: 1 }],
    deliveryLocation: { latitude: 36.75, longitude: 3.05 },
    deliveryAddress: 'Alger Centre',
    paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
  });

  assert.strictEqual(createRes.success, true);
  const order = createRes.order!;
  assert.strictEqual(order.status, OrderStatus.SUBMITTED);
  assert.ok(order.deliveryOtp.length === 4);

  // 2. Merchant accept
  const acceptRes = orderService.merchantAcceptOrder(order.id, 'mch-alg-001', 15);
  assert.strictEqual(acceptRes.success, true);
  assert.strictEqual(order.status, OrderStatus.RESTAURANT_ACCEPTED);

  // 3. Dispatch offer created
  const offer = dispatch.getOfferForOrder(order.id);
  assert.ok(offer);

  // 4. Courier accept
  const courierAccept = orderService.courierAcceptOffer(offer.offerId);
  assert.strictEqual(courierAccept.success, true);
  assert.strictEqual(order.status, OrderStatus.COURIER_ASSIGNED);

  // 5. Courier arrives and picks up
  orderService.courierArrivedAtRestaurant(order.id, order.courierId!);
  assert.strictEqual(order.status, OrderStatus.COURIER_AT_RESTAURANT);

  orderService.courierPickedUpOrder(order.id, order.courierId!);
  assert.strictEqual(order.status, OrderStatus.PICKED_UP);

  // 6. Invalid OTP fails delivery
  const invalidOtpRes = orderService.courierDeliverOrder(order.id, order.courierId!, '0000');
  assert.strictEqual(invalidOtpRes.success, false);
  assert.strictEqual(invalidOtpRes.error, 'Invalid delivery OTP');

  // 7. Valid OTP completes delivery and frees courier
  const validOtpRes = orderService.courierDeliverOrder(order.id, order.courierId!, order.deliveryOtp);
  assert.strictEqual(validOtpRes.success, true);
  assert.strictEqual(order.status, OrderStatus.DELIVERED);

  const courier = telemetry.getCourier(order.courierId!);
  assert.strictEqual(courier!.status, CourierStatus.ONLINE_IDLE);
});

test('Dark Store Grocery: Wave picking sequence and barcode scanning', () => {
  const { DarkStoreService } = require('../src/services/darkstore-service');
  const darkStore = new DarkStoreService();

  // Create pick task for Afia Oil (Aisle 2) and Candia Milk (Aisle 1)
  const task = darkStore.generateOptimizedPickTask('ord-groc-001', [
    { sku: 'GROC-003', quantity: 1 }, // Aisle 2
    { sku: 'GROC-001', quantity: 2 }, // Aisle 1
  ]);

  // Verify aisle ordering: Aisle 1 must come before Aisle 2
  assert.strictEqual(task.items[0].sku, 'GROC-001');
  assert.strictEqual(task.items[1].sku, 'GROC-003');

  // Verify barcode scan
  const scan1 = darkStore.scanItemBarcode(task.taskId, '6131234567890'); // Candia
  assert.strictEqual(scan1.success, true);
  assert.strictEqual(task.isCompleted, false);

  const scan2 = darkStore.scanItemBarcode(task.taskId, '6135555555555'); // Afia
  assert.strictEqual(scan2.success, true);
  assert.strictEqual(task.isCompleted, true);
});

test('Tunisian e-Payment: SMT HMAC-SHA256 signature, Flouci & 3-decimal TND millimes', () => {
  const {
    TunisianPaymentService,
    TunisianPaymentGateway,
    TunisianPaymentStatus,
  } = require('../src/services/tunisian-payment-service');

  const paymentService = new TunisianPaymentService();

  // 1. Verify 3-decimal TND millimes formatting
  assert.strictEqual(TunisianPaymentService.formatTND(25500), '25.500 TND');
  assert.strictEqual(TunisianPaymentService.toMillimes(14.75), 14750);

  // 2. Initiate SMT ClicToPay payment (25.500 TND)
  const initRes = paymentService.initiatePayment({
    orderId: 'ord-tunis-001',
    gateway: TunisianPaymentGateway.SMT_CLICTOPAY,
    amountMillimes: 25500,
    customerPhone: '+21698112233',
  });

  assert.strictEqual(initRes.success, true);
  assert.strictEqual(initRes.amountFormatted, '25.500 TND');
  assert.ok(initRes.checkoutUrl.includes('clictopay.com.tn'));

  // 3. Test tampered SMT signature is rejected
  const tamperedRes = paymentService.processSMTWebhook({
    paymentId: initRes.paymentId,
    gatewayReference: 'SMT-REF-999',
    status: 'SUCCESS',
    signature: 'invalid_fraudulent_signature',
  });
  assert.strictEqual(tamperedRes.success, false);
  assert.strictEqual(tamperedRes.error, 'Invalid SMT HMAC signature');

  // 4. Test authentic cryptographic signature is verified and captured
  const validSig = paymentService.generateSMTSignature(initRes.paymentId, 'SMT-REF-999', 'SUCCESS');
  const validRes = paymentService.processSMTWebhook({
    paymentId: initRes.paymentId,
    gatewayReference: 'SMT-REF-999',
    status: 'SUCCESS',
    signature: validSig,
  });

  assert.strictEqual(validRes.success, true);
  assert.strictEqual(validRes.tx.status, TunisianPaymentStatus.CAPTURED);

  // 5. Test Digital Non-COD Ledger Reconciliation (Courier Cash liability must be 0)
  const ledger = new LedgerService();
  const mockTunisianOrder: any = {
    id: 'ord-tunis-001',
    merchantId: 'mch-tun-001',
    itemsSubtotalCents: 21000, // 21.000 TND food (in millimes)
    deliveryFeeCents: 3500,    // 3.500 TND delivery
    totalAmountCents: 24500,   // 24.500 TND total paid digitally
    paymentMethod: PaymentMethod.SMT_CLICTOPAY,
    currency: 'TND',
  };

  const settlement = ledger.recordOrderDelivery(mockTunisianOrder, 'courier-tn-001');

  // Courier collected 0 cash because customer paid via SMT card!
  assert.strictEqual(settlement.courierCashCollectedCents, 0);
  // Merchant receives 21.000 TND - 15% platform take (3.150 TND) = 17.850 TND (17,850 millimes)
  assert.strictEqual(settlement.merchantNetPayableCents, 17850);
  // Courier receives 80% of 3.500 TND delivery fee = 2.800 TND (2,800 millimes)
  assert.strictEqual(settlement.courierNetEarningCents, 2800);
});
