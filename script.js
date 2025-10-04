const state = {
    services: JSON.parse(localStorage.getItem('services')) || [
        { id: 1, name: 'خدمات عمومی', waiting: 0, timePerTicket: 5, enabled: true },
        { id: 2, name: 'مشاوره', waiting: 0, timePerTicket: 10, enabled: true },
        { id: 3, name: 'پذیرش', waiting: 0, timePerTicket: 3, enabled: true },
        { id: 4, name: 'عکاسی', waiting: 0, timePerTicket: 7, enabled: true }
    ],
    tickets: JSON.parse(localStorage.getItem('tickets')) || [],
    currentUser: JSON.parse(localStorage.getItem('currentUser')) || null,
    settings: JSON.parse(localStorage.getItem('settings')) || {
        counterNumber: 1,
        adminPassword: '1234',
        enablePhotography: true
    },
    currentTicket: null,
    isPhotographyMode: false,
    photographyReservations: JSON.parse(localStorage.getItem('photographyReservations')) || [],
    photographyHistory: JSON.parse(localStorage.getItem('photographyHistory')) || []
};

// صداها
const sounds = {
    notification: new Audio('https://assets.mixkit.co/active_storage/sfx/286/286-preview.mp3'),
    call: new Audio('https://assets.mixkit.co/active_storage/sfx/257/257-preview.mp3')
};

// تنظیمات اولیه صداها
sounds.notification.volume = 0.7;
sounds.call.volume = 0.7;

// DOM Elements
const elements = {
    // عناصر موجود
    serviceButtons: document.getElementById('service-buttons'),
    ticketDisplay: document.getElementById('ticket-display'),
    currentTicketElement: document.getElementById('current-ticket'),
    callNextBtn: document.getElementById('call-next-btn'),
    passBtn: document.getElementById('pass-btn'),
    completeBtn: document.getElementById('complete-btn'),
    loginSection: document.getElementById('login-section'),
    userInfo: document.getElementById('user-info'),
    userGreeting: document.getElementById('user-greeting'),
    counterNumberInput: document.getElementById('counter-number'),
    adminPasswordInput: document.getElementById('admin-password'),
    loginBtn: document.getElementById('login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    resetAllBtn: document.getElementById('reset-all-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    counterSettingsBtn: document.getElementById('counter-settings-btn'),
    serviceCheckboxes: document.getElementById('service-checkboxes'),
    callSelectedBtn: document.getElementById('call-selected-btn'),
    ticketHistory: document.getElementById('ticket-history'),
    popupContainer: document.getElementById('popup-container'),
    popupMessage: document.getElementById('popup-message'),
    specificTicketInput: document.getElementById('specific-ticket-input'),
    specificCallBtn: document.getElementById('specific-call-btn'),
    pastTicketInput: document.getElementById('past-ticket-input'),
    pastCallBtn: document.getElementById('past-call-btn'),
    totalWaitingCount: document.getElementById('total-waiting-count'),
    
    // عناصر جدید برای عکاسی
    photographyRoleCheckbox: document.getElementById('photography-role'),
    manualPhotographyInput: document.getElementById('manual-photography-input'),
    sendToPhotographyBtn: document.getElementById('send-to-photography-btn'),
    photographyWaitingList: document.getElementById('photography-waiting-list'),
    photographyHistoryTable: document.getElementById('photography-history'),
    photographyCallBtn: document.getElementById('photography-call-btn')
};

// Initialize the application
function init() {
    loadState();
    renderServices();
    renderServiceCheckboxes();
    renderTicketHistory();
    updateTotalWaiting();
    setupEventListeners();
    checkPhotographyMode();
    renderPhotographyWaitingList();
    renderPhotographyHistory();
}

// بارگذاری وضعیت از localStorage
function loadState() {
    const savedServices = localStorage.getItem('services');
    const savedTickets = localStorage.getItem('tickets');
    const savedUser = localStorage.getItem('currentUser');
    const savedSettings = localStorage.getItem('settings');
    const savedPhotographyReservations = localStorage.getItem('photographyReservations');
    const savedPhotographyHistory = localStorage.getItem('photographyHistory');

    if (savedServices) state.services = JSON.parse(savedServices);
    if (savedTickets) state.tickets = JSON.parse(savedTickets);
    if (savedUser) state.currentUser = JSON.parse(savedUser);
    if (savedSettings) state.settings = JSON.parse(savedSettings);
    if (savedPhotographyReservations) state.photographyReservations = JSON.parse(savedPhotographyReservations);
    if (savedPhotographyHistory) state.photographyHistory = JSON.parse(savedPhotographyHistory);

    updateUI();
}

// ذخیره وضعیت در localStorage
function saveState() {
    localStorage.setItem('services', JSON.stringify(state.services));
    localStorage.setItem('tickets', JSON.stringify(state.tickets));
    localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
    localStorage.setItem('settings', JSON.stringify(state.settings));
    localStorage.setItem('photographyReservations', JSON.stringify(state.photographyReservations));
    localStorage.setItem('photographyHistory', JSON.stringify(state.photographyHistory));
}

// به‌روزرسانی رابط کاربری بر اساس وضعیت
function updateUI() {
    if (state.currentUser) {
        elements.loginSection.style.display = 'none';
        elements.userInfo.style.display = 'flex';
        elements.userGreeting.textContent = `کاربر: شماره باجه ${state.currentUser.counterNumber}`;
        elements.counterSettingsBtn.textContent = `شماره باجه: ${state.currentUser.counterNumber}`;
    } else {
        elements.loginSection.style.display = 'flex';
        elements.userInfo.style.display = 'none';
    }

    renderServices();
    renderTicketHistory();
    updateTotalWaiting();
    checkPhotographyMode();
    renderPhotographyWaitingList();
    renderPhotographyHistory();
}

// تنظیم event listeners
function setupEventListeners() {
    // Event listeners موجود
    elements.loginBtn.addEventListener('click', handleLogin);
    elements.logoutBtn.addEventListener('click', handleLogout);
    elements.resetAllBtn.addEventListener('click', resetAll);
    elements.settingsBtn.addEventListener('click', showSettings);
    elements.counterSettingsBtn.addEventListener('click', showCounterSettings);
    elements.callNextBtn.addEventListener('click', callNextTicket);
    elements.passBtn.addEventListener('click', passCurrentTicket);
    elements.completeBtn.addEventListener('click', completeCurrentTicket);
    elements.callSelectedBtn.addEventListener('click', callSelectedServices);
    elements.specificCallBtn.addEventListener('click', callSpecificTicket);
    elements.pastCallBtn.addEventListener('click', callPastTicket);
    
    // Event listeners جدید برای عکاسی
    elements.photographyRoleCheckbox?.addEventListener('change', togglePhotographyMode);
    elements.sendToPhotographyBtn?.addEventListener('click', sendToPhotography);
    elements.photographyCallBtn?.addEventListener('click', callPhotographyTicket);
    
    // Enter key listeners برای inputها
    elements.specificTicketInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') callSpecificTicket();
    });
    
    elements.pastTicketInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') callPastTicket();
    });
    
    elements.manualPhotographyInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendToPhotography();
    });
}

