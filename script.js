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
// --- AUTHENTICATION & UI TOGGLES ---
async function login() {
    try {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!email || !password) {
            alert('لطفا ایمیل و رمز عبور را وارد کنید.');
            return;
        }
        
        console.log('Attempting login with:', email);
        
        await account.createEmailSession(email, password);
        console.log('Login successful');
        
        // بارگذاری مجدد برنامه
        await initializeApp();
        
    } catch (error) {
        console.error('Login error:', error);
        alert('خطا در ورود: ' + (error.message || 'لطفا اطلاعات را بررسی کنید'));
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
            const button = document.createElement('button');
            button.className = 'service-btn';
            
            // Check if service is disabled
            const isDisabled = service.disabled === true;
            const waitingCount = tickets.filter(t => t.service_id === service.$id && t.status === 'در حال انتظار').length;
            
            // Add disabled class if service is disabled
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
            
            // Check if service is disabled
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

        // Check if service is disabled - برای همه کاربران (هم اپراتور هم کیوسک)
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

        // Check if service is disabled - برای همه کاربران (هم اپراتور هم کیوسک)
        const isDisabled = service.disabled === true;
        if (isDisabled) {
            showPopupNotification('<p>این خدمت در حال حاضر غیرفعال است. امکان ثبت نوبت جدید وجود ندارد.</p>');
            return;
        }

        // محاسبه شماره نوبت کلی (همیشه باید پشت سر هم باشد)
        const allTickets = await databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID, [
            Query.orderDesc('$createdAt'),
            Query.limit(1)
        ]);
        const lastGeneralTicket = allTickets.documents.length > 0 ? 
            parseInt(allTickets.documents[0].general_ticket) : 0;
        const generalNumber = lastGeneralTicket + 1;

        // محاسبه شماره نوبت خاص برای این سرویس
        const serviceTickets = await databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID, [
            Query.equal('service_id', serviceId),
            Query.equal('ticket_type', 'regular'),
            Query.orderDesc('$createdAt'),
            Query.limit(1)
        ]);
        const lastSpecificTicket = serviceTickets.documents.length > 0 ? 
            parseInt(serviceTickets.documents[0].specific_ticket) : service.start_number - 1;
        const specificNumber = lastSpecificTicket + 1;

        // بررسی محدوده شماره سرویس
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
        // بررسی اجباری بودن نام و نام خانوادگی برای پاس نوبت
        if (!firstName || !lastName) {
            alert('برای ثبت پاس نوبت، وارد کردن نام و نام خانوادگی الزامی است.');
            return;
        }

        if (nationalId && !checkCodeMeli(nationalId)) {
            alert('کد ملی وارد شده معتبر نیست.');
            return;
        }
        if (tempSelectedServicesForPass.length === 0) return;

        // محاسبه شماره نوبت کلی (همیشه باید پشت سر هم باشد)
        const allTickets = await databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID, [
            Query.orderDesc('$createdAt'),
            Query.limit(1)
        ]);
        const lastGeneralTicket = allTickets.documents.length > 0 ? 
            parseInt(allTickets.documents[0].general_ticket) : 0;
        const generalNumber = lastGeneralTicket + 1;

        const creationPromises = tempSelectedServicesForPass.map((serviceId, index) => {
            const service = services.find(s => s.$id === serviceId);
            // Check if service is disabled - برای همه کاربران
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

// --- TICKET CALLING LOGIC ---
async function callNextTicket() {
    console.log('=== CALL NEXT TICKET STARTED ===');
    
    // بررسی لاگین بودن کاربر
    if (!currentUser) {
        console.error('User not logged in');
        showPopupNotification('<p>لطفا ابتدا وارد سیستم شوید.</p>');
        return;
    }
    
    // بررسی وجود خدمات
    if (services.length === 0) {
        console.error('No services loaded');
        showPopupNotification('<p>خدمات بارگذاری نشده‌اند. لطفا صفحه را رفرش کنید.</p>');
        return;
    }
    
    // بررسی تنظیمات کاربر
    const userPrefs = currentUser.prefs || {};
    const counterName = userPrefs.counter_name;
    const serviceSelections = userPrefs.service_selections || {};
    
    console.log('User prefs:', userPrefs);
    console.log('Counter name:', counterName);
    console.log('Service selections:', serviceSelections);
    
    if (!counterName) {
        console.error('Counter name not set');
        showPopupNotification('<p>لطفا ابتدا شماره باجه خود را تنظیم کنید.</p>');
        return;
    }
    
    const selectedServiceIds = Object.keys(serviceSelections).filter(id => serviceSelections[id]);
    console.log('Selected service IDs:', selectedServiceIds);
    
    if (selectedServiceIds.length === 0) {
        console.error('No services selected');
        showPopupNotification('<p>لطفا حداقل یک خدمت را برای فراخوانی انتخاب کنید.</p>');
        return;
    }
    
    try {
        // دریافت تیکت‌های به‌روز از سرور
        console.log('Fetching latest tickets...');
        await fetchTickets();
        console.log('Tickets loaded:', tickets.length);
        
        // فیلتر تیکت‌های در حال انتظار برای خدمات انتخابی
        const waitingTickets = tickets
            .filter(t => t.status === 'در حال انتظار' && selectedServiceIds.includes(t.service_id))
            .sort((a, b) => new Date(a.$createdAt) - new Date(b.$createdAt));
        
        console.log('Waiting tickets for selected services:', waitingTickets);
        
        if (waitingTickets.length === 0) {
            console.log('No waiting tickets found');
            showPopupNotification(`
                <p>هیچ نوبتی در صف انتظار برای خدمات انتخابی شما نیست.</p>
                <p style="font-size: 14px; margin-top: 10px;">
                    خدمات انتخابی: ${selectedServiceIds.map(id => {
                        const service = services.find(s => s.$id === id);
                        return service ? service.name : 'نامشخص';
                    }).join(', ')}
                </p>
            `);
            return;
        }
        
        // پیدا کردن تیکت بعدی برای فراخوانی
        let ticketToCall = null;
        
        // اولویت 1: پاس‌هایی که delay_count = 0
        const passedTickets = waitingTickets.filter(t => t.ticket_type === 'pass' && t.delay_count === 0);
        if (passedTickets.length > 0) {
            ticketToCall = passedTickets[0];
            console.log('Selected pass ticket:', ticketToCall);
        } else {
            // اولویت 2: تیکت‌های معمولی
            const regularTickets = waitingTickets.filter(t => t.ticket_type === 'regular');
            if (regularTickets.length > 0) {
                ticketToCall = regularTickets[0];
                console.log('Selected regular ticket:', ticketToCall);
            }
        }
        
        if (!ticketToCall) {
            console.log('No suitable ticket found');
            showPopupNotification('<p>هیچ نوبت مناسبی برای فراخوانی پیدا نشد.</p>');
            return;
        }
        
        // فراخوانی تیکت
        console.log('Calling ticket:', ticketToCall);
        
        const updatedTicket = await databases.updateDocument(
            DATABASE_ID, 
            TICKETS_COLLECTION_ID, 
            ticketToCall.$id, 
            {
                status: 'در حال سرویس',
                called_by: currentUser.$id,
                called_by_name: currentUser.name,
                called_by_counter_name: counterName,
                call_time: new Date().toISOString()
            }
        );
        
        console.log('Ticket called successfully:', updatedTicket);
        
        // نمایش پیام موفقیت
        const service = services.find(s => s.$id === updatedTicket.service_id);
        const popupMessage = `
            <span class="ticket-number">${updatedTicket.specific_ticket || 'پاس'}</span>
            <p><strong>نام:</strong> ${updatedTicket.first_name} ${updatedTicket.last_name}</p>
            <p><strong>خدمت:</strong> ${service ? service.name : '---'}</p>
            <p><strong>باجه:</strong> ${counterName}</p>
        `;
        showPopupNotification(popupMessage);
        
        // به‌روزرسانی وضعیت تیکت قبلی اگر وجود داشت
        if (lastCalledTicket[currentUser.$id]) {
            const lastTicket = tickets.find(t => t.$id === lastCalledTicket[currentUser.$id]);
            if (lastTicket && lastTicket.status === 'در حال سرویس') {
                // می‌توانید وضعیت تیکت قبلی را به "اتمام" تغییر دهید اگر نیاز است
            }
        }
        
        lastCalledTicket[currentUser.$id] = updatedTicket.$id;
        
    } catch (error) {
        console.error('Error in callNextTicket:', error);
        showPopupNotification('<p>خطا در فراخوانی نوبت. لطفا دوباره تلاش کنید.</p>');
    }
    
    console.log('=== CALL NEXT TICKET COMPLETED ===');
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
            
            // تنظیم required برای فیلدهای نام و نام خانوادگی در حالت پاس
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
        document.getElementById('pass-delay-count').value = 0;
        
        // حذف required هنگام بستن فرم
        document.getElementById('first-name').required = false;
        document.getElementById('last-name').required = false;
    }

    // اضافه کردن این بخش بعد از تعریف متغیرها در script.js

// --- COUNTER NUMBER LOGIC ---
function showCounterNumberModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'counter-modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal">
            <h2>تعیین شماره باجه</h2>
            <p>لطفا شماره باجه خود را وارد کنید:</p>
            <div class="form-group">
                <input type="text" id="counter-number-input" placeholder="شماره باجه" maxlength="20">
            </div>
            <div class="form-actions">
                <button id="save-counter-btn" class="primary-btn">ذخیره</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('save-counter-btn').addEventListener('click', saveCounterNumber);
}

async function saveCounterNumber() {
    const counterNumber = document.getElementById('counter-number-input').value.trim();
    
    if (!counterNumber) {
        alert('لطفا شماره باجه را وارد کنید.');
        return;
    }
    
    try {
        const userPrefs = currentUser.prefs || {};
        await account.updatePrefs({ 
            ...userPrefs, 
            counter_name: counterNumber 
        });
        
        currentUser.prefs = await account.getPrefs();
        document.getElementById('counter-modal-overlay').remove();
        
        // بعد از تنظیم شماره باجه، خدمات انتخابی را نمایش می‌دهیم
        showServiceSelectionModal();
    } catch (error) {
        console.error('Error saving counter number:', error);
        alert('خطا در ذخیره شماره باجه');
    }
}

function showServiceSelectionModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'service-selection-modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal">
            <h2>انتخاب خدمات برای فراخوانی</h2>
            <p>لطفا خدمات مورد نظر خود برای فراخوانی را انتخاب کنید:</p>
            <div id="mandatory-service-checkboxes" class="service-checkboxes-container"></div>
            <div class="form-actions">
                <button id="save-services-btn" class="primary-btn">ذخیره و ادامه</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    renderMandatoryServiceCheckboxes();
    document.getElementById('save-services-btn').addEventListener('click', saveMandatoryServices);
}

