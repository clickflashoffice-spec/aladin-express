"use strict";
// ==============================================================================
// Yassir Express API Gateway & Orchestrator
// Unified Entrypoint for Customer, Merchant, Courier & Real-Time Tracking
// ==============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEcosystemServer = createEcosystemServer;
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
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
function createEcosystemServer() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
    // Instantiate core services
    const catalogService = new catalog_service_1.CatalogService();
    const telemetryService = new telemetry_service_1.TelemetryService();
    const ledgerService = new ledger_service_1.LedgerService();
    const dispatchEngine = new dispatch_engine_1.DispatchEngine(telemetryService, ledgerService);
    const orderService = new order_service_1.OrderService(catalogService, telemetryService, dispatchEngine, ledgerService);
    const tunisianPaymentService = new tunisian_payment_service_1.TunisianPaymentService();
    // Health and ecosystem metadata
    app.get('/api/v1/health', (_req, res) => {
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
    const server = http_1.default.createServer(app);
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
    server.listen(config_1.CONFIG.PORT, () => {
        console.log(`=================================================================`);
        console.log(`🚀 YASSIR EXPRESS ECOSYSTEM ONLINE`);
        console.log(`📡 HTTP Gateway: http://localhost:${config_1.CONFIG.PORT}`);
        console.log(`🛰️ WebSocket Telemetry: ws://localhost:${config_1.CONFIG.PORT}/ws/tracking`);
        console.log(`=================================================================`);
    });
}
