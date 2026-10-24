// ==============================================================================
// Yassir Express Customer REST API Routes
// Parity with com.yatechnologies.yassir_rider food module
// ==============================================================================

import { Router, Request, Response } from 'express';
import { CatalogService } from '../services/catalog-service';
import { OrderService } from '../services/order-service';
import { TelemetryService } from '../services/telemetry-service';
import { PaymentMethod } from '../types';

export function createCustomerRouter(
  catalogService: CatalogService,
  orderService: OrderService,
  telemetryService: TelemetryService
): Router {
  const router = Router();

  // 1. Browse nearby restaurants
  router.get('/restaurants', (req: Request, res: Response) => {
    const merchants = catalogService.getAllMerchants();
    res.json({
      success: true,
      count: merchants.length,
      data: merchants.map((m) => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        address: m.addressLine,
        city: m.city,
        rating: m.rating,
        prepTimeMinutes: m.prepTimeMinutes,
        isOpen: m.isOpen,
        location: m.location,
      })),
    });
  });

  // 2. Get restaurant menu
  router.get('/restaurants/:id/menu', (req: Request, res: Response) => {
    const merchantId = String(req.params.id);
    const merchant = catalogService.getMerchantById(merchantId);
    if (!merchant) {
      return res.status(404).json({ success: false, error: 'Restaurant not found' });
    }
    res.json({
      success: true,
      data: {
        restaurantId: merchant.id,
        name: merchant.name,
        menu: merchant.menu,
      },
    });
  });

  // 2.5 List all orders (for ecosystem dashboard)
  router.get('/orders', (_req: Request, res: Response) => {
    res.json({
      success: true,
      orders: orderService.getAllOrders(),
    });
  });

  // 3. Place order
  router.post('/orders', (req: Request, res: Response) => {
    const {
      customerId,
      customerName,
      merchantId,
      items,
      deliveryLocation,
      deliveryAddress,
      paymentMethod,
    } = req.body;

    if (!merchantId || !items || !deliveryLocation) {
      return res.status(400).json({ success: false, error: 'Missing mandatory fields' });
    }

    const result = orderService.createOrder({
      customerId: customerId || 'cust-user-001',
      customerName: customerName || 'Anis Benali',
      merchantId,
      items,
      deliveryLocation,
      deliveryAddress: deliveryAddress || '15 Rue Didouche Mourad, Algiers',
      paymentMethod: paymentMethod || PaymentMethod.CASH_ON_DELIVERY,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json({
      success: true,
      order: result.order,
    });
  });

  // 4. Track order & courier live location
  router.get('/orders/:id/track', (req: Request, res: Response) => {
    const orderId = String(req.params.id);
    const order = orderService.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    let courierLocation = null;
    let courierInfo = null;

    if (order.courierId) {
      const courier = telemetryService.getCourier(order.courierId);
      if (courier) {
        courierLocation = courier.currentLocation;
        courierInfo = {
          id: courier.id,
          name: courier.fullName,
          vehicleType: courier.vehicleType,
          phoneNumber: courier.phoneNumber,
        };
      }
    }

    res.json({
      success: true,
      data: {
        orderId: order.id,
        status: order.status,
        placedAt: order.placedAt,
        readyByTime: order.readyByTime,
        deliveryOtp: order.deliveryOtp, // In prod only visible to customer
        courier: courierInfo,
        courierLocation,
      },
    });
  });

  return router;
}
