// ==================== SUPABASE AUTH & REALTIME INTEGRATION ====================
// This file contains the Supabase Auth and Realtime integration for CC & LUCIA

// ==================== CONFIGURATION ====================
// Credentials can be set in localStorage via setup.html or manually
const DEFAULT_SUPABASE_URL = 'https://dttsnjozyjfwaikmmazf.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0dHNuam96eWpmd2Fpa21tYXpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTczNDEsImV4cCI6MjA4NjM5MzM0MX0.UTy8vzMzSY2_szeqdi2bbxvDfEYLT_fzMaPTd-v0JW4';

// Get credentials from localStorage or use defaults
const SUPABASE_URL = localStorage.getItem('supabase_url') || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = localStorage.getItem('supabase_key') || DEFAULT_SUPABASE_ANON_KEY;

// ==================== SUPABASE CLIENT ====================
let supabase = null;
let realtimeSubscriptions = [];

// ==================== INITIALIZATION ====================
function initSupabase() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || 
        SUPABASE_URL === 'https://your-project.supabase.co' ||
        SUPABASE_ANON_KEY === 'your-anon-key') {
        console.warn('Supabase not configured. Please set your Supabase credentials.');
        updateSyncStatus('offline', 'Supabase Not Configured');
        return false;
    }
    
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            },
            realtime: {
                params: {
                    eventsPerSecond: 10
                }
            }
        });
        
        console.log('Supabase initialized successfully');
        updateSyncStatus('synced', 'Connected to Supabase');
        
        // Check for existing session
        checkSupabaseSession();
        
        return true;
    } catch (error) {
        console.error('Failed to initialize Supabase:', error);
        updateSyncStatus('error', 'Connection Failed');
        return false;
    }
}

// ==================== AUTHENTICATION ====================
async function checkSupabaseSession() {
    if (!supabase) return;
    
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error('Session check error:', error);
            return;
        }
        
        if (session) {
            console.log('Existing Supabase session found');
            await loadUserProfile(session.user);
        }
    } catch (error) {
        console.error('Session check failed:', error);
    }
}

async function loadUserProfile(authUser) {
    if (!supabase || !authUser) return;
    
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();
        
        if (error) {
            console.error('Profile load error:', error);
            return;
        }
        
        if (profile) {
            currentUser = {
                id: authUser.id,
                email: profile.email,
                name: profile.name,
                role: profile.role,
                unit: profile.unit,
                expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            };
            
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showApp();
            
            // Subscribe to real-time updates
            subscribeToRealtimeUpdates();
            
            // Sync data from Supabase
            await syncFromSupabase();
            
            showToast(`Welcome back, ${profile.name}!`, 'success');
        }
    } catch (error) {
        console.error('Profile load failed:', error);
    }
}

async function handleSupabaseLogin(e) {
    e.preventDefault();
    showLoading(true);
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!supabase) {
        // Fallback to local auth if Supabase not configured
        handleLocalLogin(email, password);
        return;
    }
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            showToast(error.message, 'error');
            showLoading(false);
            return;
        }
        
        if (data.user) {
            await loadUserProfile(data.user);
            logActivity('login', `User logged in: ${data.user.email}`);
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Login failed. Please try again.', 'error');
    }
    
    showLoading(false);
}

async function handleSupabaseSignup(e) {
    e.preventDefault();
    showLoading(true);
    
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const role = document.getElementById('selected-role').value;
    const unit = document.getElementById('signup-unit').value;
    
    if (!role) {
        showToast('Please select a role', 'error');
        showLoading(false);
        return;
    }
    
    if (role === 'buyer' && !unit) {
        showToast('Please select a unit', 'error');
        showLoading(false);
        return;
    }
    
    if (!supabase) {
        showToast('Supabase not configured. Please set up Supabase first.', 'error');
        showLoading(false);
        return;
    }
    
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                    role,
                    unit: role === 'buyer' ? unit : null
                }
            }
        });
        
        if (error) {
            showToast(error.message, 'error');
            showLoading(false);
            return;
        }
        
        if (data.user) {
            document.getElementById('verification-email').textContent = email;
            document.getElementById('verification-alert').style.display = 'block';
            showToast('Account created! Please check your email to verify.', 'success');
            switchAuthTab('login');
        }
    } catch (error) {
        console.error('Signup error:', error);
        showToast('Signup failed. Please try again.', 'error');
    }
    
    showLoading(false);
}

