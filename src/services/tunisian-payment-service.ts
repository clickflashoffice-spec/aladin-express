// ==============================================================================
// Yassir Express Tunisian e-Payment Gateway & Settlement Adapter
// Supports SMT (ClicToPay), Flouci Mobile Wallet, e-Dinar / D17, and Konnect
// Handles 3-decimal TND currency arithmetic (1 TND = 1,000 Millimes)
// ==============================================================================

import crypto from 'crypto';

export enum TunisianPaymentGateway {
  SMT_CLICTOPAY = 'SMT_CLICTOPAY',       // Société Monétique Tunisie (Cards)
  FLOUCI = 'FLOUCI',                     // Flouci Mobile Wallet (Kaoun)
  EDINAR_D17 = 'EDINAR_D17',             // La Poste Tunisienne (D17 / e-Dinar)
  KONNECT = 'KONNECT',                   // Konnect Payment Gateway
}

export enum TunisianPaymentStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export interface TunisianPaymentTransaction {
  paymentId: string;
  orderId: string;
  gateway: TunisianPaymentGateway;
  amountMillimes: number; // 1 TND = 1,000 millimes
  amountTND: number;
  currency: 'TND';
  status: TunisianPaymentStatus;
  customerPhone?: string;
  gatewayReference?: string;
  signature?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class TunisianPaymentService {
  private transactions: Map<string, TunisianPaymentTransaction> = new Map();

  // Secret keys (in production loaded from KMS / HashiCorp Vault)
  private readonly SMT_SECRET_KEY = process.env.SMT_SECRET_KEY || 'smt_test_secret_key_tunisia_2026';
  private readonly FLOUCI_APP_SECRET = process.env.FLOUCI_APP_SECRET || 'flouci_app_secret_kaoun_2026';

  /**
   * Format TND millimes to human-readable string: e.g. 25500 -> "25.500 TND"
   */
  public static formatTND(amountMillimes: number): string {
    const tnd = (amountMillimes / 1000).toFixed(3);
    return `${tnd} TND`;
  }

  /**
   * Convert TND to Millimes integer: e.g. 25.5 -> 25500
   */
  public static toMillimes(amountTND: number): number {
    return Math.round(amountTND * 1000);
  }

  /**
   * 1. Initiate a payment with the selected Tunisian gateway
   */
  public initiatePayment(params: {
    orderId: string;
    gateway: TunisianPaymentGateway;
    amountMillimes: number;
    customerPhone?: string;
  }): {
    success: boolean;
    paymentId: string;
    checkoutUrl: string;
    qrPayload?: string;
    amountFormatted: string;
  } {
    const paymentId = `tnpay-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const amountTND = params.amountMillimes / 1000;

    const tx: TunisianPaymentTransaction = {
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
  public processSMTWebhook(payload: {
    paymentId: string;
    gatewayReference: string;
    status: string;
    signature: string;
  }): { success: boolean; error?: string; tx?: TunisianPaymentTransaction } {
    const tx = this.transactions.get(payload.paymentId);
    if (!tx) {
      return { success: false, error: 'Transaction not found' };
    }

    // Verify cryptographic signature: HMAC-SHA256(paymentId + gatewayReference + status, SMT_SECRET)
    const expectedData = `${payload.paymentId}:${payload.gatewayReference}:${payload.status}`;
    const calculatedSignature = crypto
      .createHmac('sha256', this.SMT_SECRET_KEY)
      .update(expectedData)
      .digest('hex');

    if (calculatedSignature !== payload.signature) {
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
  public processFlouciCallback(payload: {
    paymentId: string;
    flouciPaymentId: string;
    status: 'SUCCESS' | 'FAILED';
  }): { success: boolean; tx?: TunisianPaymentTransaction } {
    const tx = this.transactions.get(payload.paymentId);
    if (!tx) return { success: false };

    tx.gatewayReference = payload.flouciPaymentId;
    tx.status = payload.status === 'SUCCESS' ? TunisianPaymentStatus.CAPTURED : TunisianPaymentStatus.FAILED;
    tx.updatedAt = new Date();

    return { success: true, tx };
  }

  /**
   * Generate signature for testing SMT webhook
   */
  public generateSMTSignature(paymentId: string, gatewayReference: string, status: string): string {
    const data = `${paymentId}:${gatewayReference}:${status}`;
    return crypto.createHmac('sha256', this.SMT_SECRET_KEY).update(data).digest('hex');
  }

  public getTransaction(paymentId: string): TunisianPaymentTransaction | undefined {
    return this.transactions.get(paymentId);
  }

  public getTransactionForOrder(orderId: string): TunisianPaymentTransaction | undefined {
    for (const tx of this.transactions.values()) {
      if (tx.orderId === orderId) return tx;
    }
    return undefined;
  }
}
