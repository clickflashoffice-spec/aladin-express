// ==============================================================================
// Yassir Express Domain Types & Models
// ==============================================================================

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  COURIER = 'COURIER',
  MERCHANT_ADMIN = 'MERCHANT_ADMIN',
  DISPATCHER = 'DISPATCHER',
}

export enum VehicleType {
  MOTORCYCLE = 'MOTORCYCLE',
  BICYCLE = 'BICYCLE',
  CAR = 'CAR',
  SCOOTER = 'SCOOTER',
}

export enum CourierStatus {
  OFFLINE = 'OFFLINE',
  ONLINE_IDLE = 'ONLINE_IDLE',
  OFFER_PENDING = 'OFFER_PENDING',
  ASSIGNED_TO_ORDER = 'ASSIGNED_TO_ORDER',
  SUSPENDED = 'SUSPENDED',
}

export enum OrderStatus {
  SUBMITTED = 'SUBMITTED',
  RESTAURANT_ACCEPTED = 'RESTAURANT_ACCEPTED',
  PREPARING = 'PREPARING',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  COURIER_ASSIGNED = 'COURIER_ASSIGNED',
  COURIER_AT_RESTAURANT = 'COURIER_AT_RESTAURANT',
  PICKED_UP = 'PICKED_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  COURIER_AT_CUSTOMER = 'COURIER_AT_CUSTOMER',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

export enum PaymentMethod {
  CASH_ON_DELIVERY = 'CASH_ON_DELIVERY',
  YASSIR_PAY = 'YASSIR_PAY',
  CIB_EDAHABIA = 'CIB_EDAHABIA',
  // Tunisian e-Payments
  SMT_CLICTOPAY = 'SMT_CLICTOPAY',
  FLOUCI = 'FLOUCI',
  EDINAR_D17 = 'EDINAR_D17',
  KONNECT = 'KONNECT',
}

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

export interface User {
  id: string;
  phoneNumber: string;
  fullName: string;
  role: UserRole;
  language: string;
}

export interface MenuItem {
  id: string;
  merchantId: string;
  title: string;
  description: string;
  priceCents: number; // In DZD cents (100 = 1 DZD)
  currency: string;
  isAvailable: boolean;
}

export interface Merchant {
  id: string;
  name: string;
  slug: string;
  phoneNumber: string;
  location: GeoCoordinate;
  addressLine: string;
  city: string;
  countryCode: string;
  commissionRate: number; // e.g. 15.0 (%)
  isOpen: boolean;
  prepTimeMinutes: number;
  rating: number;
  menu: MenuItem[];
}

export interface Courier {
  id: string;
  fullName: string;
  phoneNumber: string;
  vehicleType: VehicleType;
  status: CourierStatus;
  currentLocation: GeoCoordinate;
  lastPingAt: Date;
  acceptanceRate: number;
  currentCashDebtCents: number; // COD liability
  maxCashLimitCents: number; // e.g. 15,000 DZD
}

export interface OrderItemRequest {
  menuItemId: string;
  quantity: number;
}

export interface OrderItem {
  menuItemId: string;
  title: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  merchantId: string;
  courierId?: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  items: OrderItem[];
  itemsSubtotalCents: number;
  deliveryFeeCents: number;
  totalAmountCents: number;
  currency: string;
  deliveryAddress: string;
  deliveryLocation: GeoCoordinate;
  placedAt: Date;
  readyByTime?: Date;
  deliveryOtp: string;
}

export interface DispatchOffer {
  offerId: string;
  orderId: string;
  courierId: string;
  pickupLocation: GeoCoordinate;
  dropoffLocation: GeoCoordinate;
  guaranteedPayoutCents: number;
  expiresAt: Date;
}

export interface LedgerEntry {
  id: string;
  orderId?: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amountCents: number;
  currency: string;
  timestamp: Date;
}
