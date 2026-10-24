// ==============================================================================
// Yassir Express Tunisian e-Payment API Routes
// Endpoints for SMT (ClicToPay), Flouci Mobile Wallet & e-Dinar D17
// ==============================================================================

import { Router, Request, Response } from 'express';
import {
  TunisianPaymentGateway,
  TunisianPaymentService,
} from '../services/tunisian-payment-service';
import { OrderService } from '../services/order-service';

export function createTunisianPaymentRouter(
  paymentService: TunisianPaymentService,
  orderService: OrderService
): Router {
  const router = Router();

  // 1. Initiate Tunisian e-Payment
  router.post('/initiate', (req: Request, res: Response) => {
    const { orderId, gateway, customerPhone } = req.body;
    if (!orderId || !gateway) {
      return res.status(400).json({ success: false, error: 'Missing orderId or gateway' });
    }

    const order = orderService.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const result = paymentService.initiatePayment({
      orderId: order.id,
      gateway: gateway as TunisianPaymentGateway,
      amountMillimes: order.totalAmountCents, // Total in millimes
      customerPhone,
    });

    res.json(result);
  });

  // 2. SMT / ClicToPay Webhook (IPN)
  router.post('/smt/webhook', (req: Request, res: Response) => {
    const { paymentId, gatewayReference, status, signature } = req.body;
    if (!paymentId || !signature) {
      return res.status(400).json({ success: false, error: 'Missing paymentId or signature' });
    }

    const result = paymentService.processSMTWebhook({
      paymentId,
      gatewayReference: gatewayReference || `SMT-REF-${Date.now()}`,
      status: status || 'SUCCESS',
      signature,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({ success: true, message: 'SMT payment captured and order settled', tx: result.tx });
  });

  // 3. Flouci Callback
  router.post('/flouci/callback', (req: Request, res: Response) => {
    const { paymentId, flouciPaymentId, status } = req.body;
    if (!paymentId) {
      return res.status(400).json({ success: false, error: 'Missing paymentId' });
    }

    const result = paymentService.processFlouciCallback({
      paymentId,
      flouciPaymentId: flouciPaymentId || `FLOUCI-${Date.now()}`,
      status: status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({ success: true, message: 'Flouci payment verified', tx: result.tx });
  });

  // 4. Get Payment Status
  router.get('/:paymentId', (req: Request, res: Response) => {
    const paymentId = String(req.params.paymentId);
    const tx = paymentService.getTransaction(paymentId);
    if (!tx) {
      return res.status(404).json({ success: false, error: 'Payment transaction not found' });
    }

    res.json({ success: true, transaction: tx });
  });

  return router;
}
