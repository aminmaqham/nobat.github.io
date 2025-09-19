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
    const counterNameInput = document.getElementById('counter-name-input');
    const saveCounterBtn = document.getElementById('save-counter-btn');

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
        
        // Load the saved counter name
        if (currentUser.prefs && currentUser.prefs.counter_name) {
            counterNameInput.value = currentUser.prefs.counter_name;
        }

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
            const button = document.createElement('button');
            button.className = 'service-btn';
            const waitingCount = tickets.filter(t => t.service_id === service.$id && t.status === 'در حال انتظار').length;
            const timeToShow = service.estimation_mode === 'smart' ? service.smart_time : service.manual_time;
            button.innerHTML = `
                <div>
                    <div class="service-name">${service.name}</div>
                    <div class="waiting-count">منتظران: ${waitingCount}</div>
                </div>
                <div class="estimation-time">${service.estimation_mode}: ${Math.round(timeToShow)} دقیقه</div>
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
                <td>${ticket.called_by_counter_name || '---'}</td>
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
                <p><strong>باجه:</strong> ${ticket.called_by_counter_name || '---'}</p>
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
        
        const timePerTicket = service.estimation_mode === 'smart' ? service.smart_time : service.manual_time;
        const queueLength = tickets.filter(t => t.service_id === service.$id && t.status === 'در حال انتظار').length;
        
        return queueLength * timePerTicket;
    }

    async function checkAvailabilityAndOpenForm(serviceId) {
        const service = services.find(s => s.$id === serviceId);
        if (!service) return;

        const estimatedWait = calculateEstimatedWaitTime(serviceId);
        const now = new Date();
        const endTimeParts = (service.work_hours_end || "17:00").split(':');
        const endTime = new Date();
        endTime.setHours(parseInt(endTimeParts[0]), parseInt(endTimeParts[1]), 0, 0);

        const estimatedFinishTime = new Date(now.getTime() + estimatedWait * 60000);

        if (estimatedFinishTime > endTime) {
            const warning = `هشدار: زمان تخمینی نوبت شما (${Math.round(estimatedWait)} دقیقه) خارج از ساعت کاری (${service.work_hours_end}) این خدمت است. آیا مایل به ثبت نوبت هستید؟`;
            if (confirm(warning)) {
                openTicketForm('regular', service.$id);
            }
        } else {
            openTicketForm('regular', service.$id);
        }
    }

    // --- TICKET LOGIC ---
    async function generateTicket(serviceId, firstName, lastName, nationalId) {
        if (nationalId && !checkCodeMeli(nationalId)) {
            alert('کد ملی وارد شده معتبر نیست.');
            return;
        }

        const service = services.find(s => s.$id === serviceId);
        if (!service) return;

        const serviceTickets = tickets.filter(t => t.service_id === serviceId && t.ticket_type === 'regular');
        const specificNumber = (serviceTickets.length) + service.start_number;
        const generalNumber = tickets.length + 1;
        const estimatedWait = calculateEstimatedWaitTime(serviceId);

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
                <span class="ticket-number">نوبت شما: ${createdTicket.specific_ticket}</span>
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
            alert('کد ملی وارد شده معتبر نیست.');
            return;
        }
        if (tempSelectedServicesForPass.length === 0) return;

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
        const service = services.find(s => s.$id === serviceId);
        if (!service || service.estimation_mode !== 'smart') return;

        const durationMinutes = (new Date() - new Date(callTime)) / 60000;
        if (durationMinutes < 0.1 || durationMinutes > 120) return;

        const newSmartTime = (service.smart_time * 0.8) + (durationMinutes * 0.2);
        try {
            await databases.updateDocument(DATABASE_ID, SERVICES_COLLECTION_ID, serviceId, { smart_time: newSmartTime });
        } catch (error) {
            console.error("Failed to update smart time:", error);
        }
    }

    async function callNextTicket() {
        if (lastCalledTicket[currentUser.$id]) {
            const lastTicket = tickets.find(t => t.$id === lastCalledTicket[currentUser.$id]);
            if (lastTicket && lastTicket.status === 'در حال سرویس') {
                await updateSmartTime(lastTicket.service_id, lastTicket.call_time);
            }
        }
        
        // Get user's counter name
        const counterName = (currentUser.prefs && currentUser.prefs.counter_name) || 'باجه';

        const selections = (currentUser.prefs && currentUser.prefs.service_selections) || {};
        const selectedServiceIds = Object.keys(selections).filter(id => selections[id]);

        if (selectedServiceIds.length === 0) {
            showPopupNotification('<p>لطفا حداقل یک خدمت را برای فراخوانی انتخاب کنید.</p>');
            return;
        }

        let ticketToCall = null;
        
        const waitingTickets = tickets
            .filter(t => t.status === 'در حال انتظار' && selectedServiceIds.includes(t.service_id))
            .sort((a, b) => new Date(a.$createdAt) - new Date(b.$createdAt));

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
                const updatedTicket = await databases.updateDocument(DATABASE_ID, TICKETS_COLLECTION_ID, ticketToCall.$id, {
                    status: 'در حال سرویس',
                    called_by: currentUser.$id,
                    called_by_name: currentUser.name,
                    called_by_counter_name: counterName, // Use the user's defined counter name
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
        if (!confirm('آیا مطمئن هستید؟ تمام نوبت‌ها برای همیشه پاک خواهند شد.')) return;
        
        try {
            let response = await databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID, [Query.limit(100)]);
            while (response.documents.length > 0) {
                const deletePromises = response.documents.map(doc => databases.deleteDocument(DATABASE_ID, TICKETS_COLLECTION_ID, doc.$id));
                await Promise.all(deletePromises);
                response = await databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID, [Query.limit(100)]);
            }
            showPopupNotification('<p>تمام نوبت‌ها با موفقیت پاک شدند.</p>');
        } catch (error) {
            console.error('Error resetting tickets:', error);
            showPopupNotification('<p>خطا در پاک کردن نوبت‌ها.</p>');
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
    function openAdminPanel() {
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
                <td><input type="text" value="${service.estimation_mode}" class="setting-estimation-mode"></td>
                <td><input type="number" value="${service.manual_time}" class="setting-manual-time"></td>
                <td><input type="number" value="${service.smart_time}" class="setting-smart-time" step="0.1"></td>
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
            <td><input type="text" value="manual" class="setting-estimation-mode"></td>
            <td><input type="number" value="10" class="setting-manual-time"></td>
            <td><input type="number" value="10.0" class="setting-smart-time" step="0.1"></td>
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
                estimation_mode: row.querySelector('.setting-estimation-mode').value,
                manual_time: parseInt(row.querySelector('.setting-manual-time').value),
                smart_time: parseFloat(row.querySelector('.setting-smart-time').value), 
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

    function formatDate(dateString) {
        if (!dateString) return '---';
        const d = new Date(dateString);
        return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    }

    // --- EVENT LISTENERS ---
    loginBtn.addEventListener('click', login);
    logoutBtn.addEventListener('click', logout);
    settingsBtn.addEventListener('click', openAdminPanel);
    resetAllBtn.addEventListener('click', resetAllTickets);
    closeSettingsBtn.addEventListener('click', () => adminPanel.style.display = 'none');
    cancelSettingsBtn.addEventListener('click', () => adminPanel.style.display = 'none');
    addServiceBtn.addEventListener('click', addNewServiceRow);
    saveSettingsBtn.addEventListener('click', saveSettings);
    callNextBtn.addEventListener('click', callNextTicket);
    passTicketBtn.addEventListener('click', openPassServiceModal);
    cancelPassServiceBtn.addEventListener('click', () => passServiceModalOverlay.style.display = 'none');
    
    // New listener for saving the counter name
    saveCounterBtn.addEventListener('click', async () => {
        const counterName = counterNameInput.value.trim();
        if (counterName === '') {
            alert('لطفا نام باجه را وارد کنید.');
            return;
        }
        try {
            const userPrefs = currentUser.prefs || {};
            await account.updatePrefs({ ...userPrefs, counter_name: counterName });
            currentUser.prefs = await account.getPrefs();
            showPopupNotification('<p>نام باجه با موفقیت ذخیره شد.</p>');
            // Update the greeting to show the counter name
            userGreeting.textContent = `کاربر: ${currentUser.name || currentUser.email} (باجه: ${counterName})`;
        } catch (e) {
            console.error("Failed to save counter name", e);
            showPopupNotification('<p>خطا در ذخیره نام باجه.</p>');
        }
    });

    confirmPassServiceBtn.addEventListener('click', () => {
        const selected = passServiceList.querySelectorAll('input:checked');
        if (selected.length === 0) {
            alert('لطفا حداقل یک خدمت را انتخاب کنید.');
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
