"use strict";
// ==============================================================================
// Yassir Express Full Lifecycle Multi-Agent Simulator
// Demonstrates Customer Order -> Merchant KDS -> Dispatch Engine -> Courier GPS -> COD Ledger
// ==============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
const types_1 = require("../types");
async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function runFullEcosystemSimulation() {
    console.log('\n================================================================================');
    console.log('🇩🇿 STARTING YASSIR EXPRESS ECOSYSTEM FULL RECONSTRUCTION SIMULATION (ALGIERS)');
    console.log('================================================================================\n');
    const { catalogService, telemetryService, dispatchEngine, orderService, ledgerService } = (0, index_1.createEcosystemServer)();
    // 1. DISCOVERY PHASE
    console.log('📍 [STEP 1: CUSTOMER DISCOVERY]');
    const merchants = catalogService.getAllMerchants();
    const targetMerchant = merchants[0]; // Le Gourmet Burger Hydra
    console.log(`- Customer opened Yassir Express app in Algiers.`);
    console.log(`- Selected Restaurant: "${targetMerchant.name}" (${targetMerchant.addressLine})`);
    console.log(`- Menu Items available:`);
    for (const item of targetMerchant.menu) {
        console.log(`  * [${item.id}] ${item.title} -> ${item.priceCents / 100} DZD`);
    }
    // 2. ORDER PLACEMENT
    console.log('\n🛒 [STEP 2: CUSTOMER ORDER PLACEMENT]');
    const orderResult = orderService.createOrder({
        customerId: 'usr-customer-algiers-01',
        customerName: 'Sami Bouzidi',
        merchantId: targetMerchant.id,
        items: [
            { menuItemId: 'item-001', quantity: 2 }, // 2x Smash Burgers (2x 950 DZD = 1900 DZD)
            { menuItemId: 'item-002', quantity: 1 }, // 1x Truffle Fries (450 DZD)
            { menuItemId: 'item-003', quantity: 2 }, // 2x Selecto Soda (2x 150 DZD = 300 DZD)
        ],
        deliveryLocation: { latitude: 36.7538, longitude: 3.0588 }, // Boulevard Mohamed V, Algiers
        deliveryAddress: '32 Boulevard Mohamed V, Alger Centre',
        paymentMethod: types_1.PaymentMethod.CASH_ON_DELIVERY,
    });
    if (!orderResult.success || !orderResult.order) {
        throw new Error(`Order placement failed: ${orderResult.error}`);
    }
    const order = orderResult.order;
    console.log(`✅ Order Placed Successfully: Order ID #${order.id}`);
    console.log(`- Subtotal Food: ${order.itemsSubtotalCents / 100} DZD`);
    console.log(`- Delivery Fee: ${order.deliveryFeeCents / 100} DZD`);
    console.log(`- Total Amount to Pay (COD): ${order.totalAmountCents / 100} DZD`);
    console.log(`- Delivery Secret OTP (generated): ${order.deliveryOtp}`);
    // 3. MERCHANT KITCHEN ACCEPTANCE
    console.log('\n👨‍🍳 [STEP 3: KITCHEN DISPLAY SYSTEM (KDS) ACCEPTANCE]');
    const prepMinutes = 15;
    console.log(`- Restaurant "${targetMerchant.name}" accepted order.`);
    console.log(`- Kitchen estimated food preparation time: ${prepMinutes} minutes.`);
    orderService.merchantAcceptOrder(order.id, targetMerchant.id, prepMinutes);
    // 4. DISPATCH ENGINE EVALUATION
    console.log('\n🧠 [STEP 4: SPATIAL CANDIDATE RANKING & DISPATCH]');
    const activeOffer = dispatchEngine.getOfferForOrder(order.id);
    if (!activeOffer) {
        throw new Error('No dispatch offer found for order');
    }
    const selectedCandidate = telemetryService.getCourier(activeOffer.courierId);
    const distanceKm = telemetryService.calculateDistanceKm(selectedCandidate.currentLocation, targetMerchant.location);
    const etaMinutes = telemetryService.estimateTravelTimeMinutes(distanceKm);
    console.log(`🎯 Top Matched Candidate: ${selectedCandidate.fullName} (${selectedCandidate.id})`);
    console.log(`  * Distance to Restaurant: ${distanceKm.toFixed(2)} km`);
    console.log(`  * Estimated Courier ETA: ${etaMinutes} mins`);
    console.log(`  * Current Cash Debt on Hand: ${selectedCandidate.currentCashDebtCents / 100} DZD / 15,000 DZD Limit`);
    console.log(`- Broadcasted Dispatch Offer #${activeOffer.offerId} (20s countdown, guaranteed payout: ${activeOffer.guaranteedPayoutCents / 100} DZD)`);
    // 5. COURIER ACCEPTS OFFER
    console.log('\n📲 [STEP 5: COURIER PARTNER APP]');
    const acceptResult = orderService.courierAcceptOffer(activeOffer.offerId);
    console.log(`- Courier ${selectedCandidate.fullName} clicked ACCEPT.`);
    console.log(`- Order Status updated to: ${order.status}`);
    // 6. PICKUP WORKFLOW
    console.log('\n🛵 [STEP 6: RESTAURANT ARRIVAL & PICKUP]');
    orderService.courierArrivedAtRestaurant(order.id, selectedCandidate.id);
    console.log(`- Courier arrived at ${targetMerchant.name}. Status: ${order.status}`);
    await sleep(200);
    orderService.courierPickedUpOrder(order.id, selectedCandidate.id);
    console.log(`- Courier verified kitchen order ticket & picked up food. Status: ${order.status}`);
    // 7. REAL-TIME GPS TELEMETRY TRANSIT
    console.log('\n🛰️ [STEP 7: LIVE COURIER GPS TELEMETRY & IN-TRANSIT TRACKING]');
    const waypoints = [
        { latitude: 36.7412, longitude: 3.0425, speed: 28, heading: 45 },
        { latitude: 36.7460, longitude: 3.0480, speed: 32, heading: 42 },
        { latitude: 36.7500, longitude: 3.0530, speed: 25, heading: 50 },
        { latitude: 36.7538, longitude: 3.0588, speed: 12, heading: 30 },
    ];
    for (let i = 0; i < waypoints.length; i++) {
        const wp = waypoints[i];
        telemetryService.updateCourierLocation(selectedCandidate.id, { latitude: wp.latitude, longitude: wp.longitude }, wp.speed, wp.heading);
        console.log(`  [PING #${i + 1}] Courier Lat: ${wp.latitude}, Lon: ${wp.longitude} | Speed: ${wp.speed} km/h | Heading: ${wp.heading}°`);
        await sleep(100);
    }
    // 8. CUSTOMER HANDOVER & DELIVERY VERIFICATION
    console.log('\n🤝 [STEP 8: ARRIVAL, OTP VERIFICATION & CASH-ON-DELIVERY]');
    console.log(`- Courier arrived at customer doorstep: ${order.deliveryAddress}`);
    console.log(`- Customer provided secret delivery OTP: ${order.deliveryOtp}`);
    const deliveryResult = orderService.courierDeliverOrder(order.id, selectedCandidate.id, order.deliveryOtp);
    if (!deliveryResult.success) {
        throw new Error(`Delivery verification failed: ${deliveryResult.error}`);
    }
    console.log(`✅ Handover Successful! Order #${order.id} marked as DELIVERED.`);
    // 9. FINANCIAL RECONCILIATION AUDIT
    console.log('\n💰 [STEP 9: DOUBLE-ENTRY CASH RECONCILIATION AUDIT]');
    const settlement = deliveryResult.settlement;
    console.log(`- Total Cash Collected by Courier: ${settlement.courierCashCollectedCents / 100} DZD`);
    console.log(`- Restaurant Net Payable (Subtotal - 15% Comm): ${settlement.merchantNetPayableCents / 100} DZD`);
    console.log(`- Courier Net Earning (80% of Delivery Fee): ${settlement.courierNetEarningCents / 100} DZD`);
    console.log(`- Platform Total Net Revenue: ${settlement.platformTotalRevenueCents / 100} DZD`);
    const updatedCourier = telemetryService.getCourier(selectedCandidate.id);
    console.log(`\n📊 [COURIER WALLET STATUS POST-DELIVERY]`);
    console.log(`- Courier New Cash Debt: ${updatedCourier.currentCashDebtCents / 100} DZD`);
    console.log(`- Maximum Cash Ceiling: ${updatedCourier.maxCashLimitCents / 100} DZD`);
    console.log(`- Debt Exceeded / Blocked from Dispatch: ${ledgerService.isCourierDebtExceeded(updatedCourier.currentCashDebtCents)}`);
    console.log('\n================================================================================');
    console.log('🏁 YASSIR EXPRESS ECOSYSTEM SIMULATION: 100% COMPLETE & VERIFIED');
    console.log('================================================================================\n');
}
runFullEcosystemSimulation().catch((err) => {
    console.error('Simulation Error:', err);
    process.exit(1);
});