function renderMandatoryServiceCheckboxes() {
    const container = document.getElementById('mandatory-service-checkboxes');
    container.innerHTML = '';
    
    services.forEach(service => {
        const div = document.createElement('div');
        div.className = 'service-checkbox';
        
        const isDisabled = service.disabled === true;
        if (isDisabled) {
            div.classList.add('disabled-service');
        }
        
        div.innerHTML = `
            <input type="checkbox" id="mandatory-service-${service.$id}" value="${service.$id}" ${isDisabled ? 'disabled' : ''}>
            <label for="mandatory-service-${service.$id}">${service.name} ${isDisabled ? '(غیرفعال)' : ''}</label>
        `;
        container.appendChild(div);
    });
}

async function saveMandatoryServices() {
    const selectedServices = [];
    document.querySelectorAll('#mandatory-service-checkboxes input[type="checkbox"]:checked').forEach(cb => {
        selectedServices.push(cb.value);
    });
    
    if (selectedServices.length === 0) {
        alert('لطفا حداقل یک خدمت را برای فراخوانی انتخاب کنید.');
        return;
    }
    
    try {
        const userPrefs = currentUser.prefs || {};
        const serviceSelections = {};
        selectedServices.forEach(serviceId => {
            serviceSelections[serviceId] = true;
        });
        
        await account.updatePrefs({ 
            ...userPrefs, 
            service_selections: serviceSelections 
        });
        
        currentUser.prefs = await account.getPrefs();
        document.getElementById('service-selection-modal-overlay').remove();
        
        // ادامه برنامه
        await fetchData();
        setupRealtimeSubscriptions();
        checkAutoReset();
    } catch (error) {
        console.error('Error saving service selections:', error);
        alert('خطا در ذخیره خدمات انتخابی');
    }
}

