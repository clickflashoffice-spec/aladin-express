"use strict";
// ==============================================================================
// Yassir Express Catalog Service
// Stores merchants, menus, pricing, and operating statuses
// ==============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogService = void 0;
class CatalogService {
    merchants = new Map();
    constructor() {
        this.seedDefaultMerchants();
    }
    seedDefaultMerchants() {
        // Seed real-world Algiers merchants
        const merchantId1 = 'mch-alg-001';
        const merchantId2 = 'mch-alg-002';
        const merchant1 = {
            id: merchantId1,
            name: 'Le Gourmet Burger Hydra',
            slug: 'le-gourmet-burger-hydra',
            phoneNumber: '+213550112233',
            location: { latitude: 36.7412, longitude: 3.0425 }, // Hydra, Algiers
            addressLine: '12 Boulevard Sidi Yahia, Hydra',
            city: 'Algiers',
            countryCode: 'DZ',
            commissionRate: 15.0,
            isOpen: true,
            prepTimeMinutes: 15,
            rating: 4.8,
            menu: [
                {
                    id: 'item-001',
                    merchantId: merchantId1,
                    title: 'Classic Smash Burger Double Cheese',
                    description: 'Two pure beef patties, melted cheddar, house sauce, brioche bun',
                    priceCents: 95000, // 950 DZD
                    currency: 'DZD',
                    isAvailable: true,
                },
                {
                    id: 'item-002',
                    merchantId: merchantId1,
                    title: 'Crispy Truffle Fries',
                    description: 'Hand-cut fries, parmesan cheese, truffle oil drizzle',
                    priceCents: 45000, // 450 DZD
                    currency: 'DZD',
                    isAvailable: true,
                },
                {
                    id: 'item-003',
                    merchantId: merchantId1,
                    title: 'Selecto Algerian Soda 33cl',
                    description: 'Authentic local apple soda',
                    priceCents: 15000, // 150 DZD
                    currency: 'DZD',
                    isAvailable: true,
                },
            ],
        };
        const merchant2 = {
            id: merchantId2,
            name: 'Pizzeria Napoli Bab Ezzouar',
            slug: 'pizzeria-napoli-bab-ezzouar',
            phoneNumber: '+213550445566',
            location: { latitude: 36.7167, longitude: 3.1833 }, // Bab Ezzouar, Algiers
            addressLine: 'Cité 5 Juillet, Bab Ezzouar',
            city: 'Algiers',
            countryCode: 'DZ',
            commissionRate: 15.0,
            isOpen: true,
            prepTimeMinutes: 20,
            rating: 4.6,
            menu: [
                {
                    id: 'item-004',
                    merchantId: merchantId2,
                    title: 'Pizza Margherita Traditionnelle',
                    description: 'San Marzano tomato sauce, fresh mozzarella, basil',
                    priceCents: 80000, // 800 DZD
                    currency: 'DZD',
                    isAvailable: true,
                },
                {
                    id: 'item-005',
                    merchantId: merchantId2,
                    title: 'Tiramisu Maison Speculoos',
                    description: 'Italian mascarpone with caramelized speculoos crunch',
                    priceCents: 40000, // 400 DZD
                    currency: 'DZD',
                    isAvailable: true,
                },
            ],
        };
        this.merchants.set(merchant1.id, merchant1);
        this.merchants.set(merchant2.id, merchant2);
        // Seed Tunisian Merchants (Tunis)
        const merchantIdTN1 = 'mch-tun-001';
        const merchantTN1 = {
            id: merchantIdTN1,
            name: 'Cosmitto Coffee Lac 2',
            slug: 'cosmitto-coffee-lac-2',
            phoneNumber: '+21671960011',
            location: { latitude: 36.8392, longitude: 10.2372 }, // Les Berges du Lac 2, Tunis
            addressLine: 'Rue de la Feuille d Érable, Les Berges du Lac 2',
            city: 'Tunis',
            countryCode: 'TN',
            commissionRate: 15.0,
            isOpen: true,
            prepTimeMinutes: 12,
            rating: 4.7,
            menu: [
                {
                    id: 'item-tn-001',
                    merchantId: merchantIdTN1,
                    title: 'Caramel Macchiato Grande',
                    description: 'Double espresso, steamed milk, vanilla syrup and caramel drizzle',
                    priceCents: 6500, // 6.500 TND (6500 millimes)
                    currency: 'TND',
                    isAvailable: true,
                },
                {
                    id: 'item-tn-002',
                    merchantId: merchantIdTN1,
                    title: 'Club Sandwich Poulet Fumé',
                    description: 'Smoked chicken breast, boiled egg, gouda, fresh greens and fries',
                    priceCents: 14500, // 14.500 TND
                    currency: 'TND',
                    isAvailable: true,
                },
                {
                    id: 'item-tn-003',
                    merchantId: merchantIdTN1,
                    title: 'Cheesecake Spéculoos Maison',
                    description: 'Creamy New York cheesecake with crunchy Biscoff base',
                    priceCents: 8500, // 8.500 TND
                    currency: 'TND',
                    isAvailable: true,
                },
            ],
        };
        const merchantIdTN2 = 'mch-tun-002';
        const merchantTN2 = {
            id: merchantIdTN2,
            name: 'Le Golfe Restaurant La Marsa',
            slug: 'le-golfe-la-marsa',
            phoneNumber: '+21671748222',
            location: { latitude: 36.8782, longitude: 10.3247 }, // La Marsa, Tunis
            addressLine: '5 Rue El Arbi Zarrouk, La Marsa Plage',
            city: 'Tunis',
            countryCode: 'TN',
            commissionRate: 15.0,
            isOpen: true,
            prepTimeMinutes: 25,
            rating: 4.9,
            menu: [
                {
                    id: 'item-tn-004',
                    merchantId: merchantIdTN2,
                    title: 'Brik Traditionnelle au Thon et Câpres',
                    description: 'Crispy pastry sheet, whole farm egg, wild tuna, capers and harissa',
                    priceCents: 6000, // 6.000 TND
                    currency: 'TND',
                    isAvailable: true,
                },
                {
                    id: 'item-tn-005',
                    merchantId: merchantIdTN2,
                    title: 'Couscous Royal au Mérou de la Méditerranée',
                    description: 'Traditional steamed semolina, fresh grouper fish, chickpeas and peppers',
                    priceCents: 32000, // 32.000 TND
                    currency: 'TND',
                    isAvailable: true,
                },
                {
                    id: 'item-tn-006',
                    merchantId: merchantIdTN2,
                    title: 'Boga Cidre Tunisienne 33cl',
                    description: 'Iconic Tunisian carob and apple cider soda',
                    priceCents: 2500, // 2.500 TND
                    currency: 'TND',
                    isAvailable: true,
                },
            ],
        };
        this.merchants.set(merchantTN1.id, merchantTN1);
        this.merchants.set(merchantTN2.id, merchantTN2);
    }
    getAllMerchants() {
        return Array.from(this.merchants.values());
    }
    getMerchantById(id) {
        return this.merchants.get(id);
    }
    getMenuItem(merchantId, itemId) {
        const merchant = this.merchants.get(merchantId);
        if (!merchant)
            return undefined;
        return merchant.menu.find((i) => i.id === itemId);
    }
    setMerchantOpenStatus(merchantId, isOpen) {
        const merchant = this.merchants.get(merchantId);
        if (!merchant)
            return false;
        merchant.isOpen = isOpen;
        return true;
    }
}
exports.CatalogService = CatalogService;
