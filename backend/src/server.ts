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
    globalItemOrder: number[];
    lastActiveSearchTerm: string;
}

const serverState: ServerState = {
    selectedItemIds: new Set<number>(),
    globalItemOrder: ALL_ITEMS.map(item => item.id),
    lastActiveSearchTerm: ''
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

    let currentOrderedGlobalItems: Item[] = [];
    for (const id of serverState.globalItemOrder) {
        const item = getItemById(id);
        if (item) {
            currentOrderedGlobalItems.push(item);
        }
    }

    let workingItems: Item[] = currentOrderedGlobalItems;

    if (searchTerm) {
        workingItems = workingItems.filter(item => item.value.toString().includes(searchTerm));
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
    const { draggedId, targetId } = req.body;
    if (typeof draggedId === 'number' && typeof targetId === 'number') {
        const newOrder = [...serverState.globalItemOrder];
        const draggedIndex = newOrder.indexOf(draggedId);
        const targetIndex = newOrder.indexOf(targetId);

        if (draggedIndex !== -1 && targetIndex !== -1) {
            const [removed] = newOrder.splice(draggedIndex, 1);
            newOrder.splice(targetIndex, 0, removed);
            serverState.globalItemOrder = newOrder;
            console.log('Global item order updated.');
            res.status(200).json({ message: 'Global item order updated successfully.' });
            return;
        }
    }
    res.status(400).json({ message: 'Invalid data for sorting.' });
});

app.get('/api/initial-state', (req, res) => {
    const limit = 20;
    const initialSearchTerm = serverState.lastActiveSearchTerm;


    let currentOrderedGlobalItems: Item[] = [];
    for (const id of serverState.globalItemOrder) {
        const item = getItemById(id);
        if (item) {
            currentOrderedGlobalItems.push(item);
        }
    }

    let itemsForInitialLoad: Item[] = currentOrderedGlobalItems;

    if (initialSearchTerm) {
        itemsForInitialLoad = itemsForInitialLoad.filter(item => item.value.toString().includes(initialSearchTerm.toLowerCase()));
    }
    
    const initialItemsToReturn = itemsForInitialLoad.slice(0, limit);

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
    serverState.globalItemOrder = ALL_ITEMS.map(item => item.id);
    console.log('Global sort order reset to default.');
    res.status(200).json({ message: 'Global sort order reset successfully.' });
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    console.log(`Generated ${ALL_ITEMS.length} dummy items.`);
});
