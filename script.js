// تابع بررسی صحت کد ملی
function checkCodeMeli(code) {
    if (!code || code === '---') return true;
    code = code.toString().replace(/\D/g, '');
    if (code.length !== 10) return false;
    if (/^(\d)\1{9}$/.test(code)) return false;
    
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(code.charAt(i)) * (10 - i);
    }
    const lastDigit = parseInt(code.charAt(9));
    const remainder = sum % 11;
    
    return (remainder < 2 && lastDigit === remainder) || 
           (remainder >= 2 && lastDigit === (11 - remainder));
}

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const resetAllBtn = document.getElementById('reset-all-btn');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const userGreeting = document.getElementById('user-greeting');
    const loginFields = document.getElementById('login-fields');
    const userInfo = document.getElementById('user-info');
    const mainContent = document.getElementById('main-content');
    const serviceButtonsContainer = document.querySelector('.service-buttons');
    const ticketForm = document.getElementById('ticket-form');
    const ticketFormTitle = document.getElementById('ticket-form-title');
    const submitTicketBtn = document.getElementById('submit-ticket');
    const cancelTicketBtn = document.getElementById('cancel-ticket');
    const callNextBtn = document.getElementById('call-next-btn');
    const passTicketBtn = document.getElementById('pass-ticket-btn');
    const serviceCheckboxes = document.getElementById('service-checkboxes');
    const currentTicketDisplay = document.getElementById('current-ticket');
    const ticketNotification = document.getElementById('ticket-notification');
    const ticketHistoryTable = document.querySelector('#ticket-history tbody');

    // Modals & Panels
    const passServiceModalOverlay = document.getElementById('pass-service-modal-overlay');
    const passServiceList = document.getElementById('pass-service-list');
    const confirmPassServiceBtn = document.getElementById('confirm-pass-service');
    const cancelPassServiceBtn = document.getElementById('cancel-pass-service');
    
    const adminPanel = document.getElementById('admin-panel');
    const serviceList = document.getElementById('service-list');
    const addServiceBtn = document.getElementById('add-service-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const cancelSettingsBtn = document.getElementById('cancel-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings');


    // Application State
    let isAdmin = false;
    let currentUser = null;
    let generalTicketCounter = 1;
    let services = [];
    let serviceTicketCounters = {};
    let waitingQueues = {};
    let passedTickets = [];
    let activeTickets = {};
    let ticketHistory = [];
    let users = [];
    let tempSelectedServicesForPass = [];

    function init() {
        loadFromLocalStorage();
        
        // --- FIX START ---
        // Sanitize waitingQueues to prevent potential shared array references from corrupted data.
        // This ensures each service always has its own separate queue.
        const loadedQueues = waitingQueues || {};
        waitingQueues = {};
        // --- FIX END ---

        services.forEach(service => {
            if (!serviceTicketCounters[service.id]) serviceTicketCounters[service.id] = service.start;
            
            // --- FIX START ---
            // Reconstruct the waitingQueues object safely.
            // If a queue existed in the loaded data, copy its contents; otherwise, create a new empty array.
            waitingQueues[service.id] = loadedQueues[service.id] ? [...loadedQueues[service.id]] : [];
            // --- FIX END ---

            if (!activeTickets[service.id]) activeTickets[service.id] = null;
        });
        
        if(currentUser) {
            renderServiceButtons();
            updateServiceCheckboxes();
            updateHistoryTable();
            updateCurrentTicketDisplay();
        }
    }

    function loadFromLocalStorage() {
        const savedData = localStorage.getItem('ticketSystemData');
        const data = savedData ? JSON.parse(savedData) : {};

        generalTicketCounter = data.generalTicketCounter || 1;
        serviceTicketCounters = data.serviceTicketCounters || {};
        waitingQueues = data.waitingQueues || {};
        passedTickets = data.passedTickets || [];
        activeTickets = data.activeTickets || {};
        ticketHistory = data.ticketHistory || [];
        services = data.services || [
            { id: 1, name: "خدمت 1", start: 101, end: 199, time: 10, workHours: { start: "08:00", end: "17:00" } }
        ];
        users = data.users || [
            { username: "admin", password: "admin123", isAdmin: true, serviceSelections: {} },
            { username: "user1", password: "user1123", isAdmin: false, serviceSelections: {} }
        ];
    }

    function saveToLocalStorage() {
        const data = {
            generalTicketCounter, serviceTicketCounters, waitingQueues,
            passedTickets, activeTickets, ticketHistory, services, users,
        };
        localStorage.setItem('ticketSystemData', JSON.stringify(data));
    }

    function renderServiceButtons() {
        serviceButtonsContainer.innerHTML = '';
        services.forEach(service => {
            const button = document.createElement('button');
            button.className = 'service-btn';
            button.dataset.service = service.id;
            const waitingCount = waitingQueues[service.id]?.length || 0;
            button.innerHTML = `
                <div class="service-name">${service.name}</div>
                <div class="waiting-count">منتظران: ${waitingCount}</div>
            `;
            button.addEventListener('click', () => {
                if (!currentUser) return;
                openTicketForm('regular', service.id);
            });
            serviceButtonsContainer.appendChild(button);
        });
    }

    function updateServiceCheckboxes() {
        if (!currentUser) return;
        serviceCheckboxes.innerHTML = '';
        services.forEach(service => {
            const waitingCount = waitingQueues[service.id]?.length || 0;
            const div = document.createElement('div');
            div.className = 'service-checkbox';
            div.innerHTML = `
                <input type="checkbox" id="service-check-${service.id}" value="${service.id}">
                <label for="service-check-${service.id}">${service.name} (${waitingCount} نفر)</label>
            `;
            const checkbox = div.querySelector('input');
            checkbox.checked = currentUser.serviceSelections[service.id] || false;
            checkbox.addEventListener('change', () => {
                currentUser.serviceSelections[service.id] = checkbox.checked;
                saveToLocalStorage(); // Fix: Save selection immediately
            });
            serviceCheckboxes.appendChild(div);
        });
    }

    function openTicketForm(mode, serviceId = null) {
        ticketForm.dataset.mode = mode;
        if (mode === 'regular') {
            ticketForm.dataset.serviceId = serviceId;
            ticketFormTitle.textContent = 'ثبت نوبت جدید';
        } else {
            ticketFormTitle.textContent = 'ثبت اطلاعات شخص پاس داده شده';
        }
        ticketForm.style.display = 'block';
        document.getElementById('first-name').focus();
    }

    function closeTicketForm() {
        ticketForm.style.display = 'none';
        document.getElementById('first-name').value = '';
        document.getElementById('last-name').value = '';
        document.getElementById('national-id').value = '';
    }
    
    function showNotification(message, isPass = false) {
        ticketNotification.textContent = message;
        ticketNotification.classList.toggle('pass-notification', isPass);
        ticketNotification.style.display = 'block';

        setTimeout(() => {
            ticketNotification.style.display = 'none';
            ticketNotification.classList.remove('pass-notification');
        }, 3000);
    }

    function generateTicket(serviceId, firstName, lastName, nationalId) {
        if (nationalId && !checkCodeMeli(nationalId)) {
            alert('کد ملی وارد شده معتبر نیست'); return;
        }
        const service = services.find(s => s.id === serviceId);
        if (serviceTicketCounters[serviceId] >= service.end) {
            serviceTicketCounters[serviceId] = service.start;
        }
        const ticket = {
            generalTicket: generalTicketCounter++, specificTicket: serviceTicketCounters[serviceId]++,
            serviceId: service.id, serviceName: service.name,
            firstName: firstName || '---', lastName: lastName || '---', nationalId: nationalId || '---',
            registrationTime: new Date(), status: 'در حال انتظار', registeredBy: currentUser.username,
        };
        waitingQueues[serviceId].push(ticket);
        ticketHistory.push(ticket);
        saveToLocalStorage();
        renderServiceButtons(); updateServiceCheckboxes(); updateHistoryTable();
        showNotification(`نوبت ${ticket.specificTicket} برای ${service.name} ثبت شد.`);
        closeTicketForm();
    }

    function generatePassTicket(firstName, lastName, nationalId, passedServices) {
        if (!firstName && !lastName && !nationalId) {
            alert('باید حداقل نام، نام خانوادگی یا کد ملی را وارد کنید.'); return;
        }
        if (nationalId && !checkCodeMeli(nationalId)) {
            alert('کد ملی وارد شده معتبر نیست'); return;
        }
        passedServices.forEach(serviceId => {
            const service = services.find(s => s.id === serviceId);
            const passTicket = {
                type: 'pass', serviceId: service.id, serviceName: service.name,
                firstName: firstName || '---', lastName: lastName || '---', nationalId: nationalId || '---',
                registrationTime: new Date(), registeredBy: currentUser.username
            };
            passedTickets.push(passTicket);
            ticketHistory.push(passTicket);
        });
        saveToLocalStorage();
        updateHistoryTable();
        showNotification(`شخص با موفقیت به خدمات انتخاب شده پاس داده شد.`);
        closeTicketForm();
    }

    function callNextTicket() {
        if (!currentUser) return;
        const selectedServices = Object.keys(currentUser.serviceSelections).filter(id => currentUser.serviceSelections[id]).map(Number);
        if (selectedServices.length === 0) {
            showNotification('لطفا حداقل یک خدمت را برای فراخوانی انتخاب کنید'); return;
        }
        for (let i = 0; i < passedTickets.length; i++) {
            const passed = passedTickets[i];
            if (selectedServices.includes(passed.serviceId)) {
                passedTickets.splice(i, 1);
                const ticketToDisplay = { ...passed, status: 'در حال سرویس', calledBy: currentUser.username, callTime: new Date() };
                const historyIndex = ticketHistory.findIndex(t => t.type === 'pass' && t.registrationTime === passed.registrationTime);
                if(historyIndex > -1) ticketHistory[historyIndex] = ticketToDisplay;
                activeTickets[passed.serviceId] = ticketToDisplay;
                saveToLocalStorage(); updateCurrentTicketDisplay(); updateHistoryTable();
                showNotification(`فراخوانی شخص پاس داده شده: ${passed.firstName} ${passed.lastName} به ${passed.serviceName}`, true);
                return;
            }
        }
        let oldestTicket = null, serviceIdToCall = null;
        selectedServices.forEach(serviceId => {
            if (waitingQueues[serviceId]?.length > 0) {
                const ticket = waitingQueues[serviceId][0];
                if (!oldestTicket || new Date(ticket.registrationTime) < new Date(oldestTicket.registrationTime)) {
                    oldestTicket = ticket; serviceIdToCall = serviceId;
                }
            }
        });
        if (oldestTicket) {
            waitingQueues[serviceIdToCall].shift();
            const ticketToDisplay = { ...oldestTicket, status: 'در حال سرویس', calledBy: currentUser.username, callTime: new Date() };
            const historyIndex = ticketHistory.findIndex(t => t.generalTicket === oldestTicket.generalTicket);
            if (historyIndex > -1) ticketHistory[historyIndex] = ticketToDisplay;
            activeTickets[serviceIdToCall] = ticketToDisplay;
            saveToLocalStorage(); renderServiceButtons(); updateServiceCheckboxes(); updateHistoryTable(); updateCurrentTicketDisplay();
            showNotification(`نوبت ${oldestTicket.specificTicket} برای ${oldestTicket.serviceName} فراخوانی شد`);
        } else {
            showNotification('هیچ نوبتی در صف انتظار برای خدمات انتخابی شما وجود ندارد');
        }
    }

    function updateCurrentTicketDisplay() {
        currentTicketDisplay.innerHTML = '';
        let activeTicketsList = Object.values(activeTickets).filter(t => t && t.status === 'در حال سرویس');
        activeTicketsList.sort((a, b) => new Date(b.callTime) - new Date(a.callTime));
        activeTicketsList.slice(0, 3).forEach(ticket => {
            const div = document.createElement('div');
            div.className = 'current-ticket-item';
            div.innerHTML = `<h3>${ticket.serviceName}</h3>
                <p><strong>نوبت:</strong> ${ticket.specificTicket || 'پاس'}</p>
                <p><strong>نام:</strong> ${ticket.firstName} ${ticket.lastName}</p>
                <p><strong>زمان فراخوان:</strong> ${new Date(ticket.callTime).toLocaleTimeString('fa-IR')}</p>`;
            currentTicketDisplay.appendChild(div);
        });
        if (activeTicketsList.length === 0) {
            currentTicketDisplay.innerHTML = '<p style="text-align: center;">هیچ نوبتی در حال سرویس نیست</p>';
        }
    }
    
    function resetAllTickets() {
        if (!confirm('آیا مطمئن هستید که می‌خواهید همه نوبت‌ها و تاریخچه را پاک کنید؟ این عمل غیرقابل بازگشت است.')) return;
        generalTicketCounter = 1; passedTickets = []; ticketHistory = [];
        services.forEach(service => {
            serviceTicketCounters[service.id] = service.start;
            waitingQueues[service.id] = [];
            activeTickets[service.id] = null;
        });
        saveToLocalStorage();
        init();
    }

    function updateHistoryTable() {
        ticketHistoryTable.innerHTML = '';
        ticketHistory.sort((a, b) => new Date(b.callTime || b.registrationTime) - new Date(a.callTime || a.registrationTime));
        ticketHistory.slice(0, 50).forEach(ticket => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${ticket.generalTicket || 'پاس'}</td><td>${ticket.specificTicket || 'پاس'}</td>
                <td>${ticket.firstName} ${ticket.lastName}</td><td>${ticket.nationalId}</td><td>${ticket.serviceName}</td>
                <td>${ticket.registeredBy || '---'}</td><td>${formatDate(ticket.registrationTime)}</td>
                <td>${ticket.calledBy || '---'}</td><td>${formatDate(ticket.callTime)}</td>
                <td>${ticket.status || 'پاس شده'}</td>`;
            ticketHistoryTable.appendChild(row);
        });
    }

    function formatDate(date) {
        if (!date) return '---';
        const d = new Date(date);
        return `${d.toLocaleTimeString('fa-IR')} ${d.toLocaleDateString('fa-IR')}`;
    }

    function login(username, password) {
        const user = users.find(u => u.username === username && u.password === password);
        if (!user) { alert('نام کاربری یا رمز عبور اشتباه است'); return; }
        currentUser = user; isAdmin = user.isAdmin;
        loginFields.style.display = 'none'; userInfo.style.display = 'flex';
        userGreeting.textContent = `کاربر: ${username}`;
        mainContent.style.display = 'block';
        settingsBtn.style.display = isAdmin ? 'inline-block' : 'none';
        resetAllBtn.style.display = isAdmin ? 'inline-block' : 'none';
        if (!currentUser.serviceSelections) currentUser.serviceSelections = {};
        init();
    }

    function logout() {
        saveToLocalStorage(); currentUser = null; isAdmin = false;
        loginFields.style.display = 'flex'; userInfo.style.display = 'none';
        mainContent.style.display = 'none';
        settingsBtn.style.display = 'none'; resetAllBtn.style.display = 'none';
    }

    function openPassServiceModal() {
        passServiceList.innerHTML = '';
        services.forEach(service => {
            const div = document.createElement('div');
            div.className = 'service-checkbox';
            div.innerHTML = `<input type="checkbox" id="pass-check-${service.id}" value="${service.id}">
                             <label for="pass-check-${service.id}">${service.name}</label>`;
            passServiceList.appendChild(div);
        });
        passServiceModalOverlay.style.display = 'flex';
    }
    
    // --- Settings Panel Functions ---
    function renderServiceSettings() {
        serviceList.innerHTML = '';
        services.forEach(service => {
            const row = document.createElement('tr');
            row.dataset.id = service.id;
            row.innerHTML = `
                <td><input type="text" value="${service.name}" class="setting-name"></td>
                <td><input type="number" value="${service.start}" class="setting-start"></td>
                <td><input type="number" value="${service.end}" class="setting-end"></td>
                <td><input type="number" value="${service.time}" class="setting-time"></td>
                <td><input type="time" value="${service.workHours.start}" class="setting-work-start"></td>
                <td><input type="time" value="${service.workHours.end}" class="setting-work-end"></td>
                <td><button class="remove-service-btn">حذف</button></td>`;
            serviceList.appendChild(row);
        });
        serviceList.querySelectorAll('.remove-service-btn').forEach(b => b.addEventListener('click', () => b.closest('tr').remove()));
    }

    function addNewService() {
        const newId = services.length > 0 ? Math.max(...services.map(s => s.id)) + 1 : 1;
        const row = document.createElement('tr');
        row.dataset.id = newId;
        row.innerHTML = `
            <td><input type="text" value="خدمت جدید" class="setting-name"></td>
            <td><input type="number" value="${newId * 100 + 1}" class="setting-start"></td>
            <td><input type="number" value="${newId * 100 + 99}" class="setting-end"></td>
            <td><input type="number" value="10" class="setting-time"></td>
            <td><input type="time" value="08:00" class="setting-work-start"></td>
            <td><input type="time" value="17:00" class="setting-work-end"></td>
            <td><button class="remove-service-btn">حذف</button></td>`;
        serviceList.appendChild(row);
        row.querySelector('.remove-service-btn').addEventListener('click', () => row.remove());
    }

    function saveSettings() {
        const newServices = [];
        serviceList.querySelectorAll('tr').forEach(row => {
            newServices.push({
                id: parseInt(row.dataset.id), name: row.querySelector('.setting-name').value,
                start: parseInt(row.querySelector('.setting-start').value), end: parseInt(row.querySelector('.setting-end').value),
                time: parseInt(row.querySelector('.setting-time').value),
                workHours: { start: row.querySelector('.setting-work-start').value, end: row.querySelector('.setting-work-end').value }
            });
        });
        services = newServices;
        saveToLocalStorage();
        init();
        adminPanel.style.display = 'none';
        showNotification('تنظیمات با موفقیت ذخیره شد.');
    }

    // --- Event Listeners ---
    loginBtn.addEventListener('click', () => login(usernameInput.value, passwordInput.value));
    logoutBtn.addEventListener('click', logout);
    settingsBtn.addEventListener('click', () => { if (isAdmin) { renderServiceSettings(); adminPanel.style.display = 'block'; }});
    resetAllBtn.addEventListener('click', resetAllTickets);
    passTicketBtn.addEventListener('click', () => { if (currentUser) openPassServiceModal(); });
    cancelPassServiceBtn.addEventListener('click', () => passServiceModalOverlay.style.display = 'none');
    confirmPassServiceBtn.addEventListener('click', () => {
        const selected = passServiceList.querySelectorAll('input:checked');
        if (selected.length === 0) { alert('لطفا حداقل یک خدمت را انتخاب کنید.'); return; }
        tempSelectedServicesForPass = Array.from(selected).map(cb => parseInt(cb.value));
        passServiceModalOverlay.style.display = 'none';
        openTicketForm('pass');
    });
    submitTicketBtn.addEventListener('click', () => {
        const mode = ticketForm.dataset.mode;
        const firstName = document.getElementById('first-name').value.trim();
        const lastName = document.getElementById('last-name').value.trim();
        const nationalId = document.getElementById('national-id').value.trim();
        if (mode === 'regular') {
            generateTicket(parseInt(ticketForm.dataset.serviceId), firstName, lastName, nationalId);
        } else if (mode === 'pass') {
            generatePassTicket(firstName, lastName, nationalId, tempSelectedServicesForPass);
        }
    });
    cancelTicketBtn.addEventListener('click', closeTicketForm);
    callNextBtn.addEventListener('click', callNextTicket);
    addServiceBtn.addEventListener('click', addNewService);
    saveSettingsBtn.addEventListener('click', saveSettings);
    cancelSettingsBtn.addEventListener('click', () => adminPanel.style.display = 'none');
    closeSettingsBtn.addEventListener('click', () => adminPanel.style.display = 'none');

    init();
});