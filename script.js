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
    const counterSettingsBtn = document.getElementById('counter-settings-btn');
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
    
    // عناصر جدید برای تنظیمات باجه
    const counterSettingsModal = document.getElementById('counter-settings-modal');
    const counterNameInput = document.getElementById('counter-name-input');
    const saveCounterBtn = document.getElementById('save-counter-btn');
    const cancelCounterBtn = document.getElementById('cancel-counter-btn');

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
            await checkAndSetCounterName();
            showLoggedInUI();
            await fetchData();
            setupRealtimeSubscriptions();
            checkAutoReset();
        } catch (error) {
            console.log('User not logged in');
            showLoggedOutUI();
        }
    }

    // تابع جدید برای بررسی و تنظیم شماره باجه
    async function checkAndSetCounterName() {
        const userPrefs = currentUser.prefs || {};
        if (!userPrefs.counter_name) {
            // اگر شماره باجه تنظیم نشده، مودال تنظیمات را نشان بده
            openCounterSettingsModal();
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
                Query.orderDesc('$createdAt')
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
        
        const userPrefs = currentUser.prefs || {};
        const counterName = userPrefs.counter_name || 'تعیین نشده';
        userGreeting.textContent = `کاربر: ${currentUser.name || currentUser.email} (باجه: ${counterName})`;
        
        mainContent.style.display = 'block';
        totalWaitingContainer.style.display = 'block';

        if (currentUser.prefs && currentUser.prefs.role === 'admin') {
            settingsBtn.style.display = 'inline-block';
            resetAllBtn.style.display = 'inline-block';
        } else {
            settingsBtn.style.display = 'none';
            resetAllBtn.style.display = 'none';
        }
        
        // دکمه تنظیمات باجه همیشه نمایش داده می‌شود
        counterSettingsBtn.style.display = 'inline-block';
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
            
            const isDisabled = service.disabled === true;
            const waitingCount = tickets.filter(t => t.service_id === service.$id && t.status === 'در حال انتظار').length;
            
            if (isDisabled) {
                button.classList.add('disabled-service');
            }
            
            button.innerHTML = `
                <div>
                    <div class="service-name">${service.name}</div>
                    <div class="waiting-count">منتظران: ${waitingCount}</div>
                </div>
                <div class="estimation-time">تخمین زمان: ${Math.round(service.manual_time)} دقیقه</div>
                ${isDisabled ? '<div class="service-disabled-label">(غیرفعال)</div>' : ''}
            `;
            
            button.addEventListener('click', () => {
                if (isDisabled) {
                    showPopupNotification('<p>این خدمت در حال حاضر غیرفعال است. امکان ثبت نوبت جدید وجود ندارد.</p>');
                } else {
                    checkAvailabilityAndOpenForm(service.$id);
                }
            });
            
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
            
            const isDisabled = service.disabled === true;
            if (isDisabled) {
                div.classList.add('disabled-service');
            }
            
            div.innerHTML = `<input type="checkbox" id="service-check-${service.$id}" value="${service.$id}" ${isDisabled ? '' : ''}>
                             <label for="service-check-${service.$id}">${service.name} ${isDisabled ? '(غیرفعال)' : ''}</label>`;
            
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

        const isDisabled = service.disabled === true;
        if (isDisabled) {
            showPopupNotification('<p>این خدمت در حال حاضر غیرفعال است. امکان ثبت نوبت جدید وجود ندارد.</p>');
            return;
        }

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

        const isDisabled = service.disabled === true;
        if (isDisabled) {
            showPopupNotification('<p>این خدمت در حال حاضر غیرفعال است. امکان ثبت نوبت جدید وجود ندارد.</p>');
            return;
        }

        const allTickets = await databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID, [
            Query.orderDesc('$createdAt'),
            Query.limit(1)
        ]);
        const lastGeneralTicket = allTickets.documents.length > 0 ? 
            parseInt(allTickets.documents[0].general_ticket) : 0;
        const generalNumber = lastGeneralTicket + 1;

        const serviceTickets = await databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID, [
            Query.equal('service_id', serviceId),
            Query.equal('ticket_type', 'regular'),
            Query.orderDesc('$createdAt'),
            Query.limit(1)
        ]);
        const lastSpecificTicket = serviceTickets.documents.length > 0 ? 
            parseInt(serviceTickets.documents[0].specific_ticket) : service.start_number - 1;
        const specificNumber = lastSpecificTicket + 1;

        if (specificNumber > service.end_number) {
            showPopupNotification('<p>شماره نوبت این خدمت به حداکثر مقدار مجاز رسیده است.</p>');
            return;
        }

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
        if (!firstName || !lastName) {
            alert('برای ثبت پاس نوبت، وارد کردن نام و نام خانوادگی الزامی است.');
            return;
        }

        if (nationalId && !checkCodeMeli(nationalId)) {
            alert('کد ملی وارد شده معتبر نیست.');
            return;
        }
        if (tempSelectedServicesForPass.length === 0) return;

        const allTickets = await databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID, [
            Query.orderDesc('$createdAt'),
            Query.limit(1)
        ]);
        const lastGeneralTicket = allTickets.documents.length > 0 ? 
            parseInt(allTickets.documents[0].general_ticket) : 0;
        const generalNumber = lastGeneralTicket + 1;

        const creationPromises = tempSelectedServicesForPass.map((serviceId, index) => {
            const service = services.find(s => s.$id === serviceId);
            const isDisabled = service && service.disabled === true;
            if (isDisabled) {
                showPopupNotification('<p>یکی از خدمات انتخاب شده غیرفعال است. امکان ثبت نوبت پاس وجود ندارد.</p>');
                return Promise.reject('Service disabled');
            }
            
            const newTicketData = {
                service_id: serviceId,
                general_ticket: generalNumber,
                first_name: firstName,
                last_name: lastName,
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
            if (error !== 'Service disabled') {
                showPopupNotification('<p>خطا در ثبت نوبت پاس شده!</p>');
            }
        }
    }

    async function callNextTicket() {
        if (lastCalledTicket[currentUser.$id]) {
            const lastTicket = tickets.find(t => t.$id === lastCalledTicket[currentUser.$id]);
            if (lastTicket && lastTicket.status === 'در حال سرویس') {
                // No smart time update needed anymore
            }
        }

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
                const userPrefs = currentUser.prefs || {};
                const counterName = userPrefs.counter_name || 'باجه';
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
                    <p><strong>نام:</strong> ${updatedTicket.first_name} ${updatedTicket.last_name}</p>
                    <p><strong>کد ملی:</strong> ${updatedTicket.national_id}</p>
                    <p><strong>خدمت:</strong> ${services.find(s => s.$id === updatedTicket.service_id)?.name || '---'}</p>
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

    // --- AUTO RESET FUNCTIONALITY ---
    async function checkAutoReset() {
        try {
            const today = new Date().toDateString();
            const lastReset = localStorage.getItem('lastAutoReset');
            
            if (lastReset !== today) {
                const servicesWithAutoReset = services.filter(service => service.auto_reset === true);
                
                if (servicesWithAutoReset.length > 0) {
                    const serviceIds = servicesWithAutoReset.map(service => service.$id);
                    const ticketsToDelete = tickets.filter(ticket => 
                        serviceIds.includes(ticket.service_id)
                    );
                    
                    if (ticketsToDelete.length > 0) {
                        const deletePromises = ticketsToDelete.map(ticket => 
                            databases.deleteDocument(DATABASE_ID, TICKETS_COLLECTION_ID, ticket.$id)
                        );
                        await Promise.all(deletePromises);
                        console.log(`Auto-reset completed for ${ticketsToDelete.length} tickets`);
                    }
                    
                    localStorage.setItem('lastAutoReset', today);
                }
            }
        } catch (error) {
            console.error('Error in auto-reset:', error);
        }
    }

    // --- COUNTER SETTINGS LOGIC ---
    function openCounterSettingsModal() {
        const userPrefs = currentUser.prefs || {};
        counterNameInput.value = userPrefs.counter_name || '';
        counterSettingsModal.style.display = 'flex';
    }

    function closeCounterSettingsModal() {
        counterSettingsModal.style.display = 'none';
    }

    async function saveCounterSettings() {
        const counterName = counterNameInput.value.trim();
        if (!counterName) {
            alert('لطفا شماره یا نام باجه را وارد کنید.');
            return;
        }

        try {
            const userPrefs = currentUser.prefs || {};
            await account.updatePrefs({ 
                ...userPrefs, 
                counter_name: counterName 
            });
            
            // به‌روزرسانی اطلاعات کاربر
            currentUser = await account.get();
            
            // به‌روزرسانی UI
            userGreeting.textContent = `کاربر: ${currentUser.name || currentUser.email} (باجه: ${counterName})`;
            
            showPopupNotification('<p>شماره باجه با موفقیت ذخیره شد.</p>');
            closeCounterSettingsModal();
        } catch (error) {
            console.error('Error saving counter settings:', error);
            showPopupNotification('<p>خطا در ذخیره شماره باجه!</p>');
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
            
            document.getElementById('first-name').required = true;
            document.getElementById('last-name').required = true;
        }
        ticketForm.style.display = 'block';
    }

    function closeTicketForm() {
        ticketForm.style.display = 'none';
        document.getElementById('first-name').value = '';
        document.getElementById('last-name').value = '';
        document.getElementById('national-id').value = '';
        document.getElementById('pass-delay-count').value = '0';
        document.getElementById('first-name').required = false;
        document.getElementById('last-name').required = false;
    }

    function showPopupNotification(message) {
        popupText.innerHTML = message;
        popupNotification.style.display = 'flex';
        setTimeout(() => {
            popupNotification.style.display = 'none';
        }, 5000);
    }

    function formatDate(dateString) {
        if (!dateString) return '---';
        const date = new Date(dateString);
        return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString('fa-IR');
    }

    // --- ADMIN PANEL LOGIC ---
    function openAdminPanel() {
        adminPanel.style.display = 'block';
        renderServiceSettings();
    }

    function closeAdminPanel() {
        adminPanel.style.display = 'none';
    }

    function renderServiceSettings() {
        serviceList.innerHTML = '';
        services.forEach(service => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="text" class="service-name-input" value="${service.name}"></td>
                <td><input type="number" class="service-start-input" value="${service.start_number}"></td>
                <td><input type="number" class="service-end-input" value="${service.end_number}"></td>
                <td><input type="number" class="service-time-input" value="${service.manual_time}" step="0.5"></td>
                <td><input type="time" class="service-start-time-input" value="${service.work_hours_start || '08:00'}"></td>
                <td><input type="time" class="service-end-time-input" value="${service.work_hours_end || '17:00'}"></td>
                <td><input type="checkbox" class="service-disabled-input" ${service.disabled ? 'checked' : ''}></td>
                <td><input type="checkbox" class="service-auto-reset-input" ${service.auto_reset ? 'checked' : ''}></td>
                <td><button class="delete-service-btn" data-id="${service.$id}">حذف</button></td>
            `;
            serviceList.appendChild(row);
        });
    }

    async function saveServiceSettings() {
        const serviceUpdates = Array.from(serviceList.children).map(row => {
            return {
                $id: row.querySelector('.delete-service-btn').dataset.id,
                name: row.querySelector('.service-name-input').value,
                start_number: parseInt(row.querySelector('.service-start-input').value),
                end_number: parseInt(row.querySelector('.service-end-input').value),
                manual_time: parseFloat(row.querySelector('.service-time-input').value),
                work_hours_start: row.querySelector('.service-start-time-input').value,
                work_hours_end: row.querySelector('.service-end-time-input').value,
                disabled: row.querySelector('.service-disabled-input').checked,
                auto_reset: row.querySelector('.service-auto-reset-input').checked
            };
        });

        try {
            const updatePromises = serviceUpdates.map(update => 
                databases.updateDocument(DATABASE_ID, SERVICES_COLLECTION_ID, update.$id, update)
            );
            await Promise.all(updatePromises);
            showPopupNotification('<p>تنظیمات خدمات با موفقیت ذخیره شد.</p>');
            closeAdminPanel();
            await fetchData();
        } catch (error) {
            console.error('Error saving service settings:', error);
            showPopupNotification('<p>خطا در ذخیره تنظیمات!</p>');
        }
    }

    async function addNewService() {
        const newService = {
            name: 'خدمت جدید',
            start_number: 1,
            end_number: 999,
            manual_time: 5,
            work_hours_start: '08:00',
            work_hours_end: '17:00',
            disabled: false,
            auto_reset: false
        };

        try {
            await databases.createDocument(DATABASE_ID, SERVICES_COLLECTION_ID, ID.unique(), newService);
            await fetchServices();
            renderServiceSettings();
        } catch (error) {
            console.error('Error adding new service:', error);
            showPopupNotification('<p>خطا در افزودن خدمت جدید!</p>');
        }
    }

    async function deleteService(serviceId) {
        if (!confirm('آیا مطمئن هستید؟ این عمل قابل بازگشت نیست.')) return;
        
        try {
            await databases.deleteDocument(DATABASE_ID, SERVICES_COLLECTION_ID, serviceId);
            await fetchServices();
            renderServiceSettings();
            showPopupNotification('<p>خدمت با موفقیت حذف شد.</p>');
        } catch (error) {
            console.error('Error deleting service:', error);
            showPopupNotification('<p>خطا در حذف خدمت!</p>');
        }
    }

    // --- PASS TICKET LOGIC ---
    function openPassServiceSelection() {
        passServiceList.innerHTML = '';
        services.forEach(service => {
            const div = document.createElement('div');
            div.className = 'service-checkbox';
            
            const isDisabled = service.disabled === true;
            if (isDisabled) {
                div.classList.add('disabled-service');
            }
            
            div.innerHTML = `<input type="checkbox" id="pass-service-${service.$id}" value="${service.$id}" ${isDisabled ? 'disabled' : ''}>
                             <label for="pass-service-${service.$id}">${service.name} ${isDisabled ? '(غیرفعال)' : ''}</label>`;
            passServiceList.appendChild(div);
        });
        passServiceModalOverlay.style.display = 'flex';
    }

    function closePassServiceSelection() {
        passServiceModalOverlay.style.display = 'none';
        tempSelectedServicesForPass = [];
    }

    function confirmPassServiceSelection() {
        const selectedServices = Array.from(passServiceList.querySelectorAll('input[type="checkbox"]:checked:not(:disabled)'))
            .map(cb => cb.value);
        
        if (selectedServices.length === 0) {
            alert('لطفا حداقل یک خدمت را انتخاب کنید.');
            return;
        }
        
        tempSelectedServicesForPass = selectedServices;
        closePassServiceSelection();
        openTicketForm('pass');
    }

    // --- EVENT LISTENERS ---
    loginBtn.addEventListener('click', login);
    logoutBtn.addEventListener('click', logout);
    settingsBtn.addEventListener('click', openAdminPanel);
    counterSettingsBtn.addEventListener('click', openCounterSettingsModal);
    resetAllBtn.addEventListener('click', resetAllTickets);
    callNextBtn.addEventListener('click', callNextTicket);
    passTicketBtn.addEventListener('click', openPassServiceSelection);
    submitTicketBtn.addEventListener('click', () => {
        const mode = ticketForm.dataset.mode;
        const firstName = document.getElementById('first-name').value;
        const lastName = document.getElementById('last-name').value;
        const nationalId = document.getElementById('national-id').value;
        
        if (mode === 'regular') {
            generateTicket(ticketForm.dataset.serviceId, firstName, lastName, nationalId);
        } else if (mode === 'pass') {
            const delayCount = parseInt(document.getElementById('pass-delay-count').value) || 0;
            generatePassTicket(firstName, lastName, nationalId, delayCount);
        }
    });
    cancelTicketBtn.addEventListener('click', closeTicketForm);
    saveCounterBtn.addEventListener('click', saveCounterSettings);
    cancelCounterBtn.addEventListener('click', closeCounterSettingsModal);
    closeSettingsBtn.addEventListener('click', closeAdminPanel);
    cancelSettingsBtn.addEventListener('click', closeAdminPanel);
    saveSettingsBtn.addEventListener('click', saveServiceSettings);
    addServiceBtn.addEventListener('click', addNewService);
    confirmPassServiceBtn.addEventListener('click', confirmPassServiceSelection);
    cancelPassServiceBtn.addEventListener('click', closePassServiceSelection);

    serviceList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-service-btn')) {
            deleteService(e.target.dataset.id);
        }
    });

    // --- INITIALIZE APP ---
    initializeApp();
});