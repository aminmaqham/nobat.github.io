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
// --- بهبود setupRealtimeSubscriptions ---
function setupRealtimeSubscriptions() {
    const ticketChannel = `databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents`;
    client.subscribe(ticketChannel, (response) => {
        console.log('Real-time update:', response);
        // به‌روزرسانی فوری بدون تأخیر
        fetchData().then(() => {
            console.log('Data updated in real-time');
        });
    });
    
    const serviceChannel = `databases.${DATABASE_ID}.collections.${SERVICES_COLLECTION_ID}.documents`;
    client.subscribe(serviceChannel, () => {
        fetchData().then(() => {
            console.log('Services updated in real-time');
        });
    });
    
    // نظارت پیشرفته بر تغییرات localStorage برای sync بین تب‌ها
    window.addEventListener('storage', (e) => {
        if (e.key === 'photographyList' || e.key === 'photographyListUpdate') {
            console.log('Photography list updated from another tab');
            loadPhotographyList();
            updatePhotographyUI();
            renderPhotographyList();
            
            // به‌روزرسانی فوری نمایشگر
            triggerDisplayUpdate();
        }
    });
    
    // نظارت بر eventهای custom با پاسخگویی آنی
    window.addEventListener('photographyListUpdated', () => {
        updatePhotographyUI();
        renderPhotographyList();
    });
    
    // polling برای اطمینان از sync کامل
    setInterval(() => {
        fetchData().catch(console.error);
    }, 2000); // هر 2 ثانیه
}

    // --- UI RENDERING ---
function updateTotalWaitingCount() {
    const waitingCount = tickets.filter(t => t.status === 'در حال انتظار').length;
    document.getElementById('total-waiting-count').textContent = waitingCount;
    
    // حذف هرگونه محدودیت - نمایش عدد واقعی
    // این مشکل که عدد بیشتر از 25 نشان داده نمی‌شد را برطرف می‌کند
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
        if (isPhotographyUser) {
            await processPhotographyTicket();
            return;
        }
        
        // منطق قبلی برای کاربران عادی
        const selections = (currentUser.prefs && currentUser.prefs.service_selections) || {};
        await callNextRegularTicket(selections);
    }

