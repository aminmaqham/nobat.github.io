document.addEventListener('DOMContentLoaded', () => {
    // --- APPWRITE SETUP ---
    const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
    const APPWRITE_PROJECT_ID = '68a8d1b0000e80bdc1f3';
    const DATABASE_ID = '68a8d24b003cd6609e37';
    const SERVICES_COLLECTION_ID = '68a8d28b002ce97317ae';
    const TICKETS_COLLECTION_ID = '68a8d63a003a3a6afa24';
    const PHOTOGRAPHY_COLLECTION_ID = 'photography_records'; // اضافه کردن کالکشن عکاسی

    const { Client, Account, Databases, ID, Query, Permission, Role } = Appwrite;

    const client = new Client();
    client
        .setEndpoint(APPWRITE_ENDPOINT)
        .setProject(APPWRITE_PROJECT_ID);

    const account = new Account(client);
    const databases = new Databases(client);

    // --- DOM Elements ---
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

    // عناصر جدید برای عکاسی
    const photographyCheckbox = document.getElementById('photography-service-check');
    const photographyModal = document.getElementById('photography-modal');
    const photoNationalIdInput = document.getElementById('photo-national-id');
    const capturePhotoBtn = document.getElementById('capture-photo-btn');
    const reservePhotoBtn = document.getElementById('reserve-photo-btn');
    const noPhotoBtn = document.getElementById('no-photo-btn');
    const reserveListBtn = document.getElementById('reserve-list-btn');
    const cancelPhotoBtn = document.getElementById('cancel-photo-btn');
    const photoReserveListModal = document.getElementById('photo-reserve-list-modal');
    const photoReserveTable = document.querySelector('#photo-reserve-table tbody');
    const closeReserveListBtn = document.getElementById('close-reserve-list-btn');
    const sendToPhotographyBtn = document.getElementById('send-to-photography-btn');
    const callNextAfterPopupBtn = document.getElementById('call-next-after-popup-btn');
    const photographyHistoryTable = document.querySelector('#photography-history tbody');

    // --- Application State ---
    let currentUser = null;
    let services = [];
    let tickets = [];
    let tempSelectedServicesForPass = [];
    let lastCalledTicket = {};
    let currentCalledTicket = null; // تیکت فعلی که فراخوانی شده
    let photographyRecords = []; // رکوردهای عکاسی

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
        await Promise.all([fetchServices(), fetchTickets(), fetchPhotographyRecords()]);
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

    async function fetchPhotographyRecords() {
        try {
            // اگر کالکشن عکاسی وجود ندارد، ایجاد می‌کنیم
            const response = await databases.listDocuments(DATABASE_ID, PHOTOGRAPHY_COLLECTION_ID, [
                Query.orderDesc('$createdAt')
            ]);
            photographyRecords = response.documents;
        } catch (error) {
            console.log('Photography collection not found or empty, will be created on first use');
            photographyRecords = [];
        }
    }

    function renderUI() {
        if (!currentUser) return;
        renderServiceButtons();
        updateServiceCheckboxes();
        updateHistoryTable();
        updateCurrentTicketDisplay();
        updateTotalWaitingCount();
        updatePhotographyHistory();
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

    function updatePhotographyHistory() {
        photographyHistoryTable.innerHTML = '';
        photographyRecords.forEach(record => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${record.customer_name || '---'}</td>
                <td>${record.national_id || '---'}</td>
                <td>${record.original_ticket || '---'}</td>
                <td>${record.service_name || '---'}</td>
                <td>${getPhotoStatusText(record.photo_status)}</td>
                <td>${formatDate(record.sent_to_photography_time)}</td>
                <td>${formatDate(record.photo_approved_time)}</td>
                <td>
                    ${record.photo_status === 'sent' ? 
                        `<button class="approve-photo-btn" data-id="${record.$id}">تایید عکس</button>` : 
                        '---'}
                </td>
            `;
            photographyHistoryTable.appendChild(row);
        });

        // اضافه کردن event listener برای دکمه‌های تایید عکس
        document.querySelectorAll('.approve-photo-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const recordId = e.target.dataset.id;
                approvePhoto(recordId);
            });
        });
    }

    function getPhotoStatusText(status) {
        const statusMap = {
            'sent': 'ارسال شده به عکاسی',
            'reserved': 'رزرو شده',
            'approved': 'تایید شده',
            'no_photo': 'بدون عکس',
            'completed': 'تکمیل شده'
        };
        return statusMap[status] || status;
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
                showPopupNotification('<p>خطا در ثبت نوبت پاس!</p>');
            }
        }
    }

    // --- CALL LOGIC ---
    async function callNextTicket() {
        if (!currentUser) return;
        
        const userPrefs = currentUser.prefs || {};
        const selections = userPrefs.service_selections || {};
        const selectedServiceIds = Object.keys(selections).filter(id => selections[id]);
        
        if (selectedServiceIds.length === 0) {
            showPopupNotification('<p>لطفاً حداقل یک خدمت را برای فراخوانی انتخاب کنید.</p>');
            return;
        }

        // بررسی اولویت عکاسی
        const isPhotographySelected = photographyCheckbox.checked;
        
        if (isPhotographySelected) {
            // اولویت با عکاسی - بررسی نوبت‌های عکاسی
            const photographyTickets = tickets.filter(t => 
                selectedServiceIds.includes(t.service_id) && 
                t.status === 'در حال انتظار' &&
                t.photography_priority === true
            );
            
            if (photographyTickets.length > 0) {
                // اگر نوبت عکاسی وجود دارد، مودال عکاسی را نشان بده
                openPhotographyModal(photographyTickets[0]);
                return;
            }
        }

        // فراخوانی عادی
        await callNextRegularTicket(selectedServiceIds);
    }

    async function callNextRegularTicket(selectedServiceIds) {
        const waitingTickets = tickets.filter(t => 
            selectedServiceIds.includes(t.service_id) && 
            t.status === 'در حال انتظار'
        );

        if (waitingTickets.length === 0) {
            showPopupNotification('<p>نوبت جدیدی برای فراخوانی وجود ندارد.</p>');
            return;
        }

        // مرتب‌سازی بر اساس اولویت و زمان
        waitingTickets.sort((a, b) => {
            // اولویت با نوبت‌های عادی
            if (a.ticket_type === 'regular' && b.ticket_type === 'pass') return -1;
            if (a.ticket_type === 'pass' && b.ticket_type === 'regular') return 1;
            
            // سپس بر اساس زمان ثبت
            return new Date(a.$createdAt) - new Date(b.$createdAt);
        });

        const nextTicket = waitingTickets[0];
        await callTicket(nextTicket);
    }

    async function callTicket(ticket) {
        try {
            const now = new Date().toISOString();
            const updatedTicket = await databases.updateDocument(
                DATABASE_ID, TICKETS_COLLECTION_ID, ticket.$id, {
                    status: 'در حال سرویس',
                    called_by: currentUser.$id,
                    called_by_name: currentUser.name,
                    call_time: now
                }
            );
            
            currentCalledTicket = updatedTicket;
            
            const service = services.find(s => s.$id === ticket.service_id);
            const popupMessage = `
                <span class="ticket-number">نوبت: ${ticket.specific_ticket || 'پاس'}</span>
                <p>نوبت کلی: ${ticket.general_ticket}</p>
                <p>نام: ${ticket.first_name} ${ticket.last_name}</p>
                <p>خدمت: ${service ? service.name : '---'}</p>
                <span class="call-time">زمان فراخوان: ${formatDate(now)}</span>
            `;
            
            // نمایش دکمه‌های جدید در پاپاپ
            showPopupNotification(popupMessage, true);
            
        } catch (error) {
            console.error('Error calling ticket:', error);
            showPopupNotification('<p>خطا در فراخوانی نوبت!</p>');
        }
    }

    // --- PHOTOGRAPHY SYSTEM ---
    function openPhotographyModal(ticket) {
        currentCalledTicket = ticket;
        photoNationalIdInput.value = ticket.national_id || '';
        photographyModal.style.display = 'flex';
    }

    async function handlePhotographyAction(action) {
        if (!currentCalledTicket) return;
        
        const service = services.find(s => s.$id === currentCalledTicket.service_id);
        
        switch (action) {
            case 'capture':
                // ثبت عکس - ارسال به عکاسی
                if (!validateNationalId(photoNationalIdInput.value)) {
                    alert('کد ملی وارد شده معتبر نیست.');
                    return;
                }
                
                await createPhotographyRecord('sent');
                await updateTicketPhotographyStatus('sent');
                showPopupNotification('<p>مشتری به عکاسی ارسال شد.</p>');
                break;
                
            case 'reserve':
                // رزرو نوبت عکس
                await createPhotographyRecord('reserved');
                await updateTicketPhotographyStatus('reserved');
                showPopupNotification('<p>نوبت عکس رزرو شد.</p>');
                break;
                
            case 'no_photo':
                // بدون عکس
                await createPhotographyRecord('no_photo');
                await updateTicketPhotographyStatus('no_photo');
                await completeTicketService();
                showPopupNotification('<p>خدمت بدون عکس تکمیل شد.</p>');
                break;
                
            case 'reserve_list':
                // نمایش لیست رزروها
                openPhotoReserveList();
                return;
        }
        
        closePhotographyModal();
    }

    function validateNationalId(nationalId) {
        return checkCodeMeli(nationalId);
    }

    async function createPhotographyRecord(status) {
        const service = services.find(s => s.$id === currentCalledTicket.service_id);
        
        const recordData = {
            original_ticket: currentCalledTicket.general_ticket,
            specific_ticket: currentCalledTicket.specific_ticket || 'پاس',
            customer_name: `${currentCalledTicket.first_name} ${currentCalledTicket.last_name}`,
            national_id: photoNationalIdInput.value || currentCalledTicket.national_id,
            service_id: currentCalledTicket.service_id,
            service_name: service ? service.name : '---',
            photo_status: status,
            sent_to_photography_time: new Date().toISOString(),
            called_by: currentUser.$id,
            called_by_name: currentUser.name
        };
        
        try {
            const record = await databases.createDocument(
                DATABASE_ID, PHOTOGRAPHY_COLLECTION_ID, ID.unique(), recordData,
                [Permission.read(Role.users()), Permission.update(Role.users()), Permission.delete(Role.users())]
            );
            photographyRecords.push(record);
            updatePhotographyHistory();
        } catch (error) {
            console.error('Error creating photography record:', error);
        }
    }

    async function updateTicketPhotographyStatus(status) {
        try {
            await databases.updateDocument(
                DATABASE_ID, TICKETS_COLLECTION_ID, currentCalledTicket.$id, {
                    photography_status: status,
                    national_id: photoNationalIdInput.value || currentCalledTicket.national_id
                }
            );
        } catch (error) {
            console.error('Error updating ticket photography status:', error);
        }
    }

    async function approvePhoto(recordId) {
        try {
            const record = photographyRecords.find(r => r.$id === recordId);
            if (!record) return;
            
            // آپدیت وضعیت رکورد عکاسی
            await databases.updateDocument(
                DATABASE_ID, PHOTOGRAPHY_COLLECTION_ID, recordId, {
                    photo_status: 'approved',
                    photo_approved_time: new Date().toISOString(),
                    approved_by: currentUser.$id,
                    approved_by_name: currentUser.name
                }
            );
            
            // پیدا کردن تیکت اصلی و آپدیت آن
            const originalTicket = tickets.find(t => 
                t.general_ticket === record.original_ticket && 
                t.service_id === record.service_id
            );
            
            if (originalTicket) {
                await databases.updateDocument(
                    DATABASE_ID, TICKETS_COLLECTION_ID, originalTicket.$id, {
                        photography_status: 'approved',
                        status: 'تکمیل شده'
                    }
                );
            }
            
            // رفرش داده‌ها
            await fetchData();
            showPopupNotification('<p>عکس تایید شد و نوبت به باجه بازگشت.</p>');
            
        } catch (error) {
            console.error('Error approving photo:', error);
            showPopupNotification('<p>خطا در تایید عکس!</p>');
        }
    }

    function openPhotoReserveList() {
        const reservedRecords = photographyRecords.filter(r => r.photo_status === 'reserved');
        photoReserveTable.innerHTML = '';
        
        reservedRecords.forEach(record => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${record.customer_name}</td>
                <td>${record.national_id}</td>
                <td>${record.service_name}</td>
                <td>${formatDate(record.sent_to_photography_time)}</td>
                <td>
                    <button class="complete-reserve-btn" data-id="${record.$id}">تکمیل عکس</button>
                </td>
            `;
            photoReserveTable.appendChild(row);
        });
        
        // اضافه کردن event listener برای دکمه‌ها
        document.querySelectorAll('.complete-reserve-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const recordId = e.target.dataset.id;
                completeReservedPhoto(recordId);
            });
        });
        
        photoReserveListModal.style.display = 'flex';
        photographyModal.style.display = 'none';
    }

    async function completeReservedPhoto(recordId) {
        try {
            await databases.updateDocument(
                DATABASE_ID, PHOTOGRAPHY_COLLECTION_ID, recordId, {
                    photo_status: 'completed',
                    photo_approved_time: new Date().toISOString()
                }
            );
            
            await fetchPhotographyRecords();
            openPhotoReserveList(); // رفرش لیست
            showPopupNotification('<p>عکس رزرو شده تکمیل شد.</p>');
            
        } catch (error) {
            console.error('Error completing reserved photo:', error);
            showPopupNotification('<p>خطا در تکمیل عکس رزرو شده!</p>');
        }
    }

    // --- POPUP NOTIFICATION ---
    function showPopupNotification(message, showButtons = false) {
        popupText.innerHTML = message;
        
        // تنظیم نمایش دکمه‌ها
        sendToPhotographyBtn.style.display = showButtons ? 'block' : 'none';
        callNextAfterPopupBtn.style.display = showButtons ? 'block' : 'none';
        
        popupNotification.style.display = 'flex';
        
        // پخش صدای نوتیفیکیشن
        playNotificationSound();
    }

    function closePopupNotification() {
        popupNotification.style.display = 'none';
        currentCalledTicket = null;
    }

    // --- MODAL MANAGEMENT ---
    function openCounterSettingsModal() {
        const userPrefs = currentUser.prefs || {};
        counterNameInput.value = userPrefs.counter_name || '';
        counterSettingsModal.style.display = 'flex';
    }

    function closeCounterSettingsModal() {
        counterSettingsModal.style.display = 'none';
    }

    function closePhotographyModal() {
        photographyModal.style.display = 'none';
        currentCalledTicket = null;
    }

    function closePhotoReserveList() {
        photoReserveListModal.style.display = 'none';
    }

    // --- EVENT LISTENERS ---
    loginBtn.addEventListener('click', login);
    logoutBtn.addEventListener('click', logout);
    callNextBtn.addEventListener('click', callNextTicket);
    sendToPhotographyBtn.addEventListener('click', () => {
        closePopupNotification();
        if (currentCalledTicket) {
            openPhotographyModal(currentCalledTicket);
        }
    });
    callNextAfterPopupBtn.addEventListener('click', () => {
        closePopupNotification();
        callNextTicket();
    });

    // دکمه‌های عکاسی
    capturePhotoBtn.addEventListener('click', () => handlePhotographyAction('capture'));
    reservePhotoBtn.addEventListener('click', () => handlePhotographyAction('reserve'));
    noPhotoBtn.addEventListener('click', () => handlePhotographyAction('no_photo'));
    reserveListBtn.addEventListener('click', () => handlePhotographyAction('reserve_list'));
    cancelPhotoBtn.addEventListener('click', closePhotographyModal);
    closeReserveListBtn.addEventListener('click', closePhotoReserveList);

    // تنظیمات باجه
    counterSettingsBtn.addEventListener('click', openCounterSettingsModal);
    saveCounterBtn.addEventListener('click', async () => {
        const counterName = counterNameInput.value.trim();
        if (!counterName) {
            alert('لطفاً شماره یا نام باجه را وارد کنید.');
            return;
        }
        
        try {
            const userPrefs = currentUser.prefs || {};
            await account.updatePrefs({ ...userPrefs, counter_name: counterName });
            currentUser = await account.get();
            closeCounterSettingsModal();
            showLoggedInUI();
        } catch (error) {
            console.error('Error saving counter name:', error);
            alert('خطا در ذخیره شماره باجه!');
        }
    });
    cancelCounterBtn.addEventListener('click', closeCounterSettingsModal);

    // سایر event listenerها بدون تغییر باقی می‌مانند...

    // --- INITIALIZE APP ---
    initializeApp();
});