function checkUserPreferences() {
    const userPrefs = currentUser.prefs || {};
    
    // بررسی وجود شماره باجه
    if (!userPrefs.counter_name) {
        showCounterNumberModal();
        return false;
    }
    
    // بررسی وجود خدمات انتخابی
    const serviceSelections = userPrefs.service_selections || {};
    const hasSelectedServices = Object.values(serviceSelections).some(val => val === true);
    
    if (!hasSelectedServices) {
        // ابتدا مطمئن شویم خدمات بارگذاری شده‌اند
        if (services.length === 0) {
            // اگر خدمات هنوز بارگذاری نشده، منتظر می‌مانیم
            setTimeout(() => checkUserPreferences(), 100);
            return false;
        }
        showServiceSelectionModal();
        return false;
    }
    
    return true;
}

// تغییر در تابع initializeApp برای بررسی تنظیمات کاربر

// --- INITIALIZATION ---
async function initializeApp() {
    try {
        currentUser = await account.get();
        console.log('User logged in:', currentUser);
        
        // ابتدا خدمات را دریافت می‌کنیم
        await fetchServices();
        console.log('Services loaded:', services.length);
        
        // بررسی تنظیمات کاربر
        if (!checkUserPreferences()) {
            console.log('User preferences not set, waiting for user input...');
            return; // منتظر می‌مانیم تا کاربر تنظیمات را تکمیل کند
        }
        
        showLoggedInUI();
        await fetchData();
        setupRealtimeSubscriptions();
        checkAutoReset();
        
        console.log('App initialized successfully');
        
    } catch (error) {
        console.log('User not logged in or session expired:', error);
        showLoggedOutUI();
    }
}
// اضافه کردن دکمه تغییر شماره باجه در تابع showLoggedInUI
function showLoggedInUI() {
    loginFields.style.display = 'none';
    userInfo.style.display = 'flex';
    
    const userPrefs = currentUser.prefs || {};
    const counterName = userPrefs.counter_name || 'تعیین نشده';
    
    userGreeting.innerHTML = `کاربر: ${currentUser.name || currentUser.email} <span class="counter-badge">(باجه: ${counterName})</span>`;
    mainContent.style.display = 'block';
    totalWaitingContainer.style.display = 'block';

    if (currentUser.prefs && currentUser.prefs.role === 'admin') {
        settingsBtn.style.display = 'inline-block';
        resetAllBtn.style.display = 'inline-block';
    } else {
        settingsBtn.style.display = 'none';
        resetAllBtn.style.display = 'none';
    }
    
    // اضافه کردن دکمه تغییر شماره باجه
    if (!document.getElementById('change-counter-btn')) {
        const changeCounterBtn = document.createElement('button');
        changeCounterBtn.id = 'change-counter-btn';
        changeCounterBtn.textContent = 'تغییر شماره باجه';
        changeCounterBtn.className = 'secondary-btn';
        changeCounterBtn.style.marginRight = '10px';
        changeCounterBtn.addEventListener('click', showCounterNumberModal);
        userInfo.insertBefore(changeCounterBtn, settingsBtn);
    }
}

