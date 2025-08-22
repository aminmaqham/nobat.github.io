document.addEventListener('DOMContentLoaded', () => {
    // --- APPWRITE SETUP ---
    // IMPORTANT: Replace with your actual Appwrite Project ID and Endpoint
    const APPWRITE_ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
    const APPWRITE_PROJECT_ID = '68a8d1b0000e80bdc1f3'; // <-- project ID شما
    const DATABASE_ID = '68a8d24b003cd6609e37'; // <-- شناسه دیتابیسی که ساختید
    const SERVICES_COLLECTION_ID = 'services';
    const TICKETS_COLLECTION_ID = 'tickets';

    const { Client, Account, Databases, ID, Query } = Appwrite;

    const client = new Client();
    client
        .setEndpoint(APPWRITE_ENDPOINT)
        .setProject(APPWRITE_PROJECT_ID);

    const account = new Account(client);
    const databases = new Databases(client);

    // --- DOM Elements ---
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const userGreeting = document.getElementById('user-greeting');
    const loginFields = document.getElementById('login-fields');
    const userInfo = document.getElementById('user-info');
    const mainContent = document.getElementById('main-content');
    const serviceButtonsContainer = document.querySelector('.service-buttons');
    const ticketForm = document.getElementById('ticket-form');
    const callNextBtn = document.getElementById('call-next-btn');
    const serviceCheckboxes = document.getElementById('service-checkboxes');
    const currentTicketDisplay = document.getElementById('current-ticket');
    const popupNotification = document.getElementById('popup-notification');
    const popupText = document.getElementById('popup-text');
    const totalWaitingContainer = document.getElementById('total-waiting-container');
    const ticketHistoryTable = document.querySelector('#ticket-history tbody');
    const submitTicketBtn = document.getElementById('submit-ticket');
    const cancelTicketBtn = document.getElementById('cancel-ticket');
    const ticketFormTitle = document.getElementById('ticket-form-title');

    // --- Application State ---
    let currentUser = null;
    let services = [];
    let tickets = [];

    // --- INITIALIZATION ---
    async function initializeApp() {
        try {
            currentUser = await account.get();
            showLoggedInUI();
            await fetchData();
            setupRealtimeSubscriptions();
        } catch (error) {
            console.log('User not logged in');
            showLoggedOutUI();
        }
    }

    async function fetchData() {
        await Promise.all([fetchServices(), fetchTickets()]);
        renderUI();
    }

    async function fetchServices() {
        try {
            const response = await databases.listDocuments(DATABASE_ID, SERVICES_COLLECTION_ID);
            services = response.documents;
        } catch (error) {
            console.error('Error fetching services:', error);
        }
    }

    async function fetchTickets() {
        try {
            const response = await databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID, [
                Query.orderDesc('$createdAt'),
                Query.limit(100)
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

    // --- AUTHENTICATION ---
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
            showLoggedOutUI();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }

    function showLoggedInUI() {
        loginFields.style.display = 'none';
        userInfo.style.display = 'flex';
        userGreeting.textContent = `کاربر: ${currentUser.name || currentUser.email}`;
        mainContent.style.display = 'block';
        totalWaitingContainer.style.display = 'block';

        if (currentUser.prefs && currentUser.prefs.role === 'admin') {
            settingsBtn.style.display = 'inline-block';
        } else {
            settingsBtn.style.display = 'none';
        }
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
        client.subscribe(ticketChannel, response => {
            console.log('Realtime update received:', response.payload);
            // A simple refetch is easiest for now
            fetchData();
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
            const waitingCount = tickets.filter(t => t.service_id === service.$id && t.status === 'در حال انتظار').length;
            button.innerHTML = `
                <div>
                    <div class="service-name">${service.name}</div>
                    <div class="waiting-count">منتظران: ${waitingCount}</div>
                </div>
                <div class="estimation-time">${service.estimation_mode}: ${service.manual_time} دقیقه</div>
            `;
            button.addEventListener('click', () => openTicketForm('regular', service.$id));
            serviceButtonsContainer.appendChild(button);
        });
    }
    
    async function updateServiceCheckboxes() {
        // This part needs a way to store user preferences (service selections)
        // For simplicity, this is omitted for now but can be added to user.prefs
        serviceCheckboxes.innerHTML = 'قابلیت انتخاب خدمات به زودی اضافه می‌شود.';
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
                <td>${ticket.registered_by.substring(0, 8)}...</td>
                <td>${formatDate(ticket.$createdAt)}</td>
                <td>${ticket.called_by ? ticket.called_by.substring(0, 8) + '...' : '---'}</td>
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

    // --- TICKET LOGIC ---
    async function generateTicket(serviceId, firstName, lastName, nationalId) {
        const service = services.find(s => s.$id === serviceId);
        if (!service) return;

        const newTicketData = {
            service_id: serviceId,
            first_name: firstName,
            last_name: lastName,
            national_id: nationalId,
            registered_by: currentUser.$id,
            status: 'در حال انتظار',
            // You'll need to add logic for general/specific ticket numbers
        };

        try {
            await databases.createDocument(DATABASE_ID, TICKETS_COLLECTION_ID, ID.unique(), newTicketData);
            showPopupNotification(`<p>نوبت برای خدمت «${service.name}» ثبت شد.</p>`);
            closeTicketForm();
        } catch (error) {
            console.error('Error creating ticket:', error);
            showPopupNotification('<p>خطا در ثبت نوبت!</p>');
        }
    }

    async function callNextTicket() {
        // Simplified: find the oldest waiting ticket
        try {
            const response = await databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID, [
                Query.equal('status', ['در حال انتظار']),
                Query.orderAsc('$createdAt'),
                Query.limit(1)
            ]);

            if (response.documents.length === 0) {
                showPopupNotification('<p>هیچ نوبتی در صف انتظار نیست.</p>');
                return;
            }

            const ticketToCall = response.documents[0];
            await databases.updateDocument(DATABASE_ID, TICKETS_COLLECTION_ID, ticketToCall.$id, {
                status: 'در حال سرویس',
                called_by: currentUser.$id,
                call_time: new Date().toISOString()
            });

            showPopupNotification(`<p>نوبت ${ticketToCall.specific_ticket || ''} فراخوانی شد.</p>`);

        } catch (error) {
            console.error('Error calling next ticket:', error);
        }
    }

    // --- HELPERS ---
    function openTicketForm(mode, serviceId) {
        ticketForm.dataset.mode = mode;
        ticketForm.dataset.serviceId = serviceId;
        ticketFormTitle.textContent = 'ثبت نوبت جدید';
        ticketForm.style.display = 'block';
    }

    function closeTicketForm() {
        ticketForm.style.display = 'none';
        // Clear form fields
    }

    function showPopupNotification(htmlContent) {
        popupText.innerHTML = htmlContent;
        popupNotification.style.display = 'flex';
        setTimeout(() => popupNotification.classList.add('show'), 10);
        popupNotification.addEventListener('click', function closeHandler() {
            popupNotification.classList.remove('show');
            setTimeout(() => popupNotification.style.display = 'none', 300);
            popupNotification.removeEventListener('click', closeHandler);
        });
    }

    function formatDate(dateString) {
        if (!dateString) return '---';
        const d = new Date(dateString);
        return d.toLocaleTimeString('fa-IR');
    }

    // --- EVENT LISTENERS ---
    loginBtn.addEventListener('click', login);
    logoutBtn.addEventListener('click', logout);
    callNextBtn.addEventListener('click', callNextTicket);
    submitTicketBtn.addEventListener('click', () => {
        const serviceId = ticketForm.dataset.serviceId;
        const firstName = document.getElementById('first-name').value;
        const lastName = document.getElementById('last-name').value;
        const nationalId = document.getElementById('national-id').value;
        generateTicket(serviceId, firstName, lastName, nationalId);
    });
    cancelTicketBtn.addEventListener('click', closeTicketForm);

    // --- START THE APP ---
    initializeApp();
});
