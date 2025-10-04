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
    const elements = {
        photographyModal: document.getElementById('photography-modal'),
        manualTicketInput: document.getElementById('manual-ticket-input'),
        manualPhotographyBtn: document.getElementById('manual-photography-btn'),
        photographyRoleCheckbox: document.getElementById('photography-role-checkbox'),
        photographyWaitingCount: document.getElementById('photography-waiting-count'),
        photographyTicketNumber: document.getElementById('photography-ticket-number'),
        photographyCustomerName: document.getElementById('photography-customer-name'),
        photographyNationalIdInput: document.getElementById('photography-national-id'),
        confirmPhotographyBtn: document.getElementById('confirm-photography-btn'),
        cancelPhotographyBtn: document.getElementById('cancel-photography-btn'),
        photographyDisplay: document.getElementById('photography-display'),
        photographyListContainer: document.getElementById('photography-list'),
        loginBtn: document.getElementById('login-btn'),
        pastTicketInput: document.getElementById('past-ticket-input'),
        callPastBtn: document.getElementById('call-past-btn'),
        logoutBtn: document.getElementById('logout-btn'),
        settingsBtn: document.getElementById('settings-btn'),
        counterSettingsBtn: document.getElementById('counter-settings-btn'),
        resetAllBtn: document.getElementById('reset-all-btn'),
        emailInput: document.getElementById('email'),
        passwordInput: document.getElementById('password'),
        userGreeting: document.getElementById('user-greeting'),
        loginFields: document.getElementById('login-fields'),
        userInfo: document.getElementById('user-info'),
        mainContent: document.getElementById('main-content'),
        serviceButtonsContainer: document.querySelector('.service-buttons'),
        ticketForm: document.getElementById('ticket-form'),
        callNextBtn: document.getElementById('call-next-btn'),
        passTicketBtn: document.getElementById('pass-ticket-btn'),
        serviceCheckboxes: document.getElementById('service-checkboxes'),
        currentTicketDisplay: document.getElementById('current-ticket'),
        popupNotification: document.getElementById('popup-notification'),
        popupText: document.getElementById('popup-text'),
        totalWaitingContainer: document.getElementById('total-waiting-container'),
        ticketHistoryTable: document.querySelector('#ticket-history tbody'),
        submitTicketBtn: document.getElementById('submit-ticket'),
        cancelTicketBtn: document.getElementById('cancel-ticket'),
        ticketFormTitle: document.getElementById('ticket-form-title'),
        adminPanel: document.getElementById('admin-panel'),
        serviceList: document.getElementById('service-list'),
        addServiceBtn: document.getElementById('add-service-btn'),
        saveSettingsBtn: document.getElementById('save-settings-btn'),
        closeSettingsBtn: document.getElementById('close-settings'),
        cancelSettingsBtn: document.getElementById('cancel-settings-btn'),
        passServiceModalOverlay: document.getElementById('pass-service-modal-overlay'),
        passServiceList: document.getElementById('pass-service-list'),
        confirmPassServiceBtn: document.getElementById('confirm-pass-service'),
        cancelPassServiceBtn: document.getElementById('cancel-pass-service'),
        counterSettingsModal: document.getElementById('counter-settings-modal'),
        counterNameInput: document.getElementById('counter-name-input'),
        saveCounterBtn: document.getElementById('save-counter-btn'),
        cancelCounterBtn: document.getElementById('cancel-counter-btn')
    };

    // --- Application State ---
    const state = {
        currentUser: null,
        services: [],
        tickets: [],
        tempSelectedServicesForPass: [],
        lastCalledTicket: {},
        photographyList: [],
        currentTicketForPhotography: null,
        photographyHistory: [],
        isPhotographyUser: false
    };

    // --- Utility Functions ---
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

    function formatDate(dateString) {
        if (!dateString) return '---';
        return new Date(dateString).toLocaleString('fa-IR');
    }

    function showPopupNotification(htmlContent) {
        const popup = elements.popupNotification;
        const popupText = elements.popupText;
        
        popupText.innerHTML = htmlContent;
        popup.style.display = 'flex';
        
        setTimeout(() => {
            popup.classList.add('show');
        }, 10);
        
        const closeHandler = function(e) {
            if (e.target === popup) {
                popup.classList.remove('show');
                setTimeout(() => {
                    popup.style.display = 'none';
                }, 300);
                popup.removeEventListener('click', closeHandler);
            }
        };
        
        popup.addEventListener('click', closeHandler);
    }

    function showAdvancedPopupNotification(ticket, htmlContent) {
        return new Promise((resolve) => {
            const popup = elements.popupNotification;
            const popupText = elements.popupText;
            
            popupText.innerHTML = '';
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'popup-with-buttons';
            
            const messageDiv = document.createElement('div');
            messageDiv.innerHTML = htmlContent;
            contentDiv.appendChild(messageDiv);
            
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
        });
    }

    function showNationalIdError(message) {
        const nationalIdInput = elements.photographyNationalIdInput;
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

    // --- Data Management ---
    async function fetchData() {
        if (!state.currentUser) return;
        await Promise.all([fetchServices(), fetchTickets()]);
        renderUI();
    }

    async function fetchServices() {
        try {
            const response = await databases.listDocuments(DATABASE_ID, SERVICES_COLLECTION_ID, [Query.orderAsc('name')]);
            state.services = response.documents;
        } catch (error) {
            console.error('Error fetching services:', error);
        }
    }

    async function fetchTickets() {
        try {
            const response = await databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID, [
                Query.orderDesc('$createdAt')
            ]);
            state.tickets = response.documents;
        } catch (error) {
            console.error('Error fetching tickets:', error);
        }
    }

    // --- Photography Management ---
    function getPhotographyList() {
        try {
            const saved = localStorage.getItem('photographyList');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    }

    function savePhotographyList(list) {
        try {
            localStorage.setItem('photographyList', JSON.stringify(list));
        } catch (error) {
            console.error('Error saving photography list:', error);
        }
    }

    function loadPhotographyList() {
        try {
            const saved = localStorage.getItem('photographyList');
            if (saved) {
                state.photographyList = JSON.parse(saved);
            }
            renderPhotographyList();
            
            if (state.photographyList.length > 0) {
                elements.photographyDisplay.style.display = 'flex';
            }
        } catch (error) {
            console.error('Error loading photography list:', error);
            state.photographyList = [];
        }
    }

    function loadPhotographyHistory() {
        try {
            const saved = localStorage.getItem('photographyHistory');
            if (saved) {
                state.photographyHistory = JSON.parse(saved);
            }
            renderPhotographyHistory();
        } catch (error) {
            console.error('Error loading photography history:', error);
            state.photographyHistory = [];
        }
    }

    function savePhotographyHistory() {
        try {
            localStorage.setItem('photographyHistory', JSON.stringify(state.photographyHistory));
        } catch (error) {
            console.error('Error saving photography history:', error);
        }
    }

    function addToPhotographyHistory(item, action = 'added') {
        const sourceText = item.source === 'manual_input' ? 'ثبت دستی' : 'ارسال به عکاسی';
        
        const historyItem = {
            id: Date.now().toString(),
            ticketNumber: item.ticketNumber,
            firstName: item.firstName,
            lastName: item.lastName,
            nationalId: item.nationalId,
            action: action,
            source: sourceText,
            timestamp: new Date().toISOString(),
            completedAt: action === 'completed' ? new Date().toISOString() : null,
            status: action === 'completed' ? 'تکمیل شده' : 'در انتظار'
        };
        
        state.photographyHistory.unshift(historyItem);
        
        if (state.photographyHistory.length > 100) {
            state.photographyHistory = state.photographyHistory.slice(0, 100);
        }
        
        savePhotographyHistory();
        renderPhotographyHistory();
    }

    function renderPhotographyHistory() {
        const historyBody = document.getElementById('photography-history-body');
        if (!historyBody) return;
        
        if (state.photographyHistory.length === 0) {
            historyBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">هیچ رکوردی در تاریخچه عکاسی وجود ندارد</td></tr>';
            return;
        }
        
        historyBody.innerHTML = state.photographyHistory.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${item.ticketNumber}</td>
                <td>${item.firstName} ${item.lastName}</td>
                <td>${item.nationalId}</td>
                <td>${item.source || '---'}</td>
                <td>${formatDate(item.timestamp)}</td>
                <td>${item.completedAt ? formatDate(item.completedAt) : '---'}</td>
                <td class="${item.status === 'تکمیل شده' ? 'status-completed' : 'status-pending'}">
                    ${item.status}
                </td>
            </tr>
        `).join('');
    }

    function renderPhotographyList() {
        if (state.photographyList.length === 0) {
            elements.photographyListContainer.innerHTML = '<div class="photography-empty">هیچ نوبتی در لیست عکاسی وجود ندارد</div>';
            elements.photographyDisplay.style.display = 'none';
            return;
        }
        
        const displayItems = state.photographyList.slice(0, 7);
        
        elements.photographyListContainer.innerHTML = displayItems.map((item, index) => `
            <div class="photography-item ${item.photoTaken ? 'photo-taken' : ''} ${index === 0 && !item.photoTaken ? 'new-item' : ''}">
                <div class="photography-number">${index + 1}</div>
                <div class="photography-info">
                    <div class="photography-ticket">${item.ticketNumber} - ${item.firstName} ${item.lastName}</div>
                    <div class="photography-national-id">${item.nationalId}</div>
                </div>
                <div class="photography-status ${item.photoTaken ? 'photo-taken' : ''}">
                    ${item.photoTaken ? 'عکس گرفته شد' : 'در انتظار'}
                </div>
            </div>
        `).join('');
        
        elements.photographyDisplay.style.display = 'flex';
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

    async function addToPhotographyList(ticket, nationalId) {
        console.log('Adding to photography list:', { ticket, nationalId });
        
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

        try {
            const photographyList = getPhotographyList();
            
            const existingItemByTicket = photographyList.find(item => 
                item.ticketId === ticket.$id
            );
            
            if (existingItemByTicket) {
                alert('این نوبت قبلاً در لیست عکاسی قرار گرفته است.');
                return false;
            }

            const existingItemByNationalId = photographyList.find(item => 
                item.nationalId === nationalId && !item.photoTaken
            );
            
            if (existingItemByNationalId) {
                alert(`کد ملی ${nationalId} قبلاً در لیست عکاسی ثبت شده است (نوبت: ${existingItemByNationalId.ticketNumber}).`);
                return false;
            }

            const newItem = {
                id: Date.now().toString(),
                ticketId: ticket.$id,
                ticketNumber: ticket.specific_ticket || 'پاس',
                generalNumber: ticket.general_ticket,
                firstName: ticket.first_name,
                lastName: ticket.last_name,
                nationalId: nationalId,
                serviceId: ticket.service_id,
                serviceName: state.services.find(s => s.$id === ticket.service_id)?.name || '---',
                addedAt: new Date().toISOString(),
                photoTaken: false,
                returned: false,
                source: 'photography_modal'
            };

            photographyList.unshift(newItem);
            savePhotographyList(photographyList);
            
            addToPhotographyHistory(newItem, 'added');
            
            await updateAllDisplays();
            
            showPopupNotification(`<p>نوبت ${newItem.ticketNumber} با کد ملی ${nationalId} به لیست عکاسی اضافه شد.</p>`);
            return true;

        } catch (error) {
            console.error('Error adding to photography list:', error);
            showPopupNotification('<p>خطا در اضافه کردن به لیست عکاسی!</p>');
            return false;
        }
    }

    async function markPhotoAsTaken(photographyItemId) {
        const photographyList = getPhotographyList();
        const item = photographyList.find(i => i.id === photographyItemId);
        
        if (item) {
            item.photoTaken = true;
            item.completedAt = new Date().toISOString();
            savePhotographyList(photographyList);
            
            addToPhotographyHistory(item, 'completed');
            
            await updateAllDisplays();
            
            return true;
        }
        return false;
    }

    async function removeFromPhotographyList(photographyItemId) {
        state.photographyList = state.photographyList.filter(item => item.id !== photographyItemId);
        await savePhotographyList();
        renderPhotographyList();
        
        if (state.photographyList.length === 0) {
            elements.photographyDisplay.style.display = 'none';
        }
    }

    // --- UI Rendering ---
    function renderUI() {
        if (!state.currentUser) return;
        renderServiceButtons();
        updateServiceCheckboxes();
        updateHistoryTable();
        updateCurrentTicketDisplay();
        updateTotalWaitingCount();
    }

    function updateTotalWaitingCount() {
        const waitingCount = state.tickets.filter(t => t.status === 'در حال انتظار').length;
        document.getElementById('total-waiting-count').textContent = waitingCount;
    }

    function renderServiceButtons() {
        elements.serviceButtonsContainer.innerHTML = '';
        state.services.forEach(service => {
            const button = document.createElement('button');
            button.className = 'service-btn';
            
            const isDisabled = service.disabled === true;
            const waitingCount = state.tickets.filter(t => t.service_id === service.$id && t.status === 'در حال انتظار').length;
            
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
            
            elements.serviceButtonsContainer.appendChild(button);
        });
    }

    async function updateServiceCheckboxes() {
        if (!state.currentUser) return;
        elements.serviceCheckboxes.innerHTML = '';
        const userPrefs = state.currentUser.prefs || {};
        const selections = userPrefs.service_selections || {};

        state.services.forEach(service => {
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
                    state.currentUser.prefs = await account.getPrefs();
                } catch (e) {
                    console.error("Failed to save preferences", e);
                }
            });
            
            elements.serviceCheckboxes.appendChild(div);
        });
    }

    function updateHistoryTable() {
        elements.ticketHistoryTable.innerHTML = '';
        state.tickets.forEach(ticket => {
            const service = state.services.find(s => s.$id === ticket.service_id);
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
            elements.ticketHistoryTable.appendChild(row);
        });
    }

    function updateCurrentTicketDisplay() {
        elements.currentTicketDisplay.innerHTML = '';
        const activeTickets = state.tickets
            .filter(t => t.status === 'در حال سرویس')
            .sort((a, b) => new Date(b.call_time) - new Date(a.call_time));
        
        activeTickets.slice(0, 3).forEach(ticket => {
            const service = state.services.find(s => s.$id === ticket.service_id);
            const div = document.createElement('div');
            div.className = 'current-ticket-item';
            div.innerHTML = `
                <h3>${service ? service.name : ''}</h3>
                <p><strong>نوبت:</strong> ${ticket.specific_ticket || 'پاس'}</p>
                <p><strong>نام:</strong> ${ticket.first_name} ${ticket.last_name}</p>
                <p><strong>زمان فراخوان:</strong> ${formatDate(ticket.call_time)}</p>
            `;
            elements.currentTicketDisplay.appendChild(div);
        });

        if (activeTickets.length === 0) {
            elements.currentTicketDisplay.innerHTML = '<p>هیچ نوبتی در حال سرویس نیست</p>';
        }
    }

    // --- Ticket Management ---
    function calculateEstimatedWaitTime(serviceId) {
        const service = state.services.find(s => s.$id === serviceId);
        if (!service) return 0;
        
        const timePerTicket = service.manual_time;
        const queueLength = state.tickets.filter(t => t.service_id === service.$id && t.status === 'در حال انتظار').length;
        
        return queueLength * timePerTicket;
    }

    async function checkAvailabilityAndOpenForm(serviceId) {
        const service = state.services.find(s => s.$id === serviceId);
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

    async function generateTicket(serviceId, firstName, lastName, nationalId) {
        if (nationalId && !checkCodeMeli(nationalId)) {
            alert('کد ملی وارد شده معتبر نیست.');
            return;
        }

        const service = state.services.find(s => s.$id === serviceId);
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
            registered_by: state.currentUser.$id,
            registered_by_name: state.currentUser.name,
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

    async function callNextTicketWithOptions() {
        const selections = (state.currentUser.prefs && state.currentUser.prefs.service_selections) || {};
        const selectedServiceIds = Object.keys(selections).filter(id => selections[id]);

        if (selectedServiceIds.length === 0) {
            showPopupNotification('<p>لطفا حداقل یک خدمت را برای فراخوانی انتخاب کنید.</p>');
            return;
        }

        let ticketToCall = null;
        
        const waitingTickets = state.tickets
            .filter(t => t.status === 'در حال انتظار' && selectedServiceIds.includes(t.service_id))
            .sort((a, b) => new Date(a.$createdAt) - new Date(b.$createdAt));

        const passedTickets = waitingTickets.filter(t => t.ticket_type === 'pass' && t.delay_count === 0);
        
        if (passedTickets.length > 0) {
            ticketToCall = passedTickets[0];
        } else {
            const regularTickets = waitingTickets.filter(t => t.ticket_type === 'regular');
            if (regularTickets.length > 0) {
                ticketToCall = regularTickets[0];
                
                const passedToUpdate = state.tickets.filter(t => 
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
                const userPrefs = state.currentUser.prefs || {};
                const counterName = userPrefs.counter_name || 'باجه';
                const updatedTicket = await databases.updateDocument(DATABASE_ID, TICKETS_COLLECTION_ID, ticketToCall.$id, {
                    status: 'در حال سرویس',
                    called_by: state.currentUser.$id,
                    called_by_name: state.currentUser.name,
                    called_by_counter_name: counterName,
                    call_time: new Date().toISOString()
                });
                
                state.lastCalledTicket[state.currentUser.$id] = updatedTicket.$id;
                
                await fetchTickets();
                
                const service = state.services.find(s => s.$id === updatedTicket.service_id);
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
                
                await updateAllDisplays();
                
            } catch (error) {
                console.error('Error calling next ticket:', error);
                showPopupNotification('<p>خطا در فراخوانی نوبت!</p>');
            }
        } else {
            showPopupNotification('<p>هیچ نوبتی در صف انتظار برای خدمات انتخابی نیست.</p>');
        }
    }

    // --- Modal Management ---
    function openPhotographyModal(ticket) {
        state.currentTicketForPhotography = ticket;
        elements.photographyNationalIdInput.value = '';
        elements.photographyTicketNumber.textContent = ticket.specific_ticket || 'پاس';
        elements.photographyCustomerName.textContent = `${ticket.first_name} ${ticket.last_name}`;
        elements.photographyModal.style.display = 'flex';
        elements.photographyNationalIdInput.focus();
    }

    function closePhotographyModal() {
        elements.photographyModal.style.display = 'none';
        state.currentTicketForPhotography = null;
    }

    function openTicketForm(mode, serviceId = null) {
        elements.ticketForm.dataset.mode = mode;
        const passDelayGroup = document.getElementById('pass-delay-group');
        if (mode === 'regular') {
            elements.ticketForm.dataset.serviceId = serviceId;
            elements.ticketFormTitle.textContent = 'ثبت نوبت جدید';
            passDelayGroup.style.display = 'none';
        } else if (mode === 'pass') {
            elements.ticketFormTitle.textContent = 'ثبت اطلاعات شخص پاس داده شده';
            passDelayGroup.style.display = 'block';
            
            document.getElementById('first-name').required = true;
            document.getElementById('last-name').required = true;
        }
        elements.ticketForm.style.display = 'block';
    }

    function closeTicketForm() {
        elements.ticketForm.style.display = 'none';
        document.getElementById('first-name').value = '';
        document.getElementById('last-name').value = '';
        document.getElementById('national-id').value = '';
        document.getElementById('pass-delay-count').value = 0;
        
        document.getElementById('first-name').required = false;
        document.getElementById('last-name').required = false;
    }

    // --- Authentication ---
    async function login() {
        try {
            await account.createEmailSession(elements.emailInput.value, elements.passwordInput.value);
            initializeApp();
        } catch (error) {
            alert('خطا در ورود: ' + error.message);
        }
    }

    async function logout() {
        try {
            await account.deleteSession('current');
            state.currentUser = null;
            window.location.reload();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }

    function showLoggedInUI() {
        elements.loginFields.style.display = 'none';
        elements.userInfo.style.display = 'flex';
        
        const userPrefs = state.currentUser.prefs || {};
        const counterName = userPrefs.counter_name || 'تعیین نشده';
        const roleDisplay = userPrefs.role === 'photography' ? ' (عکاسی)' : '';
        elements.userGreeting.textContent = `کاربر: ${state.currentUser.name || state.currentUser.email} (باجه: ${counterName}${roleDisplay})`;
        
        elements.mainContent.style.display = 'block';
        elements.totalWaitingContainer.style.display = 'block';
        elements.photographyDisplay.style.display = 'flex';

        if (state.currentUser.prefs && state.currentUser.prefs.role === 'admin') {
            elements.settingsBtn.style.display = 'inline-block';
            elements.resetAllBtn.style.display = 'inline-block';
        } else {
            elements.settingsBtn.style.display = 'none';
            elements.resetAllBtn.style.display = 'none';
        }
        
        elements.counterSettingsBtn.style.display = 'inline-block';
        
        updateUIForPhotographyRole();
    }

    function showLoggedOutUI() {
        elements.loginFields.style.display = 'flex';
        elements.userInfo.style.display = 'none';
        elements.mainContent.style.display = 'none';
        elements.totalWaitingContainer.style.display = 'none';
    }

    // --- Counter Settings ---
    async function checkAndSetCounterName() {
        const userPrefs = state.currentUser.prefs || {};
        if (!userPrefs.counter_name) {
            openCounterSettingsModal();
        }
    }

    function openCounterSettingsModal() {
        const userPrefs = state.currentUser.prefs || {};
        elements.counterNameInput.value = userPrefs.counter_name || '';
        elements.counterSettingsModal.style.display = 'flex';
    }

    function closeCounterSettingsModal() {
        elements.counterSettingsModal.style.display = 'none';
    }

    async function saveCounterSettings() {
        const counterName = elements.counterNameInput.value.trim();
        if (!counterName) {
            alert('لطفا شماره یا نام باجه را وارد کنید.');
            return;
        }

        try {
            const userPrefs = state.currentUser.prefs || {};
            await account.updatePrefs({ ...userPrefs, counter_name: counterName });
            state.currentUser.prefs = await account.getPrefs();
            closeCounterSettingsModal();
            showLoggedInUI();
            await fetchData();
        } catch (error) {
            console.error('Error saving counter settings:', error);
            alert('خطا در ذخیره تنظیمات باجه!');
        }
    }

    function updateUIForPhotographyRole() {
        const userPrefs = state.currentUser.prefs || {};
        const isPhotographyUser = userPrefs.role === 'photography';
        
        if (isPhotographyUser) {
            document.querySelector('.service-buttons-container').style.display = 'none';
            document.querySelector('.ticket-controls').style.display = 'none';
            document.querySelector('.ticket-history-container').style.display = 'none';
            document.querySelector('.current-tickets-container').style.display = 'none';
            document.querySelector('.photography-controls').style.display = 'flex';
            document.querySelector('.photography-history-container').style.display = 'block';
        } else {
            document.querySelector('.service-buttons-container').style.display = 'block';
            document.querySelector('.ticket-controls').style.display = 'flex';
            document.querySelector('.ticket-history-container').style.display = 'block';
            document.querySelector('.current-tickets-container').style.display = 'block';
            document.querySelector('.photography-controls').style.display = 'none';
            document.querySelector('.photography-history-container').style.display = 'none';
        }
    }

    // --- Event Handlers ---
    function setupEventListeners() {
        // Authentication
        elements.loginBtn.addEventListener('click', login);
        elements.logoutBtn.addEventListener('click', logout);
        
        // Ticket Management
        elements.submitTicketBtn.addEventListener('click', async () => {
            const mode = elements.ticketForm.dataset.mode;
            const firstName = document.getElementById('first-name').value.trim();
            const lastName = document.getElementById('last-name').value.trim();
            const nationalId = document.getElementById('national-id').value.trim();
            
            if (mode === 'regular') {
                const serviceId = elements.ticketForm.dataset.serviceId;
                await generateTicket(serviceId, firstName, lastName, nationalId);
            } else if (mode === 'pass') {
                const delayCount = parseInt(document.getElementById('pass-delay-count').value) || 0;
                await generatePassTicket(firstName, lastName, nationalId, delayCount);
            }
        });
        
        elements.cancelTicketBtn.addEventListener('click', closeTicketForm);
        
        // Ticket Controls
        elements.callNextBtn.addEventListener('click', callNextTicketWithOptions);
        
        elements.passTicketBtn.addEventListener('click', () => {
            openTicketForm('pass');
        });
        
        // Photography Modal
        elements.confirmPhotographyBtn.addEventListener('click', async () => {
            if (state.currentTicketForPhotography) {
                const nationalId = elements.photographyNationalIdInput.value.trim();
                const success = await addToPhotographyList(state.currentTicketForPhotography, nationalId);
                if (success) {
                    closePhotographyModal();
                }
            }
        });
        
        elements.cancelPhotographyBtn.addEventListener('click', closePhotographyModal);
        
        // Manual Photography
        elements.manualPhotographyBtn.addEventListener('click', () => {
            const ticketNumber = elements.manualTicketInput.value.trim();
            if (ticketNumber) {
                const mockTicket = {
                    $id: 'manual_' + Date.now(),
                    specific_ticket: ticketNumber,
                    general_ticket: '---',
                    first_name: '---',
                    last_name: '---',
                    service_id: 'manual',
                    ticket_type: 'manual'
                };
                openPhotographyModal(mockTicket);
                elements.manualTicketInput.value = '';
            } else {
                alert('لطفا شماره نوبت را وارد کنید.');
            }
        });
        
        // National ID Validation
        elements.photographyNationalIdInput.addEventListener('input', (e) => {
            validateNationalIdInput(e.target);
        });
        
        // Counter Settings
        elements.counterSettingsBtn.addEventListener('click', openCounterSettingsModal);
        elements.saveCounterBtn.addEventListener('click', saveCounterSettings);
        elements.cancelCounterBtn.addEventListener('click', closeCounterSettingsModal);
        
        // Past Ticket Call
        elements.callPastBtn.addEventListener('click', async () => {
            const pastTicketNumber = elements.pastTicketInput.value.trim();
            if (!pastTicketNumber) {
                alert('لطفا شماره نوبت را وارد کنید.');
                return;
            }
            
            const ticket = state.tickets.find(t => 
                t.specific_ticket === pastTicketNumber || 
                t.general_ticket === pastTicketNumber
            );
            
            if (!ticket) {
                alert('نوبتی با این شماره یافت نشد.');
                return;
            }
            
            if (ticket.status === 'در حال سرویس') {
                alert('این نوبت در حال حاضر در حال سرویس است.');
                return;
            }
            
            if (ticket.status === 'تکمیل شده') {
                alert('این نوبت قبلاً تکمیل شده است.');
                return;
            }
            
            try {
                const userPrefs = state.currentUser.prefs || {};
                const counterName = userPrefs.counter_name || 'باجه';
                await databases.updateDocument(DATABASE_ID, TICKETS_COLLECTION_ID, ticket.$id, {
                    status: 'در حال سرویس',
                    called_by: state.currentUser.$id,
                    called_by_name: state.currentUser.name,
                    called_by_counter_name: counterName,
                    call_time: new Date().toISOString()
                });
                
                await fetchTickets();
                showPopupNotification(`<p>نوبت ${ticket.specific_ticket} فراخوانی شد.</p>`);
                elements.pastTicketInput.value = '';
                
            } catch (error) {
                console.error('Error calling past ticket:', error);
                showPopupNotification('<p>خطا در فراخوانی نوبت!</p>');
            }
        });
    }

    // --- Initialization ---
    async function initializeApp() {
        try {
            state.currentUser = await account.get();
            state.currentUser.prefs = await account.getPrefs();
            
            showLoggedInUI();
            setupEventListeners();
            await checkAndSetCounterName();
            await fetchData();
            loadPhotographyList();
            loadPhotographyHistory();
        } catch (error) {
            console.error('Initialization failed:', error);
            showLoggedOutUI();
        }
    }

    // --- Auto-refresh ---
    setInterval(async () => {
        if (state.currentUser) {
            await fetchData();
        }
    }, 10000);

    // --- Initialize App ---
    initializeApp();
});