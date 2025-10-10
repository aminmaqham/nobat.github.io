document.addEventListener('DOMContentLoaded', () => {
    // --- APPWRITE SETUP ---
    const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
    const APPWRITE_PROJECT_ID = '68a8d1b0000e80bdc1f3';
    const DATABASE_ID = '68a8d24b003cd6609e37';
    const SERVICES_COLLECTION_ID = '68a8d28b002ce97317ae';
    const TICKETS_COLLECTION_ID = '68a8d63a003a3a6afa24';
    const PHOTOGRAPHY_COLLECTION_ID = 'photography_history';

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
    let photographyHistory = [];
    let isPhotographyUser = false;
    let currentTicketForPhotography = null;
    let isCallingInProgress = false;
    let lastCalledTicketData = null; // برای ذخیره اطلاعات نوبت فراخوانی شده

   
// --- Sound Management System ---
class SoundManager {
    constructor() {
        this.isAudioEnabled = true;
        this.volume = 0.7;
    }

    // ✅ پخش اعلان از طریق نمایشگر
    async playCallAnnouncement(ticketNumber, counterNumber, ticketData = null) {
        if (!this.isAudioEnabled) return;
        
        console.log(`🎵 Requesting display to play: Ticket ${ticketNumber}, Counter ${counterNumber}`);
        
        lastCalledTicketData = { ticketNumber, counterNumber, ticketData };
        
        return Promise.resolve();
    }

    // ✅ تکرار صوت آخرین نوبت
    async repeatLastAnnouncement() {
        if (!this.isAudioEnabled || !lastCalledTicketData) {
            console.log('❌ No recent announcement to repeat');
            return;
        }
        
        const { ticketNumber, counterNumber, ticketData } = lastCalledTicketData;
        console.log(`🔁 Repeating announcement: Ticket ${ticketNumber}, Counter ${counterNumber}`);
        
        return Promise.resolve();
    }

    setVolume(level) {
        this.volume = Math.max(0, Math.min(1, level));
    }

    toggleSound(enabled) {
        this.isAudioEnabled = enabled;
        console.log(`🔊 Sound ${enabled ? 'enabled' : 'disabled'}`);
    }

    loadSettings() {
        // تنظیمات صدا فقط برای نمایشگر
    }
}

    const soundManager = new SoundManager();

    // --- توابع کمکی برای دسترسی امن ---
    function getUserPrefs() {
        return currentUser ? (currentUser.prefs || {}) : {};
    }

    function getCounterName() {
        const prefs = getUserPrefs();
        return prefs.counter_name || 'باجه';
    }

    function getCounterNumber() {
        const prefs = getUserPrefs();
        return prefs.counter_number || '1';
    }

    function isUserPhotography() {
        const prefs = getUserPrefs();
        return prefs.is_photography_user || false;
    }

    function getServiceSelections() {
        const prefs = getUserPrefs();
        return prefs.service_selections || {};
    }

    function getUserRole() {
        const prefs = getUserPrefs();
        return prefs.role || 'user';
    }

    // --- توابع مدیریت تاریخچه عکاسی ---
    async function loadPhotographyHistory() {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID, 
                PHOTOGRAPHY_COLLECTION_ID,
                [Query.orderDesc('$createdAt'), Query.limit(100)]
            );
            photographyHistory = response.documents;
            renderPhotographyHistory();
            updatePhotographyUI();
        } catch (error) {
            console.error('Error loading photography history from Appwrite:', error);
            photographyHistory = [];
        }
    }

    function savePhotographyHistory() {
        try {
            const event = new Event('photographyHistoryUpdated');
            window.dispatchEvent(event);
            console.log('Photography history synced');
        } catch (error) {
            console.error('Error saving photography history:', error);
        }
    }

    // --- تابع اصلاح شده برای نمایش خطای کد ملی ---
    function showNationalIdError(message) {
        const nationalIdInput = document.getElementById('photography-national-id');
        if (nationalIdInput) {
            nationalIdInput.style.borderColor = 'var(--danger-color)';
            nationalIdInput.style.backgroundColor = '#ffeaea';
            nationalIdInput.focus();
            
            const errorToast = document.createElement('div');
            errorToast.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: var(--danger-color);
                color: white;
                padding: 10px 20px;
                border-radius: var(--border-radius);
                z-index: 10000;
                font-family: 'Vazirmatn', sans-serif;
            `;
            errorToast.textContent = message;
            document.body.appendChild(errorToast);
            
            setTimeout(() => {
                errorToast.remove();
            }, 3000);
        }
        console.error('National ID Error:', message);
    }

    // --- تابع برای بررسی تکراری نبودن کد ملی در لیست انتظار ---
    function isNationalIdInWaitingList(nationalId) {
        const nationalIdStr = String(nationalId);
        return photographyHistory.some(item => 
            String(item.nationalId) === nationalIdStr && 
            item.status === 'در انتظار' &&
            !item.photoTaken
        );
    }

    // --- تابع اصلاح شده برای افزودن به تاریخچه عکاسی ---
    async function addToPhotographyList(ticket, nationalId, source = 'photography_modal') {
        console.log('Adding to photography history:', { ticket, nationalId, source });

        if (!nationalId || nationalId.trim() === '') {
            showNationalIdError('لطفا کد ملی را وارد کنید.');
            return false;
        }

        nationalId = nationalId.toString().replace(/\s/g, '').replace(/\D/g, '');
        
        if (nationalId.length !== 10) {
            showNationalIdError('کد ملی باید 10 رقم باشد.');
            return false;
        }

        if (!checkCodeMeli(nationalId)) {
            showNationalIdError('کد ملی وارد شده معتبر نیست.');
            return false;
        }

        if (isNationalIdInWaitingList(nationalId)) {
            alert(`کد ملی ${nationalId} قبلاً در لیست انتظار عکاسی ثبت شده است.`);
            return false;
        }

        try {
            const service = services.find(s => s.$id === ticket.service_id);
            
            let ticketNumber = ticket.specific_ticket;
            if (!ticketNumber || ticketNumber === 'undefined' || ticketNumber === 'null') {
                ticketNumber = 'پاس';
            }

            const originalCounterName = ticket.called_by_counter_name || getCounterName();

            const newItem = {
                ticketNumber: String(ticketNumber),
                nationalId: String(nationalId),
                firstName: ticket.first_name || '---',
                lastName: ticket.last_name || '---',
                source: source,
                serviceId: ticket.service_id,
                serviceName: service?.name || '---',
                originalTicketId: parseInt(ticket.$id) || 0,
                ticketType: ticket.ticket_type || 'regular',
                originalCounterName: originalCounterName
            };

            console.log('Prepared photography item with Appwrite-compatible types:', newItem);

            const success = await addToPhotographyHistory(newItem, 'added');
            
            if (success) {
                showPopupNotification(`<p>نوبت ${newItem.ticketNumber} با کد ملی ${nationalId} به لیست عکاسی اضافه شد.</p>`);
                return true;
            }
            
            return false;

        } catch (error) {
            console.error('Error adding to photography list:', error);
            showPopupNotification('<p>خطا در اضافه کردن به لیست عکاسی!</p>');
            return false;
        }
    }

    async function addToPhotographyHistoryWithFallback(item, action = 'added') {
        try {
            return await addToPhotographyHistory(item, action);
        } catch (error) {
            console.error('Primary method failed, trying fallback:', error);
            return false;
        }
    }

    async function addToPhotographyHistory(item, action = 'added') {
        try {
            console.log('Starting to add to photography history:', item);
            
            if (!currentUser) {
                console.error('No current user found');
                showPopupNotification('<p>خطا: کاربر لاگین نشده است</p>');
                return false;
            }
            
            const userPrefs = getUserPrefs();
            const counterName = getCounterName();

            const photographyData = {
                ticketNumber: String(item.ticketNumber || 'پاس').substring(0, 255),
                nationalId: String(item.nationalId || '').substring(0, 9998),
                firstName: String(item.firstName || 'ثبت دستی').substring(0, 9998),
                lastName: String(item.lastName || '').substring(0, 9998),
                status: action === 'completed' ? 'تکمیل شده' : 'در انتظار',
                photoTaken: action === 'completed',
                timestamp: new Date().toISOString(),
                addedBy: currentUser.$id,
                addedByName: String(currentUser.name || currentUser.email).substring(0, 9998),
                counterName: String(counterName).substring(0, 9998),
                source: String(item.source || 'photography_modal').substring(0, 254)
            };

            if (item.serviceId) {
                photographyData.serviceId = String(item.serviceId).substring(0, 9998);
            }
            
            if (item.serviceName) {
                photographyData.serviceName = String(item.serviceName).substring(0, 9998);
            }
            
            if (item.originalTicketId) {
                photographyData.originalTicketId = parseInt(item.originalTicketId) || 0;
            }
            
            if (item.ticketType) {
                photographyData.ticketType = String(item.ticketType).substring(0, 9998);
            }
            
            if (item.originalCounterName) {
                photographyData.originalCounterName = String(item.originalCounterName).substring(0, 9998);
            }

            if (action === 'completed') {
                photographyData.completedAt = new Date().toISOString();
                photographyData.completedBy = currentUser.$id;
                photographyData.completedByName = String(currentUser.name || currentUser.email).substring(0, 9998);
            }

            console.log('Creating photography document with Appwrite-compatible structure:', photographyData);

            const createdItem = await databases.createDocument(
                DATABASE_ID, 
                PHOTOGRAPHY_COLLECTION_ID, 
                ID.unique(), 
                photographyData,
                [Permission.read(Role.users()), Permission.update(Role.users()), Permission.delete(Role.users())]
            );

            console.log('Successfully created photography item:', createdItem);

            photographyHistory.unshift(createdItem);
            
            if (photographyHistory.length > 100) {
                photographyHistory = photographyHistory.slice(0, 100);
            }
            
            renderPhotographyHistory();
            updatePhotographyUI();
            
            return true;

        } catch (error) {
            console.error('Error adding to photography history:', error);
            
            let errorMessage = 'خطا در اضافه کردن به تاریخچه عکاسی! ';
            if (error.message) {
                errorMessage += error.message;
            }
            
            showPopupNotification(`<p>${errorMessage}</p>`);
            return false;
        }
    }

    // --- تابع برای علامت‌گذاری عکس گرفته شده و بازگشت به باجه ---
    async function markPhotoAsTaken(photographyItemId) {
        try {
            const photographyItem = photographyHistory.find(i => i.$id === photographyItemId);
            if (!photographyItem) {
                console.error('Photography item not found:', photographyItemId);
                return false;
            }

            const updatedItem = await databases.updateDocument(
                DATABASE_ID, 
                PHOTOGRAPHY_COLLECTION_ID, 
                photographyItemId, 
                {
                    photoTaken: true,
                    completedAt: new Date().toISOString(),
                    status: 'تکمیل شده',
                    completedBy: currentUser.$id,
                    completedByName: currentUser.name || currentUser.email
                }
            );

            const itemIndex = photographyHistory.findIndex(i => i.$id === photographyItemId);
            if (itemIndex !== -1) {
                photographyHistory[itemIndex] = updatedItem;
            }

            if (photographyItem.originalTicketId) {
                await returnTicketToOriginalCounter(photographyItem.originalTicketId, photographyItem.originalCounterName);
            }

            renderPhotographyHistory();
            updatePhotographyUI();
            
            showPopupNotification(`<p>عکس با موفقیت ثبت شد و نوبت به باجه مبدا بازگردانده شد.</p>`);
            return true;
        } catch (error) {
            console.error('Error marking photo as taken:', error);
            showPopupNotification('<p>خطا در ثبت عکس!</p>');
            return false;
        }
    }

    // --- تابع بهبود یافته برای بازگشت نوبت به باجه مبدا ---
    async function returnTicketToOriginalCounter(ticketId, originalCounterName) {
        try {
            console.log(`Returning ticket ${ticketId} to counter: ${originalCounterName}`);
            
            const originalTicket = await databases.getDocument(
                DATABASE_ID,
                TICKETS_COLLECTION_ID,
                ticketId
            );

            if (!originalTicket) {
                console.error('Original ticket not found:', ticketId);
                return false;
            }

            // ایجاد نوبت جدید با اولویت بالا
            const newTicketData = {
                service_id: originalTicket.service_id,
                specific_ticket: originalTicket.specific_ticket,
                general_ticket: originalTicket.general_ticket,
                first_name: originalTicket.first_name,
                last_name: originalTicket.last_name,
                national_id: originalTicket.national_id,
                registered_by: originalTicket.registered_by,
                registered_by_name: originalTicket.registered_by_name,
                status: 'در حال انتظار',
                ticket_type: 'returned_from_photography',
                original_ticket_id: originalTicket.$id,
                returned_from_photography: true,
                original_counter_name: originalCounterName || 'عکاسی',
                priority: 'high', // ✅ اولویت بالا
                created_at: new Date().toISOString(),
                // ✅ اضافه کردن فیلدهای مربوط به فراخوانی صوتی
                called_by_counter_name: originalCounterName,
                call_time: new Date().toISOString()
            };

            const returnedTicket = await databases.createDocument(
                DATABASE_ID,
                TICKETS_COLLECTION_ID,
                ID.unique(),
                newTicketData,
                [Permission.read(Role.users()), Permission.update(Role.users()), Permission.delete(Role.users())]
            );

            console.log('Ticket returned to counter with high priority:', returnedTicket);
            
            const service = services.find(s => s.$id === originalTicket.service_id);
            const serviceName = service ? service.name : 'خدمت';
            
            showPopupNotification(`
                <p>نوبت ${originalTicket.specific_ticket || 'پاس'} به صف ${serviceName} بازگردانده شد.</p>
                <p style="font-size: 14px; color: #4CAF50;">✓ این نوبت در اولویت بالا قرار گرفت و به زودی فراخوانی می‌شود.</p>
            `);

            return true;

        } catch (error) {
            console.error('Error returning ticket to counter:', error);
            showPopupNotification('<p>خطا در بازگرداندن نوبت به باجه!</p>');
            return false;
        }
    }

    // --- تابع رندر تاریخچه عکاسی ---
    function renderPhotographyHistory() {
        const historyBody = document.getElementById('photography-history-body');
        if (!historyBody) return;
        
        if (photographyHistory.length === 0) {
            historyBody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 20px;">هیچ رکوردی در تاریخچه عکاسی وجود ندارد</td></tr>';
            return;
        }
        
        historyBody.innerHTML = photographyHistory.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${item.ticketNumber}</td>
                <td>${item.firstName} ${item.lastName}</td>
                <td>${item.nationalId}</td>
                <td>${item.serviceName || '---'}</td>
                <td>${item.source === 'manual_input' ? 'ثبت دستی' : 'ارسال به عکاسی'}</td>
                <td>${item.addedByName || '---'}</td>
                <td>${formatDate(item.timestamp)}</td>
                <td>${item.completedAt ? formatDate(item.completedAt) : '---'}</td>
                <td>${item.completedByName || '---'}</td>
                <td class="${item.status === 'تکمیل شده' ? 'status-completed' : 'status-pending'}">
                    ${item.status}
                </td>
            </tr>
        `).join('');
    }

    // --- تابع به‌روزرسانی UI عکاسی ---
    function updatePhotographyUI() {
        const waitingItems = photographyHistory.filter(item => 
            item.status === 'در انتظار' && !item.photoTaken
        );
        const waitingCount = waitingItems.length;
        
        if (photographyWaitingCount) {
            photographyWaitingCount.textContent = waitingCount;
        }
        
        renderPhotographyList();
        
        if (isPhotographyUser && waitingCount > 0) {
            document.querySelector('.photography-waiting-display').innerHTML = `
                منتظران عکاسی: <span id="photography-waiting-count">${waitingCount}</span>
                <span style="color: #d32f2f; font-weight: 700;"> - اولویت با عکاسی</span>
            `;
        }
    }

    // --- تابع رندر لیست عکاسی (نمایش زنده) ---
    function renderPhotographyList() {
        if (!photographyListContainer) return;
        
        const waitingItems = photographyHistory.filter(item => 
            item.status === 'در انتظار' && !item.photoTaken
        );
        
        if (waitingItems.length === 0) {
            photographyListContainer.innerHTML = '<div class="photography-empty">هیچ نوبتی در لیست عکاسی وجود ندارد</div>';
            if (photographyDisplay) {
                photographyDisplay.style.display = 'none';
            }
            return;
        }
        
        const displayItems = waitingItems.slice(0, 7);
        
        photographyListContainer.innerHTML = displayItems.map((item, index) => `
            <div class="photography-item ${index === 0 ? 'new-item' : ''}">
                <div class="photography-number">${index + 1}</div>
                <div class="photography-info">
                    <div class="photography-ticket">${item.ticketNumber} - ${item.firstName} ${item.lastName}</div>
                    <div class="photography-national-id">${item.nationalId}</div>
                </div>
                <div class="photography-status">
                    در انتظار
                </div>
            </div>
        `).join('');
        
        if (photographyDisplay) {
            photographyDisplay.style.display = 'flex';
        }
    }

    // --- توابع به‌روزرسانی وضعیت آنلاین ---
    async function updateAllDisplays() {
        await updateTotalWaitingCount();
        updatePhotographyUI();
    }

    async function updateTotalWaitingCount() {
        try {
            const waitingTickets = tickets.filter(t => t.status === 'در حال انتظار');
            document.getElementById('total-waiting-count').textContent = waitingTickets.length;
        } catch (error) {
            console.error('Error updating total waiting count:', error);
        }
    }

    // --- نوتیفیکیشن پیشرفته با دکمه‌ها ---
    function showAdvancedPopupNotification(ticket, htmlContent) {
        return new Promise((resolve) => {
            const popup = document.getElementById('popup-notification');
            const popupText = document.getElementById('popup-text');
            
            popupText.innerHTML = '';
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'popup-with-buttons';
            
            const closeBtn = document.createElement('button');
            closeBtn.className = 'popup-close-btn';
            closeBtn.innerHTML = '×';
            closeBtn.title = 'بستن';
            closeBtn.onclick = () => {
                closePopup();
                setTimeout(() => resolve('close'), 300);
            };
            
            const messageDiv = document.createElement('div');
            messageDiv.innerHTML = htmlContent;
            
            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'popup-buttons';
            
            // ✅ دکمه تکرار صوت
            const repeatSoundBtn = document.createElement('button');
            repeatSoundBtn.className = 'popup-btn popup-repeat-btn';
            repeatSoundBtn.innerHTML = '🔊 تکرار صوت';
            repeatSoundBtn.onclick = () => {
                console.log('🔁 User requested sound repetition');
                soundManager.repeatLastAnnouncement();
                // افکت بصری
                repeatSoundBtn.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    repeatSoundBtn.style.transform = 'scale(1)';
                }, 150);
            };
            
            // ✅ دکمه ارسال به عکاسی
            const photographyBtn = document.createElement('button');
            photographyBtn.className = 'popup-btn popup-photography-btn';
            photographyBtn.textContent = 'ارسال به عکاسی';
            photographyBtn.onclick = () => {
                closePopup();
                setTimeout(() => resolve('photography'), 300);
            };
            
            // ✅ دکمه فراخوان بعدی
            const nextBtn = document.createElement('button');
            nextBtn.className = 'popup-btn popup-next-btn';
            nextBtn.textContent = 'فراخوان بعدی';
            nextBtn.onclick = () => {
                closePopup();
                setTimeout(() => resolve('next'), 300);
            };
            
            buttonsDiv.appendChild(repeatSoundBtn);
            buttonsDiv.appendChild(photographyBtn);
            buttonsDiv.appendChild(nextBtn);
            
            contentDiv.appendChild(closeBtn);
            contentDiv.appendChild(messageDiv);
            contentDiv.appendChild(buttonsDiv);
            
            popupText.appendChild(contentDiv);
            
            popup.style.display = 'flex';
            setTimeout(() => {
                popup.classList.add('show');
            }, 10);
            
            // ✅ پخش خودکار صوت از طریق نمایشگر
            if (ticket) {
                const ticketNumber = ticket.specific_ticket || '0001';
                const counterNumber = getCounterNumber();
                soundManager.playCallAnnouncement(ticketNumber, counterNumber, ticket);
            }
            
            function closePopup() {
                popup.classList.remove('show');
                setTimeout(() => {
                    popup.style.display = 'none';
                }, 300);
            }
            
            const backgroundCloseHandler = function(e) {
                if (e.target === popup) {
                    closePopup();
                    setTimeout(() => resolve('background'), 300);
                }
            };
            
            popup.addEventListener('click', backgroundCloseHandler);
            
            const originalClosePopup = closePopup;
            closePopup = function() {
                popup.removeEventListener('click', backgroundCloseHandler);
                originalClosePopup();
            };
        });
    }

    // --- تابع جدید برای نمایش مودال دریافت کد ملی ---
    function showNationalIdModal(ticketNumber) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            `;
            
            const content = document.createElement('div');
            content.style.cssText = `
                background: white;
                padding: 25px;
                border-radius: 8px;
                width: 90%;
                max-width: 400px;
                text-align: center;
            `;
            
            content.innerHTML = `
                <h3 style="margin-bottom: 15px; color: #333;">ثبت دستی عکاسی</h3>
                <p style="margin-bottom: 15px; color: #666;">شماره نوبت: <strong>${ticketNumber}</strong></p>
                <input type="text" id="manual-national-id-input" 
                       placeholder="کد ملی را وارد کنید" 
                       style="width: 100%; padding: 12px; margin-bottom: 15px; border: 2px solid #ddd; border-radius: 4px; text-align: center; font-size: 16px;"
                       maxlength="10">
                <div style="display: flex; gap: 10px;">
                    <button id="confirm-manual-btn" style="flex: 1; padding: 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">تایید</button>
                    <button id="cancel-manual-btn" style="flex: 1; padding: 12px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">انصراف</button>
                </div>
            `;
            
            modal.appendChild(content);
            document.body.appendChild(modal);
            
            const nationalIdInput = document.getElementById('manual-national-id-input');
            const confirmBtn = document.getElementById('confirm-manual-btn');
            const cancelBtn = document.getElementById('cancel-manual-btn');
            
            nationalIdInput.focus();
            
            nationalIdInput.addEventListener('input', function() {
                this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10);
            });
            
            nationalIdInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    confirmBtn.click();
                }
            });
            
            confirmBtn.onclick = () => {
                const nationalId = nationalIdInput.value.trim();
                if (nationalId) {
                    document.body.removeChild(modal);
                    resolve(nationalId);
                } else {
                    alert('لطفا کد ملی را وارد کنید.');
                    nationalIdInput.focus();
                }
            };
            
            cancelBtn.onclick = () => {
                document.body.removeChild(modal);
                resolve(null);
            };
            
            modal.onclick = (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    resolve(null);
                }
            };
        });
    }

    // --- تابع برای ثبت دستی در عکاسی ---
    async function addManualToPhotographyList() {
        const ticketNumber = manualTicketInput.value.trim();
        
        if (!ticketNumber) {
            alert('لطفا شماره نوبت را وارد کنید.');
            return;
        }
        
        try {
            const nationalId = await showNationalIdModal(ticketNumber);
            
            if (!nationalId) {
                return;
            }

            if (!nationalId || nationalId.trim() === '') {
                alert('لطفا کد ملی را وارد کنید.');
                return;
            }

            const cleanNationalId = nationalId.toString().replace(/\s/g, '').replace(/\D/g, '');
            
            if (cleanNationalId.length !== 10) {
                alert('کد ملی باید 10 رقم باشد.');
                return;
            }

            if (!checkCodeMeli(cleanNationalId)) {
                alert('کد ملی وارد شده معتبر نیست.');
                return;
            }

            if (isNationalIdInWaitingList(cleanNationalId)) {
                alert(`کد ملی ${cleanNationalId} قبلاً در لیست انتظار عکاسی ثبت شده است.`);
                return;
            }
            
            const newItem = {
                ticketNumber: ticketNumber,
                firstName: 'ثبت دستی',
                lastName: '',
                nationalId: cleanNationalId,
                source: 'manual_input',
                serviceName: 'ثبت دستی',
                ticketType: 'manual'
            };

            const success = await addToPhotographyHistoryWithFallback(newItem, 'added');
            
            if (success) {
                manualTicketInput.value = '';
                showPopupNotification(`<p>نوبت ${ticketNumber} با موفقیت به لیست عکاسی اضافه شد.</p>`);
            } else {
                showPopupNotification('<p>خطا در ثبت نوبت عکاسی!</p>');
            }
            
        } catch (error) {
            console.error('Error in manual photography addition:', error);
            showPopupNotification('<p>خطا در اضافه کردن به لیست عکاسی!</p>');
        }
    }

    // --- تابع بهبودیافته برای فراخوانی نوبت ---
    async function callSpecificTicket(ticket) {
        // ✅ جلوگیری از فراخوانی همزمان
        if (isCallingInProgress) {
            showPopupNotification('<p>لطفاً منتظر بمانید... فراخوانی در حال انجام است.</p>');
            return;
        }

        isCallingInProgress = true;
        
        try {
            // ✅ نمایش پیام "منتظر بمانید"
            const waitingPopup = showWaitingNotification('در حال فراخوانی نوبت... لطفاً منتظر بمانید');
            
            const counterName = getCounterName();
            const counterNumber = getCounterNumber();
            
            const updatedTicket = await databases.updateDocument(
                DATABASE_ID, 
                TICKETS_COLLECTION_ID, 
                ticket.$id, 
                {
                    status: 'در حال سرویس',
                    called_by: currentUser.$id,
                    called_by_name: currentUser.name || currentUser.email,
                    called_by_counter_name: counterName,
                    call_time: new Date().toISOString()
                }
            );
            
            lastCalledTicket[currentUser.$id] = updatedTicket.$id;
            await fetchTickets();
            
            // ✅ بستن پیام انتظار
            closeWaitingNotification(waitingPopup);
            
            const service = services.find(s => s.$id === updatedTicket.service_id);
            const popupMessage = `
                <div class="ticket-popup-header">
                    <span class="ticket-number">${updatedTicket.specific_ticket || 'پاس'}</span>
                    ${updatedTicket.returned_from_photography ? 
                        '<span class="photography-badge">📸 بازگشته از عکاسی</span>' : ''}
                    ${updatedTicket.priority === 'high' ? 
                        '<span class="priority-badge">⚡ اولویت بالا</span>' : ''}
                </div>
                <div class="ticket-popup-info">
                    <p><strong>نام:</strong> ${updatedTicket.first_name} ${updatedTicket.last_name}</p>
                    <p><strong>کد ملی:</strong> ${updatedTicket.national_id}</p>
                    <p><strong>خدمت:</strong> ${service?.name || '---'}</p>
                    <p><strong>باجه:</strong> ${counterName} (شماره ${counterNumber})</p>
                    ${updatedTicket.original_counter_name ? 
                        `<p><strong>باجه مبدا:</strong> ${updatedTicket.original_counter_name}</p>` : ''}
                </div>
            `;
            
            // ✅ استفاده از نوتیفیکیشن جدید با قابلیت تکرار صوت
            const userChoice = await showAdvancedPopupNotification(updatedTicket, popupMessage);
            
            if (userChoice === 'photography') {
                openPhotographyModal(updatedTicket);
            } else if (userChoice === 'next') {
                setTimeout(() => {
                    callNextTicketWithOptions();
                }, 1000);
            }
            
            await updateAllDisplays();
            
        } catch (error) {
            console.error('Error calling specific ticket:', error);
            showPopupNotification('<p>خطا در فراخوانی نوبت!</p>');
        } finally {
            // ✅ آزاد کردن قفل فراخوانی
            isCallingInProgress = false;
        }
    }

    // --- تابع بهبودیافته برای فراخوانی نوبت ---
    async function callNextTicketWithOptions() {
        // ✅ جلوگیری از فراخوانی همزمان
        if (isCallingInProgress) {
            showPopupNotification('<p>لطفاً منتظر بمانید... فراخوانی در حال انجام است.</p>');
            return;
        }

        const selections = getServiceSelections();
        const selectedServiceIds = Object.keys(selections).filter(id => selections[id]);

        if (selectedServiceIds.length === 0) {
            showPopupNotification('<p>لطفا حداقل یک خدمت را برای فراخوانی انتخاب کنید.</p>');
            return;
        }

        // ✅ اولویت اول: نوبت‌های بازگشته از عکاسی با اولویت بالا
        const highPriorityReturnedTickets = tickets.filter(t => 
            t.status === 'در حال انتظار' && 
            t.returned_from_photography === true &&
            t.priority === 'high' &&
            selectedServiceIds.includes(t.service_id)
        ).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        if (highPriorityReturnedTickets.length > 0) {
            console.log('🚨 Calling high priority returned ticket:', highPriorityReturnedTickets[0]);
            await callSpecificTicket(highPriorityReturnedTickets[0]);
            return;
        }

        // ✅ اولویت دوم: نوبت‌های بازگشته از عکاسی عادی
        const returnedTickets = tickets.filter(t => 
            t.status === 'در حال انتظار' && 
            t.returned_from_photography === true &&
            selectedServiceIds.includes(t.service_id)
        ).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        if (returnedTickets.length > 0) {
            console.log('📸 Calling returned ticket:', returnedTickets[0]);
            await callSpecificTicket(returnedTickets[0]);
            return;
        }

        // ✅ اولویت سوم: نوبت‌های عکاسی در انتظار (فقط اگر کاربر عکاسی است)
        const waitingPhotographyItems = photographyHistory.filter(item => 
            item.status === 'در انتظار' && !item.photoTaken
        );

        if (waitingPhotographyItems.length > 0 && isPhotographyUser) {
            console.log('🎯 Processing photography ticket as photography user');
            await processPhotographyTicket();
            return;
        }

        // ✅ اولویت چهارم: فراخوانی نوبت‌های عادی
        console.log('📋 Calling regular ticket');
        await callNextRegularTicket();
    }

    // تابع جدید برای بررسی و تنظیم شماره باجه
    async function checkAndSetCounterName() {
        const userPrefs = getUserPrefs();
        
        // فقط اگر کاربر لاگین کرده و تنظیمات کامل نیست، مودال نمایش داده شود
        if (currentUser && (!userPrefs.counter_name || !userPrefs.counter_number)) {
            // تأخیر کوتاه برای اطمینان از بارگذاری کامل UI
            setTimeout(() => {
                openCounterSettingsModal();
            }, 1000);
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
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            
            if (!email || !password) {
                alert('لطفا ایمیل و رمز عبور را وارد کنید.');
                return;
            }
            
            console.log('Attempting login with:', email);
            await account.createEmailSession(email, password);
            console.log('Login successful');
            
            window.location.reload();
            
        } catch (error) {
            console.error('Login error:', error);
            alert('خطا در ورود: ' + (error.message || 'اطلاعات ورود نامعتبر است'));
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
        
        const counterName = getCounterName();
        userGreeting.textContent = `کاربر: ${currentUser.name || currentUser.email} (باجه: ${counterName})`;
        
        mainContent.style.display = 'block';
        totalWaitingContainer.style.display = 'block';

        if (getUserRole() === 'admin') {
            settingsBtn.style.display = 'inline-block';
            resetAllBtn.style.display = 'inline-block';
        } else {
            settingsBtn.style.display = 'none';
            resetAllBtn.style.display = 'none';
        }
        
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
        
        const photographyChannel = `databases.${DATABASE_ID}.collections.${PHOTOGRAPHY_COLLECTION_ID}.documents`;
        client.subscribe(photographyChannel, (response) => {
            console.log('Photography history updated via real-time:', response);
            loadPhotographyHistory();
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
        const selections = getServiceSelections();

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
                    const userPrefs = getUserPrefs();
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

    // --- تابع بهبودیافته callNextRegularTicket ---
    async function callNextRegularTicket() {
        // ✅ جلوگیری از فراخوانی همزمان
        if (isCallingInProgress) {
            showPopupNotification('<p>لطفاً منتظر بمانید... فراخوانی در حال انجام است.</p>');
            return;
        }

        isCallingInProgress = true;

        try {
            // ✅ نمایش پیام "منتظر بمانید"
            const waitingPopup = showWaitingNotification('در حال فراخوانی نوبت... لطفاً منتظر بمانید');

            const selections = getServiceSelections();
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
                    const counterName = getCounterName();
                    const counterNumber = getCounterNumber();
                    const updatedTicket = await databases.updateDocument(DATABASE_ID, TICKETS_COLLECTION_ID, ticketToCall.$id, {
                        status: 'در حال سرویس',
                        called_by: currentUser.$id,
                        called_by_name: currentUser.name,
                        called_by_counter_name: counterName,
                        call_time: new Date().toISOString()
                    });
                    
                    lastCalledTicket[currentUser.$id] = updatedTicket.$id;
                    
                    // ✅ بستن پیام انتظار
                    closeWaitingNotification(waitingPopup);
                    
                    await fetchTickets();
                    
                    const service = services.find(s => s.$id === updatedTicket.service_id);
                    const popupMessage = `
                        <span class="ticket-number">فراخوان: ${updatedTicket.specific_ticket || 'پاس'}</span>
                        <p><strong>نام:</strong> ${updatedTicket.first_name} ${updatedTicket.last_name}</p>
                        <p><strong>کد ملی:</strong> ${updatedTicket.national_id}</p>
                        <p><strong>خدمت:</strong> ${service?.name || '---'}</p>
                        <p><strong>باجه:</strong> ${counterName}</p>
                    `;
                    
                    const userChoice = await showAdvancedPopupNotification(updatedTicket, popupMessage);
                    
                    if (userChoice === 'photography') {
                        openPhotographyModal(updatedTicket);
                    } else if (userChoice === 'next') {
                        setTimeout(() => {
                            callNextTicketWithOptions();
                        }, 1000);
                    }
                    
                    await updateAllDisplays();
                    
                } catch (error) {
                    console.error('Error calling next ticket:', error);
                    showPopupNotification('<p>خطا در فراخوانی نوبت!</p>');
                }
            } else {
                showPopupNotification('<p>هیچ نوبتی در صف انتظار برای خدمات انتخابی نیست.</p>');
            }
        } finally {
            // ✅ آزاد کردن قفل فراخوانی
            isCallingInProgress = false;
        }
    }

    // --- فراخوانی نوبت گذشته خاص ---
    async function callPastTicket() {
        // ✅ جلوگیری از فراخوانی همزمان
        if (isCallingInProgress) {
            showPopupNotification('<p>لطفاً منتظر بمانید... فراخوانی در حال انجام است.</p>');
            return;
        }

        isCallingInProgress = true;

        try {
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

            // ✅ نمایش پیام "منتظر بمانید"
            const waitingPopup = showWaitingNotification('در حال فراخوانی نوبت... لطفاً منتظر بمانید');

            const pastTicket = tickets.find(t => 
                t.specific_ticket == ticketNumber || t.general_ticket == ticketNumber
            );

            if (!pastTicket) {
                showPopupNotification(`<p>نوبت ${ticketNumber} در سیستم یافت نشد.</p>`);
                pastTicketInput.classList.add('error');
                return;
            }

            const counterName = getCounterName();
            const counterNumber = getCounterNumber();
            
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
            
            // ✅ بستن پیام انتظار
            closeWaitingNotification(waitingPopup);
            
            const service = services.find(s => s.$id === updatedTicket.service_id);
            
            const popupMessage = `
                <span class="ticket-number">${updatedTicket.specific_ticket || 'پاس'}</span>
                <p><strong>نام:</strong> ${updatedTicket.first_name} ${updatedTicket.last_name}</p>
                <p><strong>کد ملی:</strong> ${updatedTicket.national_id}</p>
                <p><strong>خدمت:</strong> ${service?.name || '---'}</p>
                <p><strong>باجه:</strong> ${counterName}</p>
            `;
            showPopupNotification(popupMessage);
            
            pastTicketInput.value = '';
            pastTicketInput.classList.remove('error');
            pastTicketInput.classList.add('success');
            setTimeout(() => pastTicketInput.classList.remove('success'), 2000);
            
            await fetchData();
            
        } catch (error) {
            console.error('Error calling past ticket:', error);
            showPopupNotification('<p>خطا در فراخوانی نوبت گذشته!</p>');
            pastTicketInput.classList.add('error');
        } finally {
            // ✅ آزاد کردن قفل فراخوانی
            isCallingInProgress = false;
        }
    }
    
    async function resetAllTickets() {
        if (!confirm('⚠️ هشدار: این عمل غیرقابل بازگشت است!\n\nآیا مطمئن هستید که می‌خواهید:\n• تمام نوبت‌ها\n• تمام تاریخچه عکاسی\n• لیست انتظار عکاسی\n\nرا پاک کنید؟')) return;
        
        try {
            showPopupNotification('<p>در حال پاک کردن داده‌ها... لطفا منتظر بمانید.</p>');
            
            let deletedTicketsCount = 0;
            let deletedPhotographyCount = 0;

            try {
                let ticketsResponse = await databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID, [Query.limit(100)]);
                while (ticketsResponse.documents.length > 0) {
                    const deletePromises = ticketsResponse.documents.map(doc => 
                        databases.deleteDocument(DATABASE_ID, TICKETS_COLLECTION_ID, doc.$id)
                    );
                    await Promise.all(deletePromises);
                    deletedTicketsCount += ticketsResponse.documents.length;
                    ticketsResponse = await databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID, [Query.limit(100)]);
                }
                console.log(`Deleted ${deletedTicketsCount} tickets`);
            } catch (ticketError) {
                console.error('Error deleting tickets:', ticketError);
            }

            try {
                let photographyResponse = await databases.listDocuments(DATABASE_ID, PHOTOGRAPHY_COLLECTION_ID, [Query.limit(100)]);
                while (photographyResponse.documents.length > 0) {
                    const deletePhotographyPromises = photographyResponse.documents.map(doc => 
                        databases.deleteDocument(DATABASE_ID, PHOTOGRAPHY_COLLECTION_ID, doc.$id)
                    );
                    await Promise.all(deletePhotographyPromises);
                    deletedPhotographyCount += photographyResponse.documents.length;
                    photographyResponse = await databases.listDocuments(DATABASE_ID, PHOTOGRAPHY_COLLECTION_ID, [Query.limit(100)]);
                }
                console.log(`Deleted ${deletedPhotographyCount} photography records`);
            } catch (photographyError) {
                console.error('Error deleting photography history:', photographyError);
            }

            photographyHistory = [];
            tickets = [];
            savePhotographyHistory();
            
            updatePhotographyUI();
            await fetchData();
            renderUI();
            
            showPopupNotification(`
                <p>✅ پاکسازی با موفقیت انجام شد:</p>
                <p>• ${deletedTicketsCount} نوبت پاک شد</p>
                <p>• ${deletedPhotographyCount} رکورد عکاسی پاک شد</p>
                <p>• لیست انتظار عکاسی پاک شد</p>
            `);
            
        } catch (error) {
            console.error('Error in reset operation:', error);
            showPopupNotification('<p>❌ خطا در پاک کردن داده‌ها. لطفا دوباره تلاش کنید.</p>');
        }
    }

    async function resetPhotographyHistoryOnly() {
        if (!confirm('آیا مطمئن هستید که می‌خواهید فقط تاریخچه عکاسی را پاک کنید؟')) return;
        
        try {
            let deletedCount = 0;
            let photographyResponse = await databases.listDocuments(DATABASE_ID, PHOTOGRAPHY_COLLECTION_ID, [Query.limit(100)]);
            
            while (photographyResponse.documents.length > 0) {
                const deletePromises = photographyResponse.documents.map(doc => 
                    databases.deleteDocument(DATABASE_ID, PHOTOGRAPHY_COLLECTION_ID, doc.$id)
                );
                await Promise.all(deletePromises);
                deletedCount += photographyResponse.documents.length;
                photographyResponse = await databases.listDocuments(DATABASE_ID, PHOTOGRAPHY_COLLECTION_ID, [Query.limit(100)]);
            }
            
            photographyHistory = [];
            savePhotographyHistory();
            updatePhotographyUI();
            
            showPopupNotification(`<p>✅ ${deletedCount} رکورد از تاریخچه عکاسی پاک شد.</p>`);
            
        } catch (error) {
            console.error('Error resetting photography history:', error);
            showPopupNotification('<p>❌ خطا در پاک کردن تاریخچه عکاسی.</p>');
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
        const userPrefs = getUserPrefs();
        counterNameInput.value = userPrefs.counter_name || '';
        
        // اضافه کردن فیلد شماره باجه
        if (!document.getElementById('counter-number-input')) {
            const numberInput = document.createElement('input');
            numberInput.type = 'text';
            numberInput.id = 'counter-number-input';
            numberInput.placeholder = 'شماره باجه (مثلاً 5)';
            numberInput.value = userPrefs.counter_number || '';
            numberInput.style.cssText = 'width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px;';
            
            const counterNameLabel = counterNameInput.previousElementSibling;
            counterNameLabel.parentNode.insertBefore(numberInput, counterNameInput.nextSibling);
        }
        
        counterSettingsModal.style.display = 'flex';
    }

    function closeCounterSettingsModal() {
        counterSettingsModal.style.display = 'none';
    }

    async function saveCounterSettings() {
        const counterName = counterNameInput.value.trim();
        const counterNumberInput = document.getElementById('counter-number-input');
        const counterNumber = counterNumberInput ? counterNumberInput.value.trim() : '1';
        
        if (!counterName) {
            alert('لطفا نام باجه را وارد کنید.');
            counterNameInput.focus();
            return;
        }

        if (!counterNumber || isNaN(counterNumber) || counterNumber < 1 || counterNumber > 99) {
            alert('لطفا شماره باجه را به صورت عدد بین 1 تا 99 وارد کنید.');
            counterNumberInput.focus();
            return;
        }

        try {
            const userPrefs = getUserPrefs();
            await account.updatePrefs({ 
                ...userPrefs, 
                counter_name: counterName,
                counter_number: counterNumber
            });
            
            currentUser = await account.get();
            
            userGreeting.textContent = `کاربر: ${currentUser.name || currentUser.email} (باجه: ${counterName})`;
            
            showPopupNotification('<p>تنظیمات باجه با موفقیت ذخیره شد.</p>');
            closeCounterSettingsModal();
            
            // به‌روزرسانی UI
            updateUIForUserRole();
            
        } catch (error) {
            console.error('Error saving counter settings:', error);
            showPopupNotification('<p>خطا در ذخیره تنظیمات باجه!</p>');
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
        document.getElementById('pass-delay-count').value = 0;
        
        document.getElementById('first-name').required = false;
        document.getElementById('last-name').required = false;
    }

    function openPassServiceModal() {
        passServiceList.innerHTML = '';
        services.forEach(service => {
            const div = document.createElement('div');
            div.className = 'service-checkbox';
            
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
        const popup = document.getElementById('popup-notification');
        const popupText = document.getElementById('popup-text');
        
        popupText.innerHTML = '';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'simple-popup-content';
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'simple-popup-close-btn';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = () => {
            closePopup();
        };
        
        const messageDiv = document.createElement('div');
        messageDiv.innerHTML = htmlContent;
        
        contentDiv.appendChild(closeBtn);
        contentDiv.appendChild(messageDiv);
        popupText.appendChild(contentDiv);
        
        popup.style.display = 'flex';
        
        setTimeout(() => {
            popup.classList.add('show');
        }, 10);
        
        const closeHandler = function(e) {
            if (e.target === popup) {
                closePopup();
            }
        };
        
        function closePopup() {
            popup.classList.remove('show');
            setTimeout(() => {
                popup.style.display = 'none';
            }, 300);
            popup.removeEventListener('click', closeHandler);
        }
        
        popup.addEventListener('click', closeHandler);
    }

    // --- تابع جدید برای نمایش پیام انتظار ---
    function showWaitingNotification(message) {
        const popup = document.createElement('div');
        popup.id = 'waiting-popup';
        popup.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            color: white;
            font-size: 18px;
            font-family: 'Vazirmatn', sans-serif;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: var(--primary-color);
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;
        
        content.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 15px;">⏳</div>
            <div>${message}</div>
        `;
        
        popup.appendChild(content);
        document.body.appendChild(popup);
        
        return popup;
    }

    function closeWaitingNotification(popup) {
        if (popup && popup.parentNode) {
            popup.parentNode.removeChild(popup);
        }
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

            const data = {
                name: row.querySelector('.setting-name').value,
                start_number: parseInt(row.querySelector('.setting-start').value) || 100,
                end_number: parseInt(row.querySelector('.setting-end').value) || 199,
                manual_time: parseInt(row.querySelector('.setting-manual-time').value) || 10,
                work_hours_start: row.querySelector('.setting-work-start').value || '08:00',
                work_hours_end: row.querySelector('.setting-work-end').value || '17:00'
            };

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

    function checkCodeMeli(code) {
        if (!code) return false;
        code = code.toString().replace(/\s/g, '').replace(/\D/g, '');
        if (code.length !== 10 || /^(\d)\1{9}$/.test(code)) return false;
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(code.charAt(i)) * (10 - i);
        }
        const lastDigit = parseInt(code.charAt(9));
        const remainder = sum % 11;
        return (remainder < 2 && lastDigit === remainder) || 
               (remainder >= 2 && lastDigit === (11 - remainder));
    }

    // --- Photography Modal Functions ---
    function openPhotographyModal(ticket) {
        currentTicketForPhotography = ticket;
        photographyTicketNumber.textContent = ticket.specific_ticket || 'پاس';
        photographyCustomerName.textContent = `${ticket.first_name} ${ticket.last_name}`;
        photographyModal.style.display = 'flex';
        
        photographyNationalIdInput.value = '';
        photographyNationalIdInput.focus();
        
        photographyNationalIdInput.removeEventListener('keypress', handlePhotographyEnter);
        confirmPhotographyBtn.removeEventListener('click', confirmPhotography);
        cancelPhotographyBtn.removeEventListener('click', closePhotographyModal);
        
        photographyNationalIdInput.addEventListener('keypress', handlePhotographyEnter);
        confirmPhotographyBtn.addEventListener('click', confirmPhotography);
        cancelPhotographyBtn.addEventListener('click', closePhotographyModal);
    }

    function handlePhotographyEnter(e) {
        if (e.key === 'Enter') {
            confirmPhotography();
        }
    }

    function validateNationalIdInput(input) {
        const value = input.value.replace(/\D/g, '');
        
        if (value.length === 0) {
            input.style.borderColor = '';
            input.style.backgroundColor = '';
        } else if (value.length === 10 && checkCodeMeli(value)) {
            input.style.borderColor = 'var(--primary-color)';
            input.style.backgroundColor = '#e8f5e9';
        } else {
            input.style.borderColor = 'var(--danger-color)';
            input.style.backgroundColor = '#ffeaea';
        }
    }

    async function confirmPhotography() {
        const nationalId = photographyNationalIdInput.value.trim();
        
        if (!nationalId) {
            alert('لطفا کد ملی را وارد کنید.');
            photographyNationalIdInput.focus();
            return;
        }
        
        const cleanNationalId = nationalId.replace(/\s/g, '').replace(/\D/g, '');
        
        if (cleanNationalId.length !== 10) {
            alert('کد ملی باید 10 رقم باشد.');
            photographyNationalIdInput.focus();
            return;
        }
        
        if (!checkCodeMeli(cleanNationalId)) {
            alert('کد ملی وارد شده معتبر نیست.');
            photographyNationalIdInput.focus();
            return;
        }
        
        if (!currentTicketForPhotography) {
            alert('خطا در دریافت اطلاعات نوبت.');
            return;
        }
        
        const success = await addToPhotographyList(currentTicketForPhotography, cleanNationalId);
        if (success) {
            closePhotographyModal();
        }
    }

    // --- تابع برای ثبت دستی با Enter ---
    function handleManualPhotographyEnter(e) {
        if (e.key === 'Enter') {
            addManualToPhotographyList();
        }
    }

    function closePhotographyModal() {
        console.log('Closing photography modal');
        photographyModal.style.display = 'none';
        currentTicketForPhotography = null;
        
        photographyNationalIdInput.removeEventListener('keypress', handlePhotographyEnter);
        confirmPhotographyBtn.removeEventListener('click', confirmPhotography);
        cancelPhotographyBtn.removeEventListener('click', closePhotographyModal);
    }

    function setupPhotographyEventListeners() {
        console.log('Setting up photography event listeners');
        
        if (manualPhotographyBtn) {
            manualPhotographyBtn.removeEventListener('click', addManualToPhotographyList);
            manualPhotographyBtn.addEventListener('click', addManualToPhotographyList);
        }
        
        if (manualTicketInput) {
            manualTicketInput.removeEventListener('keypress', handleManualPhotographyEnter);
            manualTicketInput.addEventListener('keypress', handleManualPhotographyEnter);
        }
    }

    function handlePhotographyInput() {
        this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10);
        validateNationalIdInput(this);
    }

    // --- Photography Role Functions ---
    async function processPhotographyTicket() {
        const waitingItems = photographyHistory.filter(item => 
            item.status === 'در انتظار' && !item.photoTaken
        );
        
        if (waitingItems.length === 0) {
            showPopupNotification('<p>هیچ نوبتی در لیست انتظار عکاسی وجود ندارد.</p>');
            return;
        }
        
        const sortedItems = [...waitingItems].sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );
        
        const nextItem = sortedItems[0];
        
        const popupMessage = `
            <span class="ticket-number">نوبت عکاسی: ${nextItem.ticketNumber}</span>
            <p><strong>نام:</strong> ${nextItem.firstName} ${nextItem.lastName}</p>
            <p><strong>کد ملی:</strong> ${nextItem.nationalId}</p>
            <p><strong>خدمت:</strong> ${nextItem.serviceName || '---'}</p>
            <p><strong>منبع:</strong> ${nextItem.source === 'manual_input' ? 'ثبت دستی' : 'ارسال به عکاسی'}</p>
            ${nextItem.originalCounterName ? `<p><strong>باجه مبدا:</strong> ${nextItem.originalCounterName}</p>` : ''}
        `;
        
        const userChoice = await showAdvancedPhotographyPopup(nextItem, popupMessage);
        
        if (userChoice === 'photo_taken') {
            await markPhotoAsTaken(nextItem.$id);
            
        } else if (userChoice === 'skip') {
            showPopupNotification(`<p>نوبت ${nextItem.ticketNumber} رد شد.</p>`);
            
            setTimeout(() => {
                processPhotographyTicket();
            }, 2000);
        }
        
        updatePhotographyUI();
    }

    // --- تابع جدید برای نوتیفیکیشن عکاسی با قابلیت تکرار صوت ---
    function showAdvancedPhotographyPopup(photographyItem, htmlContent) {
        return new Promise((resolve) => {
            const popup = document.getElementById('popup-notification');
            const popupText = document.getElementById('popup-text');
            
            popupText.innerHTML = '';
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'popup-with-buttons';
            
            const closeBtn = document.createElement('button');
            closeBtn.className = 'popup-close-btn';
            closeBtn.innerHTML = '×';
            closeBtn.title = 'بستن';
            closeBtn.onclick = () => {
                closePopup();
                setTimeout(() => resolve('close'), 300);
            };
            
            const messageDiv = document.createElement('div');
            messageDiv.innerHTML = htmlContent;
            
            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'popup-buttons';
            
            // ✅ دکمه تکرار صوت برای عکاسی
            const repeatSoundBtn = document.createElement('button');
            repeatSoundBtn.className = 'popup-btn popup-repeat-btn';
            repeatSoundBtn.innerHTML = '🔊 تکرار صوت';
            repeatSoundBtn.onclick = () => {
                console.log('🔁 User requested photography sound repetition');
                // نمایشگر از طریق real-time صوت را تکرار می‌کند
                // افکت بصری
                repeatSoundBtn.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    repeatSoundBtn.style.transform = 'scale(1)';
                }, 150);
            };
            
            // ✅ دکمه عکس گرفته شد
            const photoTakenBtn = document.createElement('button');
            photoTakenBtn.className = 'popup-btn popup-photography-btn';
            photoTakenBtn.textContent = 'عکس گرفته شد';
            photoTakenBtn.onclick = () => {
                closePopup();
                setTimeout(() => resolve('photo_taken'), 300);
            };
            
            // ✅ دکمه بعدی
            const skipBtn = document.createElement('button');
            skipBtn.className = 'popup-btn popup-next-btn';
            skipBtn.textContent = 'بعدی';
            skipBtn.onclick = () => {
                closePopup();
                setTimeout(() => resolve('skip'), 300);
            };
            
            buttonsDiv.appendChild(repeatSoundBtn);
            buttonsDiv.appendChild(photoTakenBtn);
            buttonsDiv.appendChild(skipBtn);
            
            contentDiv.appendChild(closeBtn);
            contentDiv.appendChild(messageDiv);
            contentDiv.appendChild(buttonsDiv);
            
            popupText.appendChild(contentDiv);
            
            popup.style.display = 'flex';
            setTimeout(() => {
                popup.classList.add('show');
            }, 10);
            
            function closePopup() {
                popup.classList.remove('show');
                setTimeout(() => {
                    popup.style.display = 'none';
                }, 300);
            }
            
            const backgroundCloseHandler = function(e) {
                if (e.target === popup) {
                    closePopup();
                    setTimeout(() => resolve('background'), 300);
                }
            };
            
            popup.addEventListener('click', backgroundCloseHandler);
            
            const originalClosePopup = closePopup;
            closePopup = function() {
                popup.removeEventListener('click', backgroundCloseHandler);
                originalClosePopup();
            };
        });
    }

    function showSendToPhotographyButton(ticket) {
        const existingButton = document.querySelector('.send-to-photography-btn');
        if (existingButton) {
            existingButton.remove();
        }
        
        const button = document.createElement('button');
        button.className = 'big-button send-to-photography-btn';
        button.textContent = 'ارسال به لیست عکاسی';
        button.addEventListener('click', () => {
            openPhotographyModal(ticket);
        });
        
        const ticketActions = document.querySelector('.ticket-actions');
        ticketActions.appendChild(button);
        
        setTimeout(() => {
            if (button.parentNode) {
                button.remove();
            }
        }, 30000);
    }

    // --- تابع استخراج شماره باجه از نام ---
    function extractCounterNumber(counterName) {
        if (!counterName) return '1';
        
        // استخراج عدد از انتهای نام
        const numbers = counterName.match(/\d+$/);
        if (numbers) {
            return numbers[0];
        }
        
        // جستجوی کلمات عددی
        const wordToNumber = {
            'یک': '1', 'اول': '1', 'دو': '2', 'دوم': '2',
            'سه': '3', 'سوم': '3', 'چهار': '4', 'چهارم': '4',
            'پنج': '5', 'پنجم': '5', 'شش': '6', 'ششم': '6',
            'هفت': '7', 'هفتم': '7', 'هشت': '8', 'هشتم': '8',
            'نه': '9', 'نهم': '9', 'ده': '10', 'دهم': '10'
        };
        
        for (const [word, num] of Object.entries(wordToNumber)) {
            if (counterName.includes(word)) {
                return num;
            }
        }
        
        return '1';
    }

    function updateUIForUserRole() {
        if (isPhotographyUser) {
            document.getElementById('call-next-btn').textContent = 'فراخوانی نوبت بعدی (اولویت عکاسی)';
            
            const waitingCount = photographyHistory.filter(item => 
                item.status === 'در انتظار' && !item.photoTaken
            ).length;
            
            document.querySelector('.photography-waiting-display').innerHTML = `
                منتظران عکاسی: <span id="photography-waiting-count">${waitingCount}</span>
                ${waitingCount > 0 ? ' - اولویت با عکاسی' : ''}
            `;
            
        } else {
            document.getElementById('call-next-btn').textContent = 'فراخوان نوبت بعدی';
            document.querySelector('.photography-waiting-display').innerHTML = `
                منتظران عکاسی: <span id="photography-waiting-count">0</span>
            `;
        }
    }

    async function updateUserPhotographyRole() {
        try {
            const userPrefs = getUserPrefs();
            await account.updatePrefs({ 
                ...userPrefs, 
                is_photography_user: isPhotographyUser 
            });
            
            currentUser.prefs = await account.getPrefs();
            updateUIForUserRole();
            
            if (isPhotographyUser) {
                showPopupNotification('<p>حالت عکاسی فعال شد. اکنون می‌توانید نوبت‌های عکاسی را فراخوانی کنید.</p>');
            } else {
                showPopupNotification('<p>حالت عکاسی غیرفعال شد.</p>');
            }
        } catch (error) {
            console.error('Error updating user role:', error);
        }
    }

    // --- اضافه کردن کنترل‌های صدا به UI ---
    function addSoundControlsToUI() {
        // ✅ اضافه کردن کنترل‌های صدا به هدر
        const soundControlDiv = document.createElement('div');
        soundControlDiv.className = 'sound-control';
        soundControlDiv.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 10px;
            justify-content: center;
        `;
        
        // دکمه فعال/غیرفعال کردن صدا
        const soundToggleBtn = document.createElement('button');
        soundToggleBtn.className = 'sound-btn';
        soundToggleBtn.innerHTML = '🔊';
        soundToggleBtn.title = 'فعال/غیرفعال کردن صدا';
        soundToggleBtn.onclick = () => {
            soundManager.toggleSound(!soundManager.isAudioEnabled);
            soundToggleBtn.innerHTML = soundManager.isAudioEnabled ? '🔊' : '🔇';
        };
        
        // دکمه تکرار صوت آخرین نوبت
        const repeatSoundBtn = document.createElement('button');
        repeatSoundBtn.className = 'sound-btn';
        repeatSoundBtn.innerHTML = '🔁';
        repeatSoundBtn.title = 'تکرار صوت آخرین نوبت';
        repeatSoundBtn.onclick = () => {
            soundManager.repeatLastAnnouncement();
        };
        
        soundControlDiv.appendChild(soundToggleBtn);
        soundControlDiv.appendChild(repeatSoundBtn);
        
        // اضافه کردن به هدر
        const header = document.querySelector('header');
        header.appendChild(soundControlDiv);
    }

    // --- Initialize App ---
    async function initializeApp() {
        try {
            currentUser = await account.get();
            
            const userPrefs = getUserPrefs();
            isPhotographyUser = userPrefs.is_photography_user || false;
            photographyRoleCheckbox.checked = isPhotographyUser;
            
            showLoggedInUI();
            await fetchData();
            await loadPhotographyHistory();
            
            // تنظیمات باجه فقط بعد از لاگین چک شود
            await checkAndSetCounterName();
            
            setupRealtimeSubscriptions();
            checkAutoReset();
            updatePhotographyUI();
            updateUIForUserRole();
            
            setupPhotographyEventListeners();
            
            // ✅ اضافه کردن کنترل‌های صدا
            addSoundControlsToUI();
            
            console.log('App initialized successfully');
            
        } catch (error) {
            console.log('User not logged in, showing login form');
            showLoggedOutUI();
        }
    }

    // --- EVENT LISTENERS ---
    loginBtn.addEventListener('click', login);
    callPastBtn.addEventListener('click', callPastTicket);
    logoutBtn.addEventListener('click', logout);
    
    settingsBtn.addEventListener('click', openAdminPanel);
    resetAllBtn.addEventListener('click', resetAllTickets);
    callNextBtn.addEventListener('click', callNextTicketWithOptions);
    passTicketBtn.addEventListener('click', openPassServiceModal);
    
    const resetPhotographyBtn = document.getElementById('reset-photography-btn');
    if (resetPhotographyBtn) {
        resetPhotographyBtn.addEventListener('click', resetPhotographyHistoryOnly);
    }
    
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
    
    manualPhotographyBtn.addEventListener('click', addManualToPhotographyList);
    
    manualTicketInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addManualToPhotographyList();
        }
    });
    
    photographyRoleCheckbox.addEventListener('change', function() {
        isPhotographyUser = this.checked;
        updateUserPhotographyRole();
        updatePhotographyUI();
    });

    pastTicketInput.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '');
        
        if (this.value.length > 0) {
            this.classList.remove('error');
        }
    });

    pastTicketInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            callPastTicket();
        }
    });

    photographyNationalIdInput.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10);
        
        if (this.value.length > 0) {
            this.style.borderColor = '';
            this.style.backgroundColor = '';
        }
    });

    // --- INITIALIZE APP ---
    initializeApp();

});