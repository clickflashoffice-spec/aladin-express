// ==============================================================================
// Yassir Express Merchant REST API Routes
// Parity with com.yatechnologies.yassirfoodrestaurant KDS app
// ==============================================================================

import { Router, Request, Response } from 'express';
import { CatalogService } from '../services/catalog-service';
import { OrderService } from '../services/order-service';

export function createMerchantRouter(
  catalogService: CatalogService,
  orderService: OrderService
): Router {
  const router = Router();

  // 1. Get incoming/active orders for merchant
  router.get('/:id/orders', (req: Request, res: Response) => {
    const merchantId = String(req.params.id);
    const allOrders = orderService.getAllOrders();
    const merchantOrders = allOrders.filter((o) => o.merchantId === merchantId);

    res.json({
      success: true,
      count: merchantOrders.length,
      orders: merchantOrders,
    });
  });

  // 2. Accept order with estimated prep time
  router.post('/orders/:id/accept', (req: Request, res: Response) => {
    const orderId = String(req.params.id);
    const { merchantId, prepTimeMinutes } = req.body;
    if (!merchantId) {
      return res.status(400).json({ success: false, error: 'merchantId is required' });
    }

    const prep = prepTimeMinutes || 20;
    const result = orderService.merchantAcceptOrder(orderId, merchantId, prep);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: `Order accepted. Kitchen prep estimated at ${prep} minutes. Courier dispatch initiated.`,
    });
  });

  // 3. Toggle restaurant open/close status
  router.put('/:id/status', (req: Request, res: Response) => {
    const merchantId = String(req.params.id);
    const { isOpen } = req.body;
    const success = catalogService.setMerchantOpenStatus(merchantId, Boolean(isOpen));

    if (!success) {
      return res.status(404).json({ success: false, error: 'Merchant not found' });
    }

    res.json({ success: true, isOpen });
  });

  return router;
}
