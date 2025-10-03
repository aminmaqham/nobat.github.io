document.addEventListener('DOMContentLoaded', () => {
    // --- APPWRITE SETUP ---
    const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
    const APPWRITE_PROJECT_ID = '68a8d1b0000e80bdc1f3';
    const DATABASE_ID = '68a8d24b003cd6609e37';
    const TICKETS_COLLECTION_ID = '68a8d63a003a3a6afa24';

    const { Client, Databases, Query } = Appwrite;

    const client = new Client();
    client
        .setEndpoint(APPWRITE_ENDPOINT)
        .setProject(APPWRITE_PROJECT_ID);

    const databases = new Databases(client);

    // --- DOM Elements ---
    const ticketsContainer = document.querySelector('.tickets-container');
    const photographyList = document.querySelector('.photography-list');
    const photographyWaiting = document.querySelector('.photography-waiting');
    const mainDisplay = document.querySelector('.main-display');
    const photographyDisplay = document.querySelector('.photography-display');

    // --- State Variables ---
    let currentTickets = [];
    let photographyData = [];
    let lastSpokenTicket = null;

    // --- Text-to-Speech Function ---
    function speak(text) {
        if ('speechSynthesis' in window) {
            // توقف صحبت قبلی
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'fa-IR';
            utterance.rate = 0.8;
            utterance.pitch = 1;
            utterance.volume = 1;
            
            // پیدا کردن صدای فارسی
            const voices = window.speechSynthesis.getVoices();
            const persianVoice = voices.find(voice => 
                voice.lang.includes('fa') || voice.lang.includes('ir') || voice.lang.includes('IR')
            );
            
            if (persianVoice) {
                utterance.voice = persianVoice;
            }
            
            window.speechSynthesis.speak(utterance);
        }
    }

    // --- UI Update Functions ---
    async function updateDisplay() {
        try {
            await Promise.all([
                updateTicketsDisplay(),
                updatePhotographyDisplay()
            ]);
        } catch (error) {
            console.error("Error updating display:", error);
        }
    }

    async function updateTicketsDisplay() {
        try {
            // دریافت ۳ نوبت آخر
            const response = await databases.listDocuments(
                DATABASE_ID,
                TICKETS_COLLECTION_ID,
                [
                    Query.equal('status', 'در حال سرویس'),
                    Query.orderDesc('call_time'),
                    Query.limit(3)
                ]
            );

            const calledTickets = response.documents;
            currentTickets = calledTickets;
            renderTickets(calledTickets);

            // بررسی برای اعلام صوتی
            checkForNewTicketAnnouncement(calledTickets);

        } catch (error) {
            console.error("Error fetching tickets:", error);
            renderTickets([]);
        }
    }

    function renderTickets(tickets) {
        ticketsContainer.innerHTML = '';
        
        if (tickets.length === 0) {
            ticketsContainer.innerHTML = `
                <div class="ticket-card">
                    <div class="ticket-number">---</div>
                    <div class="ticket-info">منتظر فراخوان...</div>
                    <div class="ticket-time">${new Date().toLocaleTimeString('fa-IR')}</div>
                </div>
            `;
            return;
        }

        tickets.forEach((ticket, index) => {
            const ticketElement = document.createElement('div');
            const callTime = new Date(ticket.call_time);
            const now = new Date();
            const minutesDiff = Math.floor((now - callTime) / (1000 * 60));
            
            let cardClass = 'ticket-card';
            if (minutesDiff < 2) {
                cardClass += ' recent';
            } else if (minutesDiff > 10) {
                cardClass += ' old';
            }

            ticketElement.className = cardClass;
            ticketElement.innerHTML = `
                <div class="ticket-number">${ticket.specific_ticket || 'پاس'}</div>
                <div class="ticket-info">
                    <div>شماره ${ticket.specific_ticket || 'پاس'} به ${ticket.called_by_counter_name || 'باجه'}</div>
                    <div class="counter-name">${ticket.called_by_name || 'سیستم'}</div>
                </div>
                <div class="ticket-time">${formatTime(callTime)}</div>
            `;
            
            ticketsContainer.appendChild(ticketElement);
        });
    }

    function checkForNewTicketAnnouncement(tickets) {
        if (tickets.length === 0) return;

        const latestTicket = tickets[0];
        const latestTicketId = latestTicket.$id;

        // اگر این نوبت قبلاً اعلام نشده بود
        if (lastSpokenTicket !== latestTicketId) {
            const numberToSpeak = latestTicket.specific_ticket || 'نوبت پاس شده';
            const counterName = latestTicket.called_by_counter_name || 'باجه';
            const textToSpeak = `شماره ${numberToSpeak} به ${counterName}`;
            
            speak(textToSpeak);
            lastSpokenTicket = latestTicketId;
        }
    }

    async function updatePhotographyDisplay() {
        try {
            const savedList = localStorage.getItem('photographyList');
            photographyData = savedList ? JSON.parse(savedList) : [];
            
            const waitingCount = photographyData.filter(item => !item.photoTaken).length;
            photographyWaiting.textContent = `منتظران: ${waitingCount}`;

            renderPhotographyList();

        } catch (error) {
            console.error('Error updating photography display:', error);
            renderPhotographyList();
        }
    }

    function renderPhotographyList() {
        if (photographyData.length === 0) {
            photographyList.innerHTML = '<div class="photography-empty">هیچ نوبتی در لیست عکاسی وجود ندارد</div>';
            return;
        }

        // مرتب‌سازی: اول نوبت‌های آماده بازگشت، سپس نوبت‌های رزرو شده، سپس بقیه
        const sortedList = [...photographyData].sort((a, b) => {
            const statusPriority = {
                'readyToReturn': 1,
                'reserved': 2,
                'waiting': 3,
                'completed': 4
            };

            const aStatus = getPhotographyItemStatus(a);
            const bStatus = getPhotographyItemStatus(b);
            
            if (statusPriority[aStatus] !== statusPriority[bStatus]) {
                return statusPriority[aStatus] - statusPriority[bStatus];
            }
            
            return new Date(a.addedAt) - new Date(b.addedAt);
        });
        
        // نمایش تمام آیتم‌ها - بدون محدودیت
        photographyList.innerHTML = `
            <table class="photography-table">
                <thead>
                    <tr>
                        <th>ردیف</th>
                        <th>شماره نوبت</th>
                        <th>وضعیت</th>
                        <th>ارسال کننده</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedList.map((item, index) => `
                        <tr class="photography-row ${getPhotographyRowClass(item)}">
                            <td class="photography-row-number">${index + 1}</td>
                            <td>
                                <div class="photography-ticket-number">${item.ticketNumber}</div>
                                <div class="photography-national-id">${item.nationalId}</div>
                                <div class="photography-name">${item.firstName} ${item.lastName}</div>
                                ${getPhotographyBadges(item)}
                            </td>
                            <td>
                                <span class="photography-status ${getPhotographyStatusClass(item)}">
                                    ${getPhotographyStatusText(item)}
                                </span>
                            </td>
                            <td class="photography-origin">
                                ${item.originalCounterName || '---'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function getPhotographyItemStatus(item) {
        if (item.readyToReturn) return 'readyToReturn';
        if (item.reserved) return 'reserved';
        if (item.photoTaken) return 'completed';
        return 'waiting';
    }

    function getPhotographyRowClass(item) {
        if (item.readyToReturn) return 'ready-to-return';
        if (item.reserved) return 'reserved';
        if (item.photoTaken) return 'photo-taken';
        return 'waiting';
    }

    function getPhotographyStatusClass(item) {
        if (item.readyToReturn) return 'status-ready';
        if (item.reserved) return 'status-reserved';
        if (item.photoTaken) return 'status-done';
        return 'status-waiting';
    }

    function getPhotographyStatusText(item) {
        if (item.readyToReturn) return 'آماده بازگشت';
        if (item.reserved) return 'رزرو شده';
        if (item.photoTaken) return 'تکمیل شده';
        return 'در انتظار';
    }

    function getPhotographyBadges(item) {
        let badges = '';
        if (item.reserved) {
            badges += '<div class="photography-badge reserved-badge">رزرو شده</div>';
        }
        if (item.readyToReturn) {
            badges += '<div class="photography-badge ready-badge">آماده بازگشت</div>';
        }
        return badges;
    }

    function formatTime(date) {
        return date.toLocaleTimeString('fa-IR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    // --- Real-time Updates ---
// --- بهبود یافته REAL-TIME UPDATES ---
function setupRealtime() {
    console.log('Setting up enhanced real-time for display...');
    
    // نظارت بر تغییرات در دیتابیس نوبت‌ها
    const ticketsChannel = `databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents`;
    
    client.subscribe(ticketsChannel, (response) => {
        if (response.events.includes(`databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents.*.update`) ||
            response.events.includes(`databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents.*.create`)) {
            
            console.log('Display: Ticket update detected');
            updateTicketsDisplay();
        }
    });

    // سیستم پیشرفته sync برای لیست عکاسی
    setupDisplayPhotographySync();
}

// --- سیستم SYNC پیشرفته برای نمایشگر ---
function setupDisplayPhotographySync() {
    // نظارت بر تغییرات localStorage
    window.addEventListener('storage', (e) => {
        if (e.key === 'photographyList' || e.key === 'photographyListUpdate' || e.key === 'photographyCrossTabSync') {
            console.log('Display: Photography list updated from storage');
            updatePhotographyDisplay();
        }
    });
    
    // نظارت بر custom events
    window.addEventListener('photographyListUpdated', () => {
        console.log('Display: Photography list updated via custom event');
        updatePhotographyDisplay();
    });
    
    // بررسی دوره‌ای تغییرات
    let lastDisplayCheck = Date.now();
    setInterval(() => {
        const currentTime = Date.now();
        const lastUpdate = parseInt(localStorage.getItem('photographyListUpdate') || '0');
        
        if (lastUpdate > lastDisplayCheck) {
            console.log('Display: Periodic check detected update');
            updatePhotographyDisplay();
            lastDisplayCheck = currentTime;
        }
    }, 1000);
}

    // --- Auto-refresh ---
    function startAutoRefresh() {
        // به‌روزرسانی کامل هر 3 ثانیه برای پاسخگویی آنی
        setInterval(updateDisplay, 3000);
        
        // به‌روزرسانی زمان‌ها هر 10 ثانیه
        setInterval(updateTicketsDisplay, 10000);
    }

    // --- Responsive Layout ---
    function handleResponsiveLayout() {
        function updateLayout() {
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile) {
                document.body.classList.add('mobile-layout');
                document.body.classList.remove('desktop-layout');
            } else {
                document.body.classList.add('desktop-layout');
                document.body.classList.remove('mobile-layout');
            }
        }

        window.addEventListener('resize', updateLayout);
        updateLayout();
    }

    // --- Error Handling ---
    function setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
        });
    }

    // --- Initialization ---
    async function initializeDisplay() {
        try {
            console.log('Initializing display...');
            
            // بارگذاری اولیه
            await updateDisplay();
            
            // راه‌اندازی سیستم real-time
            setupRealtime();
            
            // شروع به‌روزرسانی خودکار
            startAutoRefresh();
            
            // تنظیم layout واکنش‌گرا
            handleResponsiveLayout();
            
            // تنظیم مدیریت خطا
            setupErrorHandling();
            
            console.log('Display initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize display:', error);
            
            // نمایش حالت fallback
            ticketsContainer.innerHTML = `
                <div class="ticket-card error-state">
                    <div class="ticket-number">!</div>
                    <div class="ticket-info">خطا در اتصال به سیستم</div>
                    <div class="ticket-time">لطفا صفحه را رفرش کنید</div>
                </div>
            `;
        }
    }

    // --- استایل‌های داینامیک برای نمایشگر ---
    function addDynamicStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .photography-row.ready-to-return {
                background: linear-gradient(135deg, #e8f5e9, #c8e6c9) !important;
                border-right: 4px solid #4CAF50 !important;
                animation: pulse-ready 2s infinite;
            }
            
            .photography-row.reserved {
                background: linear-gradient(135deg, #fff3e0, #ffecb3) !important;
                border-right: 4px solid #FF9800 !important;
            }
            
            .photography-row.photo-taken {
                background: linear-gradient(135deg, #e3f2fd, #bbdefb) !important;
                border-right: 4px solid #2196F3 !important;
            }
            
            .status-ready {
                background: #4CAF50 !important;
                color: white !important;
            }
            
            .status-reserved {
                background: #FF9800 !important;
                color: white !important;
            }
            
            .photography-badge {
                display: inline-block;
                font-size: 0.7rem;
                padding: 2px 6px;
                border-radius: 8px;
                margin: 2px;
                font-weight: 600;
            }
            
            .reserved-badge {
                background: #FF9800;
                color: white;
            }
            
            .ready-badge {
                background: #4CAF50;
                color: white;
            }
            
            .ticket-card.error-state {
                background: linear-gradient(135deg, #ffebee, #ffcdd2) !important;
                color: #c62828 !important;
            }
            
            .ticket-card.error-state .ticket-number {
                color: #c62828 !important;
            }
            
            .photography-origin {
                font-size: 0.8rem;
                color: #666;
                font-weight: 500;
            }

            .photography-name {
                font-size: 0.9rem;
                color: #333;
                margin-top: 2px;
                font-weight: 500;
            }
            
            @keyframes pulse-ready {
                0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4); }
                70% { box-shadow: 0 0 0 10px rgba(76, 175, 80, 0); }
                100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
            }
            
            /* موبایل */
            .mobile-layout .container {
                flex-direction: column;
                padding: 10px;
            }
            
            .mobile-layout .photography-display {
                width: 100%;
                margin-top: 20px;
            }
            
            /* دسکتاپ */
            .desktop-layout .container {
                flex-direction: row;
            }
        `;
        document.head.appendChild(style);
    }

    // شروع برنامه
    addDynamicStyles();
    initializeDisplay();
});