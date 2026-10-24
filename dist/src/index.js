"use strict";
// ==============================================================================
// Aladin Express API Gateway & Orchestrator
// Unified Entrypoint for Customer, Merchant, Courier & Real-Time Tracking
// ==============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
exports.createEcosystemServer = createEcosystemServer;
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const ws_1 = require("ws");
const config_1 = require("./config");
const catalog_service_1 = require("./services/catalog-service");
const dispatch_engine_1 = require("./services/dispatch-engine");
const ledger_service_1 = require("./services/ledger-service");
const order_service_1 = require("./services/order-service");
const telemetry_service_1 = require("./services/telemetry-service");
const customer_routes_1 = require("./api/customer-routes");
const merchant_routes_1 = require("./api/merchant-routes");
const courier_routes_1 = require("./api/courier-routes");
const tunisian_payment_service_1 = require("./services/tunisian-payment-service");
const tunisian_payment_routes_1 = require("./api/tunisian-payment-routes");
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    // Detect and serve static files from public folder (works locally and in serverless)
    const publicDir = fs_1.default.existsSync(path_1.default.join(process.cwd(), 'public', 'index.html'))
        ? path_1.default.join(process.cwd(), 'public')
        : path_1.default.join(__dirname, '../public');
    app.use(express_1.default.static(publicDir));
    // Instantiate core services
    const catalogService = new catalog_service_1.CatalogService();
    const telemetryService = new telemetry_service_1.TelemetryService();
    const ledgerService = new ledger_service_1.LedgerService();
    const dispatchEngine = new dispatch_engine_1.DispatchEngine(telemetryService, ledgerService);
    const orderService = new order_service_1.OrderService(catalogService, telemetryService, dispatchEngine, ledgerService);
    const tunisianPaymentService = new tunisian_payment_service_1.TunisianPaymentService();
    // Root fallback: serve Web Simulator
    app.get('/', (_req, res) => {
        const indexPath = path_1.default.join(publicDir, 'index.html');
        if (fs_1.default.existsSync(indexPath)) {
            res.sendFile(indexPath);
        }
        else {
            res.send('Aladin Express Ecosystem Gateway Online');
        }
    });
    // Health and ecosystem metadata
    app.get('/api/v1/health', (_req, res) => {
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
    app.use('/api/v1/customer', (0, customer_routes_1.createCustomerRouter)(catalogService, orderService, telemetryService));
    app.use('/api/v1/merchant', (0, merchant_routes_1.createMerchantRouter)(catalogService, orderService));
    app.use('/api/v1/courier', (0, courier_routes_1.createCourierRouter)(telemetryService, dispatchEngine, orderService, ledgerService));
    app.use('/api/v1/payments/tunisia', (0, tunisian_payment_routes_1.createTunisianPaymentRouter)(tunisianPaymentService, orderService));
    // Financial Ledger audit endpoint
    app.get('/api/v1/admin/ledger', (_req, res) => {
        res.json({
            success: true,
            balances: ledgerService.getAccountBalances(),
            journalEntries: ledgerService.getJournalEntries(),
        });
    });
    // Active dispatch offers endpoint
    app.get('/api/v1/dispatch/offers', (_req, res) => {
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
function createEcosystemServer() {
    const app = createApp();
    const server = http_1.default.createServer(app);
    const { telemetryService } = app.locals.services;
    // Attach WebSocket server for real-time customer map tracking & dashboard events
    const wss = new ws_1.WebSocketServer({ server, path: '/ws/tracking' });
    wss.on('connection', (ws, req) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const orderId = url.searchParams.get('orderId');
        if (orderId) {
            telemetryService.subscribeToOrder(orderId, ws);
            ws.send(JSON.stringify({ type: 'SUBSCRIPTION_CONFIRMED', orderId }));
        }
        else {
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
    ecosystem.server.listen(config_1.CONFIG.PORT, () => {
        console.log(`=================================================================`);
        console.log(`🚀 ALADIN EXPRESS ECOSYSTEM ONLINE`);
        console.log(`📡 HTTP Gateway: http://localhost:${config_1.CONFIG.PORT}`);
        console.log(`🛰️ WebSocket Telemetry: ws://localhost:${config_1.CONFIG.PORT}/ws/tracking`);
        console.log(`=================================================================`);
    });
}
exports.default = defaultApp;
