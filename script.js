// تابع بررسی صحت کد ملی
function checkCodeMeli(code) {
    if (!code || code === '---') return true;
    code = code.toString().replace(/\D/g, '');
    if (code.length !== 10) return false;
    if (/^(\d)\1{9}$/.test(code)) return false;
    
    var sum = 0;
    for (var i = 0; i < 9; i++) {
        sum += parseInt(code.charAt(i)) * (10 - i);
    }
    var lastDigit = parseInt(code.charAt(9));
    var remainder = sum % 11;
    
    return (remainder < 2 && lastDigit === remainder) || 
           (remainder >= 2 && lastDigit === (11 - remainder));
}

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings');
    const cancelSettingsBtn = document.getElementById('cancel-settings');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const userGreeting = document.getElementById('user-greeting');
    const loginFields = document.getElementById('login-fields');
    const userInfo = document.getElementById('user-info');
    const mainContent = document.getElementById('main-content');
    const adminPanel = document.getElementById('admin-panel');
    const serviceButtonsContainer = document.querySelector('.service-buttons');
    const ticketForm = document.getElementById('ticket-form');
    const submitTicketBtn = document.getElementById('submit-ticket');
    const cancelTicketBtn = document.getElementById('cancel-ticket');
    const callNextBtn = document.getElementById('call-next-btn');
    const resetAllBtn = document.getElementById('reset-all-btn');
    const serviceCheckboxes = document.getElementById('service-checkboxes');
    const currentTicketDisplay = document.getElementById('current-ticket');
    const currentTicketHeader = document.getElementById('current-ticket-header');
    const ticketHistoryTable = document.querySelector('#ticket-history tbody');
    const saveSettingsBtn = document.getElementById('save-settings');
    const addServiceBtn = document.getElementById('add-service-btn');
    const serviceList = document.getElementById('service-list');
    const defaultServiceTimeInput = document.getElementById('default-service-time');
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');

    // Application State
    let isAdmin = false;
    let currentUser = null;
    let generalTicketCounter = 1;
    let services = [
        { id: 1, name: "خدمت 1", start: 101, end: 199, time: 10 },
        { id: 2, name: "خدمت 2", start: 201, end: 299, time: 10 },
        { id: 3, name: "خدمت 3", start: 301, end: 399, time: 10 },
        { id: 4, name: "خدمت 4", start: 401, end: 499, time: 10 },
        { id: 5, name: "خدمت 5", start: 501, end: 599, time: 10 },
        { id: 6, name: "خدمت 6", start: 601, end: 699, time: 10 }
    ];
    let serviceTicketCounters = {};
    let waitingQueues = {};
    let activeTickets = {};
    let ticketHistory = [];
    let users = [
        { username: "admin", password: "admin123", isAdmin: true, serviceSelections: {} },
        { username: "user1", password: "user1123", isAdmin: false, serviceSelections: {} },
        { username: "user2", password: "user2123", isAdmin: false, serviceSelections: {} }
    ];
    let workHours = {
        start: "08:00",
        end: "17:00"
    };
    let defaultServiceTime = 10;

    // Initialize the app
    function init() {
        services.forEach(service => {
            serviceTicketCounters[service.id] = service.start;
            waitingQueues[service.id] = [];
            activeTickets[service.id] = null;
        });
        
        loadFromLocalStorage();
        renderServiceButtons();
        updateServiceCheckboxes();
        updateHistoryTable();
    }

    function loadFromLocalStorage() {
        const savedData = localStorage.getItem('ticketSystemData');
        if (savedData) {
            const data = JSON.parse(savedData);
            generalTicketCounter = data.generalTicketCounter || 1;
            serviceTicketCounters = data.serviceTicketCounters || {};
            waitingQueues = data.waitingQueues || {};
            activeTickets = data.activeTickets || {};
            ticketHistory = data.ticketHistory || [];
            services = data.services || [
                { id: 1, name: "خدمت 1", start: 101, end: 199, time: 10 },
                { id: 2, name: "خدمت 2", start: 201, end: 299, time: 10 },
                { id: 3, name: "خدمت 3", start: 301, end: 399, time: 10 },
                { id: 4, name: "خدمت 4", start: 401, end: 499, time: 10 },
                { id: 5, name: "خدمت 5", start: 501, end: 599, time: 10 },
                { id: 6, name: "خدمت 6", start: 601, end: 699, time: 10 }
            ];
            users = data.users || [
                { username: "admin", password: "admin123", isAdmin: true, serviceSelections: {} },
                { username: "user1", password: "user1123", isAdmin: false, serviceSelections: {} },
                { username: "user2", password: "user2123", isAdmin: false, serviceSelections: {} }
            ];
            workHours = data.workHours || { start: "08:00", end: "17:00" };
            defaultServiceTime = data.defaultServiceTime || 10;
        }
        
        // تنظیم مقادیر فرم تنظیمات
        startTimeInput.value = workHours.start;
        endTimeInput.value = workHours.end;
        defaultServiceTimeInput.value = defaultServiceTime;
    }

    function saveToLocalStorage() {
        const data = {
            generalTicketCounter,
            serviceTicketCounters,
            waitingQueues,
            activeTickets,
            ticketHistory,
            services,
            users,
            workHours,
            defaultServiceTime
        };
        localStorage.setItem('ticketSystemData', JSON.stringify(data));
    }

    function renderServiceButtons() {
        serviceButtonsContainer.innerHTML = '';
        services.forEach(service => {
            const button = document.createElement('button');
            button.className = 'service-btn';
            button.dataset.service = service.id;
            
            const serviceName = document.createElement('div');
            serviceName.className = 'service-name';
            serviceName.textContent = service.name;
            
            const waitingCount = document.createElement('div');
            waitingCount.className = 'waiting-count';
            waitingCount.textContent = `منتظران: ${waitingQueues[service.id].length}`;
            
            button.appendChild(serviceName);
            button.appendChild(waitingCount);
            
            button.addEventListener('click', function() {
                if (!currentUser) return;
                if (checkWorkingHours()) {
                    openTicketForm(service.id);
                } else {
                    showNotification('در حال حاضر خارج از ساعت کاری هستیم');
                }
            });
            
            serviceButtonsContainer.appendChild(button);
        });
    }

    function checkWorkingHours() {
        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        
        const [startHour, startMinute] = workHours.start.split(':').map(Number);
        const [endHour, endMinute] = workHours.end.split(':').map(Number);
        
        const currentTime = currentHours * 60 + currentMinutes;
        const startTime = startHour * 60 + startMinute;
        const endTime = endHour * 60 + endMinute;
        
        return currentTime >= startTime && currentTime <= endTime;
    }

    function updateServiceCheckboxes() {
        serviceCheckboxes.innerHTML = '';
        services.forEach(service => {
            const div = document.createElement('div');
            div.className = 'service-checkbox';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `service-${service.id}`;
            checkbox.value = service.id;
            
            if (currentUser && currentUser.serviceSelections[service.id]) {
                checkbox.checked = true;
            }
            
            checkbox.addEventListener('change', function() {
                if (currentUser) {
                    currentUser.serviceSelections[service.id] = this.checked;
                    saveToLocalStorage();
                }
            });
            
            const label = document.createElement('label');
            label.htmlFor = `service-${service.id}`;
            label.textContent = `${service.name} (${waitingQueues[service.id].length} نفر)`;
            
            div.appendChild(checkbox);
            div.appendChild(label);
            serviceCheckboxes.appendChild(div);
        });
    }

    function openTicketForm(serviceId) {
        ticketForm.dataset.service = serviceId;
        ticketForm.style.display = 'block';
        document.getElementById('first-name').focus();
    }

    function closeTicketForm() {
        ticketForm.style.display = 'none';
        document.getElementById('first-name').value = '';
        document.getElementById('last-name').value = '';
        document.getElementById('national-id').value = '';
    }

    function showNotification(message) {
        currentTicketHeader.textContent = message;
        currentTicketHeader.style.display = 'block';
        
        setTimeout(() => {
            currentTicketHeader.style.display = 'none';
        }, 5000);
    }

    function generateTicket(serviceId, firstName, lastName, nationalId) {
        if (nationalId && nationalId !== '---' && !checkCodeMeli(nationalId)) {
            alert('کد ملی وارد شده معتبر نیست');
            return null;
        }

        const generalTicket = generalTicketCounter++;
        let specificTicket = serviceTicketCounters[serviceId];
        const service = services.find(s => s.id === serviceId);
        
        if (specificTicket >= service.end) {
            specificTicket = service.start;
        } else {
            specificTicket++;
        }
        
        serviceTicketCounters[serviceId] = specificTicket;
        const now = new Date();
        
        // محاسبه تخمین زمان انتظار با استفاده از زمان سرویس اختصاصی
        let estimatedTime = waitingQueues[serviceId].length * service.time;
        
        const ticket = {
            generalTicket,
            specificTicket,
            serviceId,
            serviceName: service.name,
            firstName: firstName || '---',
            lastName: lastName || '---',
            nationalId: nationalId || '---',
            registrationTime: now,
            callTime: null,
            completionTime: null,
            status: 'در حال انتظار',
            calledBy: null,
            estimatedTime: estimatedTime + ' دقیقه'
        };
        
        waitingQueues[serviceId].push(ticket);
        ticketHistory.push(ticket);
        
        saveToLocalStorage();
        renderServiceButtons();
        updateServiceCheckboxes();
        updateHistoryTable();
        
        // نمایش پیام در هدر نوبت فعلی
        showNotification(`نوبت ${specificTicket} برای ${service.name} ثبت شد\nنام: ${firstName || '---'} ${lastName || '---'}\nکد ملی: ${nationalId || '---'}`);
        
        closeTicketForm();
        return ticket;
    }

    function callNextTicket() {
        if (!currentUser) return;
        
        const selectedServices = [];
        for (const serviceId in currentUser.serviceSelections) {
            if (currentUser.serviceSelections[serviceId]) {
                selectedServices.push(parseInt(serviceId));
            }
        }
        
        if (selectedServices.length === 0) {
            showNotification('لطفا حداقل یک خدمت را انتخاب کنید');
            return;
        }
        
        // پیدا کردن قدیمی‌ترین نوبت در خدمات انتخاب شده
        let oldestTicket = null;
        let selectedServiceId = null;
        
        selectedServices.forEach(serviceId => {
            if (waitingQueues[serviceId].length > 0) {
                const ticket = waitingQueues[serviceId][0]; // اولین نوبت در صف (قدیمی‌ترین)
                
                if (!oldestTicket || ticket.registrationTime < oldestTicket.registrationTime) {
                    oldestTicket = ticket;
                    selectedServiceId = serviceId;
                }
            }
        });
        
        if (!oldestTicket) {
            showNotification('هیچ نوبتی در صف انتظار وجود ندارد');
            return;
        }
        
        // تکمیل سرویس فعال برای این خدمت (اگر وجود دارد)
        if (activeTickets[selectedServiceId] && activeTickets[selectedServiceId].status === 'در حال سرویس') {
            const currentTicket = activeTickets[selectedServiceId];
            currentTicket.completionTime = new Date();
            currentTicket.status = 'اتمام سرویس';
            
            // به‌روزرسانی رکورد در تاریخچه
            const historyIndex = ticketHistory.findIndex(t => 
                t.generalTicket === currentTicket.generalTicket && 
                t.specificTicket === currentTicket.specificTicket
            );
            
            if (historyIndex !== -1) {
                ticketHistory[historyIndex] = {...currentTicket};
            }
        }
        
        // فراخوانی نوبت انتخاب شده
        waitingQueues[selectedServiceId].shift(); // حذف از صف انتظار
        oldestTicket.callTime = new Date();
        oldestTicket.status = 'در حال سرویس';
        oldestTicket.calledBy = currentUser.username;
        activeTickets[selectedServiceId] = oldestTicket;
        
        // به‌روزرسانی رکورد در تاریخچه
        const historyIndex = ticketHistory.findIndex(t => 
            t.generalTicket === oldestTicket.generalTicket && 
            t.specificTicket === oldestTicket.specificTicket
        );
        
        if (historyIndex !== -1) {
            ticketHistory[historyIndex] = {...oldestTicket};
        }
        
        updateCurrentTicketDisplay();
        saveToLocalStorage();
        renderServiceButtons();
        updateServiceCheckboxes();
        updateHistoryTable();
        
        showNotification(`نوبت ${oldestTicket.specificTicket} برای ${oldestTicket.serviceName} فراخوانی شد`);
    }

    function updateCurrentTicketDisplay() {
        currentTicketDisplay.innerHTML = '';
        
        let hasActiveTicket = false;
        
        services.forEach(service => {
            if (activeTickets[service.id] && activeTickets[service.id].status === 'در حال سرویس') {
                hasActiveTicket = true;
                const ticket = activeTickets[service.id];
                const div = document.createElement('div');
                div.className = 'current-ticket-item';
                div.innerHTML = `
                    <h3>${service.name}</h3>
                    <p><strong>نوبت:</strong> ${ticket.specificTicket}</p>
                    <p><strong>نام:</strong> ${ticket.firstName} ${ticket.lastName}</p>
                    <p><strong>کد ملی:</strong> ${ticket.nationalId}</p>
                    <p><strong>زمان فراخوان:</strong> ${formatTime(ticket.callTime)}</p>
                `;
                currentTicketDisplay.appendChild(div);
            }
        });
        
        if (!hasActiveTicket) {
            currentTicketDisplay.innerHTML = '<p style="text-align: center;">هیچ نوبتی در حال سرویس نیست</p>';
        }
    }

    function formatTime(date) {
        if (!date) return '---';
        return date.toLocaleTimeString('fa-IR');
    }

    function resetAllTickets() {
        if (!confirm('آیا مطمئن هستید که می‌خواهید همه نوبت‌ها را پاک کنید؟')) {
            return;
        }
        
        generalTicketCounter = 1;
        services.forEach(service => {
            serviceTicketCounters[service.id] = service.start;
            waitingQueues[service.id] = [];
            activeTickets[service.id] = null;
        });
        ticketHistory = [];
        
        // ریست انتخاب‌های کاربران
        users.forEach(user => {
            user.serviceSelections = {};
        });
        
        currentTicketDisplay.innerHTML = '<p style="text-align: center;">هیچ نوبتی در حال سرویس نیست</p>';
        
        saveToLocalStorage();
        renderServiceButtons();
        updateServiceCheckboxes();
        updateHistoryTable();
    }

    function updateHistoryTable() {
        ticketHistoryTable.innerHTML = '';
        
        let displayTickets = [...ticketHistory];
        
        // اضافه کردن نوبت‌های فعال
        services.forEach(service => {
            if (activeTickets[service.id] && activeTickets[service.id].status === 'در حال سرویس') {
                displayTickets.push(activeTickets[service.id]);
            }
        });
        
        // مرتب‌سازی بر اساس زمان
        displayTickets.sort((a, b) => {
            const timeA = a.callTime || a.registrationTime;
            const timeB = b.callTime || b.registrationTime;
            return timeB - timeA;
        });
        
        // نمایش
        displayTickets.slice(-50).forEach(ticket => {
            const row = document.createElement('tr');
            
            // تعیین کلاس وضعیت
            let statusClass = '';
            if (ticket.status === 'در حال انتظار') statusClass = 'status-waiting';
            else if (ticket.status === 'در حال سرویس') statusClass = 'status-active';
            else if (ticket.status === 'اتمام سرویس') statusClass = 'status-completed';
            
            row.innerHTML = `
                <td>${ticket.specificTicket}</td>
                <td>${ticket.firstName} ${ticket.lastName}</td>
                <td>${ticket.serviceName}</td>
                <td>${formatDate(ticket.registrationTime)}</td>
                <td class="${statusClass}">${ticket.status}</td>
            `;
            
            ticketHistoryTable.appendChild(row);
        });
    }

    function formatDate(date) {
        if (!date) return '---';
        return date.toLocaleTimeString('fa-IR') + ' ' + date.toLocaleDateString('fa-IR');
    }

    function login(username, password) {
        const user = users.find(u => u.username === username && u.password === password);
        if (!user) {
            alert('نام کاربری یا رمز عبور اشتباه است');
            return;
        }
        
        currentUser = user;
        isAdmin = user.isAdmin;
        
        usernameInput.value = '';
        passwordInput.value = '';
        
        loginFields.style.display = 'none';
        userInfo.style.display = 'flex';
        userGreeting.textContent = `کاربر: ${username}`;
        mainContent.style.display = 'block';
        
        // بارگذاری انتخاب‌های کاربر
        if (!currentUser.serviceSelections) {
            currentUser.serviceSelections = {};
        }
        
        renderServiceSettings();
        updateServiceCheckboxes();
        updateCurrentTicketDisplay();
    }

    function logout() {
        currentUser = null;
        isAdmin = false;
        
        loginFields.style.display = 'flex';
        userInfo.style.display = 'none';
        mainContent.style.display = 'none';
        adminPanel.style.display = 'none';
    }

    function renderServiceSettings() {
        serviceList.innerHTML = '';
        services.forEach(service => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td><input type="text" class="service-name" value="${service.name}" data-id="${service.id}"></td>
                <td><input type="number" class="service-start" value="${service.start}" data-id="${service.id}"></td>
                <td><input type="number" class="service-end" value="${service.end}" data-id="${service.id}"></td>
                <td><input type="number" class="service-time-input" value="${service.time}" data-id="${service.id}" min="1"></td>
                <td><button class="remove-service" data-id="${service.id}">حذف</button></td>
            `;
            
            serviceList.appendChild(row);
        });

        document.querySelectorAll('.remove-service').forEach(button => {
            button.addEventListener('click', function() {
                const serviceId = parseInt(this.dataset.id);
                if (confirm(`آیا مطمئن هستید که می‌خواهید خدمت ${serviceId} را حذف کنید؟`)) {
                    services = services.filter(s => s.id !== serviceId);
                    renderServiceSettings();
                    renderServiceButtons();
                    updateServiceCheckboxes();
                    saveToLocalStorage();
                }
            });
        });
    }

    function addNewService() {
        const newId = services.length > 0 ? Math.max(...services.map(s => s.id)) + 1 : 1;
        const newService = {
            id: newId,
            name: `خدمت ${newId}`,
            start: newId * 100 + 1,
            end: newId * 100 + 99,
            time: defaultServiceTime
        };
        
        services.push(newService);
        serviceTicketCounters[newId] = newService.start;
        waitingQueues[newId] = [];
        activeTickets[newId] = null;
        
        renderServiceSettings();
        renderServiceButtons();
        updateServiceCheckboxes();
        saveToLocalStorage();
    }

    function saveSettings() {
        // ذخیره تنظیمات خدمات
        document.querySelectorAll('.service-name').forEach(input => {
            const id = parseInt(input.dataset.id);
            const service = services.find(s => s.id === id);
            if (service) {
                service.name = input.value;
                service.start = parseInt(input.parentElement.parentElement.querySelector('.service-start').value);
                service.end = parseInt(input.parentElement.parentElement.querySelector('.service-end').value);
                service.time = parseInt(input.parentElement.parentElement.querySelector('.service-time-input').value);
            }
        });
        
        // ذخیره تنظیمات زمان
        workHours = {
            start: startTimeInput.value,
            end: endTimeInput.value
        };
        defaultServiceTime = parseInt(defaultServiceTimeInput.value) || 10;
        
        saveToLocalStorage();
        renderServiceButtons();
        updateServiceCheckboxes();
        
        showNotification('تنظیمات با موفقیت ذخیره شد');
        adminPanel.style.display = 'none';
    }

    // Event Listeners
    loginBtn.addEventListener('click', function() {
        login(usernameInput.value, passwordInput.value);
    });

    logoutBtn.addEventListener('click', logout);

    settingsBtn.addEventListener('click', function() {
        adminPanel.style.display = 'block';
    });

    closeSettingsBtn.addEventListener('click', function() {
        adminPanel.style.display = 'none';
    });

    cancelSettingsBtn.addEventListener('click', function() {
        adminPanel.style.display = 'none';
    });

    submitTicketBtn.addEventListener('click', function() {
        const firstName = document.getElementById('first-name').value;
        const lastName = document.getElementById('last-name').value;
        const nationalId = document.getElementById('national-id').value;
        
        const serviceId = parseInt(ticketForm.dataset.service);
        generateTicket(serviceId, firstName, lastName, nationalId);
    });

    cancelTicketBtn.addEventListener('click', closeTicketForm);

    callNextBtn.addEventListener('click', callNextTicket);

    resetAllBtn.addEventListener('click', resetAllTickets);

    addServiceBtn.addEventListener('click', addNewService);

    saveSettingsBtn.addEventListener('click', saveSettings);

    // Initialize the app
    init();
});
