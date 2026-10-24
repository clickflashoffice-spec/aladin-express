// ==============================================================================
// Aladin Express API Gateway & Orchestrator
// Unified Entrypoint for Customer, Merchant, Courier & Real-Time Tracking
// ==============================================================================

import http from 'http';
import path from 'path';
import fs from 'fs';
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

export function createApp(): Express {
  const app: Express = express();
  app.use(cors());
  app.use(express.json());

  // Detect and serve static files from public folder (works locally and in serverless)
  const publicDir = fs.existsSync(path.join(process.cwd(), 'public', 'index.html'))
    ? path.join(process.cwd(), 'public')
    : path.join(__dirname, '../public');

  app.use(express.static(publicDir));

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

  // Root fallback: serve Web Simulator
  app.get('/', (_req: Request, res: Response) => {
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.send('Aladin Express Ecosystem Gateway Online');
    }
  });

  // Dedicated Customer Mobile WebApp
  app.get('/app', (_req: Request, res: Response) => {
    const appPath = path.join(publicDir, 'app.html');
    if (fs.existsSync(appPath)) {
      res.sendFile(appPath);
    } else {
      res.redirect('/');
    }
  });

  // Dedicated Driver & Courier Partner Portal WebApp
  app.get('/driver', (_req: Request, res: Response) => {
    const driverPath = path.join(publicDir, 'driver.html');
    if (fs.existsSync(driverPath)) {
      res.sendFile(driverPath);
    } else {
      res.redirect('/');
    }
  });

  // Dedicated Partner Portal WebApp
  app.get('/partner', (_req: Request, res: Response) => {
    const partnerPath = path.join(publicDir, 'partner.html');
    if (fs.existsSync(partnerPath)) {
      res.sendFile(partnerPath);
    } else {
      res.redirect('/');
    }
  });

  // Dedicated Kitchen Display System (KDS) WebApp
  app.get('/kitchen', (_req: Request, res: Response) => {
    const kitchenPath = path.join(publicDir, 'kitchen.html');
    if (fs.existsSync(kitchenPath)) {
      res.sendFile(kitchenPath);
    } else {
      res.redirect('/');
    }
  });

  // Dedicated Android APK Download & Barcode Page
  app.get('/download', (_req: Request, res: Response) => {
    const downloadPagePath = path.join(publicDir, 'download.html');
    if (fs.existsSync(downloadPagePath)) {
      res.sendFile(downloadPagePath);
    } else {
      res.redirect('/');
    }
  });

  // Direct Consumer APK Binary Download Endpoint
  app.get(['/download/aladin-express.apk', '/aladin-express.apk'], (_req: Request, res: Response) => {
    const apkPath = fs.existsSync(path.join(publicDir, 'download', 'aladin-express.apk'))
      ? path.join(publicDir, 'download', 'aladin-express.apk')
      : (fs.existsSync(path.join(publicDir, 'aladin-express.apk'))
          ? path.join(publicDir, 'aladin-express.apk')
          : path.join(process.cwd(), 'dist/apk/AladinExpress-v1.0.0-release.apk'));

    if (fs.existsSync(apkPath)) {
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', 'attachment; filename="aladin-express.apk"');
      res.sendFile(apkPath);
    } else {
      res.status(404).json({ error: 'Consumer APK file not found on server' });
    }
  });

  // Direct Driver APK Binary Download Endpoint
  app.get(['/download/aladin-driver.apk', '/aladin-driver.apk'], (_req: Request, res: Response) => {
    const apkPath = fs.existsSync(path.join(publicDir, 'download', 'aladin-driver.apk'))
      ? path.join(publicDir, 'download', 'aladin-driver.apk')
      : (fs.existsSync(path.join(publicDir, 'aladin-driver.apk'))
          ? path.join(publicDir, 'aladin-driver.apk')
          : path.join(process.cwd(), 'dist/apk/AladinDriver-v1.0.0-release.apk'));

    if (fs.existsSync(apkPath)) {
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', 'attachment; filename="aladin-driver.apk"');
      res.sendFile(apkPath);
    } else {
      res.status(404).json({ error: 'Driver APK file not found on server' });
    }
  });

  // Health and ecosystem metadata
  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.json({
      status: 'UP',
      service: 'aladin-express-core-gateway',
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

  // Store services in app.locals for reference
  app.locals.services = {
    catalogService,
    telemetryService,
    ledgerService,
    dispatchEngine,
    orderService,
    tunisianPaymentService,
  };

  return app;
}

export function createEcosystemServer() {
  const app = createApp();
  const server = http.createServer(app);
  const { telemetryService } = app.locals.services;

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
    ...app.locals.services,
  };
}

const ecosystem = createEcosystemServer();
const defaultApp = ecosystem.app;

if (require.main === module) {
  ecosystem.server.listen(CONFIG.PORT, () => {
    console.log(`=================================================================`);
    console.log(`🚀 ALADIN EXPRESS ECOSYSTEM ONLINE`);
    console.log(`📡 HTTP Gateway: http://localhost:${CONFIG.PORT}`);
    console.log(`🛰️ WebSocket Telemetry: ws://localhost:${CONFIG.PORT}/ws/tracking`);
    console.log(`=================================================================`);
  });
}

export default defaultApp;