async function handleSupabaseLogout() {
    if (supabase) {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    
    // Unsubscribe from real-time updates
    unsubscribeFromRealtimeUpdates();
    
    // Clear local user data
    currentUser = null;
    localStorage.removeItem('currentUser');
    
    // Show auth section
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('app-layout').classList.add('hidden');
    
    showToast('Logged out successfully', 'success');
}

// ==================== REALTIME SUBSCRIPTIONS ====================
function subscribeToRealtimeUpdates() {
    if (!supabase) return;
    
    console.log('Subscribing to real-time updates...');
    
    // Subscribe to inventory changes
    const inventorySubscription = supabase
        .channel('inventory-changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'inventory' },
            handleInventoryChange
        )
        .subscribe();
    
    realtimeSubscriptions.push(inventorySubscription);
    
    // Subscribe to orders changes
    const ordersSubscription = supabase
        .channel('orders-changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            handleOrdersChange
        )
        .subscribe();
    
    realtimeSubscriptions.push(ordersSubscription);
    
    // Subscribe to messages changes
    const messagesSubscription = supabase
        .channel('messages-changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'messages' },
            handleMessagesChange
        )
        .subscribe();
    
    realtimeSubscriptions.push(messagesSubscription);
    
    // Subscribe to prep sheets changes
    const prepSheetsSubscription = supabase
        .channel('prep-sheets-changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'prep_sheets' },
            handlePrepSheetsChange
        )
        .subscribe();
    
    realtimeSubscriptions.push(prepSheetsSubscription);
    
    console.log('Real-time subscriptions active');
    updateSyncStatus('synced', 'Real-time Sync Active');
}

function unsubscribeFromRealtimeUpdates() {
    realtimeSubscriptions.forEach(subscription => {
        try {
            subscription.unsubscribe();
        } catch (error) {
            console.error('Unsubscribe error:', error);
        }
    });
    
    realtimeSubscriptions = [];
    console.log('Unsubscribed from real-time updates');
}

// ==================== REALTIME HANDLERS ====================
function handleInventoryChange(payload) {
    console.log('Inventory change received:', payload);
    
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    switch (eventType) {
        case 'INSERT':
            // Add new item if not exists
            if (!inventory.find(item => item.id === newRecord.id)) {
                inventory.push(transformInventoryFromSupabase(newRecord));
            }
            break;
        
        case 'UPDATE':
            // Update existing item
            const index = inventory.findIndex(item => item.id === newRecord.id);
            if (index > -1) {
                inventory[index] = transformInventoryFromSupabase(newRecord);
            }
            break;
        
        case 'DELETE':
            // Remove deleted item
            inventory = inventory.filter(item => item.id !== oldRecord.id);
            break;
    }
    
    // Update UI
    renderStock();
    renderOrderItems();
    updateDashboardStockAlerts();
    
    // Show notification
    if (eventType === 'UPDATE') {
        showToast(`Stock updated: ${newRecord.name}`, 'info');
    }
    
    // Save to localStorage
    localStorage.setItem('inventory', JSON.stringify(inventory));
}

function handleOrdersChange(payload) {
    console.log('Orders change received:', payload);
    
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    switch (eventType) {
        case 'INSERT':
            if (!orders.find(order => order.id === newRecord.id)) {
                orders.push(transformOrderFromSupabase(newRecord));
            }
            break;
        
        case 'UPDATE':
            const index = orders.findIndex(order => order.id === newRecord.id);
            if (index > -1) {
                orders[index] = transformOrderFromSupabase(newRecord);
            }
            break;
        
        case 'DELETE':
            orders = orders.filter(order => order.id !== oldRecord.id);
            break;
    }
    
    // Update UI
    renderDeliveryTracker();
    renderAllOrders();
    updateDashboardStats();
    
    // Show notification for new orders
    if (eventType === 'INSERT' && newRecord.user_id !== currentUser?.id) {
        showToast(`New order received: ${newRecord.invoice_number}`, 'success');
    }
    
    // Save to localStorage
    localStorage.setItem('orders', JSON.stringify(orders));
}

function handleMessagesChange(payload) {
    console.log('Messages change received:', payload);
    
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    switch (eventType) {
        case 'INSERT':
            if (!messages.find(msg => msg.id === newRecord.id)) {
                messages.push(transformMessageFromSupabase(newRecord));
            }
            break;
        
        case 'UPDATE':
            const index = messages.findIndex(msg => msg.id === newRecord.id);
            if (index > -1) {
                messages[index] = transformMessageFromSupabase(newRecord);
            }
            break;
        
        case 'DELETE':
            messages = messages.filter(msg => msg.id !== oldRecord.id);
            break;
    }
    
    // Update UI
    renderMessages();
    updateMessageBadge();
    
    // Show notification for new messages
    if (eventType === 'INSERT' && newRecord.from_user_id !== currentUser?.id) {
        const isUrgent = newRecord.is_urgent;
        showToast(
            `New message from ${newRecord.from_name}: ${newRecord.subject}`,
            isUrgent ? 'error' : 'info'
        );
    }
    
    // Save to localStorage
    localStorage.setItem('messages', JSON.stringify(messages));
}

function handlePrepSheetsChange(payload) {
    console.log('Prep sheets change received:', payload);
    
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    switch (eventType) {
        case 'INSERT':
        case 'UPDATE':
            prepSheets[newRecord.id] = transformPrepSheetFromSupabase(newRecord);
            break;
        
        case 'DELETE':
            delete prepSheets[oldRecord.id];
            break;
    }
    
    // Update UI
    renderPrepDailyView();
    updatePrepStats();
    updateDashboardPrepSummary();
    
    // Save to localStorage
    localStorage.setItem('prepSheets', JSON.stringify(prepSheets));
}

// ==================== DATA TRANSFORMATION ====================
function transformInventoryFromSupabase(record) {
    return {
        id: record.id,
        name: record.name,
        category: record.category,
        unit: record.unit,
        cost: parseFloat(record.cost),
        minStock: record.min_stock,
        stock: record.stock,
        maxOrder: record.max_order,
        meatCategory: record.meat_category
    };
}

function transformInventoryToSupabase(item) {
    return {
        id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        cost: item.cost,
        min_stock: item.minStock,
        stock: item.stock,
        max_order: item.maxOrder || 0,
        meat_category: item.meatCategory,
        updated_at: new Date().toISOString()
    };
}

function transformOrderFromSupabase(record) {
    return {
        id: record.id,
        invoiceNumber: record.invoice_number,
        items: record.items,
        subtotal: parseFloat(record.subtotal),
        vat: parseFloat(record.vat),
        total: parseFloat(record.total),
        unit: record.unit,
        userName: record.user_name,
        userId: record.user_id,
        date: record.date,
        taxWeek: record.tax_week,
        status: record.status,
        completedAt: record.completed_at
    };
}

function transformOrderToSupabase(order) {
    return {
        id: order.id,
        invoice_number: order.invoiceNumber,
        items: order.items,
        subtotal: order.subtotal,
        vat: order.vat,
        total: order.total,
        unit: order.unit,
        user_name: order.userName,
        user_id: order.userId,
        date: order.date,
        tax_week: order.taxWeek,
        status: order.status,
        completed_at: order.completedAt,
        updated_at: new Date().toISOString()
    };
}

function transformMessageFromSupabase(record) {
    return {
        id: record.id,
        from: record.from_user_id,
        fromName: record.from_name,
        fromUnit: record.from_unit,
        to: record.to_user_id,
        toRole: record.to_role,
        subject: record.subject,
        body: record.body,
        urgent: record.is_urgent,
        read: record.is_read,
        readAt: record.read_at,
        date: record.created_at
    };
}

function transformMessageToSupabase(msg) {
    return {
        from_user_id: msg.from,
        from_name: msg.fromName,
        from_unit: msg.fromUnit,
        to_user_id: msg.to,
        to_role: msg.toRole,
        subject: msg.subject,
        body: msg.body,
        is_urgent: msg.urgent,
        is_read: msg.read,
        read_at: msg.readAt
    };
}

function transformPrepSheetFromSupabase(record) {
    return {
        date: record.date,
        items: record.items,
        createdAt: record.created_at,
        updatedAt: record.updated_at
    };
}

function transformPrepSheetToSupabase(sheet, dateKey) {
    return {
        id: dateKey,
        date: dateKey,
        items: sheet.items,
        updated_at: new Date().toISOString()
    };
}

// ==================== SYNC FUNCTIONS ====================
async function syncFromSupabase() {
    if (!supabase) {
        console.warn('Supabase not initialized');
        return;
    }
    
    showLoading(true);
    updateSyncStatus('syncing', 'Syncing from cloud...');
    
    try {
        // Sync inventory
        const { data: inventoryData, error: inventoryError } = await supabase
            .from('inventory')
            .select('*');
        
        if (inventoryError) throw inventoryError;
        
        if (inventoryData) {
            inventory = inventoryData.map(transformInventoryFromSupabase);
            localStorage.setItem('inventory', JSON.stringify(inventory));
        }
        
        // Sync orders
        const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (ordersError) throw ordersError;
        
        if (ordersData) {
            orders = ordersData.map(transformOrderFromSupabase);
            localStorage.setItem('orders', JSON.stringify(orders));
        }
        
        // Sync messages
        const { data: messagesData, error: messagesError } = await supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (messagesError) throw messagesError;
        
        if (messagesData) {
            messages = messagesData.map(transformMessageFromSupabase);
            localStorage.setItem('messages', JSON.stringify(messages));
        }
        
        // Sync prep sheets
        const { data: prepData, error: prepError } = await supabase
            .from('prep_sheets')
            .select('*');
        
        if (prepError) throw prepError;
        
        if (prepData) {
            prepSheets = {};
            prepData.forEach(record => {
                prepSheets[record.id] = transformPrepSheetFromSupabase(record);
            });
            localStorage.setItem('prepSheets', JSON.stringify(prepSheets));
        }
        
        // Update UI
        renderStock();
        renderOrderItems();
        renderDeliveryTracker();
        renderMessages();
        updateDashboardStats();
        
        updateSyncStatus('synced', 'Synced with cloud');
        showToast('Data synced from cloud successfully!', 'success');
        
    } catch (error) {
        console.error('Sync from Supabase failed:', error);
        updateSyncStatus('error', 'Sync failed');
        showToast('Sync failed: ' + error.message, 'error');
    }
    
    showLoading(false);
}

async function syncToSupabase(showNotification = true) {
    if (!supabase) {
        console.warn('Supabase not initialized');
        return;
    }
    
    if (showNotification) showLoading(true);
    updateSyncStatus('syncing', 'Syncing to cloud...');
    
    try {
        // Sync inventory
        for (const item of inventory) {
            const { error } = await supabase
                .from('inventory')
                .upsert(transformInventoryToSupabase(item));
            
            if (error) console.error('Inventory sync error:', error);
        }
        
        // Sync orders
        for (const order of orders) {
            const { error } = await supabase
                .from('orders')
                .upsert(transformOrderToSupabase(order));
            
            if (error) console.error('Order sync error:', error);
        }
        
        // Sync messages
        for (const msg of messages) {
            if (typeof msg.id === 'string' && msg.id.startsWith('msg-')) {
                // Local message, insert to Supabase
                const { error } = await supabase
                    .from('messages')
                    .insert(transformMessageToSupabase(msg));
                
                if (error) console.error('Message sync error:', error);
            }
        }
        
        // Sync prep sheets
        for (const [dateKey, sheet] of Object.entries(prepSheets)) {
            const { error } = await supabase
                .from('prep_sheets')
                .upsert(transformPrepSheetToSupabase(sheet, dateKey));
            
            if (error) console.error('Prep sheet sync error:', error);
        }
        
        updateSyncStatus('synced', 'Synced with cloud');
        if (showNotification) {
            showToast('Data synced to cloud successfully!', 'success');
        }
        
    } catch (error) {
        console.error('Sync to Supabase failed:', error);
        updateSyncStatus('error', 'Sync failed');
        if (showNotification) {
            showToast('Sync failed: ' + error.message, 'error');
        }
    }
    
    if (showNotification) showLoading(false);
}

// ==================== STOCK UPDATE WITH REALTIME ====================
async function updateStockRealtime(productId, newStock) {
    // Update local first
    const product = inventory.find(p => p.id === productId);
    if (product) {
        product.stock = newStock;
        saveAllData();
        renderStock();
    }
    
    // Sync to Supabase
    if (supabase) {
        try {
            const { error } = await supabase
                .from('inventory')
                .update({ 
                    stock: newStock,
                    updated_at: new Date().toISOString()
                })
                .eq('id', productId);
            
            if (error) {
                console.error('Stock update error:', error);
            } else {
                console.log('Stock updated in Supabase:', productId, newStock);
            }
        } catch (error) {
            console.error('Stock update failed:', error);
        }
    }
}

// ==================== ORDER PLACEMENT WITH REALTIME ====================
async function placeOrderRealtime(order) {
    // Add to local first
    orders.push(order);
    saveAllData();
    
    // Sync to Supabase
    if (supabase) {
        try {
            const { error } = await supabase
                .from('orders')
                .insert(transformOrderToSupabase(order));
            
            if (error) {
                console.error('Order insert error:', error);
            } else {
                console.log('Order placed in Supabase:', order.invoiceNumber);
            }
        } catch (error) {
            console.error('Order placement failed:', error);
        }
    }
}

// ==================== MESSAGE SENDING WITH REALTIME ====================
async function sendMessageRealtime(message) {
    // Add to local first
    messages.push(message);
    saveAllData();
    
    // Sync to Supabase
    if (supabase) {
        try {
            const { error } = await supabase
                .from('messages')
                .insert(transformMessageToSupabase(message));
            
            if (error) {
                console.error('Message send error:', error);
            } else {
                console.log('Message sent via Supabase');
            }
        } catch (error) {
            console.error('Message send failed:', error);
        }
    }
}

// ==================== HELPER FUNCTIONS ====================
function updateSyncStatus(status, text) {
    const syncStatus = document.getElementById('sync-status');
    const syncText = document.getElementById('sync-text');
    
    if (syncStatus && syncText) {
        syncStatus.className = 'sync-status-indicator ' + status;
        syncText.textContent = text;
    }
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = show ? 'flex' : 'none';
    }
}

// ==================== FALLBACK LOCAL AUTH ====================
function handleLocalLogin(email, password) {
    // Fallback to local auth if Supabase not configured
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        currentUser = { 
            ...user, 
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() 
        };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showApp();
        logActivity('login', `User logged in: ${user.name} (${user.role})`);
        showToast('Welcome back, ' + user.name + '!', 'success');
    } else if (email === 'admin@cc.com' && password === 'admin123') {
        currentUser = { 
            name: 'Admin', 
            email: 'admin@cc.com', 
            role: 'admin',
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showApp();
        logActivity('login', 'Admin logged in');
        showToast('Welcome, Admin!', 'success');
    } else if (email === 'buyer@cc.com' && password === 'buyer123') {
        currentUser = { 
            name: 'Demo Buyer', 
            email: 'buyer@cc.com', 
            role: 'buyer',
            unit: 'CC YORK',
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showApp();
        logActivity('login', 'Demo Buyer logged in (CC YORK)');
        showToast('Welcome, Demo Buyer!', 'success');
    } else {
        showToast('Invalid credentials', 'error');
    }
    
    showLoading(false);
}