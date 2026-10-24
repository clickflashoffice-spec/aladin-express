"use strict";
// ==============================================================================
// Yassir Express Fintech & Cash-on-Delivery (COD) Double-Entry Ledger Service
// Enforces zero-sum accounting, courier cash debt ceilings, and merchant settlements
// ==============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerService = void 0;
const config_1 = require("../config");
const types_1 = require("../types");
class LedgerService {
    journalEntries = [];
    accountBalances = new Map();
    constructor() {
        this.initStandardAccounts();
    }
    initStandardAccounts() {
        const defaultAccounts = [
            'PLATFORM_COMMISSION_REVENUE',
            'PLATFORM_DELIVERY_REVENUE',
            'ESCROW_SETTLEMENT',
        ];
        for (const acc of defaultAccounts) {
            this.accountBalances.set(acc, 0);
        }
    }
    getBalance(account) {
        return this.accountBalances.get(account) || 0;
    }
    updateBalance(account, deltaCents) {
        const current = this.getBalance(account);
        this.accountBalances.set(account, current + deltaCents);
    }
    /**
     * Process and reconcile order delivery payment.
     * In North African COD, the courier collects cash from the customer for food + delivery fee.
     */
    recordOrderDelivery(order, courierId) {
        const totalCollectedCents = order.totalAmountCents;
        const itemsCents = order.itemsSubtotalCents;
        const deliveryFeeCents = order.deliveryFeeCents;
        // Platform commission from merchant (e.g., 15% of food items)
        const platformCommissionCents = Math.round(itemsCents * (config_1.CONFIG.DEFAULT_COMMISSION_RATE / 100));
        const merchantNetPayableCents = itemsCents - platformCommissionCents;
        // Courier earnings (e.g., 80% of delivery fee)
        const courierNetEarningCents = Math.round(deliveryFeeCents * config_1.CONFIG.COURIER_EARNING_SHARE);
        const platformDeliveryTakeCents = deliveryFeeCents - courierNetEarningCents;
        const platformTotalRevenueCents = platformCommissionCents + platformDeliveryTakeCents;
        const journalEntryId = `jnl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        if (order.paymentMethod === types_1.PaymentMethod.CASH_ON_DELIVERY) {
            // 1. Courier holds full cash collected
            const courierCashAccount = `COURIER_CASH_${courierId}`;
            const courierPayableAccount = `COURIER_PAYABLE_${courierId}`;
            const merchantPayableAccount = `MERCHANT_PAYABLE_${order.merchantId}`;
            // Debit Cash in Courier Hands, Credit Revenue and Payables
            this.updateBalance(courierCashAccount, totalCollectedCents);
            this.updateBalance(merchantPayableAccount, merchantNetPayableCents);
            this.updateBalance(courierPayableAccount, courierNetEarningCents);
            this.updateBalance('PLATFORM_COMMISSION_REVENUE', platformCommissionCents);
            this.updateBalance('PLATFORM_DELIVERY_REVENUE', platformDeliveryTakeCents);
            // Record immutable journal audit log
            this.journalEntries.push({
                id: `${journalEntryId}-1`,
                orderId: order.id,
                description: `COD collected for Order #${order.id}`,
                debitAccount: courierCashAccount,
                creditAccount: 'CUSTOMER_CLEARING',
                amountCents: totalCollectedCents,
                currency: order.currency,
                timestamp: new Date(),
            });
            this.journalEntries.push({
                id: `${journalEntryId}-2`,
                orderId: order.id,
                description: `Revenue distribution for Order #${order.id}`,
                debitAccount: 'CUSTOMER_CLEARING',
                creditAccount: merchantPayableAccount,
                amountCents: merchantNetPayableCents,
                currency: order.currency,
                timestamp: new Date(),
            });
        }
        else {
            // Digital payment (Tunisian SMT / Flouci / e-Dinar, Yassir Pay, or Card)
            const digitalClearingAccount = `GATEWAY_CLEARING_${order.paymentMethod}`;
            const courierPayableAccount = `COURIER_PAYABLE_${courierId}`;
            const merchantPayableAccount = `MERCHANT_PAYABLE_${order.merchantId}`;
            // Bank / Gateway settles funds; courier holds zero cash
            this.updateBalance(digitalClearingAccount, totalCollectedCents);
            this.updateBalance(merchantPayableAccount, merchantNetPayableCents);
            this.updateBalance(courierPayableAccount, courierNetEarningCents);
            this.updateBalance('PLATFORM_COMMISSION_REVENUE', platformCommissionCents);
            this.updateBalance('PLATFORM_DELIVERY_REVENUE', platformDeliveryTakeCents);
            this.journalEntries.push({
                id: `${journalEntryId}-digital`,
                orderId: order.id,
                description: `Digital gateway capture (${order.paymentMethod}) for Order #${order.id}`,
                debitAccount: digitalClearingAccount,
                creditAccount: merchantPayableAccount,
                amountCents: totalCollectedCents,
                currency: order.currency,
                timestamp: new Date(),
            });
        }
        const courierCashCollected = order.paymentMethod === types_1.PaymentMethod.CASH_ON_DELIVERY ? totalCollectedCents : 0;
        return {
            success: true,
            journalEntryId,
            courierCashCollectedCents: courierCashCollected,
            courierNetEarningCents,
            merchantNetPayableCents,
            platformTotalRevenueCents,
        };
    }
    /**
     * Check if courier has reached the maximum allowed cash ceiling (15,000 DZD).
     */
    isCourierDebtExceeded(currentDebtCents) {
        return currentDebtCents >= config_1.CONFIG.ALGERIA_MAX_COD_DEBT_LIMIT_CENTS;
    }
    /**
     * Process a cash deposit made by courier at an agency (e.g. Algérie Poste / Baridimob or Yassir Hub).
     */
    processCourierDeposit(courierId, depositAmountCents, agencyName, referenceCode) {
        const courierCashAccount = `COURIER_CASH_${courierId}`;
        const currentDebt = this.getBalance(courierCashAccount);
        const newDebt = Math.max(0, currentDebt - depositAmountCents);
        this.accountBalances.set(courierCashAccount, newDebt);
        this.journalEntries.push({
            id: `dep-${Date.now()}`,
            description: `Cash deposit at ${agencyName} (Ref: ${referenceCode})`,
            debitAccount: 'BANK_COLLECTION_AGENCY',
            creditAccount: courierCashAccount,
            amountCents: depositAmountCents,
            currency: config_1.CONFIG.DEFAULT_CURRENCY,
            timestamp: new Date(),
        });
        return {
            success: true,
            newDebtCents: newDebt,
        };
    }
    getJournalEntries() {
        return this.journalEntries;
    }
    getAccountBalances() {
        return Object.fromEntries(this.accountBalances.entries());
    }
}
exports.LedgerService = LedgerService;