// رندر سرویس‌ها
function renderServices() {
    if (!elements.serviceButtons) return;
    
    elements.serviceButtons.innerHTML = '';
    
    state.services.forEach(service => {
        const button = document.createElement('button');
        button.className = `service-btn ${!service.enabled ? 'disabled-service' : ''}`;
        button.innerHTML = `
            <div class="service-name">${service.name}</div>
            <div class="waiting-count">${service.waiting} نفر در انتظار</div>
            <div class="estimation-time">${calculateWaitingTime(service.waiting, service.timePerTicket)} دقیقه</div>
            ${!service.enabled ? '<div class="service-disabled-label">غیرفعال</div>' : ''}
        `;
        
        if (service.enabled) {
            button.addEventListener('click', () => generateTicket(service.id));
        }
        
        elements.serviceButtons.appendChild(button);
    });
}

// رندر چک‌باکس‌های سرویس
function renderServiceCheckboxes() {
    if (!elements.serviceCheckboxes) return;
    
    elements.serviceCheckboxes.innerHTML = '';
    
    state.services.forEach(service => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = `service-checkbox ${!service.enabled ? 'disabled-service' : ''}`;
        checkboxDiv.innerHTML = `
            <input type="checkbox" id="service-${service.id}" value="${service.id}" ${!service.enabled ? 'disabled' : ''}>
            <label for="service-${service.id}">
                ${service.name}
                <span class="waiting-count-label">(${service.waiting} نفر در انتظار)</span>
            </label>
        `;
        elements.serviceCheckboxes.appendChild(checkboxDiv);
    });
}

