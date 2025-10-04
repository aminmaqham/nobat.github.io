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
    let photographyHistory = [];
    let isPhotographyUser = false;
    let photographyReservations = [];
    let currentTicketForPhotography = null;

    // --- توابع مدیریت تاریخچه عکاسی ---
    function loadPhotographyHistory() {
        try {
            const saved = localStorage.getItem('photographyHistory');
            if (saved) {
                photographyHistory = JSON.parse(saved);
            }
            
            const savedReservations = localStorage.getItem('photographyReservations');
            if (savedReservations) {
                photographyReservations = JSON.parse(savedReservations);
            }
            
            renderPhotographyHistory();
            updatePhotographyUI();
        } catch (error) {
            console.error('Error loading photography history:', error);
            photographyHistory = [];
            photographyReservations = [];
        }
    }

    function savePhotographyHistory() {
        try {
            localStorage.setItem('photographyHistory', JSON.stringify(photographyHistory));
            localStorage.setItem('photographyReservations', JSON.stringify(photographyReservations));
            // به‌روزرسانی نمایشگر
            if (typeof updatePhotographyDisplay === 'function') {
                updatePhotographyDisplay();
            }
        } catch (error) {
            console.error('Error saving photography history:', error);
        }
    }

    // --- تابع برای افزودن به تاریخچه عکاسی ---
    function addToPhotographyHistory(item, action = 'added') {
        const historyItem = {
            id: Date.now().toString(),
            ticketNumber: item.ticketNumber,
            firstName: item.firstName,
            lastName: item.lastName,
            nationalId: item.nationalId,
            action: action,
            source: item.source,
            timestamp: new Date().toISOString(),
            completedAt: action === 'completed' ? new Date().toISOString() : null,
            status: action === 'completed' ? 'تکمیل شده' : 'در انتظار',
            photoTaken: action === 'completed',
            serviceName: item.serviceName || '---',
            counterNumber: item.counterNumber || '---'
        };
        
        photographyHistory.unshift(historyItem);
        
        // فقط 100 آیتم آخر را نگه دار
        if (photographyHistory.length > 100) {
            photographyHistory = photographyHistory.slice(0, 100);
        }
        
        savePhotographyHistory();
        renderPhotographyHistory();
        updatePhotographyUI();
    }

    // --- تابع برای رزرو نوبت عکاسی ---
    function reservePhotographyTicket(ticket, nationalId) {
        const reservation = {
            id: Date.now().toString(),
            ticketNumber: ticket.specific_ticket || 'پاس',
            firstName: ticket.first_name,
            lastName: ticket.last_name,
            nationalId: nationalId,
            serviceName: services.find(s => s.$id === ticket.service_id)?.name || '---',
            reservedAt: new Date().toISOString(),
            counterNumber: ticket.called_by_counter_name || '---'
        };
        
        photographyReservations.push(reservation);
        savePhotographyHistory();
        
        return reservation;
    }

    // --- تابع برای حذف رزرو ---
    function removePhotographyReservation(reservationId) {
        photographyReservations = photographyReservations.filter(r => r.id !== reservationId);
        savePhotographyHistory();
        renderPhotographyList();
    }

    // --- تابع برای نمایش لیست رزرو ---
    function showReservationList() {
        if (photographyReservations.length === 0) {
            showPopupNotification('<p>هیچ نوبت رزروی وجود ندارد</p>');
            return;
        }

        const reservationListHTML = photographyReservations.map(reservation => `
            <div class="reserve-item">
                <div class="reserve-info">
                    <div class="reserve-ticket">${reservation.ticketNumber} - ${reservation.firstName} ${reservation.lastName}</div>
                    <div class="reserve-national-id">کد ملی: ${reservation.nationalId}</div>
                    <div class="reserve-service">خدمت: ${reservation.serviceName}</div>
                </div>
                <div class="reserve-actions">
                    <button class="reserve-call-btn" onclick="callReservedTicket('${reservation.id}')">فراخوانی</button>
                    <button class="reserve-remove-btn" onclick="removeReservation('${reservation.id}')">حذف</button>
                </div>
            </div>
        `).join('');

        const message = `
            <div class="popup-with-buttons">
                <button class="popup-close-btn" onclick="closePopup()">×</button>
                <h3>لیست نوبت‌های رزرو شده</h3>
                <div class="reserve-list">
                    ${reservationListHTML}
                </div>
            </div>
        `;

        showPopupNotification(message);
    }

    // --- تابع برای فراخوانی نوبت رزرو شده ---
    function callReservedTicket(reservationId) {
        const reservation = photographyReservations.find(r => r.id === reservationId);
        if (!reservation) return;

        // ایجاد یک تیکت موقت برای فراخوانی
        const tempTicket = {
            specific_ticket: reservation.ticketNumber,
            first_name: reservation.firstName,
            last_name: reservation.lastName,
            national_id: reservation.nationalId,
            service_id: 'reserved',
            called_by_counter_name: reservation.counterNumber
        };

        // نمایش نوتیفیکیشن عکاسی برای نوبت رزرو شده
        showPhotographyPopup(tempTicket, true);
        
        // حذف از لیست رزرو
        removePhotographyReservation(reservationId);
    }

    // --- تابع نوتیفیکیشن عکاسی با چهار گزینه ---
    function showPhotographyPopup(ticket, isReserved = false) {
        return new Promise((resolve) => {
            const popup = document.getElementById('popup-notification');
            const popupText = document.getElementById('popup-text');
            
            // پاک کردن محتوای قبلی
            popupText.innerHTML = '';
            
            const reservedText = isReserved ? ' (رزرو شده)' : '';
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'popup-with-buttons photography-popup';
            
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
            messageDiv.innerHTML = `
                <span class="ticket-number">${ticket.specific_ticket || 'پاس'}${reservedText}</span>
                <p><strong>نام:</strong> ${ticket.first_name} ${ticket.last_name}</p>
                <p><strong>کد ملی:</strong> ${ticket.national_id}</p>
                <p><strong>باجه:</strong> ${ticket.called_by_counter_name || '---'}</p>
            `;
            
            // دکمه‌های عکاسی
            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'popup-buttons';
            
            // گزینه ۱: ثبت عکس
            const takePhotoBtn = document.createElement('button');
            takePhotoBtn.className = 'photography-popup-btn photo-take-btn';
            takePhotoBtn.textContent = 'ثبت عکس';
            takePhotoBtn.onclick = () => {
                closePopup();
                setTimeout(() => {
                    completePhotographyProcess(ticket, true);
                    resolve('take_photo');
                }, 300);
            };
            
            // گزینه ۲: رزرو نوبت
            const reserveBtn = document.createElement('button');
            reserveBtn.className = 'photography-popup-btn photo-reserve-btn';
            reserveBtn.textContent = 'رزرو نوبت';
            reserveBtn.onclick = () => {
                closePopup();
                setTimeout(() => {
                    const nationalId = prompt('لطفاً کد ملی را برای رزرو وارد کنید:');
                    if (nationalId && nationalId.trim() !== '') {
                        reservePhotographyTicket(ticket, nationalId);
                        showPopupNotification(`<p>نوبت ${ticket.specific_ticket || 'پاس'} با موفقیت رزرو شد</p>`);
                    }
                    resolve('reserve');
                }, 300);
            };
            
            // گزینه ۳: بدون گرفتن عکس
            const skipPhotoBtn = document.createElement('button');
            skipPhotoBtn.className = 'photography-popup-btn photo-skip-btn';
            skipPhotoBtn.textContent = 'بدون گرفتن عکس';
            skipPhotoBtn.onclick = () => {
                closePopup();
                setTimeout(() => {
                    completePhotographyProcess(ticket, false);
                    showPopupNotification(`<p>نوبت ${ticket.specific_ticket || 'پاس'} بدون گرفتن عکس تکمیل شد</p>`);
                    resolve('skip_photo');
                }, 300);
            };
            
            // گزینه ۴: لیست رزرو عکس
            const reserveListBtn = document.createElement('button');
            reserveListBtn.className = 'photography-popup-btn photo-reserve-list-btn';
            reserveListBtn.textContent = 'لیست رزرو عکس';
            reserveListBtn.onclick = () => {
                closePopup();
                setTimeout(() => {
                    showReservationList();
                    resolve('reserve_list');
                }, 300);
            };
            
            buttonsDiv.appendChild(takePhotoBtn);
            buttonsDiv.appendChild(reserveBtn);
            buttonsDiv.appendChild(skipPhotoBtn);
            buttonsDiv.appendChild(reserveListBtn);
            
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
        });
    }

    // --- تابع تکمیل فرآیند عکاسی ---
    function completePhotographyProcess(ticket, photoTaken) {
        // افزودن به تاریخچه عکاسی
        const photoRecord = {
            ticketNumber: ticket.specific_ticket || 'پاس',
            firstName: ticket.first_name,
            lastName: ticket.last_name,
            nationalId: ticket.national_id,
            source: 'photography_process',
            serviceName: services.find(s => s.$id === ticket.service_id)?.name || '---',
            counterNumber: ticket.called_by_counter_name || '---'
        };
        
        addToPhotographyHistory(photoRecord, 'completed');
        
        // اگر عکس گرفته شده، نوبت اصلی را تکمیل کن
        if (photoTaken && ticket.$id) {
            // اینجا می‌توانید وضعیت نوبت اصلی را در دیتابیس به روز کنید
            console.log('عکس برای نوبت گرفته شد:', ticket.specific_ticket);
        }
        
        // بازگشت شماره نوبت به باجه
        if (ticket.called_by_counter_name) {
            console.log(`شماره نوبت ${ticket.specific_ticket} به باجه ${ticket.called_by_counter_name} بازگردانده شد`);
            showPopupNotification(`<p>عکس برای نوبت ${ticket.specific_ticket} ثبت شد و به باجه ${ticket.called_by_counter_name} بازگردانده شد</p>`);
        }
    }

    // --- تابع فراخوانی نوبت عکاسی ---
    async function callPhotographyTicket() {
        if (!isPhotographyUser) return;

        // اول نوبت‌های رزرو شده را بررسی کن
        if (photographyReservations.length > 0) {
            const nextReservation = photographyReservations[0];
            callReservedTicket(nextReservation.id);
            return;
        }

        // سپس نوبت‌های عادی عکاسی را بررسی کن
        const waitingPhotographyItems = photographyHistory.filter(item => 
            item.status === 'در انتظار' && !item.photoTaken
        );

        if (waitingPhotographyItems.length === 0) {
            showPopupNotification('<p>هیچ نوبتی در لیست انتظار عکاسی وجود ندارد</p>');
            return;
        }

        const nextItem = waitingPhotographyItems[0];
        
        // ایجاد تیکت موقت برای نمایش
        const tempTicket = {
            specific_ticket: nextItem.ticketNumber,
            first_name: nextItem.firstName,
            last_name: nextItem.lastName,
            national_id: nextItem.nationalId,
            service_id: 'photography',
            called_by_counter_name: nextItem.counterNumber
        };

        await showPhotographyPopup(tempTicket);
    }

    // --- تابع به‌روزرسانی وضعیت عکاسی ---
    function updatePhotographyUI() {
        const waitingCount = photographyHistory.filter(item => 
            item.status === 'در انتظار' && !item.photoTaken
        ).length;
        
        if (photographyWaitingCount) {
            photographyWaitingCount.textContent = waitingCount + photographyReservations.length;
        }
        
        renderPhotographyList();
    }

    // --- تابع رندر لیست عکاسی ---
    function renderPhotographyList() {
        if (!photographyListContainer) return;

        const waitingItems = photographyHistory.filter(item => 
            item.status === 'در انتظار' && !item.photoTaken
        );

        const allWaitingItems = [...waitingItems, ...photographyReservations.map(r => ({
            ticketNumber: r.ticketNumber,
            firstName: r.firstName,
            lastName: r.lastName,
            nationalId: r.nationalId,
            status: 'رزرو شده',
            isReserved: true
        }))];

        if (allWaitingItems.length === 0) {
            photographyListContainer.innerHTML = '<div class="photography-empty">هیچ نوبتی در لیست عکاسی وجود ندارد</div>';
            if (photographyDisplay) photographyDisplay.style.display = 'none';
            return;
        }

        // فقط 7 آیتم اول را نشان بده
        const displayItems = allWaitingItems.slice(0, 7);
        
        photographyListContainer.innerHTML = displayItems.map((item, index) => `
            <div class="photography-item ${item.isReserved ? 'reserved-item' : ''}">
                <div class="photography-number">${index + 1}</div>
                <div class="photography-info">
                    <div class="photography-ticket">${item.ticketNumber} - ${item.firstName} ${item.lastName}</div>
                    <div class="photography-national-id">${item.nationalId}</div>
                    ${item.isReserved ? '<div class="photography-reserved">رزرو شده</div>' : ''}
                </div>
                <div class="photography-status ${item.isReserved ? 'status-reserved' : 'status-pending'}">
                    ${item.isReserved ? 'رزرو شده' : 'در انتظار'}
                </div>
            </div>
        `).join('');
        
        if (photographyDisplay) photographyDisplay.style.display = 'flex';
    }

    // --- تابع رندر تاریخچه عکاسی ---
    function renderPhotographyHistory() {
        const historyBody = document.getElementById('photography-history-body');
        if (!historyBody) return;
        
        if (photographyHistory.length === 0) {
            historyBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">هیچ رکوردی در تاریخچه عکاسی وجود ندارد</td></tr>';
            return;
        }
        
        historyBody.innerHTML = photographyHistory.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${item.ticketNumber}</td>
                <td>${item.firstName} ${item.lastName}</td>
                <td>${item.nationalId}</td>
                <td>${item.source === 'manual_input' ? 'ثبت دستی' : 'ارسال به عکاسی'}</td>
                <td>${formatDate(item.timestamp)}</td>
                <td>${item.completedAt ? formatDate(item.completedAt) : '---'}</td>
                <td class="${item.status === 'تکمیل شده' ? 'status-completed' : 'status-pending'}">
                    ${item.status}
                </td>
            </tr>
        `).join('');
    }

    // --- توابع موجود (بدون تغییر) ---
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

    // --- تابع بهبودیافته برای فراخوانی نوبت ---
    async function callNextTicketWithOptions() {
        if (isPhotographyUser) {
            await callPhotographyTicket();
            return;
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
                
                await fetchTickets();
                
                const service = services.find(s => s.$id === updatedTicket.service_id);
                
                // اگر سرویس عکاسی است، از نوتیفیکیشن مخصوص عکاسی استفاده کن
                if (service?.name?.includes('عکاسی')) {
                    await showPhotographyPopup(updatedTicket);
                } else {
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
                    }
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

    // --- تابع نوتیفیکیشن پیشرفته (بدون تغییر) ---
    function showAdvancedPopupNotification(ticket, htmlContent) {
        return new Promise((resolve) => {
            const popup = document.getElementById('popup-notification');
            const popupText = document.getElementById('popup-text');
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'popup-with-buttons';
            
            const closeBtn = document.createElement('button');
            closeBtn.className = 'popup-close-btn';
            closeBtn.innerHTML = '×';
            closeBtn.onclick = () => {
                closePopup();
                setTimeout(() => resolve('close'), 300);
            };
            
            const messageDiv = document.createElement('div');
            messageDiv.innerHTML = htmlContent;
            
            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'popup-buttons';
            
            const photographyBtn = document.createElement('button');
            photographyBtn.className = 'popup-btn popup-photography-btn';
            photographyBtn.textContent = 'ارسال به عکاسی';
            photographyBtn.onclick = () => {
                closePopup();
                setTimeout(() => resolve('photography'), 300);
            };
            
            const nextBtn = document.createElement('button');
            nextBtn.className = 'popup-btn popup-next-btn';
            nextBtn.textContent = 'فراخوان بعدی';
            nextBtn.onclick = async () => {
                closePopup();
                setTimeout(async () => {
                    await callNextTicketWithOptions();
                    resolve('next');
                }, 300);
            };
            
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
        });
    }

    // --- تابع نوتیفیکیشن ساده (بدون تغییر) ---
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
        
        function closePopup() {
            popup.classList.remove('show');
            setTimeout(() => {
                popup.style.display = 'none';
            }, 300);
        }
        
        const closeHandler = function(e) {
            if (e.target === popup) {
                closePopup();
            }
        };
        
        popup.addEventListener('click', closeHandler);
        
        setTimeout(() => {
            if (popup.style.display !== 'none') {
                closePopup();
            }
        }, 10000);
    }

    // --- توابع کمکی ---
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

    // --- توابع موجود (بدون تغییر) ---
    async function initializeApp() {
        try {
            currentUser = await account.get();
            await checkAndSetCounterName();
            
            const userPrefs = currentUser.prefs || {};
            isPhotographyUser = userPrefs.is_photography_user || false;
            if (photographyRoleCheckbox) {
                photographyRoleCheckbox.checked = isPhotographyUser;
            }
            
            showLoggedInUI();
            await fetchData();
            setupRealtimeSubscriptions();
            checkAutoReset();
            loadPhotographyHistory();
            updatePhotographyUI();
            updateUIForUserRole();
            
        } catch (error) {
            console.log('User not logged in');
            showLoggedOutUI();
        }
    }

    function updateUIForUserRole() {
        if (callNextBtn) {
            if (isPhotographyUser) {
                callNextBtn.textContent = 'فراخوانی نوبت عکاسی';
            } else {
                callNextBtn.textContent = 'فراخوان نوبت بعدی';
            }
        }
    }

    // --- Event Listeners جدید ---
    function setupPhotographyEventListeners() {
        // Event listener برای تیک عکاسی
        if (photographyRoleCheckbox) {
            photographyRoleCheckbox.addEventListener('change', function() {
                isPhotographyUser = this.checked;
                updatePhotographyUI();
                updateUIForUserRole();
                
                // ذخیره تنظیمات کاربر
                if (currentUser) {
                    const userPrefs = currentUser.prefs || {};
                    userPrefs.is_photography_user = isPhotographyUser;
                    account.updatePrefs(userPrefs).then(() => {
                        currentUser.prefs = userPrefs;
                    }).catch(console.error);
                }
            });
        }

        // Event listener برای دکمه فراخوانی عکاسی
        if (callNextBtn) {
            // حذف event listener قبلی و اضافه کردن جدید
            callNextBtn.replaceWith(callNextBtn.cloneNode(true));
            const newCallNextBtn = document.getElementById('call-next-btn');
            newCallNextBtn.addEventListener('click', function() {
                if (isPhotographyUser) {
                    callPhotographyTicket();
                } else {
                    callNextTicketWithOptions();
                }
            });
        }
    }

    // --- توابع global برای HTML ---
    window.callReservedTicket = callReservedTicket;
    window.removeReservation = removePhotographyReservation;
    window.closePopup = () => {
        const popup = document.getElementById('popup-notification');
        if (popup) {
            popup.classList.remove('show');
            setTimeout(() => {
                popup.style.display = 'none';
            }, 300);
        }
    };

    // --- سایر توابع موجود شما ---
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

    // Initialize
    initializeApp();
    setupPhotographyEventListeners();

    // اضافه کردن event listener برای login
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            try {
                await account.createEmailSession(emailInput.value, passwordInput.value);
                initializeApp();
            } catch (error) {
                alert('خطا در ورود: ' + error.message);
            }
        });
    }

    // سایر event listeners موجود...
});
