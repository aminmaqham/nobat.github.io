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
    let currentCalledTicket = null;

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
        const ticketChannel = `databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents`;
        client.subscribe(ticketChannel, (response) => {
            console.log('Real-time update:', response);
            fetchData();
        });
        
        const serviceChannel = `databases.${DATABASE_ID}.collections.${SERVICES_COLLECTION_ID}.documents`;
        client.subscribe(serviceChannel, () => fetchData());
        
        // نظارت بر تغییرات localStorage برای sync بین تب‌ها
        window.addEventListener('storage', (e) => {
            if (e.key === 'photographyList' || e.key === 'photographyListUpdate') {
                console.log('Photography list updated from another tab');
                loadPhotographyList();
                updatePhotographyUI();
                renderPhotographyList();
            }
        });
        
        // نظارت بر eventهای custom
        window.addEventListener('photographyListUpdated', () => {
            updatePhotographyUI();
            renderPhotographyList();
        });
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

    // --- IMPROVED CALL NEXT TICKET LOGIC ---
    async function callNextTicket() {
        if (isPhotographyUser) {
            await showPhotographyNotification();
            return;
        }
        
        // منطق قبلی برای کاربران عادی
        const selections = (currentUser.prefs && currentUser.prefs.service_selections) || {};
        await callNextRegularTicket(selections);
    }

    // --- NEW PHOTOGRAPHY NOTIFICATION SYSTEM ---
    async function showPhotographyNotification() {
        // اگر نوبتی رزرو شده باشد، آن را پردازش کن
        if (reservedPhotographyTicket) {
            await showReservedPhotographyNotification();
            return;
        }
        
        // پیدا کردن اولین نوبت در لیست عکاسی که عکس آن گرفته نشده و رزرو نشده
        const nextPhotographyItem = photographyList.find(item => !item.photoTaken && !item.reserved);
        
        if (nextPhotographyItem) {
            await showPhotographyOptions(nextPhotographyItem);
        } else {
            // اگر نوبتی در لیست عکاسی نیست، از خدمات انتخابی فراخوانی کن
            const selections = (currentUser.prefs && currentUser.prefs.service_selections) || {};
            await callNextRegularTicket(selections);
        }
    }

    async function showReservedPhotographyNotification() {
        const notificationHTML = `
            <div class="photography-notification">
                <h3>نوبت رزرو شده</h3>
                <div class="ticket-info">
                    <div class="ticket-number-large">${reservedPhotographyTicket.ticketNumber}</div>
                    <div class="customer-info">
                        <strong>کد ملی:</strong> ${reservedPhotographyTicket.nationalId}<br>
                        <strong>نام:</strong> ${reservedPhotographyTicket.firstName} ${reservedPhotographyTicket.lastName}<br>
                        <strong>ارسال کننده:</strong> ${reservedPhotographyTicket.originalCounterName || 'سیستم'}
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="action-btn photo-taken-btn" onclick="handlePhotoTaken('${reservedPhotographyTicket.id}')">
                        ثبت عکس
                    </button>
                    <button class="action-btn next-ticket-btn" onclick="handleNextTicketPhotography()">
                        فراخوان بعدی
                    </button>
                    <button class="action-btn reserved-list-btn" onclick="showReservedList()">
                        لیست رزروها
                    </button>
                    <button class="action-btn cancel-reserve-btn" onclick="cancelReservation('${reservedPhotographyTicket.id}')">
                        لغو رزرو
                    </button>
                </div>
            </div>
        `;
        
        showCustomNotification(notificationHTML);
    }

    async function showPhotographyOptions(photographyItem) {
        const notificationHTML = `
            <div class="photography-notification">
                <h3>فراخوانی عکاسی</h3>
                <div class="ticket-info">
                    <div class="ticket-number-large">${photographyItem.ticketNumber}</div>
                    <div class="customer-info">
                        <strong>کد ملی:</strong> ${photographyItem.nationalId}<br>
                        <strong>نام:</strong> ${photographyItem.firstName} ${photographyItem.lastName}<br>
                        <strong>ارسال کننده:</strong> ${photographyItem.originalCounterName || 'سیستم'}
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="action-btn photo-taken-btn" onclick="handlePhotoTaken('${photographyItem.id}')">
                        ثبت عکس
                    </button>
                    <button class="action-btn reserve-btn" onclick="handleReserveTicket('${photographyItem.id}')">
                        رزرو نوبت
                    </button>
                    <button class="action-btn next-ticket-btn" onclick="handleNextTicketPhotography()">
                        فراخوان بعدی
                    </button>
                    <button class="action-btn reserved-list-btn" onclick="showReservedList()">
                        لیست رزروها
                    </button>
                </div>
            </div>
        `;
        
        showCustomNotification(notificationHTML);
    }

    // --- PHOTOGRAPHY ACTION HANDLERS ---
    async function handlePhotoTaken(photographyItemId) {
        const item = photographyList.find(i => i.id === photographyItemId);
        if (item) {
            await markPhotoAsTaken(item.id);
            
            // برگرداندن نوبت به صاحب اصلی
            await returnTicketToOriginalUser(item);
            
            // حذف از لیست عکاسی
            await removeFromPhotographyList(item.id);
            
            closeCustomNotification();
            showPopupNotification(`<p>عکس برای نوبت ${item.ticketNumber} ثبت شد و به ${item.originalCounterName || 'کاربر اصلی'} بازگردانده شد.</p>`);
            
            // اگر رزرو شده بود، آن را پاک کن
            if (reservedPhotographyTicket && reservedPhotographyTicket.id === photographyItemId) {
                reservedPhotographyTicket = null;
            }
        }
    }

    async function handleReserveTicket(photographyItemId) {
        const item = photographyList.find(i => i.id === photographyItemId);
        if (item) {
            await reservePhotographyTicket(item.id);
            reservedPhotographyTicket = item;
            closeCustomNotification();
            showPopupNotification(`<p>نوبت ${item.ticketNumber} رزرو شد.</p>`);
        }
    }

    async function handleNextTicketPhotography() {
        closeCustomNotification();
        
        // فراخوانی نوبت بعدی از لیست عکاسی
        const nextItem = photographyList.find(item => !item.photoTaken && !item.reserved && item.id !== (reservedPhotographyTicket?.id));
        
        if (nextItem) {
            await showPhotographyOptions(nextItem);
        } else {
            showPopupNotification('<p>نوبت بعدی برای عکاسی وجود ندارد.</p>');
        }
    }

    async function showReservedList() {
        const reservedItems = photographyList.filter(item => item.reserved);
        
        if (reservedItems.length === 0) {
            showPopupNotification('<p>هیچ نوبت رزرو شده‌ای وجود ندارد.</p>');
            return;
        }
        
        const reservedListHTML = reservedItems.map(item => `
            <div class="reserved-item" onclick="selectReservedTicket('${item.id}')">
                <div class="reserved-ticket-number">${item.ticketNumber}</div>
                <div class="reserved-customer-info">
                    ${item.firstName} ${item.lastName} - ${item.nationalId}
                </div>
            </div>
        `).join('');
        
        const notificationHTML = `
            <div class="photography-notification">
                <h3>لیست نوبت‌های رزرو شده</h3>
                <div class="reserved-list">
                    ${reservedListHTML}
                </div>
                <div class="action-buttons">
                    <button class="action-btn back-btn" onclick="showPhotographyNotification()">
                        بازگشت
                    </button>
                </div>
            </div>
        `;
        
        showCustomNotification(notificationHTML);
    }

    async function selectReservedTicket(photographyItemId) {
        const item = photographyList.find(i => i.id === photographyItemId);
        if (item) {
            reservedPhotographyTicket = item;
            closeCustomNotification();
            await showReservedPhotographyNotification();
        }
    }

    async function cancelReservation(photographyItemId) {
        const item = photographyList.find(i => i.id === photographyItemId);
        if (item) {
            item.reserved = false;
            await savePhotographyList();
            renderPhotographyList();
            reservedPhotographyTicket = null;
            closeCustomNotification();
            showPopupNotification(`<p>رزرو نوبت ${item.ticketNumber} لغو شد.</p>`);
        }
    }

    // --- IMPROVED REGULAR CALL NEXT TICKET ---
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
                currentCalledTicket = updatedTicket;
                
                // نمایش نوتیفیکیشن با گزینه‌های جدید
                await showRegularCallNotification(updatedTicket, readyPhotographyTickets.length > 0);
                
            } catch (error) {
                console.error('Error calling next ticket:', error);
                showPopupNotification('<p>خطا در فراخوانی نوبت!</p>');
            }
        } else {
            showPopupNotification('<p>هیچ نوبتی در صف انتظار برای خدمات انتخابی نیست.</p>');
        }
    }

    // --- NEW REGULAR CALL NOTIFICATION ---
    async function showRegularCallNotification(ticket, isFromPhotography) {
        const service = services.find(s => s.$id === ticket.service_id);
        
        const notificationHTML = `
            <div class="call-notification">
                <h3>${isFromPhotography ? 'بازگشته از عکاسی' : 'فراخوانی نوبت'}</h3>
                <div class="ticket-info">
                    <div class="ticket-number-large">${ticket.specific_ticket || 'پاس'}</div>
                    <div class="customer-info">
                        <strong>نام:</strong> ${ticket.first_name} ${ticket.last_name}<br>
                        <strong>کد ملی:</strong> ${ticket.national_id}<br>
                        <strong>خدمت:</strong> ${service?.name || '---'}<br>
                        <strong>باجه:</strong> ${ticket.called_by_counter_name || 'سیستم'}
                        ${isFromPhotography ? '<br><span style="color: #4CAF50; font-weight: bold;">(بازگشته از عکاسی)</span>' : ''}
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="action-btn send-to-photo-btn" onclick="sendToPhotographyFromNotification()">
                        ارسال به عکاسی
                    </button>
                    <button class="action-btn next-ticket-btn" onclick="completeAndCallNext()">
                        فراخوان بعدی
                    </button>
                </div>
            </div>
        `;
        
        showCustomNotification(notificationHTML);
    }

    async function sendToPhotographyFromNotification() {
        if (currentCalledTicket) {
            closeCustomNotification();
            openPhotographyModal(currentCalledTicket);
        }
    }

    async function completeAndCallNext() {
        if (currentCalledTicket) {
            // تکمیل نوبت فعلی
            await completeTicket(currentCalledTicket.$id);
            closeCustomNotification();
            
            // فراخوانی نوبت بعدی
            const selections = (currentUser.prefs && currentUser.prefs.service_selections) || {};
            await callNextRegularTicket(selections);
        }
    }

    // --- CUSTOM NOTIFICATION SYSTEM ---
    function showCustomNotification(htmlContent) {
        popupText.innerHTML = htmlContent;
        popupNotification.style.display = 'flex';
        
        setTimeout(() => {
            popupNotification.classList.add('show');
        }, 10);
    }

    function closeCustomNotification() {
        popupNotification.classList.remove('show');
        setTimeout(() => {
            popupNotification.style.display = 'none';
            currentCalledTicket = null;
        }, 300);
    }

    // ادامه توابع موجود (بقیه کد بدون تغییر باقی می‌ماند)
    // [بقیه توابع بدون تغییر...]

    // --- EVENT LISTENERS ---
    // [Event listeners بدون تغییر...]

    // --- INITIALIZE APP ---
    initializeApp();

    // توابع global برای استفاده در HTML
    window.handlePhotoTaken = handlePhotoTaken;
    window.handleReserveTicket = handleReserveTicket;
    window.handleNextTicketPhotography = handleNextTicketPhotography;
    window.showReservedList = showReservedList;
    window.selectReservedTicket = selectReservedTicket;
    window.cancelReservation = cancelReservation;
    window.sendToPhotographyFromNotification = sendToPhotographyFromNotification;
    window.completeAndCallNext = completeAndCallNext;
});