// تولید نوبت جدید
function generateTicket(serviceId) {
    const service = state.services.find(s => s.id === serviceId);
    if (!service || !service.enabled) return;

    const ticketNumber = `${serviceId}${String(service.waiting + 1).padStart(3, '0')}`;
    const ticket = {
        id: Date.now().toString(),
        number: ticketNumber,
        serviceId: serviceId,
        serviceName: service.name,
        status: 'waiting',
        generatedAt: new Date().toLocaleString('fa-IR'),
        calledAt: null,
        completedAt: null,
        counterNumber: state.currentUser?.counterNumber || null
    };

    service.waiting++;
    state.tickets.push(ticket);
    
    saveState();
    renderServices();
    renderServiceCheckboxes();
    updateTotalWaiting();
    
    showNotification(`
        <span class="ticket-number">${ticketNumber}</span>
        <div>${service.name}</div>
        <div class="wait-time">زمان انتظار تقریبی: ${calculateWaitingTime(service.waiting, service.timePerTicket)} دقیقه</div>
    `);
}

// فراخوانی نوبت بعدی
function callNextTicket() {
    if (!state.currentUser) {
        alert('لطفاً ابتدا وارد شوید');
        return;
    }

    const waitingTickets = state.tickets.filter(t => t.status === 'waiting');
    if (waitingTickets.length === 0) {
        showNotification('نوبت در انتظاری وجود ندارد');
        return;
    }

    // پیدا کردن نوبت‌های عکاسی اولویت دارند
    const photographyService = state.services.find(s => s.name === 'عکاسی');
    const photographyTickets = waitingTickets.filter(t => t.serviceId === photographyService?.id);
    
    let nextTicket;
    if (photographyTickets.length > 0) {
        // اگر نوبت عکاسی وجود دارد، آن را فراخوانی کن
        nextTicket = photographyTickets[0];
    } else {
        // در غیر این صورت نوبت بعدی را فراخوانی کن
        nextTicket = waitingTickets[0];
    }

    callTicket(nextTicket);
}

// فراخوانی نوبت خاص
function callSpecificTicket() {
    if (!state.currentUser) {
        alert('لطفاً ابتدا وارد شوید');
        return;
    }

    const ticketNumber = elements.specificTicketInput.value.trim();
    if (!ticketNumber) {
        showNotification('لطفاً شماره نوبت را وارد کنید');
        return;
    }

    const ticket = state.tickets.find(t => t.number === ticketNumber && t.status === 'waiting');
    if (!ticket) {
        showNotification('نوبت پیدا نشد');
        elements.specificTicketInput.classList.add('error');
        return;
    }

    elements.specificTicketInput.classList.remove('error');
    elements.specificTicketInput.value = '';
    callTicket(ticket);
}

// فراخوانی نوبت گذشته
function callPastTicket() {
    if (!state.currentUser) {
        alert('لطفاً ابتدا وارد شوید');
        return;
    }

    const ticketNumber = elements.pastTicketInput.value.trim();
    if (!ticketNumber) {
        showNotification('لطفاً شماره نوبت را وارد کنید');
        return;
    }

    const ticket = state.tickets.find(t => t.number === ticketNumber && (t.status === 'called' || t.status === 'passed'));
    if (!ticket) {
        showNotification('نوبت پیدا نشد یا در وضعیت نامناسب است');
        elements.pastTicketInput.classList.add('error');
        return;
    }

    elements.pastTicketInput.classList.remove('error');
    elements.pastTicketInput.value = '';
    callTicket(ticket, true);
}

// فراخوانی نوبت انتخابی
function callSelectedServices() {
    if (!state.currentUser) {
        alert('لطفاً ابتدا وارد شوید');
        return;
    }

    const selectedServices = Array.from(document.querySelectorAll('#service-checkboxes input:checked'))
        .map(checkbox => parseInt(checkbox.value));

    if (selectedServices.length === 0) {
        showNotification('لطفاً حداقل یک سرویس انتخاب کنید');
        return;
    }

    const waitingTickets = state.tickets.filter(t => t.status === 'waiting' && selectedServices.includes(t.serviceId));
    if (waitingTickets.length === 0) {
        showNotification('نوبت در انتظاری برای سرویس‌های انتخاب شده وجود ندارد');
        return;
    }

    const nextTicket = waitingTickets[0];
    callTicket(nextTicket);
}

