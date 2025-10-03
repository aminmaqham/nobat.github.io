document.addEventListener('DOMContentLoaded', () => {
    // --- APPWRITE SETUP ---
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
    const photographyModal = document.getElementById('photography-modal');
    const manualTicketInput = document.getElementById('manual-ticket-input');
    const manualPhotographyBtn = document.getElementById('manual-photography-btn');
    const photographyRoleCheckbox = document.getElementById('photography-role-checkbox');
    const photographyWaitingCount = document.getElementById('photography-waiting-count');
    const photographyTicketNumber = document.getElementById('photography-ticket-number');
    const photographyCustomerName = document.getElementById('photography-customer-name');
    const photographyNationalIdInput = document.getElementById('photography-national-id');
    const confirmPhotographyBtn = document.getElementById('confirm-photography-btn');
    const cancelPhotographyBtn = document.getElementById('cancel-photography-btn');
    const photographyDisplay = document.getElementById('photography-display');
    const photographyListContainer = document.getElementById('photography-list');
    const loginBtn = document.getElementById('login-btn');
    const pastTicketInput = document.getElementById('past-ticket-input');
    const callPastBtn = document.getElementById('call-past-btn');
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
    let photographyList = [];
    let currentTicketForPhotography = null;
    let isPhotographyUser = false;
    let reservedPhotographyTicket = null;

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
            
            // بارگذاری وضعیت کاربر عکاسی
            const userPrefs = currentUser.prefs || {};
            isPhotographyUser = userPrefs.is_photography_user || false;
            photographyRoleCheckbox.checked = isPhotographyUser;
            
            showLoggedInUI();
            await fetchData();
            setupRealtimeSubscriptions();
            checkAutoReset();
            loadPhotographyList();
            updatePhotographyUI();
            updateUIForUserRole();
            
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
        const roleDisplay = userPrefs.role === 'photography' ? ' (عکاسی)' : '';
        userGreeting.textContent = `کاربر: ${currentUser.name || currentUser.email} (باجه: ${counterName}${roleDisplay})`;
        
        mainContent.style.display = 'block';
        totalWaitingContainer.style.display = 'block';
        
        // نمایش لیست عکاسی
        photographyDisplay.style.display = 'flex';

        if (currentUser.prefs && currentUser.prefs.role === 'admin') {
            settingsBtn.style.display = 'inline-block';
            resetAllBtn.style.display = 'inline-block';
        } else {
            settingsBtn.style.display = 'none';
            resetAllBtn.style.display = 'none';
        }
        
        // دکمه تنظیمات باجه همیشه نمایش داده می‌شود
        counterSettingsBtn.style.display = 'inline-block';
        
        // به‌روزرسانی UI برای نقش عکاسی
        updateUIForPhotographyRole();
    }

    function showLoggedOutUI() {
        loginFields.style.display = 'flex';
        userInfo.style.display = 'none';
        mainContent.style.display = 'none';
        totalWaitingContainer.style.display = 'none';
    }

    // --- REALTIME ---
    function setupRealtimeSubscriptions() {
        console.log('Setting up enhanced real-time subscriptions...');
        
        // نظارت بر تغییرات در دیتابیس نوبت‌ها
        const ticketChannel = `databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents`;
        client.subscribe(ticketChannel, (response) => {
            console.log('Real-time ticket update detected:', response);
            
            if (response.events.includes(`databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents.*.update`) ||
                response.events.includes(`databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents.*.create`) ||
                response.events.includes(`databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents.*.delete`)) {
                
                // به‌روزرسانی فوری داده‌ها
                fetchData().then(() => {
                    console.log('Tickets updated in real-time');
                    updateTotalWaitingCount();
                });
            }
        });
        
        // نظارت بر تغییرات در دیتابیس خدمات
        const serviceChannel = `databases.${DATABASE_ID}.collections.${SERVICES_COLLECTION_ID}.documents`;
        client.subscribe(serviceChannel, (response) => {
            console.log('Real-time service update detected:', response);
            fetchData().then(() => {
                console.log('Services updated in real-time');
            });
        });
        
        // سیستم پیشرفته sync برای لیست عکاسی
        setupPhotographySync();
    }

    // --- سیستم sync پیشرفته برای لیست عکاسی ---
    function setupPhotographySync() {
        // نظارت بر تغییرات localStorage بین تب‌ها
        window.addEventListener('storage', (e) => {
            if (e.key === 'photographyList' || e.key === 'photographyListUpdate') {
                console.log('Photography list updated from another tab/window');
                handleExternalPhotographyUpdate();
            }
        });
        
        // نظارت بر custom events
        window.addEventListener('photographyListUpdated', () => {
            console.log('Photography list updated via custom event');
            handlePhotographyUpdate();
        });
        
        // بررسی دوره‌ای تغییرات
        let lastPhotographyCheck = Date.now();
        setInterval(() => {
            const currentTime = Date.now();
            const lastUpdate = parseInt(localStorage.getItem('photographyListUpdate') || '0');
            
            if (lastUpdate > lastPhotographyCheck) {
                console.log('Periodic check detected photography list update');
                handleExternalPhotographyUpdate();
                lastPhotographyCheck = currentTime;
            }
        }, 1000);
    }

    function handleExternalPhotographyUpdate() {
        loadPhotographyList();
        updatePhotographyUI();
        renderPhotographyList();
        
        // تریگر به‌روزرسانی نمایشگر
        triggerDisplayUpdate();
    }

    function handlePhotographyUpdate() {
        updatePhotographyUI();
        renderPhotographyList();
    }

    // --- UI RENDERING ---
    function updateTotalWaitingCount() {
        // شمردن تمام نوبت‌های با وضعیت "در حال انتظار" بدون هیچ محدودیتی
        const waitingCount = tickets.filter(t => t.status === 'در حال انتظار').length;
        document.getElementById('total-waiting-count').textContent = waitingCount;
        console.log(`Total waiting count: ${waitingCount} tickets`);
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

    // --- CALL NEXT TICKET LOGIC ---
    async function callNextTicket() {
        console.log('Call next ticket clicked - isPhotographyUser:', isPhotographyUser);
        
        if (isPhotographyUser) {
            console.log('Processing photography ticket...');
            await processPhotographyTicket();
            return;
        }
        
        console.log('Processing regular ticket...');
        const selections = (currentUser.prefs && currentUser.prefs.service_selections) || {};
        console.log('Selected services:', selections);
        await callNextRegularTicket(selections);
    }

    // اصلاح تابع processPhotographyTicket
    async function processPhotographyTicket() {
        console.log('Processing photography ticket - isPhotographyUser:', isPhotographyUser);
        
        // اگر نوبتی رزرو شده باشد، آن را پردازش کن
        if (reservedPhotographyTicket) {
            console.log('Found reserved ticket:', reservedPhotographyTicket.ticketNumber);
            await handleReservedPhotographyTicket();
            return;
        }
        
        // پیدا کردن اولین نوبت در لیست عکاسی که عکس آن گرفته نشده و رزرو نشده
        const nextPhotographyItem = photographyList.find(item => !item.photoTaken && !item.reserved);
        console.log('Next photography item found:', nextPhotographyItem);
        
        if (nextPhotographyItem) {
            // نمایش نوتیفیکیشن پیشرفته عکاسی
            console.log('Showing photography notification for:', nextPhotographyItem.ticketNumber);
            showPhotographyNotification(nextPhotographyItem);
        } else {
            // اگر نوبتی در لیست عکاسی نیست، از خدمات انتخابی فراخوانی کن
            console.log('No photography items available, calling regular tickets');
            const selections = (currentUser.prefs && currentUser.prefs.service_selections) || {};
            await callNextRegularTicket(selections);
        }
    }

    async function handleReservedPhotographyTicket() {
        const confirmMessage = `نوبت رزرو شده: ${reservedPhotographyTicket.ticketNumber}\nکد ملی: ${reservedPhotographyTicket.nationalId}\n\nآیا عکس گرفته شد؟`;
        
        if (confirm(confirmMessage)) {
            await markPhotoAsTaken(reservedPhotographyTicket.id);
            showPopupNotification(`<p>عکس برای نوبت ${reservedPhotographyTicket.ticketNumber} ثبت شد.</p>`);
            
            // برگرداندن نوبت به صاحب اصلی
            await returnTicketToOriginalUser(reservedPhotographyTicket);
            
            reservedPhotographyTicket = null;
        } else {
            // اگر عکس گرفته نشد، همچنان رزرو باقی بماند
            showPopupNotification(`<p>نوبت ${reservedPhotographyTicket.ticketNumber} همچنان رزرو شده است.</p>`);
        }
    }

    async function handlePhotographyTicket(photographyItem) {
        const actionChoice = confirm(`نوبت: ${photographyItem.ticketNumber}\nکد ملی: ${photographyItem.nationalId}\n\nآیا می‌خواهید این نوبت را رزرو کنید؟\n\n"تایید" = رزرو کردن\n"لغو" = عکس گرفتن و تکمیل`);
        
        if (actionChoice) {
            // رزرو نوبت
            await reservePhotographyTicket(photographyItem.id);
            reservedPhotographyTicket = photographyItem;
        } else {
            // عکس گرفتن مستقیم و تکمیل
            await markPhotoAsTaken(photographyItem.id);
            
            // برگرداندن نوبت به صاحب اصلی
            await returnTicketToOriginalUser(photographyItem);
        }
    }

    // --- اصلاح کامل تابع callNextRegularTicket ---
    async function callNextRegularTicket(selections) {
        const selectedServiceIds = Object.keys(selections).filter(id => selections[id]);

        if (selectedServiceIds.length === 0) {
            showPopupNotification('<p>لطفا حداقل یک خدمت را برای فراخوانی انتخاب کنید.</p>');
            return;
        }

        let ticketToCall = null;
        
        // اولویت با نوبت‌های آماده بازگشت از عکاسی
        const readyPhotographyTickets = photographyList
            .filter(item => item.readyToReturn && !item.returned && item.originalUserId === currentUser.$id)
            .sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));

        if (readyPhotographyTickets.length > 0) {
            const readyItem = readyPhotographyTickets[0];
            ticketToCall = tickets.find(t => t.$id === readyItem.ticketId);
            
            if (ticketToCall) {
                // علامت‌گذاری به عنوان بازگشته
                readyItem.returned = true;
                await savePhotographyList();
                updatePhotographyUI();
                renderPhotographyList();
            }
        }

        // اگر نوبت آماده عکاسی نبود، از صف عادی فراخوانی کن
        if (!ticketToCall) {
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
                
                // استفاده از نوتیفیکیشن جدید
                const service = services.find(s => s.$id === updatedTicket.service_id);
                const isFromPhotography = readyPhotographyTickets.length > 0;
                showCallNotification(updatedTicket, service, counterName, isFromPhotography);
                
            } catch (error) {
                console.error('Error calling next ticket:', error);
                showPopupNotification('<p>خطا در فراخوانی نوبت!</p>');
            }
        } else {
            showPopupNotification('<p>هیچ نوبتی در صف انتظار برای خدمات انتخابی نیست.</p>');
        }
    }

    // --- بهبود یافته SHOW CALL NOTIFICATION ---
    function showCallNotification(ticket, service, counterName, isFromPhotography = false) {
        console.log('=== showCallNotification ===', ticket.specific_ticket);
        
        const popupMessage = `
            <div class="call-notification">
                <h3>فراخوانی نوبت</h3>
                <div class="ticket-number-large">${ticket.specific_ticket || 'پاس'}</div>
                <div class="customer-info">
                    <p><strong>نام:</strong> ${ticket.first_name} ${ticket.last_name}</p>
                    <p><strong>کد ملی:</strong> ${ticket.national_id}</p>
                    <p><strong>خدمت:</strong> ${service?.name || '---'}</p>
                    <p><strong>باجه:</strong> ${counterName}</p>
                    ${isFromPhotography ? '<p style="color: #4CAF50; font-weight: bold;">(بازگشته از عکاسی)</p>' : ''}
                </div>
                <div class="action-buttons">
                    <button class="action-btn send-to-photo-btn" onclick="window.sendToPhotography('${ticket.$id}')">
                        ارسال به عکاسی
                    </button>
                    <button class="action-btn next-ticket-btn" onclick="window.callNextAfterNotification()">
                        فراخوان بعدی
                    </button>
                </div>
            </div>
        `;
        
        showPopupNotification(popupMessage);
    }

    // --- فراخوانی نوبت گذشته خاص ---
    async function callPastTicket() {
        const ticketNumber = pastTicketInput.value.trim();
        
        if (!ticketNumber) {
            showPopupNotification('<p>لطفا شماره نوبت گذشته را وارد کنید.</p>');
            pastTicketInput.classList.add('error');
            return;
        }

        if (!currentUser) {
            showPopupNotification('<p>لطفا ابتدا وارد سیستم شوید.</p>');
            return;
        }

        try {
            // جستجوی نوبت گذشته (می‌تواند در هر وضعیتی باشد)
            const pastTicket = tickets.find(t => 
                t.specific_ticket == ticketNumber || t.general_ticket == ticketNumber
            );

            if (!pastTicket) {
                showPopupNotification(`<p>نوبت ${ticketNumber} در سیستم یافت نشد.</p>`);
                pastTicketInput.classList.add('error');
                return;
            }

            const userPrefs = currentUser.prefs || {};
            const counterName = userPrefs.counter_name || 'باجه';
            
            // آپدیت نوبت به وضعیت "در حال سرویس" با زمان جدید
            const updatedTicket = await databases.updateDocument(
                DATABASE_ID, 
                TICKETS_COLLECTION_ID, 
                pastTicket.$id, 
                {
                    status: 'در حال سرویس',
                    called_by: currentUser.$id,
                    called_by_name: currentUser.name || currentUser.email,
                    called_by_counter_name: counterName,
                    call_time: new Date().toISOString()
                }
            );

            lastCalledTicket[currentUser.$id] = updatedTicket.$id;
            
            const service = services.find(s => s.$id === updatedTicket.service_id);
            
            // نمایش نوتیفیکیشن دقیقاً مانند فراخوانی عادی
            const popupMessage = `
                <span class="ticket-number">${updatedTicket.specific_ticket || 'پاس'}</span>
                <p><strong>نام:</strong> ${updatedTicket.first_name} ${updatedTicket.last_name}</p>
                <p><strong>کد ملی:</strong> ${updatedTicket.national_id}</p>
                <p><strong>خدمت:</strong> ${service?.name || '---'}</p>
                <p><strong>باجه:</strong> ${counterName}</p>
            `;
            showPopupNotification(popupMessage);
            
            // پاک کردن فیلد ورودی
            pastTicketInput.value = '';
            pastTicketInput.classList.remove('error');
            
        } catch (error) {
            console.error('Error calling past ticket:', error);
            showPopupNotification('<p>خطا در فراخوانی نوبت گذشته!</p>');
            pastTicketInput.classList.add('error');
        }
    }

    // --- PASS TICKET LOGIC ---
    async function passTicket() {
        if (!currentUser) return;
        
        const selections = (currentUser.prefs && currentUser.prefs.service_selections) || {};
        const selectedServiceIds = Object.keys(selections).filter(id => selections[id]);
        
        if (selectedServiceIds.length === 0) {
            showPopupNotification('<p>لطفا حداقل یک خدمت را برای پاس کردن انتخاب کنید.</p>');
            return;
        }

        // نمایش مودال انتخاب خدمات برای پاس
        showPassServiceModal(selectedServiceIds);
    }

    function showPassServiceModal(selectedServiceIds) {
        passServiceList.innerHTML = '';
        tempSelectedServicesForPass = [];
        
        selectedServiceIds.forEach(serviceId => {
            const service = services.find(s => s.$id === serviceId);
            if (service) {
                const div = document.createElement('div');
                div.className = 'service-checkbox';
                div.innerHTML = `
                    <input type="checkbox" id="pass-service-${service.$id}" value="${service.$id}">
                    <label for="pass-service-${service.$id}">${service.name}</label>
                `;
                
                const checkbox = div.querySelector('input');
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        tempSelectedServicesForPass.push(service.$id);
                    } else {
                        const index = tempSelectedServicesForPass.indexOf(service.$id);
                        if (index > -1) tempSelectedServicesForPass.splice(index, 1);
                    }
                });
                
                passServiceList.appendChild(div);
            }
        });
        
        passServiceModalOverlay.style.display = 'flex';
    }

    function closePassServiceModal() {
        passServiceModalOverlay.style.display = 'none';
        tempSelectedServicesForPass = [];
    }

    // --- PHOTOGRAPHY SYSTEM ---
    function updateUIForPhotographyRole() {
        const photographySection = document.getElementById('photography-section');
        const regularSection = document.getElementById('regular-section');
        
        if (isPhotographyUser) {
            photographySection.style.display = 'block';
            regularSection.style.display = 'none';
        } else {
            photographySection.style.display = 'none';
            regularSection.style.display = 'block';
        }
    }

    // --- بهبود یافته loadPhotographyList ---
    function loadPhotographyList() {
        try {
            const storedList = localStorage.getItem('photographyList');
            if (storedList) {
                photographyList = JSON.parse(storedList);
                console.log('Photography list loaded:', photographyList.length, 'items');
            } else {
                photographyList = [];
                console.log('No photography list found in localStorage');
            }
        } catch (error) {
            console.error('Error loading photography list:', error);
            photographyList = [];
        }
    }

    // --- بهبود یافته savePhotographyList ---
    function savePhotographyList() {
        try {
            localStorage.setItem('photographyList', JSON.stringify(photographyList));
            localStorage.setItem('photographyListUpdate', Date.now().toString());
            console.log('Photography list saved:', photographyList.length, 'items');
            
            // تریگر event برای sync بین تب‌ها
            window.dispatchEvent(new Event('photographyListUpdated'));
        } catch (error) {
            console.error('Error saving photography list:', error);
        }
    }

    // --- بهبود یافته renderPhotographyList ---
    function renderPhotographyList() {
        photographyListContainer.innerHTML = '';
        
        if (photographyList.length === 0) {
            photographyListContainer.innerHTML = '<p class="empty-list">لیست عکاسی خالی است</p>';
            return;
        }

        // مرتب‌سازی: اول نوبت‌های رزرو شده، سپس نوبت‌های آماده بازگشت، سپس بقیه
        const sortedList = [...photographyList].sort((a, b) => {
            if (a.reserved && !b.reserved) return -1;
            if (!a.reserved && b.reserved) return 1;
            if (a.readyToReturn && !b.readyToReturn) return -1;
            if (!a.readyToReturn && b.readyToReturn) return 1;
            return new Date(a.addedAt) - new Date(b.addedAt);
        });

        sortedList.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'photography-item';
            
            if (item.reserved) div.classList.add('reserved');
            if (item.photoTaken) div.classList.add('photo-taken');
            if (item.readyToReturn) div.classList.add('ready-to-return');
            
            div.innerHTML = `
                <div class="item-header">
                    <span class="ticket-number">${item.ticketNumber}</span>
                    <span class="status-badge">${getPhotographyStatusBadge(item)}</span>
                </div>
                <div class="item-details">
                    <p><strong>نام:</strong> ${item.customerName}</p>
                    <p><strong>کدملی:</strong> ${item.nationalId}</p>
                    <p><strong>خدمت:</strong> ${item.serviceName}</p>
                    <p><strong>زمان:</strong> ${formatTime(item.addedAt)}</p>
                    ${item.originalCounterName ? `<p><strong>باجه:</strong> ${item.originalCounterName}</p>` : ''}
                </div>
                <div class="item-actions">
                    ${!item.photoTaken ? `
                        <button class="action-btn mark-photo-btn" onclick="window.markPhotoAsTaken('${item.id}')">
                            عکس گرفته شد
                        </button>
                    ` : ''}
                    ${item.photoTaken && !item.readyToReturn ? `
                        <button class="action-btn ready-btn" onclick="window.markAsReadyToReturn('${item.id}')">
                            آماده بازگشت
                        </button>
                    ` : ''}
                    ${item.readyToReturn ? `
                        <button class="action-btn returned-btn" disabled>
                            منتظر بازگشت
                        </button>
                    ` : ''}
                    <button class="action-btn remove-btn" onclick="window.removeFromPhotographyList('${item.id}')">
                        حذف
                    </button>
                </div>
            `;
            
            photographyListContainer.appendChild(div);
        });
    }

    function getPhotographyStatusBadge(item) {
        if (item.reserved) return 'رزرو شده';
        if (item.readyToReturn) return 'آماده بازگشت';
        if (item.photoTaken) return 'عکس گرفته شد';
        return 'در انتظار عکس';
    }

    // --- بهبود یافته updatePhotographyUI ---
    function updatePhotographyUI() {
        const waitingCount = photographyList.filter(item => !item.photoTaken).length;
        const readyCount = photographyList.filter(item => item.readyToReturn).length;
        
        photographyWaitingCount.textContent = waitingCount;
        
        // به‌روزرسانی نمایشگر وضعیت
        const statusDisplay = document.getElementById('photography-status-display');
        if (statusDisplay) {
            statusDisplay.innerHTML = `
                <div class="status-item">
                    <span class="status-label">منتظر عکس:</span>
                    <span class="status-count">${waitingCount}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">آماده بازگشت:</span>
                    <span class="status-count">${readyCount}</span>
                </div>
            `;
        }
        
        renderPhotographyList();
    }

    // --- بهبود یافته sendToPhotography ---
    async function sendToPhotography(ticketId) {
        const ticket = tickets.find(t => t.$id === ticketId);
        if (!ticket) {
            showPopupNotification('<p>نوبت مورد نظر یافت نشد.</p>');
            return;
        }

        const service = services.find(s => s.$id === ticket.service_id);
        if (!service) {
            showPopupNotification('<p>خدمت مورد نظر یافت نشد.</p>');
            return;
        }

        const userPrefs = currentUser.prefs || {};
        const counterName = userPrefs.counter_name || 'باجه';

        const photographyItem = {
            id: generateId(),
            ticketId: ticket.$id,
            ticketNumber: ticket.specific_ticket || 'پاس',
            customerName: `${ticket.first_name} ${ticket.last_name}`,
            nationalId: ticket.national_id,
            serviceName: service.name,
            serviceId: service.$id,
            originalUserId: ticket.called_by,
            originalCounterName: ticket.called_by_counter_name || counterName,
            addedAt: new Date().toISOString(),
            photoTaken: false,
            readyToReturn: false,
            returned: false,
            reserved: false
        };

        photographyList.push(photographyItem);
        await savePhotographyList();
        updatePhotographyUI();

        showPopupNotification(`<p>نوبت ${photographyItem.ticketNumber} به لیست عکاسی اضافه شد.</p>`);
        
        // بستن نوتیفیکیشن فعلی
        closePopupNotification();
        
        // فراخوانی نوبت بعدی
        setTimeout(() => {
            callNextTicket();
        }, 1000);
    }

    // --- بهبود یافته markPhotoAsTaken ---
    async function markPhotoAsTaken(itemId) {
        const item = photographyList.find(i => i.id === itemId);
        if (item) {
            item.photoTaken = true;
            item.reserved = false; // اگر رزرو شده بود، لغو شود
            await savePhotographyList();
            updatePhotographyUI();
            
            // اگر این نوبت رزرو شده بود، آن را پاک کن
            if (reservedPhotographyTicket && reservedPhotographyTicket.id === itemId) {
                reservedPhotographyTicket = null;
            }
        }
    }

    // --- بهبود یافته markAsReadyToReturn ---
    async function markAsReadyToReturn(itemId) {
        const item = photographyList.find(i => i.id === itemId);
        if (item && item.photoTaken) {
            item.readyToReturn = true;
            await savePhotographyList();
            updatePhotographyUI();
        }
    }

    // --- بهبود یافته removeFromPhotographyList ---
    async function removeFromPhotographyList(itemId) {
        if (confirm('آیا از حذف این نوبت از لیست عکاسی اطمینان دارید؟')) {
            photographyList = photographyList.filter(i => i.id !== itemId);
            await savePhotographyList();
            updatePhotographyUI();
        }
    }

    // --- بهبود یافته reservePhotographyTicket ---
    async function reservePhotographyTicket(itemId) {
        const item = photographyList.find(i => i.id === itemId);
        if (item) {
            item.reserved = true;
            await savePhotographyList();
            updatePhotographyUI();
        }
    }

    // --- بهبود یافته returnTicketToOriginalUser ---
    async function returnTicketToOriginalUser(photographyItem) {
        // این تابع نوبت را به کاربر اصلی برمی‌گرداند
        // در این نسخه ساده، فقط از لیست عکاسی حذف می‌شود
        photographyList = photographyList.filter(i => i.id !== photographyItem.id);
        await savePhotographyList();
        updatePhotographyUI();
    }

    // --- بهبود یافته showPhotographyNotification ---
    function showPhotographyNotification(photographyItem) {
        const popupMessage = `
            <div class="photography-notification">
                <h3>فراخوانی عکاسی</h3>
                <div class="ticket-number-large">${photographyItem.ticketNumber}</div>
                <div class="customer-info">
                    <p><strong>نام:</strong> ${photographyItem.customerName}</p>
                    <p><strong>کد ملی:</strong> ${photographyItem.nationalId}</p>
                    <p><strong>خدمت:</strong> ${photographyItem.serviceName}</p>
                    <p><strong>باجه مبدا:</strong> ${photographyItem.originalCounterName}</p>
                </div>
                <div class="action-buttons">
                    <button class="action-btn reserve-btn" onclick="window.reservePhotographyTicket('${photographyItem.id}')">
                        رزرو نوبت
                    </button>
                    <button class="action-btn photo-taken-btn" onclick="window.markPhotoAsTaken('${photographyItem.id}')">
                        عکس گرفته شد
                    </button>
                </div>
            </div>
        `;
        
        showPopupNotification(popupMessage);
    }

    // --- TICKET FORM HANDLING ---
    function openTicketForm(type, serviceId = null) {
        ticketForm.style.display = 'block';
        ticketForm.dataset.type = type;
        
        if (type === 'regular' && serviceId) {
            const service = services.find(s => s.$id === serviceId);
            ticketFormTitle.textContent = `ثبت نوبت جدید - ${service.name}`;
            ticketForm.dataset.serviceId = serviceId;
        } else if (type === 'pass') {
            ticketFormTitle.textContent = 'ثبت نوبت پاس شده';
        }
    }

    function closeTicketForm() {
        ticketForm.style.display = 'none';
        document.getElementById('first-name').value = '';
        document.getElementById('last-name').value = '';
        document.getElementById('national-id').value = '';
        document.getElementById('delay-count').value = '0';
        ticketForm.dataset.type = '';
        ticketForm.dataset.serviceId = '';
    }

    function submitTicketForm() {
        const firstName = document.getElementById('first-name').value.trim();
        const lastName = document.getElementById('last-name').value.trim();
        const nationalId = document.getElementById('national-id').value.trim();
        const delayCount = parseInt(document.getElementById('delay-count').value) || 0;
        const type = ticketForm.dataset.type;
        
        if (type === 'regular') {
            const serviceId = ticketForm.dataset.serviceId;
            generateTicket(serviceId, firstName, lastName, nationalId);
        } else if (type === 'pass') {
            generatePassTicket(firstName, lastName, nationalId, delayCount);
        }
    }

    // --- PHOTOGRAPHY MODAL ---
    function openPhotographyModal() {
        photographyModal.style.display = 'flex';
        manualTicketInput.value = '';
        photographyCustomerName.value = '';
        photographyNationalIdInput.value = '';
    }

    function closePhotographyModal() {
        photographyModal.style.display = 'none';
    }

    function submitManualPhotography() {
        const ticketNumber = manualTicketInput.value.trim();
        const customerName = photographyCustomerName.value.trim();
        const nationalId = photographyNationalIdInput.value.trim();
        
        if (!ticketNumber || !customerName) {
            alert('لطفا شماره نوبت و نام مشتری را وارد کنید.');
            return;
        }
        
        if (nationalId && !checkCodeMeli(nationalId)) {
            alert('کد ملی وارد شده معتبر نیست.');
            return;
        }
        
        const photographyItem = {
            id: generateId(),
            ticketNumber: ticketNumber,
            customerName: customerName,
            nationalId: nationalId || '---',
            serviceName: 'عکاسی دستی',
            addedAt: new Date().toISOString(),
            photoTaken: false,
            readyToReturn: false,
            returned: false,
            reserved: false,
            isManual: true
        };
        
        photographyList.push(photographyItem);
        savePhotographyList();
        updatePhotographyUI();
        closePhotographyModal();
        
        showPopupNotification(`<p>نوبت دستی ${ticketNumber} به لیست عکاسی اضافه شد.</p>`);
    }

    // --- SETTINGS & ADMIN ---
    function openSettings() {
        if (!currentUser || !currentUser.prefs || currentUser.prefs.role !== 'admin') {
            alert('شما دسترسی ادمین ندارید.');
            return;
        }
        adminPanel.style.display = 'block';
        renderServiceList();
    }

    function closeSettings() {
        adminPanel.style.display = 'none';
    }

    function renderServiceList() {
        serviceList.innerHTML = '';
        services.forEach(service => {
            const div = document.createElement('div');
            div.className = 'service-item';
            div.innerHTML = `
                <input type="text" class="service-name-input" value="${service.name}" data-id="${service.$id}">
                <input type="number" class="service-time-input" value="${service.manual_time}" data-id="${service.$id}" placeholder="زمان تخمینی (دقیقه)">
                <input type="number" class="service-start-input" value="${service.start_number}" data-id="${service.$id}" placeholder="شروع">
                <input type="number" class="service-end-input" value="${service.end_number}" data-id="${service.$id}" placeholder="پایان">
                <input type="text" class="service-hours-start" value="${service.work_hours_start || '08:00'}" data-id="${service.$id}" placeholder="شروع کار">
                <input type="text" class="service-hours-end" value="${service.work_hours_end || '17:00'}" data-id="${service.$id}" placeholder="پایان کار">
                <label class="toggle-switch">
                    <input type="checkbox" class="service-toggle" ${service.disabled ? '' : 'checked'} data-id="${service.$id}">
                    <span class="slider"></span>
                </label>
                <button class="delete-service-btn" data-id="${service.$id}">حذف</button>
            `;
            serviceList.appendChild(div);
        });
    }

    async function saveSettings() {
        const serviceUpdates = [];
        const serviceElements = serviceList.querySelectorAll('.service-item');
        
        serviceElements.forEach(element => {
            const serviceId = element.querySelector('.service-name-input').dataset.id;
            const name = element.querySelector('.service-name-input').value;
            const manualTime = parseFloat(element.querySelector('.service-time-input').value);
            const startNumber = parseInt(element.querySelector('.service-start-input').value);
            const endNumber = parseInt(element.querySelector('.service-end-input').value);
            const workHoursStart = element.querySelector('.service-hours-start').value;
            const workHoursEnd = element.querySelector('.service-hours-end').value;
            const isEnabled = element.querySelector('.service-toggle').checked;
            
            serviceUpdates.push({
                serviceId,
                name,
                manual_time: manualTime,
                start_number: startNumber,
                end_number: endNumber,
                work_hours_start: workHoursStart,
                work_hours_end: workHoursEnd,
                disabled: !isEnabled
            });
        });
        
        try {
            for (const update of serviceUpdates) {
                await databases.updateDocument(DATABASE_ID, SERVICES_COLLECTION_ID, update.serviceId, {
                    name: update.name,
                    manual_time: update.manual_time,
                    start_number: update.start_number,
                    end_number: update.end_number,
                    work_hours_start: update.work_hours_start,
                    work_hours_end: update.work_hours_end,
                    disabled: update.disabled
                });
            }
            alert('تنظیمات با موفقیت ذخیره شد.');
            closeSettings();
            fetchData();
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('خطا در ذخیره تنظیمات!');
        }
    }

    async function addNewService() {
        const name = prompt('نام خدمت جدید را وارد کنید:');
        if (!name) return;
        
        try {
            await databases.createDocument(DATABASE_ID, SERVICES_COLLECTION_ID, ID.unique(), {
                name: name,
                manual_time: 5,
                start_number: 1,
                end_number: 999,
                work_hours_start: '08:00',
                work_hours_end: '17:00',
                disabled: false
            });
            alert('خدمت جدید با موفقیت اضافه شد.');
            fetchData();
            renderServiceList();
        } catch (error) {
            console.error('Error adding service:', error);
            alert('خطا در اضافه کردن خدمت!');
        }
    }

    async function deleteService(serviceId) {
        if (!confirm('آیا از حذف این خدمت اطمینان دارید؟')) return;
        
        try {
            await databases.deleteDocument(DATABASE_ID, SERVICES_COLLECTION_ID, serviceId);
            alert('خدمت با موفقیت حذف شد.');
            fetchData();
            renderServiceList();
        } catch (error) {
            console.error('Error deleting service:', error);
            alert('خطا در حذف خدمت!');
        }
    }

    async function resetAllTickets() {
        if (!confirm('آیا از ریست کردن تمام نوبت‌ها اطمینان دارید؟ این عمل غیرقابل بازگشت است.')) return;
        
        try {
            const allTickets = await databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID);
            const deletePromises = allTickets.documents.map(ticket => 
                databases.deleteDocument(DATABASE_ID, TICKETS_COLLECTION_ID, ticket.$id)
            );
            await Promise.all(deletePromises);
            alert('تمام نوبت‌ها با موفقیت ریست شدند.');
            fetchData();
        } catch (error) {
            console.error('Error resetting tickets:', error);
            alert('خطا در ریست کردن نوبت‌ها!');
        }
    }

    // --- HELPER FUNCTIONS ---
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    function formatDate(dateString) {
        if (!dateString) return '---';
        const date = new Date(dateString);
        return date.toLocaleTimeString('fa-IR') + ' - ' + date.toLocaleDateString('fa-IR');
    }

    function formatTime(dateString) {
        if (!dateString) return '---';
        const date = new Date(dateString);
        return date.toLocaleTimeString('fa-IR');
    }

    function showPopupNotification(message) {
        popupText.innerHTML = message;
        popupNotification.style.display = 'flex';
    }

    function closePopupNotification() {
        popupNotification.style.display = 'none';
    }

    function checkAutoReset() {
        const lastReset = localStorage.getItem('lastResetDate');
        const today = new Date().toDateString();
        
        if (lastReset !== today) {
            localStorage.setItem('lastResetDate', today);
        }
    }

    // --- NEW COUNTER SETTINGS FUNCTIONS ---
    function openCounterSettingsModal() {
        const userPrefs = currentUser?.prefs || {};
        counterNameInput.value = userPrefs.counter_name || '';
        counterSettingsModal.style.display = 'flex';
    }

    function closeCounterSettingsModal() {
        counterSettingsModal.style.display = 'none';
    }

    async function saveCounterSettings() {
        const counterName = counterNameInput.value.trim();
        
        if (!counterName) {
            alert('لطفا نام باجه را وارد کنید.');
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
            
            closeCounterSettingsModal();
            showLoggedInUI();
            showPopupNotification(`<p>نام باجه با موفقیت به "${counterName}" تنظیم شد.</p>`);
        } catch (error) {
            console.error('Error saving counter settings:', error);
            alert('خطا در ذخیره تنظیمات باجه!');
        }
    }

    // --- UPDATE UI FOR USER ROLE ---
    function updateUIForUserRole() {
        const userPrefs = currentUser?.prefs || {};
        const isAdmin = userPrefs.role === 'admin';
        
        // نمایش/مخفی کردن دکمه‌های ادمین
        if (isAdmin) {
            settingsBtn.style.display = 'inline-block';
            resetAllBtn.style.display = 'inline-block';
        } else {
            settingsBtn.style.display = 'none';
            resetAllBtn.style.display = 'none';
        }
        
        // نمایش دکمه تنظیمات باجه برای همه کاربران
        counterSettingsBtn.style.display = 'inline-block';
        
        // به‌روزرسانی UI برای نقش عکاسی
        updateUIForPhotographyRole();
    }

    // --- PHOTOGRAPHY ROLE TOGGLE ---
    async function togglePhotographyRole() {
        isPhotographyUser = photographyRoleCheckbox.checked;
        
        try {
            const userPrefs = currentUser.prefs || {};
            await account.updatePrefs({ 
                ...userPrefs, 
                is_photography_user: isPhotographyUser 
            });
            
            // به‌روزرسانی اطلاعات کاربر
            currentUser = await account.get();
            
            updateUIForPhotographyRole();
            showPopupNotification(`<p>حالت ${isPhotographyUser ? 'عکاسی' : 'عادی'} فعال شد.</p>`);
        } catch (error) {
            console.error('Error updating photography role:', error);
            photographyRoleCheckbox.checked = !isPhotographyUser;
            isPhotographyUser = !isPhotographyUser;
        }
    }

    // --- TRIGGER DISPLAY UPDATE ---
    function triggerDisplayUpdate() {
        // این تابع می‌تواند برای به‌روزرسانی نمایشگرهای فیزیکی استفاده شود
        console.log('Display update triggered');
        // در اینجا می‌توانید کدهای مربوط به به‌روزرسانی نمایشگرهای خارجی را اضافه کنید
    }

    // --- EVENT LISTENERS ---
    loginBtn.addEventListener('click', login);
    logoutBtn.addEventListener('click', logout);
    settingsBtn.addEventListener('click', openSettings);
    counterSettingsBtn.addEventListener('click', openCounterSettingsModal);
    resetAllBtn.addEventListener('click', resetAllTickets);
    saveSettingsBtn.addEventListener('click', saveSettings);
    closeSettingsBtn.addEventListener('click', closeSettings);
    cancelSettingsBtn.addEventListener('click', closeSettings);
    addServiceBtn.addEventListener('click', addNewService);
    serviceList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-service-btn')) {
            deleteService(e.target.dataset.id);
        }
    });
    submitTicketBtn.addEventListener('click', submitTicketForm);
    cancelTicketBtn.addEventListener('click', closeTicketForm);
    callNextBtn.addEventListener('click', callNextTicket);
    passTicketBtn.addEventListener('click', passTicket);
    callPastBtn.addEventListener('click', callPastTicket);
    confirmPassServiceBtn.addEventListener('click', () => {
        if (tempSelectedServicesForPass.length === 0) {
            alert('لطفا حداقل یک خدمت را انتخاب کنید.');
            return;
        }
        closePassServiceModal();
        openTicketForm('pass');
    });
    cancelPassServiceBtn.addEventListener('click', closePassServiceModal);
    manualPhotographyBtn.addEventListener('click', openPhotographyModal);
    confirmPhotographyBtn.addEventListener('click', submitManualPhotography);
    cancelPhotographyBtn.addEventListener('click', closePhotographyModal);
    photographyRoleCheckbox.addEventListener('change', togglePhotographyRole);

    // Event Listeners جدید برای تنظیمات باجه
    saveCounterBtn.addEventListener('click', saveCounterSettings);
    cancelCounterBtn.addEventListener('click', closeCounterSettingsModal);

    // --- GLOBAL FUNCTIONS FOR HTML ONCLICK ---
    window.sendToPhotography = sendToPhotography;
    window.markPhotoAsTaken = markPhotoAsTaken;
    window.markAsReadyToReturn = markAsReadyToReturn;
    window.removeFromPhotographyList = removeFromPhotographyList;
    window.reservePhotographyTicket = reservePhotographyTicket;
    window.callNextAfterNotification = () => {
        closePopupNotification();
        setTimeout(callNextTicket, 500);
    };

    // --- INITIALIZE APP ---
    initializeApp();
});