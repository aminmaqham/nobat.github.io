document.addEventListener('DOMContentLoaded', () => {
    // --- APPWRITE SETUP (FINAL & VERIFIED IDs) ---
    const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
    const APPWRITE_PROJECT_ID = '68a8d1b0000e80bdc1f3';
    const DATABASE_ID = '68a8d24b003cd6609e37';
    const SERVICES_COLLECTION_ID = '68a8d28b002ce97317ae';
    const TICKETS_COLLECTION_ID = '68a8d63a003a3a6afa24';
    const SETTINGS_COLLECTION_ID = '68a8d21a0031802b1f8c';
    const GLOBAL_SETTINGS_DOC_ID = 'global_settings';

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
    const kioskHideableElements = document.querySelectorAll('.js-kiosk-hide');
    const dailyResetEnabledCheckbox = document.getElementById('daily-reset-enabled');


    // --- Application State ---
    let currentUser = null;
    let services = [];
    let tickets = [];
    let tempSelectedServicesForPass = [];
    let lastCalledTicket = {};
    let globalSettings = {};

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
            await checkAndPerformDailyReset();
            await fetchGlobalSettings();
            showLoggedInUI();
            await fetchData();
            setupRealtimeSubscriptions();
        } catch (error) {
            console.log('User not logged in');
            showLoggedOutUI();
        }
    }

    async function fetchGlobalSettings() {
        try {
            globalSettings = await databases.getDocument(DATABASE_ID, SETTINGS_COLLECTION_ID, GLOBAL_SETTINGS_DOC_ID);
        } catch (error) {
            console.error('Error fetching global settings, creating default...');
            globalSettings = await databases.createDocument(
                DATABASE_ID, SETTINGS_COLLECTION_ID, GLOBAL_SETTINGS_DOC_ID, {
                    last_reset_date: '',
                    is_daily_reset_enabled: true
                },
                [Permission.read(Role.users()), Permission.update(Role.users())]
            );
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
                Query.orderAsc('general_ticket') // Sort by general_ticket number
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
            // After successful login, reload the app to get user data
            window.location.reload(); 
        } catch (error) {
            showPopupNotification('<p>خطا در ورود: ' + error.message + '</p>');
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

        const userIsAdmin = currentUser.prefs && currentUser.prefs.role === 'admin';
        const userIsKiosk = currentUser.name === 'کیوسک';

        settingsBtn.style.display = userIsAdmin ? 'inline-block' : 'none';
        resetAllBtn.style.display = userIsAdmin ? 'inline-block' : 'none';
        passTicketBtn.style.display = userIsKiosk ? 'none' : 'inline-block';

        kioskHideableElements.forEach(el => {
            el.style.display = userIsKiosk ? 'none' : 'block';
        });

        if (userIsKiosk) {
            serviceButtonsContainer.querySelectorAll('.service-btn').forEach(btn => {
                const oldBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(oldBtn, btn);
            });
            serviceButtonsContainer.querySelectorAll('.service-btn').forEach(btn => {
                const serviceId = btn.dataset.serviceId;
                btn.addEventListener('click', () => generateKioskTicket(serviceId));
            });
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
            if (service.is_issuing_enabled) {
                const button = document.createElement('button');
                button.className = 'service-btn';
                button.dataset.serviceId = service.$id;
                const waitingCount = tickets.filter(t => t.service_id === service.$id && t.status === 'در حال انتظار').length;
                const timePerTicket = service.manual_time;
                button.innerHTML = `
                    <div>
                        <div class="service-name">${service.name}</div>
                        <div class="waiting-count">منتظران: ${waitingCount}</div>
                    </div>
                    <div class="estimation-time">زمان تخمینی: ${Math.round(calculateEstimatedWaitTime(service.$id))} دقیقه</div>
                `;
                button.addEventListener('click', () => checkAvailabilityAndOpenForm(service.$id));
                serviceButtonsContainer.appendChild(button);
            }
        });
    }

    async function updateServiceCheckboxes() {
        if (!currentUser || currentUser.name === 'کیوسک') return;
        serviceCheckboxes.innerHTML = '';
        const userPrefs = currentUser.prefs || {};
        const selections = userPrefs.service_selections || {};

        services.forEach(service => {
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
                    // Refresh user prefs to ensure the local state is in sync
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
        const sortedTickets = [...tickets].sort((a, b) => a.general_ticket - b.general_ticket);
        sortedTickets.forEach(ticket => {
            const service = services.find(s => s.$id === ticket.service_id);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${ticket.general_ticket || '---'}</td>
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

    function countActiveCountersForService(serviceId) {
        // This function now relies on the service selections stored in Appwrite user preferences.
        const activeUsersWithSelections = services.filter(service => {
            const activeUserIds = Object.keys(service.user_selections || {});
            return activeUserIds.length > 0;
        });
        
        return activeUsersWithSelections.length > 0 ? activeUsersWithSelections.length : 1;
    }
    
    // --- Estimation Logic ---
    async function calculateEstimatedWaitTime(serviceId) {
        const service = services.find(s => s.$id === serviceId);
        if (!service) return 0;
        
        const timePerTicket = service.manual_time;
        const queueLength = tickets.filter(t => t.service_id === service.$id && t.status === 'در حال انتظار').length;
        
        const activeCounters = countActiveCountersForService(serviceId);
        
        return (queueLength * timePerTicket) / activeCounters;
    }

    async function checkAvailabilityAndOpenForm(serviceId) {
        const userIsKiosk = currentUser.name === 'کیوسک';
        const service = services.find(s => s.$id === serviceId);
        if (!service) return;

        if (!service.is_issuing_enabled) {
            showPopupNotification('<p>صدور نوبت برای این خدمت در حال حاضر غیرفعال است.</p>');
            return;
        }

        const estimatedWait = await calculateEstimatedWaitTime(serviceId);
        const now = new Date();
        const endTimeParts = (service.work_hours_end || "17:00").split(':');
        const endTime = new Date();
        endTime.setHours(parseInt(endTimeParts[0]), parseInt(endTimeParts[1]), 0, 0);

        const estimatedFinishTime = new Date(now.getTime() + estimatedWait * 60000);

        if (estimatedFinishTime > endTime) {
            if (userIsKiosk) {
                showPopupNotification('<p>ساعت کاری این خدمت به پایان رسیده است. امکان صدور نوبت وجود ندارد.</p>');
                return;
            } else {
                const warning = `هشدار: زمان تخمینی نوبت شما (${Math.round(estimatedWait)} دقیقه) خارج از ساعت کاری (${service.work_hours_end}) این خدمت است. آیا مایل به ثبت نوبت هستید؟`;
                const confirmResult = await showCustomConfirm(warning);
                if (!confirmResult) {
                    return;
                }
            }
        }
        openTicketForm('regular', service.$id);
    }
    
    async function generateKioskTicket(serviceId) {
        const service = services.find(s => s.$id === serviceId);
        if (!service) return;

        if (!service.is_issuing_enabled) {
             showPopupNotification('<p>صدور نوبت برای این خدمت در حال حاضر غیرفعال است.</p>');
             return;
        }

        const estimatedWait = await calculateEstimatedWaitTime(serviceId);
        const now = new Date();
        const endTimeParts = (service.work_hours_end || "17:00").split(':');
        const endTime = new Date();
        endTime.setHours(parseInt(endTimeParts[0]), parseInt(endTimeParts[1]), 0, 0);
        const estimatedFinishTime = new Date(now.getTime() + estimatedWait * 60000);
        
        if (estimatedFinishTime > endTime) {
            showPopupNotification('<p>ساعت کاری این خدمت به پایان رسیده است. امکان صدور نوبت از طریق کیوسک وجود ندارد.</p>');
            return;
        }

        const serviceTickets = tickets.filter(t => t.service_id === serviceId && t.ticket_type === 'regular');
        const specificNumber = (serviceTickets.length) + service.start_number;
        const generalNumber = tickets.length + 1;

        const newTicketData = {
            service_id: serviceId,
            specific_ticket: specificNumber,
            general_ticket: generalNumber,
            first_name: '---',
            last_name: '---',
            national_id: '---',
            registered_by: currentUser.$id,
            registered_by_name: 'کیوسک',
            status: 'در حال انتظار',
            ticket_type: 'regular'
        };

        try {
            const createdTicket = await databases.createDocument(
                DATABASE_ID, TICKETS_COLLECTION_ID, ID.unique(), newTicketData,
                [Permission.read(Role.users()), Permission.update(Role.users()), Permission.delete(Role.users())]
            );
            const popupMessage = `
                <span class="ticket-number">نوبت شما: ${createdTicket.specific_ticket}</span>
                <p>نوبت کلی: ${createdTicket.general_ticket}</p>
                <p>نام: ---</p>
                <p>کد ملی: ---</p>
                <span class="wait-time">زمان تخمینی انتظار: ${Math.round(estimatedWait)} دقیقه</span>
            `;
            showPopupNotification(popupMessage);
        } catch (error) {
            console.error('Error creating ticket:', error);
            showPopupNotification('<p>خطا در ثبت نوبت!</p>');
        }
    }

    // --- TICKET LOGIC ---
    async function generateTicket(serviceId, firstName, lastName, nationalId) {
        if (nationalId && !checkCodeMeli(nationalId)) {
            showPopupNotification('<p>کد ملی وارد شده معتبر نیست.</p>');
            return;
        }

        const service = services.find(s => s.$id === serviceId);
        if (!service) return;

        if (!service.is_issuing_enabled) {
             showPopupNotification('<p>صدور نوبت برای این خدمت در حال حاضر غیرفعال است.</p>');
             return;
        }
        
        const serviceTickets = tickets.filter(t => t.service_id === serviceId && t.ticket_type === 'regular');
        const specificNumber = (serviceTickets.length) + service.start_number;
        const generalNumber = tickets.length + 1;
        const estimatedWait = await calculateEstimatedWaitTime(serviceId);

        const newTicketData = {
            service_id: serviceId,
            specific_ticket: specificNumber,
            general_ticket: generalNumber,
            first_name: firstName || '---',
            last_name: lastName || '---',
            national_id: nationalId || '---',
            registered_by: currentUser.$id,
            registered_by_name: currentUser.name,
            status: 'در حال انتظار',
            ticket_type: 'regular'
        };

        try {
            const createdTicket = await databases.createDocument(
                DATABASE_ID, TICKETS_COLLECTION_ID, ID.unique(), newTicketData,
                [Permission.read(Role.users()), Permission.update(Role.users()), Permission.delete(Role.users())]
            );
            const popupMessage = `
                <span class="ticket-number">نوبت شما: ${createdTicket.specific_ticket || 'پاس'}</span>
                <p>نوبت کلی: ${createdTicket.general_ticket}</p>
                <p>نام: ${createdTicket.first_name} ${createdTicket.last_name}</p>
                <p>کد ملی: ${createdTicket.national_id}</p>
                <span class="wait-time">زمان تخمینی انتظار: ${Math.round(estimatedWait)} دقیقه</span>
            `;
            showPopupNotification(popupMessage);
            closeTicketForm();
        } catch (error) {
            console.error('Error creating ticket:', error);
            showPopupNotification('<p>خطا در ثبت نوبت!</p>');
        }
    }
    
    async function generatePassTicket(firstName, lastName, nationalId, delayCount) {
        if (nationalId && !checkCodeMeli(nationalId)) {
            showPopupNotification('<p>کد ملی وارد شده معتبر نیست.</p>');
            return;
        }
        if (tempSelectedServicesForPass.length === 0) {
            showPopupNotification('<p>لطفا حداقل یک خدمت را انتخاب کنید.</p>');
            return;
        }

        const canIssue = tempSelectedServicesForPass.every(serviceId => {
            const service = services.find(s => s.$id === serviceId);
            return service && service.is_issuing_enabled;
        });
        if (!canIssue) {
             showPopupNotification('<p>صدور نوبت برای یکی از خدمات انتخاب شده در حال حاضر غیرفعال است.</p>');
             return;
        }

        const generalNumber = tickets.length + 1;
        const creationPromises = tempSelectedServicesForPass.map((serviceId, index) => {
            const newTicketData = {
                service_id: serviceId,
                general_ticket: generalNumber + index,
                first_name: firstName || '---',
                last_name: lastName || '---',
                national_id: nationalId || '---',
                registered_by: currentUser.$id,
                registered_by_name: currentUser.name,
                status: 'در حال انتظار',
                ticket_type: 'pass',
                delay_count: delayCount
            };
            return databases.createDocument(
                DATABASE_ID, TICKETS_COLLECTION_ID, ID.unique(), newTicketData,
                [Permission.read(Role.users()), Permission.update(Role.users()), Permission.delete(Role.users())]
            );
        });

        try {
            await Promise.all(creationPromises);
            showPopupNotification(`<p>نوبت پاس شده با موفقیت ثبت شد.</p>`);
            closeTicketForm();
        } catch (error) {
            console.error('Error creating pass ticket:', error);
            showPopupNotification('<p>خطا در ثبت نوبت پاس شده!</p>');
        }
    }

    async function updateSmartTime(serviceId, callTime) {
        // This function is no longer used since estimation mode is removed
    }

    async function callNextTicket() {
        const selections = (currentUser.prefs && currentUser.prefs.service_selections) || {};
        const selectedServiceIds = Object.keys(selections).filter(id => selections[id]);

        if (selectedServiceIds.length === 0) {
            showPopupNotification('<p>لطفا حداقل یک خدمت را برای فراخوانی انتخاب کنید.</p>');
            return;
        }

        let ticketToCall = null;
        
        const waitingTickets = tickets
            .filter(t => t.status === 'در حال انتظار' && selectedServiceIds.includes(t.service_id))
            .sort((a, b) => a.general_ticket - b.general_ticket); // Sort by general ticket number

        const passedTickets = waitingTickets.filter(t => t.ticket_type === 'pass' && t.delay_count === 0);
        
        if (passedTickets.length > 0) {
            ticketToCall = passedTickets[0];
        } else {
            const regularTickets = waitingTickets.filter(t => t.ticket_type === 'regular');
            if (regularTickets.length > 0) {
                ticketToCall = regularTickets[0];
                
                const passedToUpdate = tickets.filter(t => 
                    t.ticket_type === 'pass' && t.status === 'در حال انتظار' && t.delay_count > 0 &&
                    t.service_id === ticketToCall.service_id
                );
                const updatePromises = passedToUpdate.map(t => 
                    databases.updateDocument(DATABASE_ID, TICKETS_COLLECTION_ID, t.$id, { delay_count: t.delay_count - 1 })
                );
                if (updatePromises.length > 0) await Promise.all(updatePromises);
            }
        }

        if (ticketToCall) {
            try {
                const counterName = (currentUser.prefs && currentUser.prefs.counter_name) || 'باجه';
                const updatedTicket = await databases.updateDocument(DATABASE_ID, TICKETS_COLLECTION_ID, ticketToCall.$id, {
                    status: 'در حال سرویس',
                    called_by: currentUser.$id,
                    called_by_name: currentUser.name,
                    called_by_counter_name: counterName,
                    call_time: new Date().toISOString()
                });
                lastCalledTicket[currentUser.$id] = updatedTicket.$id;
                const popupMessage = `
                    <span class="ticket-number">فراخوان: ${updatedTicket.specific_ticket || 'پاس'}</span>
                    <p>نام: ${updatedTicket.first_name} ${updatedTicket.last_name}</p>
                    <p>کد ملی: ${updatedTicket.national_id}</p>
                `;
                showPopupNotification(popupMessage);
            } catch (error) {
                console.error('Error calling next ticket:', error);
            }
        } else {
            showPopupNotification('<p>هیچ نوبتی در صف انتظار برای خدمات انتخابی نیست.</p>');
        }
    }
    
    async function resetAllTickets() {
         const confirmReset = await showCustomConfirm('آیا مطمئن هستید؟ تمام نوبت‌ها برای همیشه پاک خواهند شد.');
        if (!confirmReset) return;
        
        try {
            let response;
            let hasMore = true;
            while(hasMore) {
                response = await databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID);
                const deletePromises = response.documents.map(doc => databases.deleteDocument(DATABASE_ID, TICKETS_COLLECTION_ID, doc.$id));
                await Promise.all(deletePromises);
                hasMore = response.documents.length > 0;
            }
            showPopupNotification('<p>تمام نوبت‌ها با موفقیت پاک شدند.</p>');
        } catch (error) {
            console.error('Error resetting tickets:', error);
            showPopupNotification('<p>خطا در پاک کردن نوبت‌ها.</p>');
        }
    }

    async function checkAndPerformDailyReset() {
        // Fetch the global settings first
        try {
            globalSettings = await databases.getDocument(DATABASE_ID, SETTINGS_COLLECTION_ID, GLOBAL_SETTINGS_DOC_ID);
        } catch (e) {
            // Document doesn't exist, create it with default enabled value
            globalSettings = await databases.createDocument(
                DATABASE_ID, SETTINGS_COLLECTION_ID, GLOBAL_SETTINGS_DOC_ID, {
                    last_reset_date: '',
                    is_daily_reset_enabled: true
                },
                [Permission.read(Role.users()), Permission.update(Role.users())]
            );
        }

        const today = new Date().toISOString().slice(0, 10);
        
        // Only perform reset if it's a new day AND daily reset is enabled
        if (globalSettings.last_reset_date !== today && globalSettings.is_daily_reset_enabled) {
            console.log("Performing daily reset...");
            
            // 1. Delete all tickets
            await resetAllTickets();

            // 2. Reset user service selections by fetching all users and updating their prefs
            try {
                // NOTE: This operation requires a server-side SDK and an API key with users.read and users.write permissions.
                // It will not work on the client-side due to security restrictions.
                // This is a placeholder for the logic you would implement in a server-side function.
                 // This is a placeholder for a server-side function call.
                 // The logic to get and update all users' preferences must be on the server.
            } catch (e) {
                console.error("Failed to reset user preferences:", e);
                showPopupNotification('<p>خطا در ریست تنظیمات کاربران.</p>');
            }
            
            // 3. Update last reset date
            await databases.updateDocument(DATABASE_ID, SETTINGS_COLLECTION_ID, GLOBAL_SETTINGS_DOC_ID, { last_reset_date: today });
            console.log("Daily reset completed.");
        }
    }

    // --- MODAL & FORM LOGIC ---
    function openTicketForm(mode, serviceId = null) {
        ticketForm.dataset.mode = mode;
        const passDelayGroup = document.getElementById('pass-delay-group');
        if (mode === 'regular') {
            ticketForm.dataset.serviceId = serviceId;
            ticketFormTitle.textContent = 'ثبت نوبت جدید';
            passDelayGroup.style.display = 'none';
        } else if (mode === 'pass') {
            ticketFormTitle.textContent = 'ثبت اطلاعات شخص پاس داده شده';
            passDelayGroup.style.display = 'block';
        }
        ticketForm.style.display = 'block';
    }

    function closeTicketForm() {
        ticketForm.style.display = 'none';
        document.getElementById('first-name').value = '';
        document.getElementById('last-name').value = '';
        document.getElementById('national-id').value = '';
        document.getElementById('pass-delay-count').value = 0;
    }

    function openPassServiceModal() {
        passServiceList.innerHTML = '';
        services.forEach(service => {
            const div = document.createElement('div');
            div.className = 'service-checkbox';
            div.innerHTML = `<input type="checkbox" id="pass-check-${service.$id}" value="${service.$id}">
                             <label for="pass-check-${service.$id}">${service.name}</label>`;
            passServiceList.appendChild(div);
        });
        passServiceModalOverlay.style.display = 'flex';
    }

    // --- ADMIN PANEL LOGIC ---
    async function openAdminPanel() {
        await fetchGlobalSettings();
        dailyResetEnabledCheckbox.checked = globalSettings.is_daily_reset_enabled;
        renderServiceSettings();
        adminPanel.style.display = 'block';
    }

    function renderServiceSettings() {
        serviceList.innerHTML = '';
        services.forEach(service => {
            const row = document.createElement('tr');
            row.dataset.id = service.$id;
            row.innerHTML = `
                <td><input type="text" value="${service.name}" class="setting-name"></td>
                <td><input type="number" value="${service.start_number}" class="setting-start"></td>
                <td><input type="number" value="${service.end_number}" class="setting-end"></td>
                <td><input type="number" value="${service.manual_time}" class="setting-manual-time"></td>
                <td><input type="checkbox" ${service.is_issuing_enabled ? 'checked' : ''} class="setting-is-enabled"></td>
                <td><input type="text" value="${service.work_hours_start || '08:00'}" class="setting-work-start"></td>
                <td><input type="text" value="${service.work_hours_end || '17:00'}" class="setting-work-end"></td>
                <td><button class="remove-service-btn">حذف</button></td>`;
            serviceList.appendChild(row);
        });
        
        serviceList.querySelectorAll('.remove-service-btn').forEach(btn => {
            btn.addEventListener('click', (e) => e.target.closest('tr').remove());
        });
    }
    
    function addNewServiceRow() {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="text" placeholder="نام خدمت جدید" class="setting-name"></td>
            <td><input type="number" value="100" class="setting-start"></td>
            <td><input type="number" value="199" class="setting-end"></td>
            <td><input type="number" value="10" class="setting-manual-time"></td>
            <td><input type="checkbox" checked class="setting-is-enabled"></td>
            <td><input type="text" value="08:00" class="setting-work-start"></td>
            <td><input type="text" value="17:00" class="setting-work-end"></td>
            <td><button class="remove-service-btn">حذف</button></td>`;
        serviceList.appendChild(row);
        row.querySelector('.remove-service-btn').addEventListener('click', () => row.remove());
    }

    async function saveSettings() {
        const existingServiceIds = services.map(s => s.$id);
        const uiServiceIds = [];
        const promises = [];

        serviceList.querySelectorAll('tr').forEach(row => {
            const id = row.dataset.id;
            if(id) uiServiceIds.push(id);

            const data = {
                name: row.querySelector('.setting-name').value,
                start_number: parseInt(row.querySelector('.setting-start').value),
                end_number: parseInt(row.querySelector('.setting-end').value),
                manual_time: parseInt(row.querySelector('.setting-manual-time').value),
                is_issuing_enabled: row.querySelector('.setting-is-enabled').checked,
                work_hours_start: row.querySelector('.setting-work-start').value,
                work_hours_end: row.querySelector('.setting-work-end').value
            };

            if (id) {
                promises.push(databases.updateDocument(DATABASE_ID, SERVICES_COLLECTION_ID, id, data));
            } else {
                promises.push(databases.createDocument(DATABASE_ID, SERVICES_COLLECTION_ID, ID.unique(), data));
            }
        });

        const servicesToDelete = existingServiceIds.filter(id => !uiServiceIds.includes(id));
        servicesToDelete.forEach(id => {
            promises.push(databases.deleteDocument(DATABASE_ID, SERVICES_COLLECTION_ID, id));
        });

        // Save the new global settings
        const newGlobalSettings = { is_daily_reset_enabled: dailyResetEnabledCheckbox.checked };
        promises.push(databases.updateDocument(DATABASE_ID, SETTINGS_COLLECTION_ID, GLOBAL_SETTINGS_DOC_ID, newGlobalSettings));

        try {
            await Promise.all(promises);
            showPopupNotification('<p>تنظیمات با موفقیت ذخیره شد.</p>');
            adminPanel.style.display = 'none';
            fetchData();
        } catch (error) {
            console.error('Error saving settings:', error);
            showPopupNotification('<p>خطا در ذخیره تنظیمات!</p>');
        }
    }

    // --- HELPERS ---
    function showPopupNotification(htmlContent) {
        popupText.innerHTML = htmlContent;
        popupNotification.style.display = 'flex';
        setTimeout(() => popupNotification.classList.add('show'), 10);
        popupNotification.addEventListener('click', function closeHandler() {
            popupNotification.classList.remove('show');
            setTimeout(() => popupNotification.style.display = 'none', 300);
            popupNotification.removeEventListener('click', closeHandler);
        });
    }

    function showCustomConfirm(message) {
        return new Promise(resolve => {
            const confirmPopup = document.createElement('div');
            confirmPopup.className = 'modal-overlay';
            confirmPopup.innerHTML = `
                <div class="modal">
                    <h2>تایید</h2>
                    <p>${message}</p>
                    <div class="form-actions" style="margin-top: 20px;">
                        <button class="primary-btn" id="confirm-ok-btn">بله</button>
                        <button class="secondary-btn" id="confirm-cancel-btn">خیر</button>
                    </div>
                </div>
            `;
            document.body.appendChild(confirmPopup);

            const confirmOkBtn = document.getElementById('confirm-ok-btn');
            const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

            confirmOkBtn.addEventListener('click', () => {
                confirmPopup.remove();
                resolve(true);
            });

            confirmCancelBtn.addEventListener('click', () => {
                confirmPopup.remove();
                resolve(false);
            });
        });
    }

    function formatDate(dateString) {
        if (!dateString) return '---';
        const d = new Date(dateString);
        return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    }

    // --- EVENT LISTENERS ---
    loginBtn.addEventListener('click', login);
    logoutBtn.addEventListener('click', logout);
    settingsBtn.addEventListener('click', openAdminPanel);
    resetAllBtn.addEventListener('click', async () => {
        const confirmReset = await showCustomConfirm('آیا مطمئن هستید؟ تمام نوبت‌ها برای همیشه پاک خواهند شد.');
        if (confirmReset) {
            await resetAllTickets();
        }
    });
    closeSettingsBtn.addEventListener('click', () => adminPanel.style.display = 'none');
    cancelSettingsBtn.addEventListener('click', () => adminPanel.style.display = 'none');
    addServiceBtn.addEventListener('click', addNewServiceRow);
    saveSettingsBtn.addEventListener('click', saveSettings);
    callNextBtn.addEventListener('click', callNextTicket);
    passTicketBtn.addEventListener('click', openPassServiceModal);
    cancelPassServiceBtn.addEventListener('click', () => passServiceModalOverlay.style.display = 'none');
    
    confirmPassServiceBtn.addEventListener('click', async () => {
        const selected = passServiceList.querySelectorAll('input:checked');
        if (selected.length === 0) {
            showPopupNotification('<p>لطفا حداقل یک خدمت را انتخاب کنید.</p>');
            return;
        }
        tempSelectedServicesForPass = Array.from(selected).map(cb => cb.value);
        passServiceModalOverlay.style.display = 'none';
        openTicketForm('pass');
    });

    submitTicketBtn.addEventListener('click', () => {
        const mode = ticketForm.dataset.mode;
        const firstName = document.getElementById('first-name').value;
        const lastName = document.getElementById('last-name').value;
        const nationalId = document.getElementById('national-id').value;
        
        if (mode === 'regular') {
            const serviceId = ticketForm.dataset.serviceId;
            generateTicket(serviceId, firstName, lastName, nationalId);
        } else if (mode === 'pass') {
            const delayCount = parseInt(document.getElementById('pass-delay-count').value) || 0;
            generatePassTicket(firstName, lastName, nationalId, delayCount);
        }
    });
    cancelTicketBtn.addEventListener('click', closeTicketForm);

    // --- START THE APP ---
    initializeApp();
});
