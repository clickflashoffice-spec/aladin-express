"use strict";
// ==============================================================================
// Yassir Express Tunisian e-Payment Gateway & Settlement Adapter
// Supports SMT (ClicToPay), Flouci Mobile Wallet, e-Dinar / D17, and Konnect
// Handles 3-decimal TND currency arithmetic (1 TND = 1,000 Millimes)
// ==============================================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TunisianPaymentService = exports.TunisianPaymentStatus = exports.TunisianPaymentGateway = void 0;
const crypto = __importStar(require("crypto"));
var TunisianPaymentGateway;
(function (TunisianPaymentGateway) {
    TunisianPaymentGateway["SMT_CLICTOPAY"] = "SMT_CLICTOPAY";
    TunisianPaymentGateway["FLOUCI"] = "FLOUCI";
    TunisianPaymentGateway["EDINAR_D17"] = "EDINAR_D17";
    TunisianPaymentGateway["KONNECT"] = "KONNECT";
})(TunisianPaymentGateway || (exports.TunisianPaymentGateway = TunisianPaymentGateway = {}));
var TunisianPaymentStatus;
(function (TunisianPaymentStatus) {
    TunisianPaymentStatus["PENDING"] = "PENDING";
    TunisianPaymentStatus["AUTHORIZED"] = "AUTHORIZED";
    TunisianPaymentStatus["CAPTURED"] = "CAPTURED";
    TunisianPaymentStatus["FAILED"] = "FAILED";
    TunisianPaymentStatus["REFUNDED"] = "REFUNDED";
})(TunisianPaymentStatus || (exports.TunisianPaymentStatus = TunisianPaymentStatus = {}));
class TunisianPaymentService {
    transactions = new Map();
    // Secret keys (in production loaded from KMS / HashiCorp Vault)
    SMT_SECRET_KEY = process.env.SMT_SECRET_KEY || 'smt_test_secret_key_tunisia_2026';
    FLOUCI_APP_SECRET = process.env.FLOUCI_APP_SECRET || 'flouci_app_secret_kaoun_2026';
    /**
     * Format TND millimes to human-readable string: e.g. 25500 -> "25.500 TND"
     */
    static formatTND(amountMillimes) {
        const tnd = (amountMillimes / 1000).toFixed(3);
        return `${tnd} TND`;
    }
    /**
     * Convert TND to Millimes integer: e.g. 25.5 -> 25500
     */
    static toMillimes(amountTND) {
        return Math.round(amountTND * 1000);
    }
    /**
     * 1. Initiate a payment with the selected Tunisian gateway
     */
    initiatePayment(params) {
        const paymentId = `tnpay-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const amountTND = params.amountMillimes / 1000;
        const tx = {
            paymentId,
            orderId: params.orderId,
            gateway: params.gateway,
            amountMillimes: params.amountMillimes,
            amountTND,
            currency: 'TND',
            status: TunisianPaymentStatus.PENDING,
            customerPhone: params.customerPhone,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.transactions.set(paymentId, tx);
        let checkoutUrl = '';
        let qrPayload = undefined;
        switch (params.gateway) {
            case TunisianPaymentGateway.SMT_CLICTOPAY:
                // SMT ClicToPay 3DS2 Hosted Session
                checkoutUrl = `https://clictopay.com.tn/payment/checkout?session=${paymentId}&amount=${params.amountMillimes}`;
                break;
            case TunisianPaymentGateway.FLOUCI:
                // Flouci instant mobile wallet deeplink & QR
                checkoutUrl = `https://flouci.com/pay/${paymentId}`;
                qrPayload = `flouci://pay?app_token=yassir_express_tn&payment_id=${paymentId}&amount=${params.amountMillimes}`;
                break;
            case TunisianPaymentGateway.EDINAR_D17:
                // La Poste Tunisienne D17 checkout
                checkoutUrl = `https://d17.poste.tn/pay?ref=${paymentId}`;
                break;
            case TunisianPaymentGateway.KONNECT:
                checkoutUrl = `https://api.konnect.network/pay/${paymentId}`;
                break;
        }
        return {
            success: true,
            paymentId,
            checkoutUrl,
            qrPayload,
            amountFormatted: TunisianPaymentService.formatTND(params.amountMillimes),
        };
    }
    /**
     * 2. Process SMT / ClicToPay Webhook & Validate HMAC-SHA256 Signature
     */
    processSMTWebhook(payload) {
        const tx = this.transactions.get(payload.paymentId);
        if (!tx) {
            return { success: false, error: 'Transaction not found' };
        }
        // Verify cryptographic signature using constant-time comparison
        const expectedData = `${payload.paymentId}:${payload.gatewayReference}:${payload.status}`;
        const calculatedSignature = crypto
            .createHmac('sha256', this.SMT_SECRET_KEY)
            .update(expectedData)
            .digest('hex');
        const calculatedBuffer = Buffer.from(calculatedSignature, 'hex');
        const providedBuffer = Buffer.from(payload.signature, 'hex');
        if (calculatedBuffer.length !== providedBuffer.length ||
            !crypto.timingSafeEqual(calculatedBuffer, providedBuffer)) {
            return { success: false, error: 'Invalid SMT HMAC signature' };
        }
        tx.gatewayReference = payload.gatewayReference;
        tx.status = payload.status === 'SUCCESS' ? TunisianPaymentStatus.CAPTURED : TunisianPaymentStatus.FAILED;
        tx.updatedAt = new Date();
        return { success: true, tx };
    }
    /**
     * 3. Process Flouci Instant Payment Callback
     */
    processFlouciCallback(payload) {
        const tx = this.transactions.get(payload.paymentId);
        if (!tx)
            return { success: false };
        tx.gatewayReference = payload.flouciPaymentId;
        tx.status = payload.status === 'SUCCESS' ? TunisianPaymentStatus.CAPTURED : TunisianPaymentStatus.FAILED;
        tx.updatedAt = new Date();
        return { success: true, tx };
    }
    /**
     * Generate signature for testing SMT webhook
     */
    generateSMTSignature(paymentId, gatewayReference, status) {
        const data = `${paymentId}:${gatewayReference}:${status}`;
        return crypto.createHmac('sha256', this.SMT_SECRET_KEY).update(data).digest('hex');
    }
    getTransaction(paymentId) {
        return this.transactions.get(paymentId);
    }
    getTransactionForOrder(orderId) {
        for (const tx of this.transactions.values()) {
            if (tx.orderId === orderId)
                return tx;
        }
        return undefined;
    }
}
exports.TunisianPaymentService = TunisianPaymentService;
