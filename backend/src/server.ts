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
    itemOrder: number[];
}

const serverState: ServerState = {
    selectedItemIds: new Set<number>(),
    itemOrder: []
};

const getItemById = (id: number): Item | undefined => {
    if (id > 0 && id <= ALL_ITEMS.length) {
        return ALL_ITEMS[id - 1];
    }
    return undefined;
};

app.get('/api/items', (req, res) => {
    const page = parseInt(req.query.page as string || '0');
    const limit = parseInt(req.query.limit as string || '20');
    const searchTerm = (req.query.search as string || '').toLowerCase();

    let workingItems: Item[] = [...ALL_ITEMS];

    if (searchTerm) {
        workingItems = workingItems.filter(item => item.value.toString().includes(searchTerm));
    }

    if (page === 0 && !searchTerm && serverState.itemOrder.length > 0) {
        const orderedSegment: Item[] = [];
        const seenIds = new Set<number>();

        for (const id of serverState.itemOrder) {
            const item = getItemById(id);
            if (item) {
                orderedSegment.push(item);
                seenIds.add(item.id);
            }
        }
        const remainingItems = workingItems.filter(item => !seenIds.has(item.id));
        workingItems = [...orderedSegment, ...remainingItems];
    }

    const startIndex = page * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = workingItems.slice(startIndex, endIndex);

    res.json({
        items: paginatedItems,
        total: workingItems.length,
        hasMore: endIndex < workingItems.length
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
    const limit = 20;
    const initialOrderedItems: Item[] = [];
    const seenIdsInOrder = new Set<number>();

    for (const id of serverState.itemOrder) {
        const item = getItemById(id);
        if (item && initialOrderedItems.length < limit) {
            initialOrderedItems.push(item);
            seenIdsInOrder.add(item.id);
        } else if (initialOrderedItems.length >= limit) {
            break;
        }
    }

    if (initialOrderedItems.length < limit) {
        for (const item of ALL_ITEMS) {
            if (initialOrderedItems.length >= limit) break;
            if (!seenIdsInOrder.has(item.id)) {
                initialOrderedItems.push(item);
                seenIdsInOrder.add(item.id);
            }
        }
    }
    
    const remainingCount = ALL_ITEMS.length - initialOrderedItems.length;
    const hasMore = remainingCount > 0;

    res.json({
        selectedItemIds: Array.from(serverState.selectedItemIds),
        initialItems: initialOrderedItems,
        hasMore: hasMore
    });
});

app.post('/api/reset-sort-order', (req, res) => {
    serverState.itemOrder = [];
    console.log('Sort order reset.');
    res.status(200).json({ message: 'Sort order reset successfully.' });
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    console.log(`Generated ${ALL_ITEMS.length} dummy items.`);
});