// فراخوانی نوبت
function callTicket(ticket, isRecall = false) {
    ticket.status = 'called';
    ticket.calledAt = new Date().toLocaleString('fa-IR');
    ticket.counterNumber = state.currentUser.counterNumber;
    
    state.currentTicket = ticket;
    
    // کاهش تعداد انتظار سرویس مربوطه
    const service = state.services.find(s => s.id === ticket.serviceId);
    if (service && service.waiting > 0) {
        service.waiting--;
    }
    
    saveState();
    updateCurrentTicketDisplay();
    renderServices();
    renderServiceCheckboxes();
    updateTotalWaiting();
    
    // نمایش نوتیفیکیشن فراخوانی
    const isPhotography = service.name === 'عکاسی';
    showCallNotification(ticket, isRecall, isPhotography);
    
    // پخش صدا
    try {
        sounds.call.play().catch(e => console.log('Error playing sound:', e));
    } catch (error) {
        console.log('Sound play failed:', error);
    }
}

// نمایش نوتیفیکیشن فراخوانی
function showCallNotification(ticket, isRecall = false, isPhotography = false) {
    const recallText = isRecall ? ' (فراخوانی مجدد)' : '';
    const message = `
        <div class="${isPhotography ? 'photography-popup' : ''}">
            <div class="popup-with-buttons">
                <button class="popup-close-btn" onclick="closePopup()">×</button>
                <p>
                    <span class="ticket-number">${ticket.number}</span>
                    <div>${ticket.serviceName}${recallText}</div>
                    <div class="wait-time">لطفاً به باجه ${state.currentUser.counterNumber} مراجعه کنید</div>
                </p>
                ${isPhotography ? createPhotographyButtons(ticket) : ''}
            </div>
        </div>
    `;
    
    showNotification(message, true);
}

// ایجاد دکمه‌های عکاسی
function createPhotographyButtons(ticket) {
    return `
        <div class="popup-buttons">
            <button class="photography-popup-btn photo-take-btn" onclick="handlePhotoAction('take', '${ticket.number}')">
                ثبت عکس
            </button>
            <button class="photography-popup-btn photo-reserve-btn" onclick="handlePhotoAction('reserve', '${ticket.number}')">
                رزرو نوبت
            </button>
            <button class="photography-popup-btn photo-skip-btn" onclick="handlePhotoAction('skip', '${ticket.number}')">
                بدون گرفتن عکس
            </button>
            <button class="photography-popup-btn photo-reserve-list-btn" onclick="showReserveList()">
                لیست رزرو عکس
            </button>
        </div>
    `;
}

// مدیریت اقدامات عکاسی
function handlePhotoAction(action, ticketNumber) {
    const ticket = state.tickets.find(t => t.number === ticketNumber);
    if (!ticket) return;

    switch (action) {
        case 'take':
            completePhotography(ticket, true);
            break;
        case 'reserve':
            reservePhotography(ticket);
            break;
        case 'skip':
            completePhotography(ticket, false);
            break;
    }
    
    closePopup();
}

// تکمیل فرآیند عکاسی
function completePhotography(ticket, photoTaken) {
    // افزودن به تاریخچه عکاسی
    const photoRecord = {
        id: Date.now().toString(),
        ticketNumber: ticket.number,
        serviceName: ticket.serviceName,
        photoTaken: photoTaken,
        completedAt: new Date().toLocaleString('fa-IR'),
        counterNumber: state.currentUser.counterNumber
    };
    
    state.photographyHistory.unshift(photoRecord);
    
    if (photoTaken) {
        // اگر عکس گرفته شده، نوبت تکمیل شود
        completeCurrentTicket();
        showNotification(`عکس برای نوبت ${ticket.number} با موفقیت ثبت شد`);
    } else {
        // اگر عکس گرفته نشده، فقط وضعیت نوبت به تکمیل تغییر کند
        ticket.status = 'completed';
        ticket.completedAt = new Date().toLocaleString('fa-IR');
        showNotification(`نوبت ${ticket.number} بدون گرفتن عکس تکمیل شد`);
    }
    
    saveState();
    updateCurrentTicketDisplay();
    renderPhotographyHistory();
}

