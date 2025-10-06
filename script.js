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

    // --- توابع مدیریت تاریخچه عکاسی ---
function loadPhotographyHistory() {
    try {
        const saved = localStorage.getItem('photographyHistory');
        if (saved) {
            photographyHistory = JSON.parse(saved);
        }
        renderPhotographyHistory();
        updatePhotographyUI();
    } catch (error) {
        console.error('Error loading photography history:', error);
        photographyHistory = [];
    }
}

function savePhotographyHistory() {
    try {
        localStorage.setItem('photographyHistory', JSON.stringify(photographyHistory));
        
        // ایجاد یک event برای همگام‌سازی بین تب‌ها
        const event = new Event('photographyHistoryUpdated');
        window.dispatchEvent(event);
        
        // به‌روزرسانی نمایشگر
        if (typeof updatePhotographyDisplay === 'function') {
            updatePhotographyDisplay();
        }
        
        console.log('Photography history saved and synced');
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
            
            // نمایش پیام خطا به صورت toast
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
        return photographyHistory.some(item => 
            item.nationalId === nationalId && 
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
        
        // مقداردهی مطابق با Appwrite
        let ticketNumber = ticket.specific_ticket;
        if (!ticketNumber || ticketNumber === 'undefined' || ticketNumber === 'null') {
            ticketNumber = 'پاس';
        }

        // دریافت نام باجه مبدا از اطلاعات فراخوانی
        const originalCounterName = ticket.called_by_counter_name || (currentUser.prefs && currentUser.prefs.counter_name) || 'باجه';

        const newItem = {
            // ticketNumber: String (همانطور که در Appwrite تعریف شده)
            ticketNumber: String(ticketNumber),
            
            // nationalId: String (همانطور که در Appwrite تعریف شده)
            nationalId: String(nationalId),
            
            firstName: ticket.first_name || '---',
            lastName: ticket.last_name || '---',
            source: source,
            serviceId: ticket.service_id,
            serviceName: service?.name || '---',
            
            // originalTicketId: Integer (تبدیل به عدد برای تطبیق با Appwrite)
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
        
        // در صورت شکست، از localStorage استفاده کن
        try {
            if (!photographyHistory) {
                photographyHistory = [];
            }
            
            const newItem = {
                id: 'local_' + Date.now(),
                ticketNumber: item.ticketNumber,
                nationalId: item.nationalId,
                firstName: item.firstName || 'ثبت دستی',
                lastName: item.lastName || '',
                status: action === 'completed' ? 'تکمیل شده' : 'در انتظار',
                photoTaken: action === 'completed',
                timestamp: new Date().toISOString(),
                source: item.source || 'manual_input'
            };
            
            photographyHistory.unshift(newItem);
            savePhotographyHistory();
            updatePhotographyUI();
            
            return true;
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
            return false;
        }
    }
}

async function addToPhotographyHistory(item, action = 'added') {
    try {
        console.log('Starting to add to photography history:', item);
        
        const userPrefs = currentUser.prefs || {};
        const counterName = userPrefs.counter_name || 'باجه';

        // ساختار داده‌ای کاملاً منطبق با Appwrite
        const photographyData = {
            // ticketNumber: String (Size: 256)
            ticketNumber: String(item.ticketNumber || 'پاس').substring(0, 255),
            
            // nationalId: String (Size: 1073741824)
            nationalId: String(item.nationalId || '').substring(0, 9998),
            
            // firstName: String (Size: 999999999)
            firstName: String(item.firstName || 'ثبت دستی').substring(0, 9998),
            
            // lastName: String (Size: 999999999)  
            lastName: String(item.lastName || '').substring(0, 9998),
            
            // status: String (Size: 1073741824)
            status: action === 'completed' ? 'تکمیل شده' : 'در انتظار',
            
            // photoTaken: Boolean
            photoTaken: action === 'completed',
            
            // timestamp: String (DateTime)
            timestamp: new Date().toISOString(),
            
            // addedBy: String (Size: 99999999)
            addedBy: currentUser.$id,
            
            // addedByName: String (Size: 9999999)
            addedByName: String(currentUser.name || currentUser.email).substring(0, 9998),
            
            // counterName: String (Size: 888888888)
            counterName: String(counterName).substring(0, 9998),
            
            // source: String (Size: 255)
            source: String(item.source || 'photography_modal').substring(0, 254)
        };

        // فیلدهای اختیاری - تطبیق کامل با Appwrite
        if (item.serviceId) {
            // serviceId: String (Size: 1073741824)
            photographyData.serviceId = String(item.serviceId).substring(0, 9998);
        }
        
        if (item.serviceName) {
            // serviceName: String (Size: 1073741824)
            photographyData.serviceName = String(item.serviceName).substring(0, 9998);
        }
        
        if (item.originalTicketId) {
            // originalTicketId: Integer (Max: 9999)
            // تبدیل به عدد برای تطبیق با Integer در Appwrite
            photographyData.originalTicketId = parseInt(item.originalTicketId) || 0;
        }
        
        if (item.ticketType) {
            // ticketType: String (Size: 922145486)
            photographyData.ticketType = String(item.ticketType).substring(0, 9998);
        }
        
        if (item.originalCounterName) {
            // originalCounterName: String (Size: 1073741824)
            photographyData.originalCounterName = String(item.originalCounterName).substring(0, 9998);
        }

        // فیلدهای مربوط به تکمیل عکاسی
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

        // اضافه کردن به لیست محلی
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


    // --- تابع برای علامت‌گذاری عکس گرفته شده ---
// --- تابع برای علامت‌گذاری عکس گرفته شده و بازگشت به باجه ---
async function markPhotoAsTaken(photographyItemId) {
    try {
        const photographyItem = photographyHistory.find(i => i.$id === photographyItemId);
        if (!photographyItem) {
            console.error('Photography item not found:', photographyItemId);
            return false;
        }

        // آپدیت وضعیت در تاریخچه عکاسی
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

        // به‌روزرسانی لیست محلی
        const itemIndex = photographyHistory.findIndex(i => i.$id === photographyItemId);
        if (itemIndex !== -1) {
            photographyHistory[itemIndex] = updatedItem;
        }

        // اگر نوبت از یک باجه خاص آمده بود، آن را به صف آن باجه بازگردان
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

async function returnTicketToOriginalCounter(ticketId, originalCounterName) {
    try {
        // دریافت اطلاعات نوبت اصلی
        const originalTicket = await databases.getDocument(
            DATABASE_ID,
            TICKETS_COLLECTION_ID,
            ticketId
        );

        if (!originalTicket) {
            console.error('Original ticket not found:', ticketId);
            return false;
        }

        // ایجاد یک نوبت جدید با اولویت در صف باجه مبدا
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
            original_counter_name: originalCounterName || 'عکاسی'
        };

        const returnedTicket = await databases.createDocument(
            DATABASE_ID,
            TICKETS_COLLECTION_ID,
            ID.unique(),
            newTicketData,
            [Permission.read(Role.users()), Permission.update(Role.users()), Permission.delete(Role.users())]
        );

        console.log('Ticket returned to counter:', returnedTicket);
        
        // نمایش نوتیفیکیشن به کاربر
        const service = services.find(s => s.$id === originalTicket.service_id);
        const serviceName = service ? service.name : 'خدمت';
        
        showPopupNotification(`
            <p>نوبت ${originalTicket.specific_ticket || 'پاس'} به صف ${serviceName} بازگردانده شد.</p>
            <p style="font-size: 14px; color: #4CAF50;">این نوبت در اولویت قرار گرفت.</p>
        `);

        return true;

    } catch (error) {
        console.error('Error returning ticket to counter:', error);
        return false;
    }
}

// --- تابع جدید برای بازگرداندن نوبت به باجه مبدا ---
async function returnTicketToOriginalCounter(ticketId) {
    try {
        // دریافت اطلاعات نوبت اصلی
        const originalTicket = await databases.getDocument(
            DATABASE_ID,
            TICKETS_COLLECTION_ID,
            ticketId
        );

        if (!originalTicket) {
            console.error('Original ticket not found:', ticketId);
            return false;
        }

        // ایجاد یک نوبت جدید با اولویت در صف باجه مبدا
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
            priority: 'high' // اولویت بالا برای بازگشت از عکاسی
        };

        const returnedTicket = await databases.createDocument(
            DATABASE_ID,
            TICKETS_COLLECTION_ID,
            ID.unique(),
            newTicketData,
            [Permission.read(Role.users()), Permission.update(Role.users()), Permission.delete(Role.users())]
        );

        console.log('Ticket returned to counter:', returnedTicket);
        
        // نمایش نوتیفیکیشن به کاربر
        const service = services.find(s => s.$id === originalTicket.service_id);
        const serviceName = service ? service.name : 'خدمت';
        
        showPopupNotification(`
            <p>نوبت ${originalTicket.specific_ticket || 'پاس'} به صف ${serviceName} بازگردانده شد.</p>
            <p style="font-size: 14px; color: #4CAF50;">این نوبت در اولویت قرار گرفت.</p>
        `);

        return true;

    } catch (error) {
        console.error('Error returning ticket to counter:', error);
        // در صورت خطا، فقط پیام خطا نمایش داده شود اما فرآیند اصلی ادامه یابد
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
    
    // به‌روزرسانی وضعیت کاربر عکاسی
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
    
    // فقط 7 آیتم اول را نشان بده
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
        // به‌روزرسانی سایر نمایشگرها
        if (typeof updatePhotographyDisplay === 'function') {
            updatePhotographyDisplay();
        }
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
// --- تابع اصلاح شده برای نوتیفیکیشن پیشرفته با دکمه‌ها و دکمه بستن ---
function showAdvancedPopupNotification(ticket, htmlContent) {
    return new Promise((resolve) => {
        const popup = document.getElementById('popup-notification');
        const popupText = document.getElementById('popup-text');
        
        // پاک کردن محتوای قبلی
        popupText.innerHTML = '';
        
        // ایجاد محتوای جدید با دکمه‌ها
        const contentDiv = document.createElement('div');
        contentDiv.className = 'popup-with-buttons';
        
        // دکمه بستن
        const closeBtn = document.createElement('button');
        closeBtn.className = 'popup-close-btn';
        closeBtn.innerHTML = '×';
        closeBtn.title = 'بستن';
        closeBtn.onclick = () => {
            closePopup();
            setTimeout(() => resolve('close'), 300);
        };
        
        // محتوای اصلی
        const messageDiv = document.createElement('div');
        messageDiv.innerHTML = htmlContent;
        
        // دکمه‌ها
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'popup-buttons';
        
        // دکمه ارسال به عکاسی
        const photographyBtn = document.createElement('button');
        photographyBtn.className = 'popup-btn popup-photography-btn';
        photographyBtn.textContent = 'ارسال به عکاسی';
        photographyBtn.onclick = () => {
            closePopup();
            setTimeout(() => resolve('photography'), 300);
        };
        
        // دکمه فراخوان بعدی
        const nextBtn = document.createElement('button');
        nextBtn.className = 'popup-btn popup-next-btn';
        nextBtn.textContent = 'فراخوان بعدی';
        nextBtn.onclick = () => {
            closePopup();
            setTimeout(() => resolve('next'), 300);
        };
        
        buttonsDiv.appendChild(photographyBtn);
        buttonsDiv.appendChild(nextBtn);
        
        contentDiv.appendChild(closeBtn);
        contentDiv.appendChild(messageDiv);
        contentDiv.appendChild(buttonsDiv);
        
        popupText.appendChild(contentDiv);
        
        // نمایش پاپاپ
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
        
        // بستن با کلیک روی background
        const backgroundCloseHandler = function(e) {
            if (e.target === popup) {
                closePopup();
                setTimeout(() => resolve('background'), 300);
            }
        };
        
        popup.addEventListener('click', backgroundCloseHandler);
        
        // حذف event listener هنگام بسته شدن
        const originalClosePopup = closePopup;
        closePopup = function() {
            popup.removeEventListener('click', backgroundCloseHandler);
            originalClosePopup();
        };
    });
}

// --- توابع مدیریت تاریخچه عکاسی در Appwrite ---
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
        console.log('Photography history loaded:', photographyHistory.length, 'items');
    } catch (error) {
        console.error('Error loading photography history from Appwrite:', error);
        photographyHistory = [];
    }
}


async function debugPhotographyCollection() {
    try {
        console.log('Debugging photography collection...');
        
        // بررسی وجود collection
        const documents = await databases.listDocuments(DATABASE_ID, PHOTOGRAPHY_COLLECTION_ID, [
            Query.limit(1)
        ]);
        
        console.log('Collection access successful. Sample document:', documents.documents[0]);
        console.log('Total documents:', documents.total);
        
        return true;
    } catch (error) {
        console.error('Error debugging collection:', error);
        
        // نمایش خطای کاربرپسند
        if (error.code === 404) {
            console.error('Collection not found. Please check collection ID and permissions.');
        } else if (error.code === 401) {
            console.error('Permission denied. Please check API keys and permissions.');
        }
        
        return false;
    }
}

// --- تابع برای بررسی تکراری نبودن کد ملی در لیست انتظار ---
function isNationalIdInWaitingList(nationalId) {
    const nationalIdStr = String(nationalId); // تطبیق با String در Appwrite
    return photographyHistory.some(item => 
        String(item.nationalId) === nationalIdStr && 
        item.status === 'در انتظار' &&
        !item.photoTaken
    );
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
        
        // فقط اعداد قابل وارد کردن باشند
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
        
        // بستن با کلیک روی background
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
        // ایجاد مودال برای دریافت کد ملی
        const nationalId = await showNationalIdModal(ticketNumber);
        
        if (!nationalId) {
            return; // کاربر انصراف داده
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

        // بررسی تکراری نبودن کد ملی در لیست انتظار
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

async function callSpecificTicket(ticket) {
    try {
        const userPrefs = currentUser.prefs || {};
        const counterName = userPrefs.counter_name || 'باجه';
        
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
        
        const service = services.find(s => s.$id === updatedTicket.service_id);
        const popupMessage = `
            <span class="ticket-number">${updatedTicket.specific_ticket || 'پاس'}</span>
            <p><strong>نام:</strong> ${updatedTicket.first_name} ${updatedTicket.last_name}</p>
            <p><strong>کد ملی:</strong> ${updatedTicket.national_id}</p>
            <p><strong>خدمت:</strong> ${service?.name || '---'}</p>
            <p><strong>باجه:</strong> ${counterName}</p>
            ${updatedTicket.returned_from_photography ? 
                '<p style="color: #4CAF50; font-weight: bold;">✓ بازگشته از عکاسی</p>' : ''}
            ${updatedTicket.original_counter_name ? 
                `<p style="font-size: 14px; color: #666;">باجه مبدا: ${updatedTicket.original_counter_name}</p>` : ''}
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
        console.error('Error calling specific ticket:', error);
        showPopupNotification('<p>خطا در فراخوانی نوبت!</p>');
    }
}

    // --- تابع بهبودیافته برای فراخوانی نوبت ---
// --- تابع بهبودیافته برای فراخوانی نوبت با اولویت عکاسی ---
async function callNextTicketWithOptions() {
    // اولویت اول: نوبت‌های بازگشته از عکاسی
    const returnedTickets = tickets.filter(t => 
        t.status === 'در حال انتظار' && 
        t.returned_from_photography === true
    );

    if (returnedTickets.length > 0) {
        // فراخوانی نوبت بازگشته از عکاسی
        await callSpecificTicket(returnedTickets[0]);
        return;
    }

    // اولویت دوم: نوبت‌های عکاسی در انتظار
    const waitingPhotographyItems = photographyHistory.filter(item => 
        item.status === 'در انتظار' && !item.photoTaken
    );

    if (waitingPhotographyItems.length > 0 && isPhotographyUser) {
        await processPhotographyTicket();
        return;
    }

    // اولویت سوم: فراخوانی نوبت‌های عادی
    await callNextRegularTicket();
}

// --- تابع بهبودیافته برای علامت‌گذاری عکس گرفته شده ---


    // تابع جدید برای بررسی و تنظیم شماره باجه
    async function checkAndSetCounterName() {
        const userPrefs = currentUser.prefs || {};
        if (!userPrefs.counter_name) {
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
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        if (!email || !password) {
            alert('لطفا ایمیل و رمز عبور را وارد کنید.');
            return;
        }
        
        console.log('Attempting login with:', email);
        await account.createEmailSession(email, password);
        console.log('Login successful');
        
        // بارگذاری مجدد صفحه برای اطمینان از تنظیم صحیح session
        window.location.reload();
        
    } catch (error) {
        console.error('Login error:', error);
        alert('خطا در ورود: ' + (error.message || 'اطلاعات ورود نامعتبر است'));
    }
}

// --- تابع برای بررسی وضعیت session ---
async function checkSessionStatus() {
    try {
        const user = await account.get();
        console.log('User session is active:', user.email);
        return true;
    } catch (error) {
        console.log('No active session');
        return false;
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
    
    // اضافه کردن real-time برای تاریخچه عکاسی
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
        if (isPhotographyUser) {
            await processPhotographyTicket();
            return;
        }
        
        await callNextRegularTicket();
    }

async function callNextRegularTicket() {
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
                // فراخوانی نوبت بعدی
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
            
            // پاک کردن تاریخچه عکاسی
            photographyHistory = [];
            savePhotographyHistory();
            updatePhotographyUI();
            
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
            
            currentUser = await account.get();
            
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

    // --- تابع جدید برای همگام‌سازی تاریخچه عکاسی ---
function setupPhotographyRealtimeSync() {
    // گوش دادن به تغییرات localStorage بین تب‌های مختلف
    window.addEventListener('storage', function(e) {
        if (e.key === 'photographyHistory') {
            console.log('Photography history updated from another tab');
            loadPhotographyHistory();
            updatePhotographyUI();
        }
    });
    
    // به‌روزرسانی دوره‌ای برای اطمینان از همگام‌سازی
    setInterval(() => {
        loadPhotographyHistory();
        updatePhotographyUI();
    }, 2000);
}


    // --- POPUP NOTIFICATION SYSTEM ---
// --- تابع اصلاح شده برای نوتیفیکیشن ساده با دکمه بستن ---
function showPopupNotification(htmlContent) {
    const popup = document.getElementById('popup-notification');
    const popupText = document.getElementById('popup-text');
    
    // پاک کردن محتوای قبلی
    popupText.innerHTML = '';
    
    // ایجاد محتوای جدید با دکمه بستن
    const contentDiv = document.createElement('div');
    contentDiv.className = 'simple-popup-content';
    
    // دکمه بستن
    const closeBtn = document.createElement('button');
    closeBtn.className = 'simple-popup-close-btn';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => {
        closePopup();
    };
    
    // محتوای اصلی
    const messageDiv = document.createElement('div');
    messageDiv.innerHTML = htmlContent;
    
    contentDiv.appendChild(closeBtn);
    contentDiv.appendChild(messageDiv);
    popupText.appendChild(contentDiv);
    
    popup.style.display = 'flex';
    
    setTimeout(() => {
        popup.classList.add('show');
    }, 10);
    
    // بستن با کلیک روی background
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
    
    // حذف تایمر خودکار - نوتیفیکیشن فقط با کلیک بسته می‌شود
    // setTimeout(() => {
    //     if (popup.style.display !== 'none') {
    //         closePopup();
    //     }
    // }, 10000);
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
    
    // پاک کردن فیلد قبلی
    photographyNationalIdInput.value = '';
    photographyNationalIdInput.focus();
    
    // حذف event listenerهای قبلی
    photographyNationalIdInput.removeEventListener('keypress', handlePhotographyEnter);
    confirmPhotographyBtn.removeEventListener('click', confirmPhotography);
    cancelPhotographyBtn.removeEventListener('click', closePhotographyModal);
    
    // اضافه کردن event listenerهای جدید
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
    
    // پاک کردن event listenerها
    photographyNationalIdInput.removeEventListener('keypress', handlePhotographyEnter);
    confirmPhotographyBtn.removeEventListener('click', confirmPhotography);
    cancelPhotographyBtn.removeEventListener('click', closePhotographyModal);
}


function setupPhotographyEventListeners() {
    console.log('Setting up photography event listeners');
    
    // دکمه ثبت دستی عکاسی
    if (manualPhotographyBtn) {
        manualPhotographyBtn.removeEventListener('click', addManualToPhotographyList);
        manualPhotographyBtn.addEventListener('click', addManualToPhotographyList);
    }
    
    // فیلد ثبت دستی
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
    
    // مرتب‌سازی بر اساس زمان ثبت (قدیمی‌ترین اول)
    const sortedItems = [...waitingItems].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    const nextItem = sortedItems[0];
    
    // نمایش اطلاعات نوبت عکاسی
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
        // رد کردن این نوبت و رفتن به نوبت بعدی
        showPopupNotification(`<p>نوبت ${nextItem.ticketNumber} رد شد.</p>`);
        
        // فراخوانی خودکار نوبت بعدی عکاسی
        setTimeout(() => {
            processPhotographyTicket();
        }, 2000);
    }
    
    updatePhotographyUI();
}

// --- تابع جدید برای نوتیفیکیشن عکاسی ---
function showAdvancedPhotographyPopup(photographyItem, htmlContent) {
    return new Promise((resolve) => {
        const popup = document.getElementById('popup-notification');
        const popupText = document.getElementById('popup-text');
        
        popupText.innerHTML = '';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'popup-with-buttons';
        
        // دکمه بستن
        const closeBtn = document.createElement('button');
        closeBtn.className = 'popup-close-btn';
        closeBtn.innerHTML = '×';
        closeBtn.title = 'بستن';
        closeBtn.onclick = () => {
            closePopup();
            setTimeout(() => resolve('close'), 300);
        };
        
        // محتوای اصلی
        const messageDiv = document.createElement('div');
        messageDiv.innerHTML = htmlContent;
        
        // دکمه‌های مخصوص عکاسی
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'popup-buttons';
        
        const photoTakenBtn = document.createElement('button');
        photoTakenBtn.className = 'popup-btn popup-photography-btn';
        photoTakenBtn.textContent = 'عکس گرفته شد';
        photoTakenBtn.onclick = () => {
            closePopup();
            setTimeout(() => resolve('photo_taken'), 300);
        };
        
        const skipBtn = document.createElement('button');
        skipBtn.className = 'popup-btn popup-next-btn';
        skipBtn.textContent = 'بعدی';
        skipBtn.onclick = () => {
            closePopup();
            setTimeout(() => resolve('skip'), 300);
        };
        
        buttonsDiv.appendChild(photoTakenBtn);
        buttonsDiv.appendChild(skipBtn);
        
        contentDiv.appendChild(closeBtn);
        contentDiv.appendChild(messageDiv);
        contentDiv.appendChild(buttonsDiv);
        
        popupText.appendChild(contentDiv);
        
        // نمایش پاپاپ
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
        
        // بستن با کلیک روی background
        const backgroundCloseHandler = function(e) {
            if (e.target === popup) {
                closePopup();
                setTimeout(() => resolve('background'), 300);
            }
        };
        
        popup.addEventListener('click', backgroundCloseHandler);
        
        // حذف event listener هنگام بسته شدن
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

function updateUIForUserRole() {
    if (isPhotographyUser) {
        document.getElementById('call-next-btn').textContent = 'فراخوانی نوبت بعدی (اولویت عکاسی)';
        
        // نمایش وضعیت عکاسی
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
        const userPrefs = currentUser.prefs || {};
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

    // --- Initialize App ---

// --- Initialize App ---
async function initializeApp() {
    try {
        currentUser = await account.get();
        await checkAndSetCounterName();
        
        const userPrefs = currentUser.prefs || {};
        isPhotographyUser = userPrefs.is_photography_user || false;
        photographyRoleCheckbox.checked = isPhotographyUser;
        
        showLoggedInUI();
        await fetchData();
        await loadPhotographyHistory();
        
        // بررسی ساده collection
        await debugPhotographyCollection();
        
        setupRealtimeSubscriptions();
        checkAutoReset();
        updatePhotographyUI();
        updateUIForUserRole();
        
        setupPhotographyEventListeners();
        
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

}); // پایان اصلی - این خط باید فقط یک بار باشد