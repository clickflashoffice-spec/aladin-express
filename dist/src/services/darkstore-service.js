"use strict";
// ==============================================================================
// Yassir Market Dark-Store Grocery & Inventory Optimization Service
// Wave picking, shelf/bin routing & SKU barcode validation
// ==============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.DarkStoreService = void 0;
class DarkStoreService {
    inventory = new Map();
    pickingTasks = new Map();
    constructor() {
        this.seedInventory();
    }
    seedInventory() {
        const defaultItems = [
            {
                sku: 'GROC-001',
                name: 'Candia Lait Demi-Écrémé 1L',
                category: 'Dairy',
                aisle: 1,
                shelf: 2,
                bin: 'A1',
                stockQuantity: 120,
                priceCents: 12500, // 125 DZD
                barcode: '6131234567890',
            },
            {
                sku: 'GROC-002',
                name: 'Café Moulu Bonal 250g',
                category: 'Pantry',
                aisle: 2,
                shelf: 1,
                bin: 'B4',
                stockQuantity: 85,
                priceCents: 24000, // 240 DZD
                barcode: '6139876543210',
            },
            {
                sku: 'GROC-003',
                name: 'Huile de Tournesol Afia 5L',
                category: 'Pantry',
                aisle: 2,
                shelf: 4,
                bin: 'C1',
                stockQuantity: 40,
                priceCents: 65000, // 650 DZD
                barcode: '6135555555555',
            },
            {
                sku: 'GROC-004',
                name: 'Bimo Biscuits Chocolat 150g',
                category: 'Snacks',
                aisle: 3,
                shelf: 3,
                bin: 'D2',
                stockQuantity: 200,
                priceCents: 8000, // 80 DZD
                barcode: '6131112223334',
            },
        ];
        for (const item of defaultItems) {
            this.inventory.set(item.sku, item);
        }
    }
    /**
     * Generates a distance-optimized pick list sorted by Aisle -> Shelf -> Bin
     * to eliminate backtracking inside the dark store.
     */
    generateOptimizedPickTask(orderId, itemsRequest) {
        const resolvedItems = itemsRequest
            .map((req) => {
            const item = this.inventory.get(req.sku);
            if (!item)
                return null;
            return {
                sku: item.sku,
                name: item.name,
                aisle: item.aisle,
                shelf: item.shelf,
                bin: item.bin,
                location: `Aisle ${item.aisle}, Shelf ${item.shelf}, Bin ${item.bin}`,
                quantity: req.quantity,
                scanned: false,
            };
        })
            .filter((i) => i !== null)
            // Sort by warehouse coordinates to minimize picker walking path
            .sort((a, b) => {
            if (a.aisle !== b.aisle)
                return a.aisle - b.aisle;
            return a.shelf - b.shelf;
        });
        const taskId = `pick-${Date.now()}`;
        const task = {
            taskId,
            orderId,
            darkStoreId: 'darkstore-hydra-01',
            items: resolvedItems.map(({ sku, name, location, quantity, scanned }) => ({
                sku,
                name,
                location,
                quantity,
                scanned,
            })),
            isCompleted: false,
        };
        this.pickingTasks.set(taskId, task);
        return task;
    }
    /**
     * Verify SKU barcode scan during picking.
     */
    scanItemBarcode(taskId, scannedBarcode) {
        const task = this.pickingTasks.get(taskId);
        if (!task)
            return { success: false, message: 'Task not found' };
        let found = false;
        for (const taskItem of task.items) {
            const invItem = this.inventory.get(taskItem.sku);
            if (invItem && invItem.barcode === scannedBarcode) {
                taskItem.scanned = true;
                found = true;
                break;
            }
        }
        if (!found) {
            return { success: false, message: 'Barcode does not match any item in current pick list' };
        }
        const allScanned = task.items.every((i) => i.scanned);
        if (allScanned) {
            task.isCompleted = true;
        }
        return { success: true, message: allScanned ? 'All items picked and packed!' : 'Item verified.' };
    }
}
exports.DarkStoreService = DarkStoreService;