// رزرو نوبت عکاسی
function reservePhotography(ticket) {
    const existingReservation = state.photographyReservations.find(r => r.ticketNumber === ticket.number);
    if (existingReservation) {
        showNotification('این نوبت قبلاً رزرو شده است');
        return;
    }

    const reservation = {
        id: Date.now().toString(),
        ticketNumber: ticket.number,
        serviceName: ticket.serviceName,
        reservedAt: new Date().toLocaleString('fa-IR'),
        nationalId: prompt('لطفاً کد ملی را برای رزرو وارد کنید:') || 'نامشخص'
    };

    state.photographyReservations.push(reservation);
    
    // تغییر وضعیت نوبت به رزرو شده
    ticket.status = 'reserved';
    
    saveState();
    renderPhotographyWaitingList();
    showNotification(`نوبت ${ticket.number} با موفقیت رزرو شد`);
}

// نمایش لیست رزرو
function showReserveList() {
    if (state.photographyReservations.length === 0) {
        showNotification('هیچ نوبت رزروی وجود ندارد');
        return;
    }

    const reserveListHTML = state.photographyReservations.map(reservation => `
        <div class="reserve-item">
            <div class="reserve-info">
                <div class="reserve-ticket">${reservation.ticketNumber} - ${reservation.serviceName}</div>
                <div class="reserve-national-id">کد ملی: ${reservation.nationalId}</div>
                <div class="reserve-time">زمان رزرو: ${reservation.reservedAt}</div>
            </div>
            <div class="reserve-actions">
                <button class="reserve-call-btn" onclick="callReservedTicket('${reservation.ticketNumber}')">فراخوانی</button>
                <button class="reserve-remove-btn" onclick="removeReservation('${reservation.id}')">حذف</button>
            </div>
        </div>
    `).join('');

    const message = `
        <div class="reserve-modal">
            <button class="popup-close-btn" onclick="closePopup()">×</button>
            <h3>لیست نوبت‌های رزرو شده</h3>
            <div class="reserve-list">
                ${reserveListHTML}
            </div>
        </div>
    `;

    showNotification(message, true);
}

// فراخوانی نوبت رزرو شده
function callReservedTicket(ticketNumber) {
    const ticket = state.tickets.find(t => t.number === ticketNumber);
    const reservation = state.photographyReservations.find(r => r.ticketNumber === ticketNumber);
    
    if (ticket && reservation) {
        // حذف از لیست رزرو
        state.photographyReservations = state.photographyReservations.filter(r => r.id !== reservation.id);
        
        // تغییر وضعیت نوبت به در انتظار
        ticket.status = 'waiting';
        
        saveState();
        renderPhotographyWaitingList();
        closePopup();
        
        // فراخوانی نوبت
        callTicket(ticket);
    }
}

// حذف رزرو
function removeReservation(reservationId) {
    const reservation = state.photographyReservations.find(r => r.id === reservationId);
    if (reservation) {
        // تغییر وضعیت نوبت به تکمیل شده
        const ticket = state.tickets.find(t => t.number === reservation.ticketNumber);
        if (ticket) {
            ticket.status = 'completed';
            ticket.completedAt = new Date().toLocaleString('fa-IR');
        }
        
        state.photographyReservations = state.photographyReservations.filter(r => r.id !== reservationId);
        saveState();
        renderPhotographyWaitingList();
        closePopup();
        showNotification('رزرو با موفقیت حذف شد');
    }
}

// ارسال به عکاسی
function sendToPhotography() {
    const ticketNumber = elements.manualPhotographyInput.value.trim();
    if (!ticketNumber) {
        showNotification('لطفاً شماره نوبت را وارد کنید');
        return;
    }

    const ticket = state.tickets.find(t => t.number === ticketNumber);
    if (!ticket) {
        showNotification('نوبت پیدا نشد');
        return;
    }

    if (ticket.status !== 'completed') {
        showNotification('این نوبت هنوز تکمیل نشده است');
        return;
    }

    // افزودن به تاریخچه عکاسی
    const photoRecord = {
        id: Date.now().toString(),
        ticketNumber: ticket.number,
        serviceName: ticket.serviceName,
        photoTaken: true,
        completedAt: new Date().toLocaleString('fa-IR'),
        counterNumber: state.currentUser.counterNumber,
        manuallySent: true
    };

    state.photographyHistory.unshift(photoRecord);
    elements.manualPhotographyInput.value = '';
    
    saveState();
    renderPhotographyHistory();
    showNotification(`نوبت ${ticketNumber} با موفقیت به عکاسی ارسال شد`);
}

// فراخوانی نوبت عکاسی
function callPhotographyTicket() {
    if (state.photographyReservations.length === 0) {
        showNotification('هیچ نوبت رزروی برای عکاسی وجود ندارد');
        return;
    }

    // فراخوانی اولین نوبت رزرو شده
    const nextReservation = state.photographyReservations[0];
    callReservedTicket(nextReservation.ticketNumber);
}