// اصلاح تابع processPhotographyTicket
async function processPhotographyTicket() {
    // اگر نوبتی رزرو شده باشد، آن را پردازش کن
    if (reservedPhotographyTicket) {
        await handleReservedPhotographyTicket();
        return;
    }
    
    // پیدا کردن اولین نوبت در لیست عکاسی که عکس آن گرفته نشده و رزرو نشده
    const nextPhotographyItem = photographyList.find(item => !item.photoTaken && !item.reserved);
    
    if (nextPhotographyItem) {
        // نمایش نوتیفیکیشن پیشرفته عکاسی
        showPhotographyNotification(nextPhotographyItem);
    } else {
        // اگر نوبتی در لیست عکاسی نیست، از خدمات انتخابی فراخوانی کن
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

// اصلاح تابع callNextRegularTicket برای استفاده از نوتیفیکیشن جدید
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

// --- اصلاح تابع showCallNotification ---
function showCallNotification(ticket, service, counterName, isFromPhotography = false) {
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
                <button class="action-btn send-to-photo-btn" onclick="sendToPhotography('${ticket.$id}')">
                    ارسال به عکاسی
                </button>
                <button class="action-btn next-ticket-btn" onclick="callNextAfterNotification()">
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
            
            // پاک کردن input و دادن استایل موفقیت
            pastTicketInput.value = '';
            pastTicketInput.classList.remove('error');
            pastTicketInput.classList.add('success');
            setTimeout(() => pastTicketInput.classList.remove('success'), 2000);
            
            // به روز رسانی داده‌ها
            await fetchData();
            
        } catch (error) {
            console.error('Error calling past ticket:', error);
            showPopupNotification('<p>خطا در فراخوانی نوبت گذشته!</p>');
            pastTicketInput.classList.add('error');
        }
    }
    
    async function resetAllTickets() {
        if (!confirm('آیا مطمئن هستید؟ تمام نوبت‌ها و لیست عکاسی برای همیشه پاک خواهند شد.')) return;
        
        try {
            let response = await databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID, [Query.limit(100)]);
            while (response.documents.length > 0) {
                const deletePromises = response.documents.map(doc => databases.deleteDocument(DATABASE_ID, TICKETS_COLLECTION_ID, doc.$id));
                await Promise.all(deletePromises);
                response = await databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID, [Query.limit(100)]);
            }
            
            // پاک کردن لیست عکاسی
            photographyList = [];
            await savePhotographyList();
            updatePhotographyUI();
            renderPhotographyList();
            
            showPopupNotification('<p>تمام نوبت‌ها و لیست عکاسی با موفقیت پاک شدند.</p>');
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

    // --- POPUP NOTIFICATION SYSTEM ---
    function showPopupNotification(htmlContent) {
        popupText.innerHTML = htmlContent + '<button class="close-popup">×</button>';
        popupNotification.style.display = 'flex';
        
        setTimeout(() => {
            popupNotification.classList.add('show');
        }, 10);
        
        // نوتیفیکیشن فقط با کلیک کاربر بسته می‌شود
        popupNotification.addEventListener('click', function closeHandler(e) {
            if (e.target === popupNotification || e.target.classList.contains('close-popup')) {
                popupNotification.classList.remove('show');
                setTimeout(() => {
                    popupNotification.style.display = 'none';
                }, 300);
                popupNotification.removeEventListener('click', closeHandler);
            }
        });
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
    function formatDate(dateString) {
        if (!dateString) return '---';
        return new Date(dateString).toLocaleString('fa-IR');
    }

    async function completeTicket(ticketId) {
        try {
            await databases.updateDocument(DATABASE_ID, TICKETS_COLLECTION_ID, ticketId, {
                status: 'تکمیل شده'
            });
        } catch (error) {
            console.error('Error completing ticket:', error);
        }
    }

    // --- Photography List Functions ---
    function openPhotographyModal(ticket) {
        currentTicketForPhotography = ticket;
        photographyNationalIdInput.value = '';
        photographyTicketNumber.textContent = ticket.specific_ticket || 'پاس';
        photographyCustomerName.textContent = `${ticket.first_name} ${ticket.last_name}`;
        photographyModal.style.display = 'flex';
        photographyNationalIdInput.focus();
    }

    async function addToPhotographyList() {
        const nationalId = photographyNationalIdInput.value.trim();
        
        if (!nationalId) {
            alert('لطفا کد ملی را وارد کنید.');
            return;
        }
        
        if (!checkCodeMeli(nationalId)) {
            alert('کد ملی وارد شده معتبر نیست.');
            return;
        }
        
        if (!currentTicketForPhotography) {
            alert('خطا در دریافت اطلاعات نوبت.');
            return;
        }
        
        try {
            // بررسی وجود قبلی در لیست عکاسی با همان ticketId
            const existingItemByTicket = photographyList.find(item => 
                item.ticketId === currentTicketForPhotography.$id
            );
            
            if (existingItemByTicket) {
                alert('این نوبت قبلاً در لیست عکاسی قرار گرفته است.');
                closePhotographyModal();
                return;
            }
            
            // بررسی وجود کدملی تکراری در لیست عکاسی (فقط نوبت‌های در انتظار)
            const existingItemByNationalId = photographyList.find(item => 
                item.nationalId === nationalId && !item.photoTaken
            );
            
            if (existingItemByNationalId) {
                alert(`کد ملی ${nationalId} قبلاً در لیست عکاسی ثبت شده است (نوبت: ${existingItemByNationalId.ticketNumber}).`);
                return;
            }
            
            // اضافه کردن به لیست عکاسی
            const newPhotographyItem = {
                id: Date.now().toString(),
                ticketId: currentTicketForPhotography.$id,
                ticketNumber: currentTicketForPhotography.specific_ticket || 'پاس',
                generalNumber: currentTicketForPhotography.general_ticket,
                firstName: currentTicketForPhotography.first_name,
                lastName: currentTicketForPhotography.last_name,
                nationalId: nationalId,
                serviceId: currentTicketForPhotography.service_id,
                serviceName: services.find(s => s.$id === currentTicketForPhotography.service_id)?.name || '---',
                addedAt: new Date().toISOString(),
                photoTaken: false,
                reserved: false,
                readyToReturn: false,
                returned: false,
                originalUserId: currentTicketForPhotography.called_by,
                originalCounterName: currentTicketForPhotography.called_by_counter_name
            };
            
            photographyList.unshift(newPhotographyItem);
            
            await savePhotographyList();
            updatePhotographyUI();
            renderPhotographyList();
            closePhotographyModal();
            
            showPopupNotification(`<p>نوبت ${newPhotographyItem.ticketNumber} به لیست عکاسی اضافه شد.</p>`);
            
            // به‌روزرسانی فوری نمایشگر
            triggerDisplayUpdate();
            
        } catch (error) {
            console.error('Error adding to photography list:', error);
            showPopupNotification('<p>خطا در اضافه کردن به لیست عکاسی!</p>');
        }
    }

    async function addManualToPhotographyList() {
        const ticketNumber = manualTicketInput.value.trim();
        const nationalId = prompt('لطفا کد ملی را وارد کنید:');
        
        if (!ticketNumber) {
            alert('لطفا شماره نوبت را وارد کنید.');
            return;
        }
        
        if (!nationalId) {
            alert('لطفا کد ملی را وارد کنید.');
            return;
        }
        
        if (!checkCodeMeli(nationalId)) {
            alert('کد ملی وارد شده معتبر نیست.');
            return;
        }
        
        try {
            // بررسی وجود قبلی در لیست عکاسی با همان شماره نوبت
            const existingItemByTicket = photographyList.find(item => 
                item.ticketNumber === ticketNumber
            );
            
            if (existingItemByTicket) {
                alert('این نوبت قبلاً در لیست عکاسی قرار گرفته است.');
                manualTicketInput.value = '';
                return;
            }
            
            // بررسی وجود کدملی تکراری در لیست عکاسی (فقط نوبت‌های در انتظار)
            const existingItemByNationalId = photographyList.find(item => 
                item.nationalId === nationalId && !item.photoTaken
            );
            
            if (existingItemByNationalId) {
                alert(`کد ملی ${nationalId} قبلاً در لیست عکاسی ثبت شده است (نوبت: ${existingItemByNationalId.ticketNumber}).`);
                return;
            }
            
            // اضافه کردن به لیست عکاسی
            const newPhotographyItem = {
                id: Date.now().toString(),
                ticketId: `manual_${Date.now()}`,
                ticketNumber: ticketNumber,
                generalNumber: 'دستی',
                firstName: 'ثبت دستی',
                lastName: '',
                nationalId: nationalId,
                serviceId: 'manual',
                serviceName: 'ثبت دستی',
                addedAt: new Date().toISOString(),
                photoTaken: false,
                reserved: false,
                readyToReturn: false,
                returned: false,
                originalUserId: currentUser.$id,
                originalCounterName: currentUser.prefs?.counter_name || 'دستی'
            };
            
            photographyList.unshift(newPhotographyItem);
            await savePhotographyList();
            updatePhotographyUI();
            manualTicketInput.value = '';
            
            showPopupNotification(`<p>نوبت ${newPhotographyItem.ticketNumber} به لیست عکاسی اضافه شد.</p>`);
            
        } catch (error) {
            console.error('Error adding manual to photography list:', error);
            showPopupNotification('<p>خطا در اضافه کردن به لیست عکاسی!</p>');
        }
    }

    function updatePhotographyUI() {
        const waitingCount = photographyList.filter(item => !item.photoTaken).length;
        photographyWaitingCount.textContent = waitingCount;
        
        // ذخیره وضعیت کاربر عکاسی
        const userPrefs = currentUser.prefs || {};
        userPrefs.is_photography_user = isPhotographyUser;
        account.updatePrefs(userPrefs).catch(console.error);
    }

    function closePhotographyModal() {
        photographyModal.style.display = 'none';
        currentTicketForPhotography = null;
    }

    function renderPhotographyList() {
        if (photographyList.length === 0) {
            photographyListContainer.innerHTML = '<div class="photography-empty">هیچ نوبتی در لیست عکاسی وجود ندارد</div>';
            photographyDisplay.style.display = 'none';
            return;
        }
        
        // مرتب‌سازی: اول نوبت‌های رزرو شده، سپس نوبت‌های آماده بازگشت، سپس بقیه
        const sortedList = [...photographyList].sort((a, b) => {
            const statusPriority = {
                'reserved': 1,
                'readyToReturn': 2,
                'waiting': 3,
                'completed': 4
            };

            const aStatus = getPhotographyItemStatus(a);
            const bStatus = getPhotographyItemStatus(b);
            
            if (statusPriority[aStatus] !== statusPriority[bStatus]) {
                return statusPriority[aStatus] - statusPriority[bStatus];
            }
            
            return new Date(a.addedAt) - new Date(b.addedAt);
        });
        
        photographyListContainer.innerHTML = sortedList.map((item, index) => `
            <div class="photography-item ${getPhotographyItemClass(item)}" data-id="${item.id}">
                <div class="photography-number">${index + 1}</div>
                <div class="photography-info">
                    <div class="photography-ticket">${item.ticketNumber} - ${item.firstName} ${item.lastName}</div>
                    <div class="photography-national-id">${item.nationalId}</div>
                    <div class="photography-service">${item.serviceName}</div>
                    ${item.originalCounterName ? `<div class="photography-origin">ارسال کننده: ${item.originalCounterName}</div>` : ''}
                </div>
                <div class="photography-actions">
                    ${!item.photoTaken && !item.reserved ? `
                        <button class="photography-btn complete-btn" onclick="markPhotoAsTaken('${item.id}')">تکمیل</button>
                        <button class="photography-btn reserve-btn" onclick="reservePhotographyTicket('${item.id}')">رزرو</button>
                    ` : ''}
                    ${item.reserved ? `
                        <button class="photography-btn continue-btn" onclick="continueReservedTicket('${item.id}')">ادامه</button>
                    ` : ''}
                    ${item.readyToReturn ? `
                        <div class="photography-ready-badge">آماده بازگشت</div>
                    ` : ''}
                </div>
                <div class="photography-status ${getPhotographyStatusClass(item)}">
                    ${getPhotographyStatusText(item)}
                </div>
            </div>
        `).join('');
        
        photographyDisplay.style.display = 'flex';
    }

    async function savePhotographyList() {
        try {
            localStorage.setItem('photographyList', JSON.stringify(photographyList));
            // تریگر به‌روزرسانی برای نمایشگر
            localStorage.setItem('photographyListUpdate', Date.now().toString());
        } catch (error) {
            console.error('Error saving photography list:', error);
        }
    }

    function loadPhotographyList() {
        try {
            const saved = localStorage.getItem('photographyList');
            if (saved) {
                photographyList = JSON.parse(saved);
            }
            renderPhotographyList();
            
            // نمایش لیست عکاسی اگر آیتمی وجود دارد
            if (photographyList.length > 0) {
                photographyDisplay.style.display = 'flex';
            }
        } catch (error) {
            console.error('Error loading photography list:', error);
            photographyList = [];
        }
    }

    async function markPhotoAsTaken(photographyItemId) {
        const item = photographyList.find(i => i.id === photographyItemId);
        if (item) {
            item.photoTaken = true;
            item.readyToReturn = true;
            item.reserved = false;
            await savePhotographyList();
            renderPhotographyList();
            updatePhotographyUI();
            
            // به‌روزرسانی فوری نمایشگر
            triggerDisplayUpdate();
            
            showPopupNotification(`<p>نوبت ${item.ticketNumber} آماده بازگشت است.</p>`);
        }
    }

    async function reservePhotographyTicket(photographyItemId) {
        const item = photographyList.find(i => i.id === photographyItemId);
        if (item) {
            item.reserved = true;
            item.photoTaken = false;
            item.readyToReturn = false;
            await savePhotographyList();
            renderPhotographyList();
            updatePhotographyUI();
            
            showPopupNotification(`<p>نوبت ${item.ticketNumber} رزرو شد.</p>`);
        }
    }

    async function removeFromPhotographyList(photographyItemId) {
        photographyList = photographyList.filter(item => item.id !== photographyItemId);
        await savePhotographyList();
        renderPhotographyList();
        
        // اگر لیست خالی شد، نمایشگر را مخفی کن
        if (photographyList.length === 0) {
            photographyDisplay.style.display = 'none';
        }
    }

    async function returnTicketToOriginalUser(photographyItem) {
        try {
            // آپدیت وضعیت نوبت در دیتابیس برای بازگشت به کاربر اصلی
            const originalTicket = await databases.updateDocument(
                DATABASE_ID, 
                TICKETS_COLLECTION_ID, 
                photographyItem.ticketId, 
                {
                    status: 'در حال انتظار',
                    photography_completed: true,
                    photography_completed_at: new Date().toISOString()
                }
            );
            
            // ایجاد نوتیفیکیشن برای کاربر اصلی
            showPopupNotification(`<p>نوبت ${photographyItem.ticketNumber} آماده بازگشت به ${photographyItem.originalCounterName || 'کاربر اصلی'} است.</p>`);
            
        } catch (error) {
            console.error('Error returning ticket to original user:', error);
        }
    }

    function showSendToPhotographyButton(ticket) {
        // حذف دکمه قبلی اگر وجود دارد
        const existingButton = document.querySelector('.send-to-photography-btn');
        if (existingButton) {
            existingButton.remove();
        }
        
        // ایجاد دکمه جدید
        const button = document.createElement('button');
        button.className = 'big-button send-to-photography-btn';
        button.textContent = 'ارسال به لیست عکاسی';
        button.addEventListener('click', () => {
            openPhotographyModal(ticket);
        });
        
        // اضافه کردن دکمه به بخش ticket-actions
        const ticketActions = document.querySelector('.ticket-actions');
        ticketActions.appendChild(button);
        
        // حذف خودکار دکمه بعد از 30 ثانیه
        setTimeout(() => {
            if (button.parentNode) {
                button.remove();
            }
        }, 30000);
    }

    // --- Helper Functions for Photography ---
    function getPhotographyItemStatus(item) {
        if (item.reserved) return 'reserved';
        if (item.readyToReturn) return 'readyToReturn';
        if (item.photoTaken) return 'completed';
        return 'waiting';
    }

    function getPhotographyItemClass(item) {
        if (item.reserved) return 'reserved';
        if (item.readyToReturn) return 'ready-to-return';
        if (item.photoTaken) return 'photo-taken';
        return '';
    }

    function getPhotographyStatusClass(item) {
        if (item.reserved) return 'status-reserved';
        if (item.readyToReturn) return 'status-ready';
        if (item.photoTaken) return 'status-done';
        return 'status-waiting';
    }

    function getPhotographyStatusText(item) {
        if (item.reserved) return 'رزرو شده';
        if (item.readyToReturn) return 'آماده بازگشت';
        if (item.photoTaken) return 'تکمیل شده';
        return 'در انتظار';
    }

    // --- تابع برای ادامه نوبت رزرو شده ---
    async function continueReservedTicket(photographyItemId) {
        const item = photographyList.find(i => i.id === photographyItemId);
        if (item) {
            reservedPhotographyTicket = item;
            showPopupNotification(`<p>نوبت ${item.ticketNumber} برای ادامه کار انتخاب شد.</p>`);
        }
    }

    // --- تابع برای به‌روزرسانی فوری نمایشگر ---
    function triggerDisplayUpdate() {
        // ارسال event برای به‌روزرسانی نمایشگر
        window.dispatchEvent(new CustomEvent('photographyListUpdated'));
        
        // همچنین به‌روزرسانی localStorage برای sync بین تب‌ها
        localStorage.setItem('photographyListUpdate', Date.now().toString());
    }

    // اصلاح تابع showPopupNotification برای فراخوانی
function showCallNotification(ticket, service, counterName) {
    const popupMessage = `
        <div class="call-notification">
            <h3>فراخوانی نوبت</h3>
            <div class="ticket-number-large">${ticket.specific_ticket || 'پاس'}</div>
            <div class="customer-info">
                <p><strong>نام:</strong> ${ticket.first_name} ${ticket.last_name}</p>
                <p><strong>کد ملی:</strong> ${ticket.national_id}</p>
                <p><strong>خدمت:</strong> ${service?.name || '---'}</p>
                <p><strong>باجه:</strong> ${counterName}</p>
            </div>
            <div class="action-buttons">
                <button class="action-btn send-to-photo-btn" onclick="sendToPhotography('${ticket.$id}')">
                    ارسال به عکاسی
                </button>
                <button class="action-btn next-ticket-btn" onclick="callNextAfterNotification()">
                    فراخوان بعدی
                </button>
            </div>
        </div>
    `;
    showPopupNotification(popupMessage);
}

// تابع ارسال به عکاسی
async function sendToPhotography(ticketId) {
    const ticket = tickets.find(t => t.$id === ticketId);
    if (ticket) {
        openPhotographyModal(ticket);
        closePopup();
    }
}

// تابع فراخوانی بعدی
async function callNextAfterNotification() {
    closePopup();
    await callNextTicket();
}

// --- توابع نوتیفیکیشن عکاسی ---

// تابع نمایش نوتیفیکیشن عکاسی
function showPhotographyNotification(photographyItem) {
    const popupMessage = `
        <div class="photography-notification">
            <h3>عکاسی - نوبت فراخوانی شده</h3>
            <div class="ticket-number-large">${photographyItem.ticketNumber}</div>
            <div class="customer-info">
                <p><strong>نام:</strong> ${photographyItem.firstName} ${photographyItem.lastName}</p>
                <p><strong>کد ملی:</strong> ${photographyItem.nationalId}</p>
                <p><strong>خدمت:</strong> ${photographyItem.serviceName}</p>
                <p><strong>ارسال کننده:</strong> ${photographyItem.originalCounterName}</p>
            </div>
            <div class="action-buttons">
                <button class="action-btn photo-taken-btn" onclick="completePhotography('${photographyItem.id}')">
                    ثبت عکس ✓
                </button>
                <button class="action-btn reserve-btn" onclick="reservePhotographyFromNotification('${photographyItem.id}')">
                    رزرو نوبت ⏰
                </button>
                <button class="action-btn next-ticket-btn" onclick="skipPhotography('${photographyItem.id}')">
                    فراخوان بعدی ➡️
                </button>
                <button class="action-btn reserved-list-btn" onclick="showReservedList()">
                    لیست رزروها 📋
                </button>
            </div>
        </div>
    `;
    showPopupNotification(popupMessage);
}

// تابع ثبت عکس
async function completePhotography(photographyItemId) {
    await markPhotoAsTaken(photographyItemId);
    closePopup();
    showPopupNotification(`<p>عکس برای نوبت ثبت شد و به باجه اصلی بازگردانده شد.</p>`);
}

// تابع رزرو از نوتیفیکیشن
async function reservePhotographyFromNotification(photographyItemId) {
    await reservePhotographyTicket(photographyItemId);
    closePopup();
    showPopupNotification(`<p>نوبت رزرو شد. پس از آمادگی مشتری، از لیست رزروها انتخاب کنید.</p>`);
}

// تابع رد کردن عکاسی
async function skipPhotography(photographyItemId) {
    const item = photographyList.find(i => i.id === photographyItemId);
    if (item) {
        // حذف از لیست عکاسی بدون ثبت عکس
        await removeFromPhotographyList(photographyItemId);
        
        // بازگرداندن به باجه اصلی با وضعیت "عکس گرفته نشده"
        try {
            await databases.updateDocument(
                DATABASE_ID, 
                TICKETS_COLLECTION_ID, 
                item.ticketId, 
                {
                    status: 'در حال انتظار',
                    photography_skipped: true,
                    photography_skipped_at: new Date().toISOString()
                }
            );
        } catch (error) {
            console.error('Error returning ticket without photo:', error);
        }
        
        closePopup();
        showPopupNotification(`<p style="color: #f44336;">نوبت بدون عکس به باجه اصلی بازگردانده شد.</p>`);
    }
}

// تابع نمایش لیست رزروها
function showReservedList() {
    const reservedItems = photographyList.filter(item => item.reserved && !item.photoTaken);
    
    if (reservedItems.length === 0) {
        showPopupNotification('<p>هیچ نوبت رزرو شده‌ای وجود ندارد.</p>');
        return;
    }
    
    const reservedListHTML = reservedItems.map(item => `
        <div class="reserved-item" onclick="selectReservedTicket('${item.id}')">
            <div class="reserved-ticket-number">${item.ticketNumber}</div>
            <div class="reserved-customer-info">
                ${item.firstName} ${item.lastName} - کدملی: ${item.nationalId}
            </div>
        </div>
    `).join('');
    
    const popupMessage = `
        <div class="photography-notification">
            <h3>لیست نوبت‌های رزرو شده</h3>
            <div class="reserved-list">
                ${reservedListHTML}
            </div>
            <div class="action-buttons">
                <button class="action-btn back-btn" onclick="showPhotographyMainView()">
                    بازگشت
                </button>
            </div>
        </div>
    `;
    showPopupNotification(popupMessage);
}

// تابع انتخاب نوبت رزرو شده
async function selectReservedTicket(photographyItemId) {
    const item = photographyList.find(i => i.id === photographyItemId);
    if (item) {
        showPhotographyNotification(item);
    }
}

// تابع بازگشت به نمای اصلی عکاسی
function showPhotographyMainView() {
    // اگر نوبت فعالی وجود دارد، آن را نمایش بده
    const activeItem = photographyList.find(item => !item.photoTaken && !item.reserved);
    if (activeItem) {
        showPhotographyNotification(activeItem);
    } else {
        closePopup();
        showPopupNotification('<p>هیچ نوبت فعالی در لیست عکاسی وجود ندارد.</p>');
    }
}

// تابع بستن پاپاپ
function closePopup() {
    const popup = document.getElementById('popup-notification');
    popup.classList.remove('show');
    setTimeout(() => {
        popup.style.display = 'none';
    }, 300);
}

    // --- Modified UI for Photography Role ---
    function updateUIForPhotographyRole() {
        const userPrefs = currentUser.prefs || {};
        
        if (userPrefs.role === 'photography') {
            // مخفی کردن بخش‌های غیرضروری برای کاربر عکاسی
            document.querySelector('.service-buttons').style.display = 'none';
            document.querySelector('.ticket-form').style.display = 'none';
            document.getElementById('pass-ticket-btn').style.display = 'none';
            document.getElementById('call-past-btn').style.display = 'none';
            
            // تغییر متن دکمه فراخوانی
            const callNextBtn = document.getElementById('call-next-btn');
            callNextBtn.textContent = 'فراخوانی نوبت عکاسی/خدمات';
            callNextBtn.style.backgroundColor = '#9C27B0';
            
            // اضافه کردن دکمه فراخوانی از لیست عکاسی
            const photographyCallSection = document.createElement('div');
            photographyCallSection.className = 'photography-call-section';
            photographyCallSection.innerHTML = `
                <button id="call-from-photography-btn" class="big-button photography-call-btn" disabled>
                    فراخوانی از لیست عکاسی
                </button>
            `;
            
            const ticketActions = document.querySelector('.ticket-actions');
            ticketActions.appendChild(photographyCallSection);
            
            // اضافه کردن ایونت لیستنر برای دکمه فراخوانی از لیست عکاسی
            document.getElementById('call-from-photography-btn').addEventListener('click', callFromPhotographyList);
            
            // به‌روزرسانی وضعیت دکمه بر اساس وجود آیتم آماده در لیست عکاسی
            updatePhotographyCallButton();
        }
    }

    function updatePhotographyCallButton() {
        const callFromPhotographyBtn = document.getElementById('call-from-photography-btn');
        if (callFromPhotographyBtn) {
            const readyItem = photographyList.find(item => item.photoTaken && !item.returned);
            callFromPhotographyBtn.disabled = !readyItem;
        }
    }

    async function callFromPhotographyList() {
        // پیدا کردن اولین آیتم در لیست عکاسی که عکس آن گرفته شده
        const readyItem = photographyList.find(item => item.photoTaken && !item.returned);
        
        if (!readyItem) {
            showPopupNotification('<p>هیچ نوبت آماده‌ای در لیست عکاسی وجود ندارد.</p>');
            return;
        }
        
        try {
            // آپدیت وضعیت نوبت در دیتابیس
            const userPrefs = currentUser.prefs || {};
            const counterName = userPrefs.counter_name || 'باجه';
            
            const updatedTicket = await databases.updateDocument(
                DATABASE_ID, 
                TICKETS_COLLECTION_ID, 
                readyItem.ticketId, 
                {
                    status: 'در حال سرویس',
                    called_by: currentUser.$id,
                    called_by_name: currentUser.name || currentUser.email,
                    called_by_counter_name: counterName,
                    call_time: new Date().toISOString()
                }
            );
            
            // علامت‌گذاری به عنوان بازگشته
            readyItem.returned = true;
            await savePhotographyList();
            renderPhotographyList();
            
            // نمایش نوتیفیکیشن
            const service = services.find(s => s.$id === updatedTicket.service_id);
            const popupMessage = `
                <span class="ticket-number">${updatedTicket.specific_ticket || 'پاس'}</span>
                <p><strong>نام:</strong> ${updatedTicket.first_name} ${updatedTicket.last_name}</p>
                <p><strong>کد ملی:</strong> ${updatedTicket.national_id}</p>
                <p><strong>خدمت:</strong> ${service?.name || '---'}</p>
                <p><strong>باجه:</strong> ${counterName}</p>
                <p style="color: #4CAF50; font-weight: bold;">(بازگشته از عکاسی)</p>
            `;
            showPopupNotification(popupMessage);
            
            // حذف از لیست عکاسی پس از 2 ثانیه
            setTimeout(() => {
                removeFromPhotographyList(readyItem.id);
            }, 2000);
            
        } catch (error) {
            console.error('Error calling from photography list:', error);
            showPopupNotification('<p>خطا در فراخوانی از لیست عکاسی!</p>');
        }
    }

    function updateUIForUserRole() {
        if (isPhotographyUser) {
            document.getElementById('call-next-btn').textContent = 'فراخوانی نوبت عکاسی/خدمات';
            document.querySelector('.photography-controls').style.display = 'none';
            
            // اضافه کردن نمایش وضعیت رزرو
            if (reservedPhotographyTicket) {
                document.getElementById('call-next-btn').textContent = `ادامه نوبت رزرو شده: ${reservedPhotographyTicket.ticketNumber}`;
            }
        } else {
            document.getElementById('call-next-btn').textContent = 'فراخوان نوبت بعدی';
            document.querySelector('.photography-controls').style.display = 'flex';
        }
    }

    async function checkReadyPhotographyTickets() {
        if (!isPhotographyUser) {
            const readyTickets = photographyList.filter(item => item.readyToReturn && !item.returned);
            if (readyTickets.length > 0) {
                // نمایش نوتیفیکیشن برای کاربر
                showPopupNotification(`<p>${readyTickets.length} نوبت آماده بازگشت از عکاسی دارید.</p>`);
            }
        }
    }

    // --- EVENT LISTENERS ---
    loginBtn.addEventListener('click', login);
    callPastBtn.addEventListener('click', callPastTicket);
    logoutBtn.addEventListener('click', logout);
    settingsBtn.addEventListener('click', openAdminPanel);
    resetAllBtn.addEventListener('click', resetAllTickets);
    callNextBtn.addEventListener('click', callNextTicket);
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
    counterSettingsBtn.addEventListener('click', openCounterSettingsModal);
    saveCounterBtn.addEventListener('click', saveCounterSettings);
    cancelCounterBtn.addEventListener('click', closeCounterSettingsModal);
    confirmPhotographyBtn.addEventListener('click', addToPhotographyList);
    cancelPhotographyBtn.addEventListener('click', closePhotographyModal);
    manualPhotographyBtn.addEventListener('click', addManualToPhotographyList);
    photographyRoleCheckbox.addEventListener('change', function() {
        isPhotographyUser = this.checked;
        updatePhotographyUI();
        updateUIForUserRole();
    });

    manualTicketInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addManualToPhotographyList();
        }
    });

    // مدیریت input کد ملی در مودال عکاسی
    photographyNationalIdInput.addEventListener('input', function() {
        // فقط اعداد مجاز هستند
        this.value = this.value.replace(/[^0-9]/g, '');
    });

    photographyNationalIdInput.addEventListener('keypress', function(e) {
        // اجازه دادن به کلید Enter برای تایید
        if (e.key === 'Enter') {
            addToPhotographyList();
        }
    });

    // مدیریت input نوبت گذشته
    pastTicketInput.addEventListener('input', function() {
        // فقط اعداد مجاز هستند
        this.value = this.value.replace(/[^0-9]/g, '');
        
        // حذف استایل خطا هنگام تایپ
        if (this.value.length > 0) {
            this.classList.remove('error');
        }
    });

    pastTicketInput.addEventListener('keypress', function(e) {
        // اجازه دادن به کلید Enter برای فراخوانی
        if (e.key === 'Enter') {
            callPastTicket();
        }
    });

    // --- INITIALIZE APP ---
    initializeApp();
});


// اضافه کردن این توابع به scope جهانی برای استفاده در onclick
window.sendToPhotography = sendToPhotography;
window.callNextAfterNotification = callNextAfterNotification;
window.completePhotography = completePhotography;
window.reservePhotographyFromNotification = reservePhotographyFromNotification;
window.skipPhotography = skipPhotography;
window.showReservedList = showReservedList;
window.selectReservedTicket = selectReservedTicket;
window.showPhotographyMainView = showPhotographyMainView;
window.markPhotoAsTaken = markPhotoAsTaken;
window.reservePhotographyTicket = reservePhotographyTicket;
window.continueReservedTicket = continueReservedTicket;