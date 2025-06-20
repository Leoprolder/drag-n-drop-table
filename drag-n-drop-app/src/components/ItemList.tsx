import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './ItemList.module.css';

interface Item {
    id: number;
    value: number;
}

const API_BASE_URL = 'https://drag-n-drop-table.onrender.com/api';
const ITEMS_PER_PAGE = 20;
const RELOAD_INTERVAL_MS = 10 * 60 * 1000;

const ItemList: React.FC = () => {
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [page, setPage] = useState<number>(0);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
    const [draggedItem, setDraggedItem] = useState<Item | null>(null);

    const observer = useRef<IntersectionObserver>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const hasMounted = useRef(false);
    const isInitialDataLoadCompleted = useRef(false);

    const lastItemRef = useCallback((node: HTMLDivElement | null) => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prevPage => prevPage + 1);
            }
        }, {
            root: listRef.current,
            threshold: 0.1
        });

        if (node) observer.current.observe(node);
    }, [loading, hasMore]);

    const fetchPaginatedItems = useCallback(async (currentPage: number, currentSearchTerm: string) => {
        setLoading(true);
        try {
            let url = `${API_BASE_URL}/items?page=${currentPage}&limit=${ITEMS_PER_PAGE}`;
            if (currentSearchTerm) {
                url += `&search=${encodeURIComponent(currentSearchTerm)}`;
            }

            const response = await fetch(url);
            const data = await response.json();

            setItems(prevItems => {
                if (currentPage === 0) {
                    return data.items;
                } else {
                    const newItems = data.items.filter((newItem: Item) => !prevItems.some(existingItem => existingItem.id === newItem.id));
                    return [...prevItems, ...newItems];
                }
            });
            setHasMore(data.hasMore);
        } catch (error) {
            console.error("Failed to fetch paginated items:", error);
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            setPage(0);

            try {
                const response = await fetch(`${API_BASE_URL}/initial-state`);
                const data = await response.json();

                setItems(data.initialItems);
                setSelectedItems(new Set(data.selectedItemIds));
                setHasMore(data.hasMore);
                setSearchTerm(data.lastActiveSearchTerm);

                isInitialDataLoadCompleted.current = true;
                hasMounted.current = true;

                await fetch(`${API_BASE_URL}/set-active-search-term`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ searchTerm: data.lastActiveSearchTerm })
                });

            } catch (error) {
                console.error("Failed to load initial state:", error);
                setHasMore(false);
            } finally {
                setLoading(false);
            }
        };

        if (!hasMounted.current) {
            loadInitialData();
        }
    }, []);

    useEffect(() => {
        if (!hasMounted.current || !isInitialDataLoadCompleted.current) {
            return;
        }

        const handler = setTimeout(async () => {
            setLoading(true);
            setPage(0);

            try {
                await fetch(`${API_BASE_URL}/set-active-search-term`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ searchTerm: searchTerm })
                });
            } catch (error) {
                console.error("Failed to set active search term:", error);
            }

            // --- REMOVED: Automatic call to reset-sort-order when search is cleared ---
            // if (searchTerm === '') {
            //     try {
            //         await fetch(`${API_BASE_URL}/reset-sort-order`, {
            //             method: 'POST',
            //         });
            //         console.log('Global sort order reset on backend due to search clear.');
            //     } catch (error) {
            //         console.error("Failed to reset sort order:", error);
            //     }
            // }

            setItems([]);
            fetchPaginatedItems(0, searchTerm);

            setLoading(false);
        }, 300);

        return () => {
            clearTimeout(handler);
        };
    }, [searchTerm, fetchPaginatedItems]);

    useEffect(() => {
        if (page > 0) {
            fetchPaginatedItems(page, searchTerm);
        }
    }, [page, searchTerm, fetchPaginatedItems]);

    useEffect(() => {
        const saveSelection = async () => {
            try {
                await fetch(`${API_BASE_URL}/save-selection`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ selectedIds: Array.from(selectedItems) }),
                });
            } catch (error) {
                console.error("Failed to save selection:", error);
            }
        };

        if (isInitialDataLoadCompleted.current) {
            saveSelection();
        }
    }, [selectedItems]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            console.log('Reloading page to keep backend awake...');
            window.location.reload();
        }, RELOAD_INTERVAL_MS);

        return () => clearInterval(intervalId);
    }, []);


    const handleCheckboxChange = useCallback((id: number) => {
        setSelectedItems(prevSelected => {
            const newSelected = new Set(prevSelected);
            if (newSelected.has(id)) {
                newSelected.delete(id);
            } else {
                newSelected.add(id);
            }
            return newSelected;
        });
    }, []);

    const handleSelectAll = useCallback(() => {
        if (items.length > 0 && selectedItems.size === items.length && items.every(item => selectedItems.has(item.id))) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(prevSelected => {
                const newSelected = new Set(prevSelected);
                items.forEach(item => newSelected.add(item.id));
                return newSelected;
            });
        }
    }, [selectedItems, items]);

    const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, item: Item) => {
        setDraggedItem(item);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.id.toString());
        e.currentTarget.classList.add(styles.dragging);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (e.currentTarget !== draggedItemRef.current) {
            e.currentTarget.classList.add(styles.dragOver);
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove(styles.dragOver);
    }, []);

    const handleDragEnd = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove(styles.dragging);
        document.querySelectorAll(`.${styles.dragOver}`).forEach(el => el.classList.remove(styles.dragOver));
    }, []);

    const draggedItemRef = useRef<HTMLDivElement | null>(null);

    const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>, targetItem: Item) => {
        e.preventDefault();
        e.currentTarget.classList.remove(styles.dragOver);

        if (!draggedItem || draggedItem.id === targetItem.id) {
            setDraggedItem(null);
            return;
        }

        try {
            setLoading(true);
            await fetch(`${API_BASE_URL}/save-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ draggedId: draggedItem.id, targetId: targetItem.id }),
            });
            setItems([]);
            setPage(0);
            fetchPaginatedItems(0, searchTerm);

        } catch (error) {
            console.error("Failed to save order:", error);
        } finally {
            setLoading(false);
            setDraggedItem(null);
        }
    }, [draggedItem, searchTerm, fetchPaginatedItems]);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    }, []);

    return (
        <div className={styles.container}>
            <h1>Список элементов</h1>
            <input
                type="text"
                placeholder="Поиск по значению..."
                value={searchTerm}
                onChange={handleSearchChange}
                className={styles.searchInput}
            />
            <div className={styles.headerRow}>
                <input
                    type="checkbox"
                    checked={items.length > 0 && selectedItems.size === items.length && items.every(item => selectedItems.has(item.id))}
                    onChange={handleSelectAll}
                    className={styles.checkbox}
                />
                <span>ID</span>
                <span>Значение</span>
            </div>
            <div className={styles.itemList} ref={listRef}>
                {items.length === 0 && !loading && searchTerm && <div className={styles.noResults}>По вашему запросу ничего не найдено.</div>}
                {items.map((item, index) => {
                    const isSelected = selectedItems.has(item.id);
                    const isLastItem = index === items.length - 1;

                    return (
                        <div
                            key={item.id}
                            className={`${styles.itemRow} ${isSelected ? styles.selected : ''} ${draggedItem?.id === item.id ? styles.dragging : ''}`}
                            ref={isLastItem ? lastItemRef : null}
                            draggable
                            onDragStart={(e) => { handleDragStart(e, item); draggedItemRef.current = e.currentTarget; }}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, item)}
                            onDragEnd={handleDragEnd}
                        >
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleCheckboxChange(item.id)}
                                className={styles.checkbox}
                            />
                            <div className={styles.itemId}>{item.id}</div>
                            <div className={styles.itemValue}>{item.value}</div>
                        </div>
                    );
                })}
                {loading && <div className={styles.loading}>Загрузка...</div>}
                {!hasMore && !loading && items.length > 0 && !searchTerm && <div className={styles.noMoreItems}>Все элементы загружены.</div>}
                {!hasMore && !loading && items.length > 0 && searchTerm && <div className={styles.noMoreItems}>Все отфильтрованные элементы загружены.</div>}
            </div>
        </div>
    );
};

export default ItemList;
