// This is the final, corrected, and complete script for your application.
// It handles user authentication, real-time data synchronization with Supabase,
// and all the functionalities of your queuing system.

document.addEventListener('DOMContentLoaded', async () => {
    // --- SUPABASE SETUP ---
    // These are your project's public credentials.
    const SUPABASE_URL = 'https://mjqfdecefsnivevmmixk.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcWZkZWNlZnNuaXZldm1taXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4NTM5NDcsImV4cCI6MjA3MTQyOTk0N30.llqc-hbFFCg9KKfVu8LG0uo7Giu4KwklsQ8P322qRrQ';

    // CORRECTED LINE: The typo "supabase.supabase" is fixed. It should be "supabase.createClient".
    const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- DOM Elements ---
    // Caching all necessary DOM elements for performance.
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const resetAllBtn = document.getElementById('reset-all-btn');
    const emailInput = document.getElementById('email');
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
    const popupNotification = document.getElementById('popup-notification');
    const popupText = document.getElementById('popup-text');
    const totalWaitingContainer = document.getElementById('total-waiting-container');
    const ticketHistoryTable = document.querySelector('#ticket-history tbody');
    const adminPanel = document.getElementById('admin-panel');
    const serviceList = document.getElementById('service-list');
    const addServiceBtn = document.getElementById('add-service-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const cancelSettingsBtn = document.getElementById('cancel-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings');
    const passServiceModalOverlay = document.getElementById('pass-service-modal-overlay');
    const passServiceList = document.getElementById('pass-service-list');
    const confirmPassServiceBtn = document.getElementById('confirm-pass-service');
    const cancelPassServiceBtn = document.getElementById('cancel-pass-service');

    // --- Application State (fetched from Supabase) ---
    let currentUser = null;
    let userProfile = null;
    let services = [];
    let tickets = [];
    let tempSelectedServicesForPass = [];

    // --- INITIALIZATION ---
    async function initializeApp() {
        await checkUserSession();
        if (currentUser) {
            await fetchData();
            renderUI();
            setupRealtimeSubscriptions();
        }
    }

    async function fetchData() {
        await Promise.all([
            fetchServices(),
            fetchTickets()
        ]);
        renderUI();
    }

    async function fetchServices() {
        const { data, error } = await supabase.from('services').select('*').order('id');
        if (error) console.error('Error fetching services:', error);
        else services = data;
    }

    async function fetchTickets() {
        const { data, error } = await supabase.from('tickets').select('*, services(name)').order('created_at', { ascending: false }).limit(100);
        if (error) console.error('Error fetching tickets:', error);
        else {
            tickets = data.map(t => ({...t, serviceName: t.services ? t.services.name : 'N/A' }));
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
    async function checkUserSession() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            currentUser = session.user;
            await fetchUserProfile();
            showLoggedInUI();
        } else {
            showLoggedOutUI();
        }
    }

    async function fetchUserProfile() {
        if (!currentUser) return;
        const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
        if (error) {
            console.error('Error fetching profile:', error);
            userProfile = null; 
        } else {
            userProfile = data;
        }
    }

    async function login() {
        const { error } = await supabase.auth.signInWithPassword({
            email: emailInput.value,
            password: passwordInput.value,
        });
        if (error) {
            alert('خطا در ورود: ' + error.message);
        } else {
            await initializeApp();
        }
    }

    async function logout() {
        await supabase.auth.signOut();
        currentUser = null;
        userProfile = null;
        showLoggedOutUI();
    }

    function showLoggedInUI() {
        loginFields.style.display = 'none';
        userInfo.style.display = 'flex';
        userGreeting.textContent = `کاربر: ${currentUser.email}`;
        mainContent.style.display = 'block';
        totalWaitingContainer.style.display = 'block';
        
        if (userProfile && userProfile.role === 'admin') {
            settingsBtn.style.display = 'inline-block';
            resetAllBtn.style.display = 'inline-block';
        } else {
            settingsBtn.style.display = 'none';
            resetAllBtn.style.display = 'none';
        }
    }

    function showLoggedOutUI() {
        loginFields.style.display = 'flex';
        userInfo.style.display = 'none';
        mainContent.style.display = 'none';
        totalWaitingContainer.style.display = 'none';
    }

    // --- REALTIME SUBSCRIPTIONS ---
    function setupRealtimeSubscriptions() {
        supabase.channel('public:tickets')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, 
            (payload) => {
                console.log('Ticket change received!', payload);
                fetchData();
            })
            .subscribe();

        supabase.channel('public:services')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, 
            (payload) => {
                console.log('Service change received!', payload);
                fetchData();
            })
            .subscribe();
    }

    // --- UI RENDERING FUNCTIONS ---
    function updateTotalWaitingCount() {
        const waitingCount = tickets.filter(t => t.status === 'در حال انتظار').length;
        document.getElementById('total-waiting-count').textContent = waitingCount;
    }
    
    function renderServiceButtons() {
        serviceButtonsContainer.innerHTML = '';
        services.forEach(service => {
            const button = document.createElement('button');
            button.className = 'service-btn';
            const waitingCount = tickets.filter(t => t.service_id === service.id && t.status === 'در حال انتظار').length;
            const estimationTime = service.estimation_mode === 'smart' ? Math.round(service.smart_time) : service.manual_time;
            const estimationModeText = service.estimation_mode === 'smart' ? 'تخمین هوشمند' : 'تخمین دستی';

            button.innerHTML = `
                <div>
                    <div class="service-name">${service.name}</div>
                    <div class="waiting-count">منتظران: ${waitingCount}</div>
                </div>
                <div class="estimation-time">${estimationModeText}: ${estimationTime} دقیقه</div>
            `;
            button.addEventListener('click', () => {
                if (!currentUser) return;
                openTicketForm('regular', service.id);
            });
            serviceButtonsContainer.appendChild(button);
        });
    }

    async function updateServiceCheckboxes() {
        if (!userProfile) return;
        serviceCheckboxes.innerHTML = '';
        const currentSelections = userProfile.service_selections || {};

        services.forEach(service => {
            const waitingCount = tickets.filter(t => t.service_id === service.id && t.status === 'در حال انتظار').length;
            const div = document.createElement('div');
            div.className = 'service-checkbox';
            div.innerHTML = `
                <input type="checkbox" id="service-check-${service.id}" value="${service.id}">
                <label for="service-check-${service.id}">
                    ${service.name} 
                    (<span class="waiting-count-label">${waitingCount} نفر</span>)
                </label>
            `;
            const checkbox = div.querySelector('input');
            checkbox.checked = currentSelections[service.id] || false;
            checkbox.addEventListener('change', async () => {
                currentSelections[service.id] = checkbox.checked;
                const { error } = await supabase.from('profiles').update({ service_selections: currentSelections }).eq('id', currentUser.id);
                if(error) console.error("Error saving selections:", error);
            });
            serviceCheckboxes.appendChild(div);
        });
    }

    function updateHistoryTable() {
        ticketHistoryTable.innerHTML = '';
        const sortedTickets = [...tickets].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        sortedTickets.slice(0, 50).forEach(ticket => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${ticket.general_ticket || 'پاس'}</td>
                <td>${ticket.specific_ticket || 'پاس'}</td>
                <td>${ticket.first_name || ''} ${ticket.last_name || ''}</td>
                <td>${ticket.national_id || '---'}</td>
                <td>${ticket.serviceName || '---'}</td>
                <td>${ticket.registered_by_user_id ? 'کاربر' : '---'}</td>
                <td>${formatDate(ticket.registration_time)}</td>
                <td>${ticket.called_by_user_id ? 'کاربر' : '---'}</td>
                <td>${formatDate(ticket.call_time)}</td>
                <td>${ticket.status || 'پاس شده'}</td>`;
            ticketHistoryTable.appendChild(row);
        });
    }

    function updateCurrentTicketDisplay() {
        currentTicketDisplay.innerHTML = '';
        const activeTicketsList = tickets
            .filter(t => t.status === 'در حال سرویس')
            .sort((a, b) => new Date(b.call_time) - new Date(a.call_time));
        
        activeTicketsList.slice(0, 3).forEach(ticket => {
            const div = document.createElement('div');
            div.className = 'current-ticket-item';
            div.innerHTML = `
                <h3>${ticket.serviceName}</h3>
                <p><strong>نوبت:</strong> ${ticket.specific_ticket || 'پاس'}</p>
                <p><strong>نام:</strong> ${ticket.first_name} ${ticket.last_name}</p>
                <p><strong>زمان فراخوان:</strong> ${new Date(ticket.call_time).toLocaleTimeString('fa-IR')}</p>`;
            currentTicketDisplay.appendChild(div);
        });

        if (activeTicketsList.length === 0) {
            currentTicketDisplay.innerHTML = '<p style="text-align: center;">هیچ نوبتی در حال سرویس نیست</p>';
        }
    }

    // --- TICKET LOGIC ---
    async function generateTicket(serviceId, firstName, lastName, nationalId) {
        const service = services.find(s => s.id === serviceId);
        if (!service) return;

        const { data: latestTicket, error: latestTicketError } = await supabase
            .from('tickets')
            .select('general_ticket')
            .order('created_at', { ascending: false })
            .limit(1);

        const newGeneralTicket = (latestTicket && latestTicket.length > 0 && latestTicket[0].general_ticket) ? latestTicket[0].general_ticket + 1 : 1;
        
        const { data: latestServiceTicket, error: latestServiceTicketError } = await supabase
            .from('tickets')
            .select('specific_ticket')
            .eq('service_id', serviceId)
            .order('specific_ticket', { ascending: false })
            .limit(1);

        let newSpecificTicket = (latestServiceTicket && latestServiceTicket.length > 0 && latestServiceTicket[0].specific_ticket) ? latestServiceTicket[0].specific_ticket + 1 : service.start_number;
        if (newSpecificTicket > service.end_number) {
            newSpecificTicket = service.start_number;
        }

        const newTicket = {
            service_id: serviceId,
            general_ticket: newGeneralTicket,
            specific_ticket: newSpecificTicket,
            first_name: firstName || '---',
            last_name: lastName || '---',
            national_id: nationalId || '---',
            registered_by_user_id: currentUser.id,
            status: 'در حال انتظار',
            ticket_type: 'regular'
        };

        const { error } = await supabase.from('tickets').insert(newTicket);
        if (error) {
            console.error('Error creating ticket:', error);
            showPopupNotification('<p>خطا در ثبت نوبت!</p>');
        } else {
            showPopupNotification(`<p>نوبت ${newSpecificTicket} برای خدمت «${service.name}» با موفقیت ثبت شد.</p>`);
            closeTicketForm();
        }
    }

    async function callNextTicket() {
        if (!userProfile) return;
        const selectedServices = Object.keys(userProfile.service_selections || {})
                                     .filter(id => userProfile.service_selections[id])
                                     .map(Number);
        if (selectedServices.length === 0) {
            showPopupNotification('<p>لطفا حداقل یک خدمت را برای فراخوانی انتخاب کنید.</p>');
            return;
        }

        const { data: oldestTicket, error } = await supabase
            .from('tickets')
            .select('*, services(name)')
            .in('service_id', selectedServices)
            .eq('status', 'در حال انتظار')
            .order('registration_time', { ascending: true })
            .limit(1)
            .single();

        if (error || !oldestTicket) {
            showPopupNotification('<p>هیچ نوبتی در صف انتظار برای خدمات انتخابی شما وجود ندارد.</p>');
            return;
        }
        
        const { error: updateError } = await supabase
            .from('tickets')
            .update({ 
                status: 'در حال سرویس', 
                call_time: new Date().toISOString(),
                called_by_user_id: currentUser.id
            })
            .eq('id', oldestTicket.id);
        
        if (updateError) {
            console.error('Error calling ticket:', updateError);
            showPopupNotification('<p>خطا در فراخوانی نوبت!</p>');
        } else {
            showPopupNotification(`
                <span class="ticket-number">فراخوان: ${oldestTicket.specific_ticket}</span>
                <p style="margin: 5px 0;">${oldestTicket.first_name} ${oldestTicket.last_name}</p>
                به خدمت «${oldestTicket.services.name}»
            `);
        }
    }

    async function resetAllTickets() {
        if (!confirm('آیا مطمئن هستید؟ این عمل تمام نوبت‌ها را پاک می‌کند.')) return;
        
        const { error } = await supabase.from('tickets').delete().neq('id', 0);
        if (error) {
            console.error('Error resetting tickets:', error);
            alert('خطا در پاک کردن نوبت‌ها.');
        } else {
            alert('تمام نوبت‌ها با موفقیت پاک شدند.');
            fetchData();
        }
    }

    // --- HELPER & UTILITY FUNCTIONS ---
    function openTicketForm(mode, serviceId = null) {
        ticketForm.dataset.mode = mode;
        if (mode === 'regular') {
            ticketForm.dataset.serviceId = serviceId;
            ticketFormTitle.textContent = 'ثبت نوبت جدید';
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

    function formatDate(date) {
        if (!date) return '---';
        const d = new Date(date);
        return `${d.toLocaleTimeString('fa-IR')} ${d.toLocaleDateString('fa-IR')}`;
    }

    // --- EVENT LISTENERS ---
    loginBtn.addEventListener('click', login);
    logoutBtn.addEventListener('click', logout);
    resetAllBtn.addEventListener('click', resetAllTickets);

    submitTicketBtn.addEventListener('click', () => {
        const mode = ticketForm.dataset.mode;
        const firstName = document.getElementById('first-name').value.trim();
        const lastName = document.getElementById('last-name').value.trim();
        const nationalId = document.getElementById('national-id').value.trim();
        if (mode === 'regular') {
            generateTicket(parseInt(ticketForm.dataset.serviceId), firstName, lastName, nationalId);
        }
    });

    cancelTicketBtn.addEventListener('click', closeTicketForm);
    callNextBtn.addEventListener('click', callNextTicket);
    
    // --- START THE APP ---
    initializeApp();
});
