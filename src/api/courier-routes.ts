// ==============================================================================
// Yassir Express Courier / Fleet REST API Routes
// Parity with com.yatechnologies.yassirfoodpartner driver app
// ==============================================================================

import { Router, Request, Response } from 'express';
import { DispatchEngine } from '../services/dispatch-engine';
import { LedgerService } from '../services/ledger-service';
import { OrderService } from '../services/order-service';
import { TelemetryService } from '../services/telemetry-service';
import { CourierStatus } from '../types';

export function createCourierRouter(
  telemetryService: TelemetryService,
  dispatchEngine: DispatchEngine,
  orderService: OrderService,
  ledgerService: LedgerService
): Router {
  const router = Router();

  // 0. Get all couriers list
  router.get('/all', (_req: Request, res: Response) => {
    res.json({
      success: true,
      couriers: telemetryService.getAllCouriers(),
    });
  });

  // 0.1 Get offers for specific courier
  router.get('/:id/offers', (req: Request, res: Response) => {
    const courierId = String(req.params.id);
    const offer = dispatchEngine.getOfferForCourier(courierId);
    res.json({
      success: true,
      offer: offer || null,
    });
  });

  // 0.2 Courier deposits cash to clear debt
  router.post('/:id/deposit', (req: Request, res: Response) => {
    const courierId = String(req.params.id);
    const { amountCents, agencyName, referenceCode } = req.body;
    const result = ledgerService.processCourierDeposit(
      courierId,
      amountCents || 500000,
      agencyName || 'Algérie Poste Hydra',
      referenceCode || `DEP-${Date.now()}`
    );
    const courier = telemetryService.getCourier(courierId);
    if (courier) {
      courier.currentCashDebtCents = result.newDebtCents;
    }
    res.json({ ...result });
  });

  // 1. Report live telemetry ping
  router.post('/location', (req: Request, res: Response) => {
    const { courierId, latitude, longitude, speedMps, headingDeg } = req.body;
    if (!courierId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, error: 'Missing coordinates or courierId' });
    }

    const success = telemetryService.updateCourierLocation(
      courierId,
      { latitude, longitude },
      speedMps || 0,
      headingDeg || 0
    );

    if (!success) {
      return res.status(404).json({ success: false, error: 'Courier not found' });
    }

    res.json({ success: true, timestamp: new Date().toISOString() });
  });

  // 2. Change courier availability status (ONLINE_IDLE / OFFLINE)
  router.post('/:id/status', (req: Request, res: Response) => {
    const courierId = String(req.params.id);
    const { status } = req.body;
    if (!status || !Object.values(CourierStatus).includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid courier status' });
    }

    const success = telemetryService.setCourierStatus(courierId, status);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Courier not found' });
    }

    res.json({ success: true, status });
  });

  // 3. Accept dispatch offer
  router.post('/offers/:offerId/accept', (req: Request, res: Response) => {
    const offerId = String(req.params.offerId);
    const result = orderService.courierAcceptOffer(offerId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json({ success: true, message: 'Offer accepted, order assigned.' });
  });

  // 4. Decline dispatch offer
  router.post('/offers/:offerId/decline', (req: Request, res: Response) => {
    const offerId = String(req.params.offerId);
    const success = dispatchEngine.declineOffer(offerId);
    res.json({ success });
  });

  // 5. Courier arrives at restaurant
  router.post('/orders/:orderId/at-restaurant', (req: Request, res: Response) => {
    const orderId = String(req.params.orderId);
    const { courierId } = req.body;
    const success = orderService.courierArrivedAtRestaurant(orderId, courierId);
    res.json({ success });
  });

  // 6. Courier confirms pickup
  router.post('/orders/:orderId/pickup', (req: Request, res: Response) => {
    const orderId = String(req.params.orderId);
    const { courierId } = req.body;
    const success = orderService.courierPickedUpOrder(orderId, courierId);
    res.json({ success });
  });

  // 7. Courier confirms delivery & verifies OTP
  router.post('/orders/:orderId/deliver', (req: Request, res: Response) => {
    const orderId = String(req.params.orderId);
    const { courierId, otp } = req.body;
    if (!courierId || !otp) {
      return res.status(400).json({ success: false, error: 'Missing courierId or OTP' });
    }

    const result = orderService.courierDeliverOrder(orderId, courierId, otp);
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  });

  // 8. Courier Wallet & Cash Debt Status
  router.get('/:id/wallet', (req: Request, res: Response) => {
    const courierId = String(req.params.id);
    const courier = telemetryService.getCourier(courierId);
    if (!courier) {
      return res.status(404).json({ success: false, error: 'Courier not found' });
    }

    const isExceeded = ledgerService.isCourierDebtExceeded(courier.currentCashDebtCents);

    res.json({
      success: true,
      data: {
        courierId: courier.id,
        currentCashDebtCents: courier.currentCashDebtCents,
        currentCashDebtDZD: courier.currentCashDebtCents / 100,
        maxCashLimitCents: courier.maxCashLimitCents,
        maxCashLimitDZD: courier.maxCashLimitCents / 100,
        debtExceeded: isExceeded,
        canAcceptOrders: !isExceeded,
      },
    });
  });

  return router;
}
