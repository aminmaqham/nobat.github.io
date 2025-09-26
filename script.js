document.addEventListener('DOMContentLoaded', () => {
    // --- APPWRITE SETUP (FINAL & VERIFIED IDs) ---
    const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
    const APPWRITE_PROJECT_ID = '68a8d1b0000e80bdc1f3';
    const DATABASE_ID = '68a8d24b003cd6609e37';
    const SERVICES_COLLECTION_ID = '68a8d28b002ce97317ae';
    const TICKETS_COLLECTION_ID = '68a8d63a003a3a6afa24';

    const { Client, Account, Databases, ID, Query, Permission, Role } = Appwrite;

    const client = new Client();
    client
        .setEndpoint(APPWRITE_ENDPOINT)
        .setProject(APPWRITE_PROJECT_ID);

    const account = new Account(client);
    const databases = new Databases(client);

    // --- DOM Elements ---
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const resetAllBtn = document.getElementById('reset-all-btn');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const userGreeting = document.getElementById('user-greeting');
    const loginFields = document.getElementById('login-fields');
    const userInfo = document.getElementById('user-info');
    const mainContent = document.getElementById('main-content');
    const serviceButtonsContainer = document.querySelector('.service-buttons');
    const ticketForm = document.getElementById('ticket-form');
    const callNextBtn = document.getElementById('call-next-btn');
    const passTicketBtn = document.getElementById('pass-ticket-btn');
    const serviceCheckboxes = document.getElementById('service-checkboxes');
    const currentTicketDisplay = document.getElementById('current-ticket');
    const popupNotification = document.getElementById('popup-notification');
    const popupText = document.getElementById('popup-text');
    const totalWaitingContainer = document.getElementById('total-waiting-container');
    const ticketHistoryTable = document.querySelector('#ticket-history tbody');
    const submitTicketBtn = document.getElementById('submit-ticket');
    const cancelTicketBtn = document.getElementById('cancel-ticket');
    const ticketFormTitle = document.getElementById('ticket-form-title');
    const adminPanel = document.getElementById('admin-panel');
    const serviceList = document.getElementById('service-list');
    const addServiceBtn = document.getElementById('add-service-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings');
    const cancelSettingsBtn = document.getElementById('cancel-settings-btn');
    const passServiceModalOverlay = document.getElementById('pass-service-modal-overlay');
    const passServiceList = document.getElementById('pass-service-list');
    const confirmPassServiceBtn = document.getElementById('confirm-pass-service');
    const cancelPassServiceBtn = document.getElementById('cancel-pass-service');

    // --- Application State ---
    let currentUser = null;
    let services = [];
    let tickets = [];
    let tempSelectedServicesForPass = [];
    let lastCalledTicket = {};

    // --- UTILITY FUNCTIONS ---
    function checkCodeMeli(code) {
        if (!code) return true;
        code = code.toString().replace(/\D/g, '');
        if (code.length !== 10 || /^(\d)\1{9}$/.test(code)) return false;
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(code.charAt(i)) * (10 - i);
        }
        const lastDigit = parseInt(code.charAt(9));
        const remainder = sum % 11;
        return (remainder < 2) ? (lastDigit === remainder) : (lastDigit === (11 - remainder));
    }

    // --- INITIALIZATION ---
    async function initializeApp() {
        try {
            currentUser = await account.get();
            showLoggedInUI();
            await fetchData();
            setupRealtimeSubscriptions();
            checkAutoReset();
        } catch (error) {
            console.log('User not logged in');
            showLoggedOutUI();
        }
    }

    async function fetchData() {
        if (!currentUser) return;
        await Promise.all([fetchServices(), fetchTickets()]);
        renderUI();
    }

    async function fetchServices() {
        try {
            const response = await databases.listDocuments(DATABASE_ID, SERVICES_COLLECTION_ID, [Query.orderAsc('name')]);
            services = response.documents;
        } catch (error) {
            console.error('Error fetching services:', error);
        }
    }

    async function fetchTickets() {
        try {
            const response = await databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID, [
                Query.orderDesc('$createdAt'),
                Query.limit(100)
            ]);
            tickets = response.documents;
        } catch (error) {
            console.error('Error fetching tickets:', error);
        }
    }

    function renderUI() {
        if (!currentUser) return;
        renderServiceButtons();
        updateServiceCheckboxes();
        updateHistoryTable();
        updateCurrentTicketDisplay();
        updateTotalWaitingCount();
    }

    // --- AUTHENTICATION & UI TOGGLES ---
    async function login() {
        try {
            await account.createEmailSession(emailInput.value, passwordInput.value);
            initializeApp();
        } catch (error) {
            alert('خطا در ورود: ' + error.message);
        }
    }

    async function logout() {
        try {
            await account.deleteSession('current');
            currentUser = null;
            window.location.reload();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }

    function showLoggedInUI() {
        loginFields.style.display = 'none';
        userInfo.style.display = 'flex';
        userGreeting.textContent = `کاربر: ${currentUser.name || currentUser.email}`;
        mainContent.style.display = 'block';
        totalWaitingContainer.style.display = 'block';

        if (currentUser.prefs && currentUser.prefs.role === 'admin') {
            settingsBtn.style.display = 'inline-block';
            resetAllBtn.style.display = 'inline-block';
        } else {
            settingsBtn.style.display = 'none';
            resetAllBtn.style.display = 'none';
        }
    }

    function showLoggedOutUI() {
        loginFields.style.display = 'flex';
        userInfo.style.display = 'none';
        mainContent.style.display = 'none';
        totalWaitingContainer.style.display = 'none';
    }

    // --- REALTIME ---
    function setupRealtimeSubscriptions() {
        const ticketChannel = `databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents`;
        client.subscribe(ticketChannel, () => fetchData());
        const serviceChannel = `databases.${DATABASE_ID}.collections.${SERVICES_COLLECTION_ID}.documents`;
        client.subscribe(serviceChannel, () => fetchData());
    }

    // --- UI RENDERING ---
    function updateTotalWaitingCount() {
        const waitingCount = tickets.filter(t => t.status === 'در حال انتظار').length;
        document.getElementById('total-waiting-count').textContent = waitingCount;
    }

    function renderServiceButtons() {
        serviceButtonsContainer.innerHTML = '';
        services.forEach(service => {
            if (service.disabled) return; // Skip disabled services
            
            const button = document.createElement('button');
            button.className = 'service-btn';
            const waitingCount = tickets.filter(t => t.service_id === service.$id && t.status === 'در حال انتظار').length;
            button.innerHTML = `
                <div>
                    <div class="service-name">${service.name}</div>
                    <div class="waiting-count">منتظران: ${waitingCount}</div>
                </div>
                <div class="estimation-time">تخمین زمان: ${Math.round(service.manual_time)} دقیقه</div>
            `;
            button.addEventListener('click', () => checkAvailabilityAndOpenForm(service.$id));
            serviceButtonsContainer.appendChild(button);
        });
    }

    async function updateServiceCheckboxes() {
        if (!currentUser) return;
        serviceCheckboxes.innerHTML = '';
        const userPrefs = currentUser.prefs || {};
        const selections = userPrefs.service_selections || {};

        services.forEach(service => {
            if (service.disabled) return; // Skip disabled services
            
            const div = document.createElement('div');
            div.className = 'service-checkbox';
            div.innerHTML = `<input type="checkbox" id="service-check-${service.$id}" value="${service.$id}">
                             <label for="service-check-${service.$id}">${service.name}</label>`;
            const checkbox = div.querySelector('input');
            checkbox.checked = selections[service.$id] || false;
            checkbox.addEventListener('change', async () => {
                selections[service.$id] = checkbox.checked;
                try {
                    await account.updatePrefs({ ...userPrefs, service_selections: selections });
                    currentUser.prefs = await account.getPrefs();
                } catch (e) {
                    console.error("Failed to save preferences", e);
                }
            });
            serviceCheckboxes.appendChild(div);
        });
    }

    function updateHistoryTable() {
        ticketHistoryTable.innerHTML = '';
        tickets.forEach(ticket => {
            const service = services.find(s => s.$id === ticket.service_id);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${ticket.general_ticket || 'پاس'}</td>
                <td>${ticket.specific_ticket || 'پاس'}</td>
                <td>${ticket.first_name} ${ticket.last_name}</td>
                <td>${ticket.national_id || '---'}</td>
                <td>${service ? service.name : '---'}</td>
                <td>${ticket.registered_by_name || '---'}</td>
                <td>${formatDate(ticket.$createdAt)}</td>
                <td>${ticket.called_by_name || '---'}</td>
                <td>${formatDate(ticket.call_time)}</td>
                <td>${ticket.status}</td>
            `;
            ticketHistoryTable.appendChild(row);
        });
    }

    function updateCurrentTicketDisplay() {
        currentTicketDisplay.innerHTML = '';
        const activeTickets = tickets
            .filter(t => t.status === 'در حال سرویس')
            .sort((a, b) => new Date(b.call_time) - new Date(a.call_time));
        
        activeTickets.slice(0, 3).forEach(ticket => {
            const service = services.find(s => s.$id === ticket.service_id);
            const div = document.createElement('div');
            div.className = 'current-ticket-item';
            div.innerHTML = `
                <h3>${service ? service.name : ''}</h3>
                <p><strong>نوبت:</strong> ${ticket.specific_ticket || 'پاس'}</p>
                <p><strong>نام:</strong> ${ticket.first_name} ${ticket.last_name}</p>
                <p><strong>زمان فراخوان:</strong> ${formatDate(ticket.call_time)}</p>
            `;
            currentTicketDisplay.appendChild(div);
        });

        if (activeTickets.length === 0) {
            currentTicketDisplay.innerHTML = '<p>هیچ نوبتی در حال سرویس نیست</p>';
        }
    }
    
    // --- Estimation Logic ---
    function calculateEstimatedWaitTime(serviceId) {
        const service = services.find(s => s.$id === serviceId);
        if (!service) return 0;
        
        const timePerTicket = service.manual_time;
        const queueLength = tickets.filter(t => t.service_id === service.$id && t.status === 'در حال انتظار').length;
        
        return queueLength * timePerTicket;
    }

    async function checkAvailabilityAndOpenForm(serviceId) {
        const service = services.find(s => s.$id === serviceId);
        if (!service) return;

        // Check if service is disabled
        if (service.disabled) {
            showPopupNotification('<p>این خدمت در حال حاضر غیرفعال است.</p>');
            return;
        }

        const estimatedWait = calculateEstimatedWaitTime(serviceId);
        const now = new Date();
        const endTimeParts = (service.work_hours_end || "17:00").split(':');
        const