// رندر لیست انتظار عکاسی
function renderPhotographyWaitingList() {
    if (!elements.photographyWaitingList) return;
    
    if (state.photographyReservations.length === 0) {
        elements.photographyWaitingList.innerHTML = '<p>هیچ نوبت رزروی وجود ندارد</p>';
        return;
    }

    const waitingListHTML = state.photographyReservations.map(reservation => `
        <div class="photography-waiting-item">
            <div class="photography-waiting-info">
                <div class="photography-waiting-ticket">${reservation.ticketNumber}</div>
                <div class="photography-waiting-service">${reservation.serviceName}</div>
                <div class="photography-waiting-time">رزرو شده در: ${reservation.reservedAt}</div>
            </div>
            <div class="photography-waiting-actions">
                <button class="photography-complete-btn" onclick="completeReservedPhotography('${reservation.ticketNumber}')">تکمیل</button>
                <button class="photography-cancel-btn" onclick="cancelPhotographyReservation('${reservation.id}')">لغو</button>
            </div>
        </div>
    `).join('');

    elements.photographyWaitingList.innerHTML = waitingListHTML;
}

// رندر تاریخچه عکاسی
function renderPhotographyHistory() {
    if (!elements.photographyHistoryTable) return;
    
    const tbody = elements.photographyHistoryTable.querySelector('tbody');
    if (!tbody) return;
    
    if (state.photographyHistory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">هیچ رکوردی وجود ندارد</td></tr>';
        return;
    }

    const historyHTML = state.photographyHistory.slice(0, 50).map(record => `
        <tr>
            <td>${record.ticketNumber}</td>
            <td>${record.serviceName}</td>
            <td>${record.photoTaken ? '<span class="status-completed">بله</span>' : '<span class="status-pending">خیر</span>'}</td>
            <td>${record.completedAt}</td>
            <td>${record.counterNumber || 'نامشخص'}</td>
        </tr>
    `).join('');

    tbody.innerHTML = historyHTML;
}

// تکمیل عکاسی رزرو شده
function completeReservedPhotography(ticketNumber) {
    const reservation = state.photographyReservations.find(r => r.ticketNumber === ticketNumber);
    if (reservation) {
        // افزودن به تاریخچه
        const photoRecord = {
            id: Date.now().toString(),
            ticketNumber: reservation.ticketNumber,
            serviceName: reservation.serviceName,
            photoTaken: true,
            completedAt: new Date().toLocaleString('fa-IR'),
            counterNumber: state.currentUser.counterNumber
        };

        state.photographyHistory.unshift(photoRecord);
        
        // حذف از لیست رزرو
        state.photographyReservations = state.photographyReservations.filter(r => r.id !== reservation.id);
        
        // تغییر وضعیت نوبت به تکمیل شده
        const ticket = state.tickets.find(t => t.number === reservation.ticketNumber);
        if (ticket) {
            ticket.status = 'completed';
            ticket.completedAt = new Date().toLocaleString('fa-IR');
        }
        
        saveState();
        renderPhotographyWaitingList();
        renderPhotographyHistory();
        showNotification(`عکاسی برای نوبت ${ticketNumber} تکمیل شد`);
    }
}

// لغو رزرو عکاسی
function cancelPhotographyReservation(reservationId) {
    const reservation = state.photographyReservations.find(r => r.id === reservationId);
    if (reservation) {
        state.photographyReservations = state.photographyReservations.filter(r => r.id !== reservationId);
        
        // تغییر وضعیت نوبت به تکمیل شده
        const ticket = state.tickets.find(t => t.number === reservation.ticketNumber);
        if (ticket) {
            ticket.status = 'completed';
            ticket.completedAt = new Date().toLocaleString('fa-IR');
        }
        
        saveState();
        renderPhotographyWaitingList();
        showNotification('رزرو عکاسی لغو شد');
    }
}

// فعال/غیرفعال کردن حالت عکاسی
function togglePhotographyMode() {
    state.isPhotographyMode = elements.photographyRoleCheckbox.checked;
    checkPhotographyMode();
}

// بررسی و به‌روزرسانی حالت عکاسی
function checkPhotographyMode() {
    const photographySection = document.querySelector('.photography-section');
    if (photographySection) {
        photographySection.style.display = state.isPhotographyMode ? 'block' : 'none';
    }
}

