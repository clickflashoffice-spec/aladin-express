// ==============================================================================
// Yassir Express API Gateway & Orchestrator
// Unified Entrypoint for Customer, Merchant, Courier & Real-Time Tracking
// ==============================================================================

import http from 'http';
import path from 'path';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { CONFIG } from './config';
import { CatalogService } from './services/catalog-service';
import { DispatchEngine } from './services/dispatch-engine';
import { LedgerService } from './services/ledger-service';
import { OrderService } from './services/order-service';
import { TelemetryService } from './services/telemetry-service';
import { createCustomerRouter } from './api/customer-routes';
import { createMerchantRouter } from './api/merchant-routes';
import { createCourierRouter } from './api/courier-routes';
import { TunisianPaymentService } from './services/tunisian-payment-service';
import { createTunisianPaymentRouter } from './api/tunisian-payment-routes';

export function createEcosystemServer() {
  const app: Express = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));

  // Instantiate core services
  const catalogService = new CatalogService();
  const telemetryService = new TelemetryService();
  const ledgerService = new LedgerService();
  const dispatchEngine = new DispatchEngine(telemetryService, ledgerService);
  const orderService = new OrderService(
    catalogService,
    telemetryService,
    dispatchEngine,
    ledgerService
  );
  const tunisianPaymentService = new TunisianPaymentService();

  // Health and ecosystem metadata
  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.json({
      status: 'UP',
      service: 'yassir-express-core-gateway',
      version: '1.0.0',
      activeCouriers: telemetryService.getAllCouriers().length,
      activeMerchants: catalogService.getAllMerchants().length,
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API routers
  app.use('/api/v1/customer', createCustomerRouter(catalogService, orderService, telemetryService));
  app.use('/api/v1/merchant', createMerchantRouter(catalogService, orderService));
  app.use(
    '/api/v1/courier',
    createCourierRouter(telemetryService, dispatchEngine, orderService, ledgerService)
  );
  app.use(
    '/api/v1/payments/tunisia',
    createTunisianPaymentRouter(tunisianPaymentService, orderService)
  );

  // Financial Ledger audit endpoint
  app.get('/api/v1/admin/ledger', (_req: Request, res: Response) => {
    res.json({
      success: true,
      balances: ledgerService.getAccountBalances(),
      journalEntries: ledgerService.getJournalEntries(),
    });
  });

  // Active dispatch offers endpoint
  app.get('/api/v1/dispatch/offers', (_req: Request, res: Response) => {
    res.json({
      success: true,
      offers: dispatchEngine.getAllOffers(),
    });
  });

  const server = http.createServer(app);

  // Attach WebSocket server for real-time customer map tracking & dashboard events
  const wss = new WebSocketServer({ server, path: '/ws/tracking' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const orderId = url.searchParams.get('orderId');

    if (orderId) {
      telemetryService.subscribeToOrder(orderId, ws);
      ws.send(JSON.stringify({ type: 'SUBSCRIPTION_CONFIRMED', orderId }));
    } else {
      telemetryService.subscribeGlobal(ws);
      ws.send(JSON.stringify({ type: 'GLOBAL_SUBSCRIPTION_ACTIVE' }));
    }
  });

  return {
    app,
    server,
    wss,
    catalogService,
    telemetryService,
    dispatchEngine,
    orderService,
    ledgerService,
    tunisianPaymentService,
  };
}

if (require.main === module) {
  const { server } = createEcosystemServer();
  server.listen(CONFIG.PORT, () => {
    console.log(`=================================================================`);
    console.log(`🚀 ALADIN EXPRESS ECOSYSTEM ONLINE`);
    console.log(`📡 HTTP Gateway: http://localhost:${CONFIG.PORT}`);
    console.log(`🛰️ WebSocket Telemetry: ws://localhost:${CONFIG.PORT}/ws/tracking`);
    console.log(`=================================================================`);
  });
}
