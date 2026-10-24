-- ==============================================================================
-- Yassir Express Production Database Schema (PostgreSQL 16 + PostGIS)
-- Reverse-engineered from client endpoints, partner apps & backend telemetry
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ------------------------------------------------------------------------------
-- 1. USERS & IDENTITY
-- ------------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('CUSTOMER', 'COURIER', 'MERCHANT_ADMIN', 'DISPATCHER', 'SUPERADMIN');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) UNIQUE NOT NULL, -- e.g. +213555123456 (Algeria), +216 (Tunisia)
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    role user_role NOT NULL DEFAULT 'CUSTOMER',
    avatar_url TEXT,
    language_code VARCHAR(5) DEFAULT 'fr', -- 'fr', 'ar', 'en'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. MERCHANTS & RESTAURANTS
-- ------------------------------------------------------------------------------
CREATE TYPE merchant_tier AS ENUM ('STANDARD', 'PREMIUM', 'EXCLUSIVE');

CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    phone_number VARCHAR(20) NOT NULL,
    location GEOMETRY(Point, 4326) NOT NULL, -- WGS84 Geo point
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address_line TEXT NOT NULL,
    city VARCHAR(100) NOT NULL, -- 'Algiers', 'Oran', 'Tunis', 'Casablanca'
    country_code VARCHAR(2) NOT NULL, -- 'DZ', 'TN', 'MA'
    h3_res7 VARCHAR(15), -- Spatial macro cell
    h3_res8 VARCHAR(15), -- Geofencing zone
    commission_rate NUMERIC(4, 2) NOT NULL DEFAULT 15.00, -- e.g. 15.00%
    is_open BOOLEAN NOT NULL DEFAULT TRUE,
    prep_time_minutes INT NOT NULL DEFAULT 20,
    rating NUMERIC(3, 2) DEFAULT 4.5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_merchants_spatial ON merchants USING GIST (location);
CREATE INDEX idx_merchants_h3_res8 ON merchants (h3_res8);

CREATE TABLE menu_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    price_cents BIGINT NOT NULL, -- e.g. 85000 DZD cents = 850.00 DZD
    currency VARCHAR(3) NOT NULL DEFAULT 'DZD', -- 'DZD', 'TND', 'MAD'
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. COURIERS & FLEET TELEMETRY
-- ------------------------------------------------------------------------------
CREATE TYPE vehicle_type AS ENUM ('MOTORCYCLE', 'BICYCLE', 'CAR', 'SCOOTER');
CREATE TYPE courier_status AS ENUM ('OFFLINE', 'ONLINE_IDLE', 'OFFER_PENDING', 'ASSIGNED_TO_ORDER', 'SUSPENDED');

CREATE TABLE couriers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_type vehicle_type NOT NULL DEFAULT 'MOTORCYCLE',
    license_plate VARCHAR(30),
    status courier_status NOT NULL DEFAULT 'OFFLINE',
    current_location GEOMETRY(Point, 4326),
    last_latitude DOUBLE PRECISION,
    last_longitude DOUBLE PRECISION,
    last_ping_at TIMESTAMPTZ,
    h3_res9 VARCHAR(15),
    acceptance_rate NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
    current_cash_debt_cents BIGINT NOT NULL DEFAULT 0,
    max_cash_debt_limit_cents BIGINT NOT NULL DEFAULT 1500000, -- 15,000 DZD
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_couriers_spatial ON couriers USING GIST (current_location);
CREATE INDEX idx_couriers_h3_res9 ON couriers (h3_res9);

CREATE TABLE courier_telemetry_logs (
    id BIGSERIAL PRIMARY KEY,
    courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    location GEOMETRY(Point, 4326) NOT NULL,
    speed_mps REAL,
    heading_deg REAL,
    accuracy_m REAL,
    battery_level SMALLINT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. ORDERS & DISPATCH LIFECYCLE
-- ------------------------------------------------------------------------------
CREATE TYPE order_status AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'RESTAURANT_ACCEPTED',
    'PREPARING',
    'READY_FOR_PICKUP',
    'COURIER_ASSIGNED',
    'COURIER_AT_RESTAURANT',
    'PICKED_UP',
    'IN_TRANSIT',
    'COURIER_AT_CUSTOMER',
    'DELIVERED',
    'CANCELLED',
    'REJECTED'
);

CREATE TYPE payment_method AS ENUM (
    'CASH_ON_DELIVERY',
    'YASSIR_PAY',
    'CIB_EDAHABIA',
    'CREDIT_CARD'
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES users(id),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    courier_id UUID REFERENCES couriers(id),
    status order_status NOT NULL DEFAULT 'SUBMITTED',
    payment_method payment_method NOT NULL DEFAULT 'CASH_ON_DELIVERY',
    
    -- Financial breakdown (in currency minor units)
    items_subtotal_cents BIGINT NOT NULL,
    delivery_fee_cents BIGINT NOT NULL,
    service_fee_cents BIGINT NOT NULL DEFAULT 0,
    discount_cents BIGINT NOT NULL DEFAULT 0,
    total_amount_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'DZD',
    
    -- Delivery Geography
    delivery_address TEXT NOT NULL,
    delivery_location GEOMETRY(Point, 4326) NOT NULL,
    delivery_latitude DOUBLE PRECISION NOT NULL,
    delivery_longitude DOUBLE PRECISION NOT NULL,
    delivery_instructions TEXT,
    
    -- Timestamps & Synchronization
    placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    estimated_prep_minutes INT,
    ready_by_time TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    delivery_otp VARCHAR(6)
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price_cents BIGINT NOT NULL,
    total_price_cents BIGINT NOT NULL,
    notes TEXT
);

-- ------------------------------------------------------------------------------
-- 5. FINTECH & CASH-ON-DELIVERY (COD) DOUBLE-ENTRY LEDGER
-- ------------------------------------------------------------------------------
CREATE TYPE account_type AS ENUM (
    'CUSTOMER_PAYABLE',
    'COURIER_CASH_HOLDING',
    'COURIER_PAYABLE',
    'MERCHANT_PAYABLE',
    'PLATFORM_COMMISSION_REVENUE',
    'PLATFORM_DELIVERY_REVENUE',
    'ESCROW_SETTLEMENT'
);

CREATE TABLE ledger_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_type account_type NOT NULL,
    owner_id UUID, -- user_id, courier_id, or merchant_id
    balance_cents BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'DZD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ledger_journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id),
    reference_code VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ledger_entry_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID NOT NULL REFERENCES ledger_journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES ledger_accounts(id),
    debit_cents BIGINT NOT NULL DEFAULT 0,
    credit_cents BIGINT NOT NULL DEFAULT 0,
    CHECK ((debit_cents > 0 AND credit_cents = 0) OR (credit_cents > 0 AND debit_cents = 0))
);
