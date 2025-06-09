import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

const app = express();
const PORT = process.env.PORT || 5000; 

// Middleware
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
    itemOrder: number[];
}

const serverState: ServerState = {
    selectedItemIds: new Set<number>(),
    itemOrder: []
};

app.get('/api/items', (req, res) => {
    const page = parseInt(req.query.page as string || '0');
    const limit = parseInt(req.query.limit as string || '20');
    const searchTerm = (req.query.search as string || '').toLowerCase();
    const sortedIdsParam = req.query.sortedIds as string;

    let filteredItems: Item[] = [];

    if (searchTerm) {
        filteredItems = ALL_ITEMS.filter(item => item.value.toString().includes(searchTerm));
    } else {
        filteredItems = [...ALL_ITEMS];
    }

    if (page === 0 && !searchTerm && serverState.itemOrder.length > 0) {
        const itemsInOrder = serverState.itemOrder
            .map(id => ALL_ITEMS.find(item => item.id === id))
            .filter((item): item is Item => item !== undefined);

        const remainingItems = filteredItems.filter(item => !serverState.itemOrder.includes(item.id));
        filteredItems = [...itemsInOrder, ...remainingItems];
    }
    
    if (page === 0 && !searchTerm && serverState.itemOrder.length > 0) {
        const initialOrderedItems: Item[] = [];
        const seenIds = new Set<number>();

        for (const id of serverState.itemOrder) {
            const item = ALL_ITEMS[id - 1];
            if (item && initialOrderedItems.length < limit) {
                initialOrderedItems.push(item);
                seenIds.add(item.id);
            } else if (initialOrderedItems.length >= limit) {
                break;
            }
        }
        
        const remainingItemsForPage = filteredItems.filter(item => !seenIds.has(item.id))
            .slice(0, limit - initialOrderedItems.length);
        
        filteredItems = [...initialOrderedItems, ...remainingItemsForPage];
    }


    const startIndex = page * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = filteredItems.slice(startIndex, endIndex);

    res.json({
        items: paginatedItems,
        total: filteredItems.length,
        hasMore: endIndex < filteredItems.length
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
    const { order } = req.body;
    if (Array.isArray(order)) {
        serverState.itemOrder = order;
        console.log('Item order saved:', serverState.itemOrder.slice(0, 50), '...');
        res.status(200).json({ message: 'Item order saved successfully.' });
    } else {
        res.status(400).json({ message: 'Invalid data format for order.' });
    }
});

app.get('/api/initial-state', (req, res) => {
    const orderedItemsForInitialLoad: Item[] = [];
    const limit = 20;

    if (serverState.itemOrder.length > 0) {
        for (let i = 0; i < Math.min(limit, serverState.itemOrder.length); i++) {
            const itemId = serverState.itemOrder[i];
            const item = ALL_ITEMS[itemId - 1];
            if (item) {
                orderedItemsForInitialLoad.push(item);
            }
        }
    }

    if (orderedItemsForInitialLoad.length < limit) {
        const existingIds = new Set(orderedItemsForInitialLoad.map(item => item.id));
        let count = orderedItemsForInitialLoad.length;
        for (const item of ALL_ITEMS) {
            if (!existingIds.has(item.id) && count < limit) {
                orderedItemsForInitialLoad.push(item);
                count++;
            } else if (count >= limit) {
                break;
            }
        }
    }


    res.json({
        selectedItemIds: Array.from(serverState.selectedItemIds),
        initialItems: orderedItemsForInitialLoad,
        hasMore: ALL_ITEMS.length > limit
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});