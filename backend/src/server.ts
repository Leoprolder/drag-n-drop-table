import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: 'https://leoprolder.github.io',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],
}));
app.use(bodyParser.json());

interface Item {
    id: number;
    value: number;
}

const ALL_ITEMS: Item[] = Array.from({ length: 1_000_000 }, (_, i) => ({
    id: i + 1,
    value: i + 1
}));

interface ServerState {
    selectedItemIds: Set<number>;
    dragDropOrder: Map<string, number[]>;
    lastActiveSearchTerm: string;
}

const serverState: ServerState = {
    selectedItemIds: new Set<number>(),
    dragDropOrder: new Map<string, number[]>(),
    lastActiveSearchTerm: ''
};

const getItemById = (id: number): Item | undefined => {
    if (id > 0 && id <= ALL_ITEMS.length) {
        return ALL_ITEMS[id - 1];
    }
    return undefined;
};

const applyOrder = (items: Item[], orderIds: number[]): Item[] => {
    const orderedMap = new Map<number, Item>();
    items.forEach(item => orderedMap.set(item.id, item));
    const result: Item[] = [];
    const seenIds = new Set<number>();
    for (const id of orderIds) {
        const item = orderedMap.get(id);
        if (item) {
            result.push(item);
            seenIds.add(item.id);
        }
    }
    for (const item of items) {
        if (!seenIds.has(item.id)) {
            result.push(item);
        }
    }
    return result;
};

app.get('/api/items', (req, res) => {
    const page = parseInt(req.query.page as string || '0');
    const limit = parseInt(req.query.limit as string || '20');
    const searchTerm = (req.query.search as string || '').toLowerCase();
    let currentItems: Item[] = [...ALL_ITEMS];
    if (searchTerm) {
        currentItems = currentItems.filter(item => item.value.toString().includes(searchTerm));
    }
    const activeOrder = serverState.dragDropOrder.get(searchTerm);
    if (activeOrder && activeOrder.length > 0) {
        currentItems = applyOrder(currentItems, activeOrder);
    }
    const startIndex = page * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = currentItems.slice(startIndex, endIndex);
    res.json({
        items: paginatedItems,
        total: currentItems.length,
        hasMore: endIndex < currentItems.length
    });
});

app.post('/api/save-selection', (req, res) => {
    const { selectedIds } = req.body;
    if (Array.isArray(selectedIds)) {
        serverState.selectedItemIds = new Set(selectedIds);
        console.log('Selected items saved:', Array.from(serverState.selectedItemIds));
        res.status(200).json({ message: 'Selected items saved successfully.' });
    } else {
        res.status(400).json({ message: 'Invalid data format for selectedIds.' });
    }
});

app.post('/api/save-order', (req, res) => {
    const { order, searchTerm } = req.body;
    if (Array.isArray(order) && typeof searchTerm === 'string') {
        serverState.dragDropOrder.set(searchTerm.toLowerCase(), order);
        console.log(`Item order saved for search term "${searchTerm}":`, order.slice(0, 50), '...');
        res.status(200).json({ message: 'Item order saved successfully.' });
    } else {
        res.status(400).json({ message: 'Invalid data format for order or searchTerm.' });
    }
});

app.get('/api/initial-state', (req, res) => {
    const limit = 20;
    let initialItemsToReturn: Item[] = [];
    let initialSearchTerm = serverState.lastActiveSearchTerm;
    let itemsForInitialLoad: Item[] = [...ALL_ITEMS];
    if (initialSearchTerm) {
        itemsForInitialLoad = itemsForInitialLoad.filter(item => item.value.toString().includes(initialSearchTerm.toLowerCase()));
    }
    const activeOrder = serverState.dragDropOrder.get(initialSearchTerm.toLowerCase());
    if (activeOrder && activeOrder.length > 0) {
        itemsForInitialLoad = applyOrder(itemsForInitialLoad, activeOrder);
    }
    initialItemsToReturn = itemsForInitialLoad.slice(0, limit);
    res.json({
        selectedItemIds: Array.from(serverState.selectedItemIds),
        initialItems: initialItemsToReturn,
        lastActiveSearchTerm: initialSearchTerm,
        hasMore: itemsForInitialLoad.length > limit
    });
});

app.post('/api/set-active-search-term', (req, res) => {
    const { searchTerm } = req.body;
    if (typeof searchTerm === 'string') {
        serverState.lastActiveSearchTerm = searchTerm.toLowerCase();
        console.log('Last active search term set to:', serverState.lastActiveSearchTerm);
        res.status(200).json({ message: 'Last active search term updated.' });
    } else {
        res.status(400).json({ message: 'Invalid data format for searchTerm.' });
    }
});

app.post('/api/reset-sort-order', (req, res) => {
    serverState.dragDropOrder.delete('');
    console.log('Global sort order reset.');
    res.status(200).json({ message: 'Global sort order reset successfully.' });
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    console.log(`Generated ${ALL_ITEMS.length} dummy items.`);
});