// ادامه توابع موجود...
function updateCurrentTicketDisplay() {
    if (!elements.currentTicketElement) return;
    
    if (state.currentTicket) {
        elements.currentTicketElement.innerHTML = `
            <div class="current-ticket-item">
                <strong>نوبت جاری:</strong> ${state.currentTicket.number}
                <br>
                <strong>سرویس:</strong> ${state.currentTicket.serviceName}
                <br>
                <strong>زمان فراخوانی:</strong> ${state.currentTicket.calledAt}
            </div>
        `;
        
        elements.passBtn.style.display = 'block';
        elements.completeBtn.style.display = 'block';
    } else {
        elements.currentTicketElement.innerHTML = '<div class="current-ticket-item">نوبت جاری: هیچ</div>';
        elements.passBtn.style.display = 'none';
        elements.completeBtn.style.display = 'none';
    }
}

function passCurrentTicket() {
    if (!state.currentTicket) return;
    
    state.currentTicket.status = 'passed';
    state.currentTicket = null;
    
    saveState();
    updateCurrentTicketDisplay();
    showNotification('نوبت جاری پاس شد');
}

function completeCurrentTicket() {
    if (!state.currentTicket) return;
    
    state.currentTicket.status = 'completed';
    state.currentTicket.completedAt = new Date().toLocaleString('fa-IR');
    state.currentTicket = null;
    
    saveState();
    updateCurrentTicketDisplay();
    showNotification('نوبت جاری تکمیل شد');
}

function handleLogin() {
    const counterNumber = elements.counterNumberInput.value.trim();
    const password = elements.adminPasswordInput.value.trim();
    
    if (!counterNumber || !password) {
        alert('لطفاً شماره باجه و رمز عبور را وارد کنید');
        return;
    }
    
    if (password !== state.settings.adminPassword) {
        alert('رمز عبور اشتباه است');
        return;
    }
    
    state.currentUser = {
        counterNumber: counterNumber,
        loginTime: new Date().toLocaleString('fa-IR')
    };
    
    elements.counterNumberInput.value = '';
    elements.adminPasswordInput.value = '';
    
    saveState();
    updateUI();
    showNotification(`خوش آمدید! باجه ${counterNumber} فعال شد`);
}

function handleLogout() {
    state.currentUser = null;
    state.currentTicket = null;
    
    saveState();
    updateUI();
    showNotification('خروج موفقیت‌آمیز بود');
}

function resetAll() {
    if (!confirm('آیا از ریست کردن تمام داده‌ها اطمینان دارید؟ این عمل غیرقابل بازگشت است.')) {
        return;
    }
    
    state.services = [
        { id: 1, name: 'خدمات عمومی', waiting: 0, timePerTicket: 5, enabled: true },
        { id: 2, name: 'مشاوره', waiting: 0, timePerTicket: 10, enabled: true },
        { id: 3, name: 'پذیرش', waiting: 0, timePerTicket: 3, enabled: true },
        { id: 4, name: 'عکاسی', waiting: 0, timePerTicket: 7, enabled: true }
    ];
    state.tickets = [];
    state.currentTicket = null;
    state.photographyReservations = [];
    state.photographyHistory = [];
    
    saveState();
    updateUI();
    showNotification('تمامی داده‌ها با موفقیت ریست شدند');
}

function showSettings() {
    const settingsHTML = `
        <div class="modal-overlay" id="settings-modal">
            <div class="modal">
                <button class="close-btn" onclick="closeModal('settings-modal')">×</button>
                <h2>تنظیمات سیستم</h2>
                <div class="settings-container">
                    <div class="settings-section">
                        <h3>مدیریت سرویس‌ها</h3>
                        <div id="services-management">
                            ${state.services.map(service => `
                                <div class="form-group">
                                    <label>${service.name}</label>
                                    <input type="number" value="${service.timePerTicket}" 
                                           onchange="updateServiceTime(${service.id}, this.value)" 
                                           placeholder="زمان به دقیقه" min="1">
                                    <label>
                                        <input type="checkbox" ${service.enabled ? 'checked' : ''} 
                                               onchange="toggleService(${service.id}, this.checked)">
                                        فعال
                                    </label>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <h3>تنظیمات مدیر</h3>
                        <div class="form-group">
                            <label>رمز عبور جدید:</label>
                            <input type="password" id="new-admin-password" placeholder="رمز عبور جدید">
                        </div>
                        <button class="primary-btn" onclick="updateAdminPassword()">بروزرسانی رمز عبور</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', settingsHTML);
}

