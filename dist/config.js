"use strict";
// ==============================================================================
// Yassir Express Global Configuration
// ==============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = void 0;
exports.CONFIG = {
    PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 8080,
    WS_PORT: process.env.WS_PORT ? parseInt(process.env.WS_PORT, 10) : 8081,
    DEFAULT_CURRENCY: 'DZD',
    // Localized Regional Financial Constants (Algeria standard)
    ALGERIA_MAX_COD_DEBT_LIMIT_CENTS: 1500000, // 15,000 DZD (Courier deposit threshold)
    DEFAULT_COMMISSION_RATE: 15.0, // 15% platform take-rate
    BASE_DELIVERY_FEE_CENTS: 25000, // 250 DZD base fare
    PER_KM_DELIVERY_FEE_CENTS: 3000, // 30 DZD per km
    COURIER_EARNING_SHARE: 0.80, // 80% of delivery fee goes to courier
    // Dispatch & Sync Delay Configuration
    DISPATCH_OFFER_TIMEOUT_SECONDS: 20,
    DISPATCH_SAFETY_BUFFER_SECONDS: 120, // 2 minutes before food ready
    MAX_SEARCH_RADIUS_KM: 6.0,
};
