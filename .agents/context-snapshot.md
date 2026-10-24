# Context Snapshot: Yassir Express Ecosystem Analysis

## Ecosystem Anatomy & Package Identifiers
- **Customer Super-App**: `com.yatechnologies.yassir_rider`
  - Integrated verticals: Yassir Go (Ride-hailing), Yassir Express (Food & Grocery delivery), Yassir Market, Yassir Pay.
  - Client framework: Flutter with Native Android/iOS bridges for geolocation & push notifications (FCM / APNs).
- **Courier / Delivery Partner App**: `com.yatechnologies.yassirfoodpartner`
  - Purpose: High-frequency GPS telemetry, order offer acceptance (15s countdown), pickup/dropoff lifecycle, cash float & debt threshold management.
- **Merchant / Restaurant Partner App**: `com.yatechnologies.yassirfoodrestaurant`
  - Purpose: Real-time kitchen order ticket (KOT), prep time estimation, menu/item out-of-stock toggles, courier arrival coordination.
- **Backend Infrastructure**:
  - Languages: Golang (high-throughput dispatch, location ingest, pricing), Node.js / Python (catalog, customer CRM), Rust (high performance computation).
  - Messaging & Ingestion: Apache Kafka / Redis Streams for event pub/sub; gRPC (internal microservices) + REST/JSON (API gateway); WebSocket / MQTT for courier telemetry.
  - Geo-indexing: Uber H3 / Geohash for spatial proximity bucketing.
  - Regional constraints: Cash-on-Delivery (COD) represents ~80-90% of transactions in North Africa (Algeria, Morocco, Tunisia), requiring rigorous courier cash balance tracking, wallet escrow, and local payment integration (SATIM/CIB/Edahabia in Algeria).
