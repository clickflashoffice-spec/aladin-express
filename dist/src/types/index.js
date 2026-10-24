"use strict";
// ==============================================================================
// Yassir Express Domain Types & Models
// ==============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentMethod = exports.OrderStatus = exports.CourierStatus = exports.VehicleType = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["CUSTOMER"] = "CUSTOMER";
    UserRole["COURIER"] = "COURIER";
    UserRole["MERCHANT_ADMIN"] = "MERCHANT_ADMIN";
    UserRole["DISPATCHER"] = "DISPATCHER";
})(UserRole || (exports.UserRole = UserRole = {}));
var VehicleType;
(function (VehicleType) {
    VehicleType["MOTORCYCLE"] = "MOTORCYCLE";
    VehicleType["BICYCLE"] = "BICYCLE";
    VehicleType["CAR"] = "CAR";
    VehicleType["SCOOTER"] = "SCOOTER";
})(VehicleType || (exports.VehicleType = VehicleType = {}));
var CourierStatus;
(function (CourierStatus) {
    CourierStatus["OFFLINE"] = "OFFLINE";
    CourierStatus["ONLINE_IDLE"] = "ONLINE_IDLE";
    CourierStatus["OFFER_PENDING"] = "OFFER_PENDING";
    CourierStatus["ASSIGNED_TO_ORDER"] = "ASSIGNED_TO_ORDER";
    CourierStatus["SUSPENDED"] = "SUSPENDED";
})(CourierStatus || (exports.CourierStatus = CourierStatus = {}));
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["SUBMITTED"] = "SUBMITTED";
    OrderStatus["RESTAURANT_ACCEPTED"] = "RESTAURANT_ACCEPTED";
    OrderStatus["PREPARING"] = "PREPARING";
    OrderStatus["READY_FOR_PICKUP"] = "READY_FOR_PICKUP";
    OrderStatus["COURIER_ASSIGNED"] = "COURIER_ASSIGNED";
    OrderStatus["COURIER_AT_RESTAURANT"] = "COURIER_AT_RESTAURANT";
    OrderStatus["PICKED_UP"] = "PICKED_UP";
    OrderStatus["IN_TRANSIT"] = "IN_TRANSIT";
    OrderStatus["COURIER_AT_CUSTOMER"] = "COURIER_AT_CUSTOMER";
    OrderStatus["DELIVERED"] = "DELIVERED";
    OrderStatus["CANCELLED"] = "CANCELLED";
    OrderStatus["REJECTED"] = "REJECTED";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CASH_ON_DELIVERY"] = "CASH_ON_DELIVERY";
    PaymentMethod["YASSIR_PAY"] = "YASSIR_PAY";
    PaymentMethod["CIB_EDAHABIA"] = "CIB_EDAHABIA";
    // Tunisian e-Payments
    PaymentMethod["SMT_CLICTOPAY"] = "SMT_CLICTOPAY";
    PaymentMethod["FLOUCI"] = "FLOUCI";
    PaymentMethod["EDINAR_D17"] = "EDINAR_D17";
    PaymentMethod["KONNECT"] = "KONNECT";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