function showCounterSettings() {
    const counterSettingsHTML = `
        <div class="modal-overlay" id="counter-settings-modal">
            <div class="modal">
                <button class="close-btn" onclick="closeModal('counter-settings-modal')">×</button>
                <h2>تنظیمات باجه</h2>
                <div class="settings-container">
                    <div class="form-group">
                        <label>شماره باجه فعلی:</label>
                        <input type="text" value="${state.currentUser?.counterNumber || ''}" disabled>
                    </div>
                    <div class="form-group">
                        <label>تغییر شماره باجه:</label>
                        <input type="text" id="new-counter-number" placeholder="شماره باجه جدید">
                    </div>
                    <button class="primary-btn" onclick="updateCounterNumber()">بروزرسانی شماره باجه</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', counterSettingsHTML);
}

function updateServiceTime(serviceId, time) {
    const service = state.services.find(s => s.id === serviceId);
    if (service) {
        service.timePerTicket = parseInt(time) || 5;
        saveState();
        renderServices();
    }
}

function toggleService(serviceId, enabled) {
    const service = state.services.find(s => s.id === serviceId);
    if (service) {
        service.enabled = enabled;
        saveState();
        renderServices();
        renderServiceCheckboxes();
    }
}

function updateAdminPassword() {
    const newPassword = document.getElementById('new-admin-password').value.trim();
    if (newPassword) {
        state.settings.adminPassword = newPassword;
        saveState();
        closeModal('settings-modal');
        showNotification('رمز عبور با موفقیت بروزرسانی شد');
    }
}

function updateCounterNumber() {
    const newCounterNumber = document.getElementById('new-counter-number').value.trim();
    if (newCounterNumber && state.currentUser) {
        state.currentUser.counterNumber = newCounterNumber;
        saveState();
        closeModal('counter-settings-modal');
        updateUI();
        showNotification('شماره باجه با موفقیت بروزرسانی شد');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
}

function renderTicketHistory() {
    if (!elements.ticketHistory) return;
    
    const tbody = elements.ticketHistory.querySelector('tbody');
    if (!tbody) return;
    
    const recentTickets = state.tickets
        .filter(t => t.status === 'completed')
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
        .slice(0, 50);
    
    if (recentTickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">هیچ نوبتی وجود ندارد</td></tr>';
        return;
    }
    
    const historyHTML = recentTickets.map(ticket => `
        <tr>
            <td>${ticket.number}</td>
            <td>${ticket.serviceName}</td>
            <td>${ticket.generatedAt}</td>
            <td>${ticket.completedAt}</td>
            <td>${ticket.counterNumber || 'نامشخص'}</td>
        </tr>
    `).join('');
    
    tbody.innerHTML = historyHTML;
}

function showNotification(message, isPersistent = false) {
    if (!elements.popupContainer || !elements.popupMessage) return;
    
    elements.popupMessage.innerHTML = message;
    elements.popupContainer.classList.add('show');
    
    if (!isPersistent) {
        setTimeout(() => {
            closePopup();
        }, 5000);
    }
    
    try {
        sounds.notification.play().catch(e => console.log('Error playing notification sound:', e));
    } catch (error) {
        console.log('Sound play failed:', error);
    }
}

function closePopup() {
    if (!elements.popupContainer) return;
    
    elements.popupContainer.classList.remove('show');
    setTimeout(() => {
        elements.popupMessage.innerHTML = '';
    }, 300);
}

function calculateWaitingTime(waitingCount, timePerTicket) {
    return Math.ceil(waitingCount * timePerTicket);
}

function updateTotalWaiting() {
    if (!elements.totalWaitingCount) return;
    
    const total = state.services.reduce((sum, service) => sum + service.waiting, 0);
    elements.totalWaitingCount.textContent = total;
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Global functions for HTML event handlers
window.handlePhotoAction = handlePhotoAction;
window.showReserveList = showReserveList;
window.callReservedTicket = callReservedTicket;
window.removeReservation = removeReservation;
window.completeReservedPhotography = completeReservedPhotography;
window.cancelPhotographyReservation = cancelPhotographyReservation;
window.closePopup = closePopup;
window.closeModal = closeModal;
window.updateServiceTime = updateServiceTime;
window.toggleService = toggleService;
window.updateAdminPassword = updateAdminPassword;
window.updateCounterNumber = updateCounterNumber;
