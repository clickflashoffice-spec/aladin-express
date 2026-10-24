# Yassir Express Delivery Ecosystem: Reverse-Engineered Architecture & System Guide

## Overview
**Yassir Express** is the on-demand logistics, food delivery, and dark-store grocery arm of Yassir (YA Technologies), the leading North African super-app operating in Algeria, Tunisia, Morocco, and surrounding territories.

This repository represents a complete 100% reverse-engineered architectural decomposition and production-grade runnable reference implementation of the entire ecosystem.

---

## 1. System Components & Package Parity

| Component | Target Artifact / Client | Core Tech Stack |
|---|---|---|
| **Customer Super-App** | `com.yatechnologies.yassir_rider` | Flutter, Dart, Native Platform Channels (Android/iOS) |
| **Courier Fleet App** | `com.yatechnologies.yassirfoodpartner` | Android (Kotlin) / iOS (Swift), MQTT/WebSocket, Foreground Geolocation Services |
| **Merchant KDS Tablet** | `com.yatechnologies.yassirfoodrestaurant` | Web / React / Android KDS Tablet, Audio Alert Daemon |
| **Edge API Gateway** | `api.yassir.io` | Envoy / Kong, JWT Authentication, Redis Token-Bucket Rate Limiter |
| **Telemetry Ingestion** | `tracking.yassir.io` | Go (Golang), WebSocket / MQTT (Port 8883), Redis Streams |
| **Dispatch & Matching** | Core Matching Cluster | Go, Uber H3 Spatial Hexagonal Discretization, Bipartite Matching |
| **Cash / Ledger Service** | Fintech Settlement Engine | Go, Double-Entry Accounting, Algerian Post/Baridimob & CIB/Edahabia |

---

## 2. Order Lifecycle State Machine

```
[Customer Cart]
       ↓
   SUBMITTED ────────────── (Timeout 5m / Cancel 60s) ───────────────> CANCELLED
       ↓
RESTAURANT_ACCEPTED (Prep time estimated: e.g. 15m)
       ↓
DISPATCH_QUEUED (T_dispatch = T_ready - T_courier_eta - 2min)
       ↓
OFFERED_TO_COURIER (15-20s countdown timer)
       ↓
COURIER_ASSIGNED
       ↓
COURIER_AT_RESTAURANT
       ↓
   PICKED_UP (Food checked & receipt verified)
       ↓
  IN_TRANSIT (Live GPS coordinates streamed to customer map)
       ↓
COURIER_AT_CUSTOMER
       ↓
   DELIVERED (Customer provides 4-digit OTP + Cash collected)
       ↓
    SETTLED (Double-entry journal posted, courier debt updated)
```

---

## 3. Localized Fintech: Cash-on-Delivery (COD) Dynamics

In North Africa, up to ~85% of retail and on-demand transactions are paid in physical cash. This introduces a unique counterparty risk where delivery couriers act as temporary escrow holding company cash.

### The Liability Ceiling Rule:
- Each courier has an active cash-in-hand liability balance:
  $$\text{Net Cash Held} = \sum \text{Cash Collected} - \sum \text{Courier Delivery Earnings} - \sum \text{Physical Agency Bank Deposits}$$
- **Threshold Limit**: 15,000 DZD (in Algeria), 400 TND (Tunisia), 1,500 MAD (Morocco).
- When $\text{Net Cash Held} \ge \text{Threshold}$, the Dispatch Engine automatically blacklists the courier from receiving new delivery offers until they deposit cash at an authorized physical drop-off agency (Algérie Poste, Yassir Hub, or Baridimob).

---

## 4. Running the Ecosystem

### 1. Build & Typecheck
```bash
npm install
npm run build
```

### 2. Run Full Multi-Agent Simulation
```bash
npm run simulate
```

### 3. Launch HTTP & WebSocket Gateway Server
```bash
npm start
```
- Gateway API: `http://localhost:8080`
- Telemetry WebSocket: `ws://localhost:8080/ws/tracking?orderId=<id>`
- Health check: `http://localhost:8080/api/v1/health`
- Ledger balances: `http://localhost:8080/api/v1/admin/ledger`
