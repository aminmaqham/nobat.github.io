// تابع بررسی صحت کد ملی
function checkCodeMeli(code) {
    if (!code || code === '---') return true;
    code = code.toString().replace(/\D/g, ''); /*cite: 2*/
    if (code.length !== 10) return false; /*cite: 2*/
    if (/^(\d)\1{9}$/.test(code)) return false; /*cite: 2*/
    
    let sum = 0;
    for (let i = 0; i < 9; i++) { /*cite: 3*/
        sum += parseInt(code.charAt(i)) * (10 - i); /*cite: 3*/
    }
    const lastDigit = parseInt(code.charAt(9)); /*cite: 4*/
    const remainder = sum % 11; /*cite: 4*/
    return (remainder < 2 && lastDigit === remainder) || 
           (remainder >= 2 && lastDigit === (11 - remainder)); /*cite: 5*/
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
    const submitTicketBtn = document.getElementById('submit-ticket'); /*cite: 7*/
    const cancelTicketBtn = document.getElementById('cancel-ticket'); /*cite: 7*/
    const callNextBtn = document.getElementById('call-next-btn'); /*cite: 7*/
    const passTicketBtn = document.getElementById('pass-ticket-btn'); /*cite: 7*/
    const serviceCheckboxes = document.getElementById('service-checkboxes'); /*cite: 8*/
    const currentTicketDisplay = document.getElementById('current-ticket');
    const popupNotification = document.getElementById('popup-notification');
    const popupText = document.getElementById('popup-text');
    const totalWaitingContainer = document.getElementById('total-waiting-container');
    const ticketHistoryTable = document.querySelector('#ticket-history tbody');

    // Modals & Panels
    const passServiceModalOverlay = document.getElementById('pass-service-modal-overlay'); /*cite: 9*/
    const passServiceList = document.getElementById('pass-service-list'); /*cite: 9*/
    const confirmPassServiceBtn = document.getElementById('confirm-pass-service'); /*cite: 9*/
    const cancelPassServiceBtn = document.getElementById('cancel-pass-service'); /*cite: 10*/
    const adminPanel = document.getElementById('admin-panel');
    const serviceList = document.getElementById('service-list');
    const addServiceBtn = document.getElementById('add-service-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const cancelSettingsBtn = document.getElementById('cancel-settings-btn'); /*cite: 11*/
    const closeSettingsBtn = document.getElementById('close-settings'); /*cite: 11*/

    // Application State
    let isAdmin = false;
    let currentUser = null; /*cite: 12*/
    let generalTicketCounter = 1;
    let services = [];
    let serviceTicketCounters = {};
    let waitingQueues = {};
    let passedTickets = []; /*cite: 13*/
    let activeTickets = {};
    let ticketHistory = [];
    let users = [];
    let tempSelectedServicesForPass = [];
    let lastCallTimePerUser = {}; /*cite: 14*/

    function init() {
        loadFromLocalStorage();
        const loadedQueues = waitingQueues || {}; /*cite: 14, 15*/
        waitingQueues = {};

        services.forEach(service => {
            if (!serviceTicketCounters[service.id]) serviceTicketCounters[service.id] = service.start;
            waitingQueues[service.id] = loadedQueues[service.id] ? [...loadedQueues[service.id]] : [];
            if (!activeTickets[service.id]) activeTickets[service.id] = null;
            if (!service.smartTime) service.smartTime = service.manualTime;
        });
        if (currentUser) { /*cite: 16*/
            renderUI(); /*cite: 16*/
        }
    }

    function renderUI() {
        renderServiceButtons();
        updateServiceCheckboxes(); /*cite: 18*/
        updateHistoryTable();
        updateCurrentTicketDisplay();
        updateTotalWaitingCount();
    }

    function updateTotalWaitingCount() {
        if (!totalWaitingContainer) return;
        const totalCount = Object.values(waitingQueues).reduce((sum, queue) => sum + queue.length, 0); /*cite: 19*/
        document.getElementById('total-waiting-count').textContent = totalCount; /*cite: 19*/
    }

    function loadFromLocalStorage() {
        const savedData = localStorage.getItem('ticketSystemData'); /*cite: 20*/
        const data = savedData ? JSON.parse(savedData) : {}; /*cite: 21*/

        generalTicketCounter = data.generalTicketCounter || 1;
        serviceTicketCounters = data.serviceTicketCounters || {}; /*cite: 21*/
        waitingQueues = data.waitingQueues || {}; /*cite: 22*/
        passedTickets = data.passedTickets || []; /*cite: 22*/
        activeTickets = data.activeTickets || {}; /*cite: 22*/
        ticketHistory = data.ticketHistory || []; /*cite: 22*/
        services = data.services || [ /*cite: 23*/
            { id: 1, name: "خدمت 1", start: 101, end: 199, manualTime: 10, smartTime: 10, estimationMode: 'manual', workHours: { start: "08:00", end: "17:00" } } /*cite: 23*/
        ];
        users = data.users || [ /*cite: 24*/
            { username: "admin", password: "admin123", isAdmin: true, serviceSelections: {} }, /*cite: 24*/
            { username: "user1", password: "user1123", isAdmin: false, serviceSelections: {} } /*cite: 24*/
        ];
    }

    function saveToLocalStorage() {
        const data = {
            generalTicketCounter, serviceTicketCounters, waitingQueues,
            passedTickets, activeTickets, ticketHistory, services, users,
        };
        localStorage.setItem('ticketSystemData', JSON.stringify(data)); /*cite: 26*/
    }

    function showPopupNotification(htmlContent) {
        popupText.innerHTML = htmlContent; /*cite: 26*/
        popupNotification.style.display = 'flex'; /*cite: 27*/
        setTimeout(() => popupNotification.classList.add('show'), 10); /*cite: 27*/

        popupNotification.addEventListener('click', function closeHandler() {
            popupNotification.classList.remove('show');
            setTimeout(() => popupNotification.style.display = 'none', 300);
            popupNotification.removeEventListener('click', closeHandler);
        });
    }

    function getEstimation(service) {
        const time = service.estimationMode === 'smart' ? /*cite: 28*/
        service.smartTime : service.manualTime; /*cite: 29*/
        return Math.round(time); /*cite: 29*/
    }

    function calculateEstimatedWaitTime(serviceId) {
        const service = services.find(s => s.id === serviceId); /*cite: 29*/
        if (!service) return 0; /*cite: 30*/
        const timePerTicket = getEstimation(service); /*cite: 30*/
        const queueLength = waitingQueues[serviceId]?.length || 0; /*cite: 30*/
        return queueLength * timePerTicket; /*cite: 30*/
    }

    function checkAvailability(serviceId) {
        const service = services.find(s => s.id === serviceId); /*cite: 31*/
        const now = new Date(); /*cite: 32*/
        const endHour = parseInt(service.workHours.end.split(':')[0]); /*cite: 32*/
        const endMinute = parseInt(service.workHours.end.split(':')[1]); /*cite: 32*/
        const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute); /*cite: 33*/

        if (now >= endTime) {
            if(confirm('ساعت کاری این باجه به پایان رسیده است. آیا مایل به ثبت نوبت هستید؟')) {
                openTicketForm('regular', service.id); /*cite: 33*/
            }
            return; /*cite: 34*/
        }

        const minutesRemaining = (endTime - now) / (1000 * 60); /*cite: 35*/
        const timeForQueue = calculateEstimatedWaitTime(serviceId); /*cite: 36*/
        const timeForNewTicket = getEstimation(service); /*cite: 36*/
        const totalTimeNeeded = timeForQueue + timeForNewTicket; /*cite: 36*/
        if (totalTimeNeeded > minutesRemaining) { /*cite: 37*/
             if(confirm(`!هشدار: زمان مورد نیاز برای نوبت شما (${Math.round(totalTimeNeeded)} دقیقه) از زمان کاری باجه بیشتر است. آیا مایل به ثبت نوبت هستید؟`)) {
                openTicketForm('regular', service.id); /*cite: 37*/
            }
        } else {
            openTicketForm('regular', service.id); /*cite: 38*/
        }
    }

    function renderServiceButtons() {
        serviceButtonsContainer.innerHTML = ''; /*cite: 39*/
        services.forEach(service => { /*cite: 40*/
            const button = document.createElement('button');
            button.className = 'service-btn';
            
            const waitingCount = waitingQueues[service.id]?.length || 0;
            const estimationTime = getEstimation(service);
            const estimationModeText = service.estimationMode === 'smart' ? 'تخمین هوشمند' : 'تخمین دستی';

            button.innerHTML = `
                <div>
                    <div class="service-name">${service.name}</div>
                    <div class="waiting-count">منتظران: ${waitingCount}</div>
                </div>
                <div class="estimation-time">${estimationModeText}: ${estimationTime} دقیقه</div>
            `; /*cite: 41, 42*/
            button.addEventListener('click', () => {
                if (!currentUser) return;
                checkAvailability(service.id);
            });
            serviceButtonsContainer.appendChild(button);
        });
    }

    function updateServiceCheckboxes() {
        if (!currentUser) return;
        serviceCheckboxes.innerHTML = ''; /*cite: 43*/
        services.forEach(service => { /*cite: 44*/
            const waitingCount = waitingQueues[service.id]?.length || 0; /*cite: 44*/
            const div = document.createElement('div');
            div.className = 'service-checkbox';
            div.innerHTML = `
                <input type="checkbox" id="service-check-${service.id}" value="${service.id}">
                <label for="service-check-${service.id}">
                    ${service.name} 
                    (<span class="waiting-count-label">${waitingCount} نفر</span>)
                </label>
            `; /*cite: 44, 45*/
            const checkbox = div.querySelector('input');
            checkbox.checked = currentUser.serviceSelections[service.id] || false; /*cite: 45, 46*/
            checkbox.addEventListener('change', () => {
                currentUser.serviceSelections[service.id] = checkbox.checked;
                saveToLocalStorage();
            });
            serviceCheckboxes.appendChild(div);
        });
    }

    function openTicketForm(mode, serviceId = null) {
        const passDelayGroup = document.getElementById('pass-delay-group');
        ticketForm.dataset.mode = mode; /*cite: 47*/
        if (mode === 'regular') {
            ticketForm.dataset.serviceId = serviceId; /*cite: 48*/
            ticketFormTitle.textContent = 'ثبت نوبت جدید'; /*cite: 49*/
            passDelayGroup.style.display = 'none';
        } else {
            ticketFormTitle.textContent = 'ثبت اطلاعات شخص پاس داده شده'; /*cite: 49*/
            passDelayGroup.style.display = 'block';
            document.getElementById('pass-delay-count').value = 0;
        }
        ticketForm.style.display = 'block';
        document.getElementById('first-name').focus(); /*cite: 50*/
    }

    function closeTicketForm() {
        ticketForm.style.display = 'none'; /*cite: 51*/
        document.getElementById('first-name').value = ''; /*cite: 51*/
        document.getElementById('last-name').value = ''; /*cite: 52*/
        document.getElementById('national-id').value = '';
    }
    
    function generateTicket(serviceId, firstName, lastName, nationalId) {
        if (nationalId && !checkCodeMeli(nationalId)) {
            alert('کد ملی وارد شده معتبر نیست');
            return; /*cite: 53*/
        }
        const service = services.find(s => s.id === serviceId); /*cite: 53*/
        const estimatedWait = calculateEstimatedWaitTime(serviceId); /*cite: 54*/

        if (serviceTicketCounters[serviceId] >= service.end) {
            serviceTicketCounters[serviceId] = service.start; /*cite: 54*/
        }
        const ticket = {
            generalTicket: generalTicketCounter++, specificTicket: serviceTicketCounters[serviceId]++, /*cite: 55*/
            serviceId: service.id, serviceName: service.name, /*cite: 55*/
            firstName: firstName || '---', lastName: lastName || '---', nationalId: nationalId || '---', /*cite: 55, 56*/
            registrationTime: new Date(), status: 'در حال انتظار', registeredBy: currentUser.username, /*cite: 56*/
        };
        waitingQueues[serviceId].push(ticket); /*cite: 57*/
        ticketHistory.push(ticket); /*cite: 57*/
        
        saveToLocalStorage();
        renderUI();
        
        const popupMessage = `
            <span class="ticket-number">نوبت شما: ${ticket.specificTicket}</span>
            <p style="margin: 5px 0;">(نوبت کلی: ${ticket.generalTicket})</p>
            <p style="margin: 10px 0;">برای: ${ticket.firstName} ${ticket.lastName}</p>
            ${ticket.nationalId !== '---' ? `<p style="margin: 5px 0; font-size: 14px;">کدملی: ${ticket.nationalId}</p>` : ''}
            برای خدمت «${service.name}» ثبت شد.
            <span class="wait-time">زمان تخمینی انتظار: ${Math.round(estimatedWait)} دقیقه</span>
        `; /*cite: 57, 58*/
        showPopupNotification(popupMessage);
        closeTicketForm(); /*cite: 58*/
    }

    function generatePassTicket(firstName, lastName, nationalId, passedServices) {
        if (!firstName && !lastName && !nationalId) {
            alert('باید حداقل نام، نام خانوادگی یا کد ملی را وارد کنید.');
            return; /*cite: 59*/
        }
        if (nationalId && !checkCodeMeli(nationalId)) {
            alert('کد ملی وارد شده معتبر نیست');
            return; /*cite: 60*/
        }
        const delayCount = parseInt(document.getElementById('pass-delay-count').value) || 0;
        passedServices.forEach(serviceId => {
            const service = services.find(s => s.id === serviceId);
            const passTicket = {
                type: 'pass', serviceId: service.id, serviceName: service.name,
                firstName: firstName || '---', lastName: lastName || '---', nationalId: nationalId || '---',
                registrationTime: new Date(), registeredBy: currentUser.username, /*cite: 62*/
                delayCount: delayCount 
            };
            passedTickets.push(passTicket); /*cite: 62*/
            ticketHistory.push(passTicket); /*cite: 62*/
        });
        saveToLocalStorage(); /*cite: 63*/
        renderUI();
        showPopupNotification(`<p>شخص با موفقیت به خدمات انتخاب شده پاس داده شد.</p>`);
        closeTicketForm(); /*cite: 63*/
    }
    
    function updateSmartTime(serviceId, durationMinutes) {
        if (!serviceId || !durationMinutes || durationMinutes <= 0) return; /*cite: 64*/
        const service = services.find(s => s.id === serviceId); /*cite: 65*/
        if (!service || service.estimationMode !== 'smart') return; /*cite: 65*/
        service.smartTime = (service.smartTime * 0.8) + (durationMinutes * 0.2); /*cite: 66*/
        saveToLocalStorage();
        renderServiceButtons();
    }

    function callNextTicket() {
        if (!currentUser) return; /*cite: 67*/
        const selectedServices = Object.keys(currentUser.serviceSelections).filter(id => currentUser.serviceSelections[id]).map(Number); /*cite: 68*/
        if (selectedServices.length === 0) {
            showPopupNotification('<p>لطفا حداقل یک خدمت را برای فراخوانی انتخاب کنید.</p>'); /*cite: 68*/
            return; /*cite: 69*/
        }

        const lastCallTime = lastCallTimePerUser[currentUser.username];
        const now = new Date(); /*cite: 69*/
        if (lastCallTime) { /*cite: 70*/
            const lastTicket = Object.values(activeTickets).flat().find(t => t && t.calledBy === currentUser.username && new Date(t.callTime).getTime() === lastCallTime.getTime()); /*cite: 70*/
            if (lastTicket) { /*cite: 71*/
                const durationMinutes = (now - lastCallTime) / (1000 * 60); /*cite: 71*/
                if (durationMinutes > 0.5 && durationMinutes < 120) {  /*cite: 72*/
                    updateSmartTime(lastTicket.serviceId, durationMinutes); /*cite: 72*/
                }
            }
        }
        lastCallTimePerUser[currentUser.username] = now; /*cite: 73*/

        // 1. Check for a passed ticket with delayCount === 0
        for (let i = 0; i < passedTickets.length; i++) {
            const passed = passedTickets[i];
            if (selectedServices.includes(passed.serviceId) && passed.delayCount === 0) { /*cite: 75*/
                passedTickets.splice(i, 1); /*cite: 75*/
                const ticketToDisplay = { ...passed, status: 'در حال سرویس', calledBy: currentUser.username, callTime: new Date() }; /*cite: 76*/
                const historyIndex = ticketHistory.findIndex(t => t.type === 'pass' && t.registrationTime === passed.registrationTime); /*cite: 77*/
                if(historyIndex > -1) ticketHistory[historyIndex] = ticketToDisplay; /*cite: 77*/
                activeTickets[passed.serviceId] = ticketToDisplay; /*cite: 78*/
                saveToLocalStorage(); 
                renderUI();
                showPopupNotification(`
                    <span class="ticket-number">فراخوان: پاس</span>
                    <p style="margin: 5px 0;">${passed.firstName} ${passed.lastName}</p>
                    ${passed.nationalId !== '---' ? `<p style="margin: 5px 0; font-size: 14px;">کدملی: ${passed.nationalId}</p>` : ''}
                    به خدمت «${passed.serviceName}»
                `); /*cite: 78*/
                return; /*cite: 79*/
            }
        }

        // 2. Find the oldest regular ticket
        let oldestTicket = null, serviceIdToCall = null;
        selectedServices.forEach(serviceId => { /*cite: 80*/
            if (waitingQueues[serviceId]?.length > 0) {
                const ticket = waitingQueues[serviceId][0];
                if (!oldestTicket || new Date(ticket.registrationTime) < new Date(oldestTicket.registrationTime)) {
                    oldestTicket = ticket; serviceIdToCall = serviceId;
                }
            }
        });

        // 3. If a regular ticket is found, call it and decrement passed ticket counters
        if (oldestTicket) { /*cite: 82*/
            // Decrement counters for passed tickets of the same service
            passedTickets.forEach(p => {
                if (p.serviceId === serviceIdToCall && p.delayCount > 0) {
                    p.delayCount--;
                }
            });

            waitingQueues[serviceIdToCall].shift(); /*cite: 82*/
            const ticketToDisplay = { ...oldestTicket, status: 'در حال سرویس', calledBy: currentUser.username, callTime: new Date() }; /*cite: 83*/
            const historyIndex = ticketHistory.findIndex(t => t.generalTicket === oldestTicket.generalTicket); /*cite: 84*/
            if (historyIndex > -1) ticketHistory[historyIndex] = ticketToDisplay; /*cite: 84*/
            activeTickets[serviceIdToCall] = ticketToDisplay; /*cite: 84*/
            saveToLocalStorage(); 
            renderUI();
            showPopupNotification(`
                <span class="ticket-number">فراخوان: ${oldestTicket.specificTicket}</span>
                <p style="margin: 5px 0;">${oldestTicket.firstName} ${oldestTicket.lastName}</p>
                ${oldestTicket.nationalId !== '---' ? `<p style="margin: 5px 0; font-size: 14px;">کدملی: ${oldestTicket.nationalId}</p>` : ''}
                به خدمت «${oldestTicket.serviceName}»
            `); /*cite: 85*/
        } else {
            showPopupNotification('<p>هیچ نوبتی در صف انتظار برای خدمات انتخابی شما وجود ندارد.</p>'); /*cite: 86*/
        }
    }

    function updateCurrentTicketDisplay() {
        currentTicketDisplay.innerHTML = ''; /*cite: 87*/
        let activeTicketsList = Object.values(activeTickets).flat().filter(t => t && t.status === 'در حال سرویس'); /*cite: 88*/
        activeTicketsList.sort((a, b) => new Date(b.callTime) - new Date(a.callTime)); /*cite: 88*/
        activeTicketsList.slice(0, 3).forEach(ticket => { /*cite: 89*/
            const div = document.createElement('div');
            div.className = 'current-ticket-item';
            div.innerHTML = `<h3>${ticket.serviceName}</h3>
                <p><strong>نوبت:</strong> ${ticket.specificTicket || 'پاس'}</p>
                <p><strong>نام:</strong> ${ticket.firstName} ${ticket.lastName}</p>
                <p><strong>زمان 
فراخوان:</strong> ${new Date(ticket.callTime).toLocaleTimeString('fa-IR')}</p>`; /*cite: 89, 90*/
            currentTicketDisplay.appendChild(div);
        });
        if (activeTicketsList.length === 0) { /*cite: 91*/
            currentTicketDisplay.innerHTML = '<p style="text-align: center;">هیچ نوبتی در حال سرویس نیست</p>'; /*cite: 91*/
        }
    }
    
    function resetAllTickets() {
        if (!confirm('آیا مطمئن هستید که می‌خواهید همه نوبت‌ها و تاریخچه را پاک کنید؟ این عمل غیرقابل بازگشت است.')) return; /*cite: 92*/
        generalTicketCounter = 1; passedTickets = []; ticketHistory = []; /*cite: 93*/
        services.forEach(service => {
            serviceTicketCounters[service.id] = service.start;
            waitingQueues[service.id] = [];
            activeTickets[service.id] = null;
        });
        saveToLocalStorage(); /*cite: 94*/
        location.reload(); /*cite: 94*/
    }

    function updateHistoryTable() {
        ticketHistoryTable.innerHTML = ''; /*cite: 94*/
        ticketHistory.sort((a, b) => new Date(b.callTime || b.registrationTime) - new Date(a.callTime || a.registrationTime)); /*cite: 95*/
        ticketHistory.slice(0, 50).forEach(ticket => { /*cite: 96*/
            const row = document.createElement('tr');
            row.innerHTML = `<td>${ticket.generalTicket || 'پاس'}</td><td>${ticket.specificTicket || 'پاس'}</td>
                <td>${ticket.firstName} ${ticket.lastName}</td><td>${ticket.nationalId}</td><td>${ticket.serviceName}</td>
                <td>${ticket.registeredBy || '---'}</td><td>${formatDate(ticket.registrationTime)}</td>
                <td>${ticket.calledBy || '---'}</td><td>${formatDate(ticket.callTime)}</td>
                 <td>${ticket.status || 'پاس شده'}</td>`; /*cite: 96, 97*/
            ticketHistoryTable.appendChild(row);
        });
    }

    function formatDate(date) {
        if (!date) return '---'; /*cite: 98*/
        const d = new Date(date); /*cite: 99*/
        return `${d.toLocaleTimeString('fa-IR')} ${d.toLocaleDateString('fa-IR')}`; /*cite: 99*/
    }

    function login(username, password) {
        const user = users.find(u => u.username === username && u.password === password); /*cite: 99*/
        if (!user) { alert('نام کاربری یا رمز عبور اشتباه است'); return; /*cite: 100*/
        }
        currentUser = user; isAdmin = user.isAdmin; /*cite: 101*/
        loginFields.style.display = 'none'; userInfo.style.display = 'flex'; /*cite: 101*/
        userGreeting.textContent = `کاربر: ${username}`; /*cite: 102*/
        mainContent.style.display = 'block'; /*cite: 102*/
        totalWaitingContainer.style.display = 'block'; /*cite: 102*/
        settingsBtn.style.display = isAdmin ? 'inline-block' : 'none'; /*cite: 102*/
        resetAllBtn.style.display = isAdmin ? 'inline-block' : 'none'; /*cite: 103*/
        if (!currentUser.serviceSelections) currentUser.serviceSelections = {}; /*cite: 103*/
        init();
    }

    function logout() {
        saveToLocalStorage(); currentUser = null; /*cite: 104*/
        isAdmin = false; /*cite: 105*/
        loginFields.style.display = 'flex'; userInfo.style.display = 'none'; /*cite: 105*/
        mainContent.style.display = 'none'; /*cite: 105*/
        totalWaitingContainer.style.display = 'none'; /*cite: 105*/
        settingsBtn.style.display = 'none'; /*cite: 105*/
        resetAllBtn.style.display = 'none'; /*cite: 106*/
        lastCallTimePerUser = {}; /*cite: 106*/
    }

    function openPassServiceModal() {
        passServiceList.innerHTML = ''; /*cite: 106*/
        services.forEach(service => { /*cite: 107*/
            const div = document.createElement('div');
            div.className = 'service-checkbox';
            div.innerHTML = `<input type="checkbox" id="pass-check-${service.id}" value="${service.id}">
                             <label for="pass-check-${service.id}">${service.name}</label>`;
            passServiceList.appendChild(div);
        });
        passServiceModalOverlay.style.display = 'flex'; /*cite: 108*/
    }
    
    function renderServiceSettings() {
        serviceList.innerHTML = ''; /*cite: 108*/
        services.forEach(service => { /*cite: 109*/
            const row = document.createElement('tr');
            row.dataset.id = service.id;
            row.innerHTML = `
                <td><input type="text" value="${service.name}" class="setting-name"></td>
                <td><input type="number" value="${service.start}" class="setting-start"></td>
                <td><input 
type="number" value="${service.end}" class="setting-end"></td>
                <td>
                    <select class="setting-estimation-mode">
                        <option value="manual" ${service.estimationMode === 'manual' ? 'selected' : ''}>دستی</option>
                        <option value="smart" ${service.estimationMode === 'smart' 
? 'selected' : ''}>هوشمند</option> /*cite: 110, 111*/
                    </select>
                </td>
                <td><input type="number" value="${service.manualTime}" class="setting-manual-time"></td>
                <td><input type="time" value="${service.workHours.start}" class="setting-work-start"></td>
                <td><input type="time" value="${service.workHours.end}" class="setting-work-end"></td>
                <td><button class="remove-service-btn">حذف</button></td>`; /*cite: 111, 112*/
            serviceList.appendChild(row);
        });
        serviceList.querySelectorAll('.remove-service-btn').forEach(b => b.addEventListener('click', () => b.closest('tr').remove())); /*cite: 113*/
    }

    function addNewService() {
        const newId = services.length > 0 ?
        Math.max(...services.map(s => s.id)) + 1 : 1; /*cite: 113, 114*/
        const row = document.createElement('tr');
        row.dataset.id = newId;
        row.innerHTML = `
            <td><input type="text" value="خدمت جدید" class="setting-name"></td>
            <td><input type="number" value="${newId * 100 + 1}" class="setting-start"></td>
            <td><input type="number" value="${newId * 100 + 99}" class="setting-end"></td>
             <td>
                <select class="setting-estimation-mode">
                    <option value="manual" selected>دستی</option> /*cite: 116*/
                    <option value="smart">هوشمند</option>
                </select>
            </td>
            <td><input type="number" value="10" class="setting-manual-time"></td>
            <td><input type="time" value="08:00" class="setting-work-start"></td>
            <td><input 
type="time" value="17:00" class="setting-work-end"></td> /*cite: 116, 117*/
            <td><button class="remove-service-btn">حذف</button></td>`;
        serviceList.appendChild(row); /*cite: 117*/
        row.querySelector('.remove-service-btn').addEventListener('click', () => row.remove()); /*cite: 118*/
    }

    function saveSettings() {
        const newServices = [];
        serviceList.querySelectorAll('tr').forEach(row => { /*cite: 119*/
            const currentService = services.find(s => s.id == row.dataset.id) || {};
            const manualTime = parseInt(row.querySelector('.setting-manual-time').value);
            newServices.push({
                id: parseInt(row.dataset.id), name: row.querySelector('.setting-name').value,
                start: parseInt(row.querySelector('.setting-start').value), end: parseInt(row.querySelector('.setting-end').value),
                estimationMode: row.querySelector('.setting-estimation-mode').value, /*cite: 120*/
                manualTime: manualTime,
                smartTime: currentService.smartTime || manualTime,
                workHours: { start: row.querySelector('.setting-work-start').value, end: row.querySelector('.setting-work-end').value }
            });
        });
        services = newServices; /*cite: 121*/
        saveToLocalStorage();
        init();
        adminPanel.style.display = 'none';
        showPopupNotification('<p>تنظیمات با موفقیت ذخیره شد.</p>'); /*cite: 121*/
    }

    // --- Event Listeners ---
    loginBtn.addEventListener('click', () => login(usernameInput.value, passwordInput.value));
    logoutBtn.addEventListener('click', logout);
    settingsBtn.addEventListener('click', () => { if (isAdmin) { renderServiceSettings(); adminPanel.style.display = 'block'; }}); /*cite: 123*/
    resetAllBtn.addEventListener('click', resetAllTickets); /*cite: 123*/
    passTicketBtn.addEventListener('click', () => { if (currentUser) openPassServiceModal(); }); /*cite: 124*/
    cancelPassServiceBtn.addEventListener('click', () => passServiceModalOverlay.style.display = 'none'); /*cite: 124*/
    confirmPassServiceBtn.addEventListener('click', () => { /*cite: 125*/
        const selected = passServiceList.querySelectorAll('input:checked');
        if (selected.length === 0) { alert('لطفا حداقل یک خدمت را انتخاب کنید.'); return; }
        tempSelectedServicesForPass = Array.from(selected).map(cb => parseInt(cb.value));
        passServiceModalOverlay.style.display = 'none';
        openTicketForm('pass');
    });
    submitTicketBtn.addEventListener('click', () => { /*cite: 126*/
        const mode = ticketForm.dataset.mode;
        const firstName = document.getElementById('first-name').value.trim();
        const lastName = document.getElementById('last-name').value.trim();
        const nationalId = document.getElementById('national-id').value.trim();
        if (mode === 'regular') {
            generateTicket(parseInt(ticketForm.dataset.serviceId), firstName, lastName, nationalId);
        } else if (mode === 'pass') {
            generatePassTicket(firstName, lastName, nationalId, tempSelectedServicesForPass); /*cite: 127*/
        }
    });
    cancelTicketBtn.addEventListener('click', closeTicketForm);
    callNextBtn.addEventListener('click', callNextTicket);
    addServiceBtn.addEventListener('click', addNewService); /*cite: 128*/
    saveSettingsBtn.addEventListener('click', saveSettings);
    cancelSettingsBtn.addEventListener('click', () => adminPanel.style.display = 'none');
    closeSettingsBtn.addEventListener('click', () => adminPanel.style.display = 'none');

    init();
});