// تغییر در تابع callNextTicket برای بررسی خدمات انتخابی
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
        showPopupNotification('<p>لطفا ابتدا خدمات مورد نظر برای فراخوانی را از طریق دکمه "تغییر شماره باجه" انتخاب کنید.</p>');
        return;
    }

    // بقیه کد بدون تغییر...
}
    function openPassServiceModal() {
        passServiceList.innerHTML = '';
        services.forEach(service => {
            const div = document.createElement('div');
            div.className = 'service-checkbox';
            
            // Check if service is disabled
            const isDisabled = service.disabled === true;
            if (isDisabled) {
                div.classList.add('disabled-service');
            }
            
            div.innerHTML = `<input type="checkbox" id="pass-check-${service.$id}" value="${service.$id}" ${isDisabled ? 'disabled' : ''}>
                             <label for="pass-check-${service.$id}">${service.name} ${isDisabled ? '(غیرفعال)' : ''}</label>`;
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
                <td><input type="number" value="${service.manual_time}" class="setting-manual-time"></td>
                <td><input type="text" value="${service.work_hours_start || '08:00'}" class="setting-work-start"></td>
                <td><input type="text" value="${service.work_hours_end || '17:00'}" class="setting-work-end"></td>
                <td><input type="checkbox" ${service.disabled ? 'checked' : ''} class="setting-disabled"></td>
                <td><input type="checkbox" ${service.auto_reset ? 'checked' : ''} class="setting-auto-reset"></td>
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
            <td><input type="text" value="08:00" class="setting-work-start"></td>
            <td><input type="text" value="17:00" class="setting-work-end"></td>
            <td><input type="checkbox" class="setting-disabled"></td>
            <td><input type="checkbox" class="setting-auto-reset"></td>
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

            // Create data object with safe defaults
            const data = {
                name: row.querySelector('.setting-name').value,
                start_number: parseInt(row.querySelector('.setting-start').value) || 100,
                end_number: parseInt(row.querySelector('.setting-end').value) || 199,
                manual_time: parseInt(row.querySelector('.setting-manual-time').value) || 10,
                work_hours_start: row.querySelector('.setting-work-start').value || '08:00',
                work_hours_end: row.querySelector('.setting-work-end').value || '17:00'
            };

            // Only add new fields if they exist in the database
            const disabledCheckbox = row.querySelector('.setting-disabled');
            const autoResetCheckbox = row.querySelector('.setting-auto-reset');
            
            if (disabledCheckbox) {
                data.disabled = disabledCheckbox.checked;
            }
            
            if (autoResetCheckbox) {
                data.auto_reset = autoResetCheckbox.checked;
            }

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
            showPopupNotification('<p>خطا در ذخیره تنظیمات! لطفا فیلدهای جدید را در دیتابیس اضافه کنید.</p>');
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
        return new Date(dateString).toLocaleString('fa-IR');
    }

    // --- EVENT LISTENERS ---
    loginBtn.addEventListener('click', login);
    logoutBtn.addEventListener('click', logout);
    settingsBtn.addEventListener('click', openAdminPanel);
    resetAllBtn.addEventListener('click', resetAllTickets);
    callNextBtn.addEventListener('click', async () => {
    console.log('Call Next button clicked');
    await callNextTicket();
    });
    passTicketBtn.addEventListener('click', openPassServiceModal);
    submitTicketBtn.addEventListener('click', () => {
        const firstName = document.getElementById('first-name').value;
        const lastName = document.getElementById('last-name').value;
        const nationalId = document.getElementById('national-id').value;
        const mode = ticketForm.dataset.mode;

        if (mode === 'regular') {
            generateTicket(ticketForm.dataset.serviceId, firstName, lastName, nationalId);
        } else if (mode === 'pass') {
            const delayCount = parseInt(document.getElementById('pass-delay-count').value);
            generatePassTicket(firstName, lastName, nationalId, delayCount);
        }
    });
    cancelTicketBtn.addEventListener('click', closeTicketForm);
    addServiceBtn.addEventListener('click', addNewServiceRow);
    saveSettingsBtn.addEventListener('click', saveSettings);
    closeSettingsBtn.addEventListener('click', () => adminPanel.style.display = 'none');
    cancelSettingsBtn.addEventListener('click', () => adminPanel.style.display = 'none');
    confirmPassServiceBtn.addEventListener('click', () => {
        tempSelectedServicesForPass = [];
        passServiceList.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            tempSelectedServicesForPass.push(cb.value);
        });
        if (tempSelectedServicesForPass.length === 0) {
            alert('لطفا حداقل یک خدمت را انتخاب کنید.');
            return;
        }
        passServiceModalOverlay.style.display = 'none';
        openTicketForm('pass');
    });
    cancelPassServiceBtn.addEventListener('click', () => passServiceModalOverlay.style.display = 'none');

    // --- INITIALIZE APP ---
    initializeApp();
});
