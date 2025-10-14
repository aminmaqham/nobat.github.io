document.addEventListener('DOMContentLoaded', () => {
    // --- APPWRITE SETUP ---
    const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
    const APPWRITE_PROJECT_ID = '68a8d1b0000e80bdc1f3';
    const DATABASE_ID = '68a8d24b003cd6609e37';
    const TICKETS_COLLECTION_ID = '68a8d63a003a3a6afa24';
    const SERVICES_COLLECTION_ID = '68a8d28b002ce97317ae';
    const PHOTOGRAPHY_COLLECTION_ID = 'photography_history';
    const AUDIO_ANNOUNCEMENTS_COLLECTION_ID = 'audio_announcements';

    const { Client, Databases, Query } = Appwrite;

    const client = new Client();
    client
        .setEndpoint(APPWRITE_ENDPOINT)
        .setProject(APPWRITE_PROJECT_ID);

    const databases = new Databases(client);

    // --- Sound Manager for Display ---
    class DisplaySoundManager {
        constructor() {
            this.isAudioEnabled = true;
            this.volume = 0.7;
            this.isPlaying = false;
            this.audioQueue = [];
            this.userInteracted = false;
            this.currentAnnouncement = null;
            this.audioCache = new Map();
            this.lastPlayedTicket = null;
            this.setupUserInteraction();
        }

        // ✅ تنظیم تعامل کاربر
        setupUserInteraction() {
            const interactionHandler = () => {
                if (!this.userInteracted) {
                    console.log('✅ User interacted with document, audio enabled');
                    this.userInteracted = true;
                    this.hideAudioPrompt();
                    
                    // پیش‌بارگذاری صداها پس از تعامل کاربر
                    this.preloadImportantSounds();
                }
            };

            document.addEventListener('click', interactionHandler, { once: true });
            document.addEventListener('keydown', interactionHandler, { once: true });
            document.addEventListener('touchstart', interactionHandler, { once: true });

            this.showAudioPrompt();
        }

        // ✅ نمایش پیام برای تعامل کاربر
        showAudioPrompt() {
            if (!this.userInteracted) {
                const prompt = document.createElement('div');
                prompt.id = 'audio-activation-prompt';
                prompt.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(0,0,0,0.95);
                    color: white;
                    padding: 30px;
                    border-radius: 15px;
                    text-align: center;
                    z-index: 10000;
                    font-family: 'Vazirmatn', sans-serif;
                    max-width: 350px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    border: 3px solid #4CAF50;
                `;
                prompt.innerHTML = `
                    <h3 style="margin-bottom: 15px; color: #4CAF50;">🔊 فعالسازی سیستم صدا</h3>
                    <p style="margin-bottom: 20px; line-height: 1.6;">برای فعال شدن سیستم پخش صدا، لطفاً روی این دکمه کلیک کنید</p>
                    <button onclick="document.getElementById('audio-activation-prompt').remove(); window.dispatchEvent(new Event('userInteraction'));" style="
                        background: #4CAF50;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                        font-family: 'Vazirmatn', sans-serif;
                    ">فعال کردن صدا</button>
                `;
                document.body.appendChild(prompt);

                window.addEventListener('userInteraction', () => {
                    this.userInteracted = true;
                    console.log('✅ Audio system activated via user interaction');
                });
            }
        }

        // ✅ مخفی کردن پیام
        hideAudioPrompt() {
            const prompt = document.getElementById('audio-activation-prompt');
            if (prompt) {
                prompt.remove();
            }
        }

        // ✅ پخش اعلان کامل برای نوبت عادی
        async playCallAnnouncement(ticketNumber, counterNumber, ticketData = null) {
            if (!this.isAudioEnabled) return;
            
            if (!this.userInteracted) {
                console.log('🔇 Waiting for user interaction before playing audio');
                this.showAudioPrompt();
                return;
            }
            
            // جلوگیری از پخش تکراری نوبت‌های یکسان
            const currentTicketKey = `${ticketNumber}-${counterNumber}`;
            if (this.lastPlayedTicket === currentTicketKey) {
                console.log('🔇 Skipping duplicate ticket announcement:', currentTicketKey);
                return;
            }
            
            this.lastPlayedTicket = currentTicketKey;
            
            console.log(`🎵 Display: Playing announcement: Ticket ${ticketNumber}, Counter ${counterNumber}`);
            
            // پاک کردن صف قدیمی و شروع جدید
            if (this.audioQueue.length > 0) {
                console.log('🔄 Clearing old audio queue, starting fresh');
                this.audioQueue = [];
                this.isPlaying = false;
            }
            
            this.currentAnnouncement = { ticketNumber, counterNumber, ticketData };
            this.audioQueue.push({ ticketNumber, counterNumber, ticketData, type: 'normal' });
            
            await this.processQueue();
        }

        // ✅ پخش اعلان کامل برای نوبت عکاسی
        async playPhotographyAnnouncement(ticketNumber, counterNumber, ticketData = null) {
            if (!this.isAudioEnabled) return;
            
            if (!this.userInteracted) {
                console.log('🔇 Waiting for user interaction before playing audio');
                this.showAudioPrompt();
                return;
            }
            
            console.log(`🎵 Display: Playing photography announcement: Ticket ${ticketNumber}, Counter ${counterNumber}`);
            
            // پاک کردن صف قدیمی و شروع جدید
            if (this.audioQueue.length > 0) {
                console.log('🔄 Clearing old audio queue, starting fresh');
                this.audioQueue = [];
                this.isPlaying = false;
            }
            
            this.currentAnnouncement = { ticketNumber, counterNumber, ticketData };
            this.audioQueue.push({ ticketNumber, counterNumber, ticketData, type: 'photography' });
            
            await this.processQueue();
        }

        // ✅ تکرار صوت آخرین اعلان
        async repeatLastAnnouncement() {
            if (!this.isAudioEnabled || !this.userInteracted) {
                console.log('🔇 Cannot repeat - audio disabled or user not interacted');
                return;
            }

            if (!this.currentAnnouncement) {
                console.log('🔇 No announcement to repeat');
                return;
            }

            const { ticketNumber, counterNumber, ticketData } = this.currentAnnouncement;
            console.log(`🔁 Repeating last announcement: Ticket ${ticketNumber}, Counter ${counterNumber}`);

            // اضافه کردن به صف برای تکرار
            this.audioQueue.unshift({ ticketNumber, counterNumber, ticketData, type: 'repeat' });
            
            if (!this.isPlaying) {
                await this.processQueue();
            }
        }

        // ✅ پردازش صف - بهبود یافته برای جلوگیری از همپوشانی
        async processQueue() {
            if (this.isPlaying || this.audioQueue.length === 0) return;
            
            this.isPlaying = true;
            
            // فقط اولین آیتم در صف را پردازش کن
            const { ticketNumber, counterNumber, ticketData, type } = this.audioQueue[0];
            
            try {
                console.log(`🔊 Display: Processing: Ticket ${ticketNumber}, Counter ${counterNumber}, Type: ${type}`);
                
                // توقف هر پخش قبلی
                this.stopAllAudio();
                
                if (type === 'photography') {
                    await this.playPhotographySingleAnnouncement(ticketNumber, counterNumber);
                } else {
                    await this.playSingleAnnouncement(ticketNumber, counterNumber);
                }
                
                console.log(`✅ Display: Completed: Ticket ${ticketNumber}, Counter ${counterNumber}`);
            } catch (error) {
                console.error(`❌ Display: Failed: Ticket ${ticketNumber}, Counter ${counterNumber}`, error);
            }
            
            // حذف آیتم پردازش شده
            this.audioQueue.shift();
            this.isPlaying = false;
            
            // اگر آیتم دیگری در صف هست، پردازش کن
            if (this.audioQueue.length > 0) {
                setTimeout(() => {
                    this.processQueue();
                }, 500);
            }
        }

        // ✅ توقف تمام صداهای در حال پخش
        stopAllAudio() {
            // توقف تمام audio elements
            document.querySelectorAll('audio').forEach(audio => {
                audio.pause();
                audio.currentTime = 0;
            });
            
            // پاک کردن کش برای جلوگیری از استفاده مجدد
            this.audioCache.clear();
        }

        async playSingleAnnouncement(ticketNumber, counterNumber) {
            try {
                console.log('🎵 Starting announcement...');
                console.log('📊 Input - Ticket:', ticketNumber, 'Counter:', counterNumber);
                
                // 1. پخش شماره نوبت
                await this.playNumberSound(ticketNumber);
                
                // 2. پخش شماره باجه
                console.log('🔢 Using counter number from input:', counterNumber);
                await this.playCounterSound(counterNumber);
                
                console.log('✅ Announcement completed');
                
            } catch (error) {
                console.error('❌ Error in announcement:', error);
                throw error;
            }
        }

        // ✅ پخش یک اعلان کامل برای نوبت عکاسی
        async playPhotographySingleAnnouncement(ticketNumber, counterNumber) {
            try {
                // پخش شماره نوبت
                console.log(`🔢 Display: Playing photography ticket number: ${ticketNumber}`);
                await this.playNumberSound(ticketNumber);
                
                // پخش شماره باجه
                console.log(`🔢 Display: Playing photography counter number: ${counterNumber}`);
                await this.playCounterSound(counterNumber);
                
            } catch (error) {
                console.error('Display: Error in photography announcement:', error);
                throw error;
            }
        }

        // ✅ پخش شماره باجه - ساده‌شده
        async playCounterSound(counterNumber) {
            if (!this.isAudioEnabled || !this.userInteracted) {
                throw new Error('Audio disabled or user not interacted');
            }
            
            console.log('🔊 playCounterSound called with:', counterNumber);
            
            // تبدیل به عدد
            const counterNum = parseInt(counterNumber) || 1;
            
            // محدود کردن به 1-10
            const safeCounterNum = Math.max(1, Math.min(10, counterNum));
            
            // تبدیل عدد به نام انگلیسی
            const numberToEnglish = {
                1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five',
                6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten'
            };
            
            const englishName = numberToEnglish[safeCounterNum] || 'one';
            const counterFile = `${englishName}.mp3`;
            
            console.log(`🔊 Playing counter sound: sounds2/${counterFile} (number: ${safeCounterNum})`);
            
            try {
                await this.playAudioFile(`sounds2/${counterFile}`);
                console.log('✅ Counter sound played successfully');
            } catch (error) {
                console.error(`❌ Error playing counter sound ${counterFile}:`, error);
                // فال‌بک به شماره 1
                await this.playAudioFile('sounds2/one.mp3');
            }
        }

        // ✅ پخش شماره نوبت - اصلاح شده
        async playNumberSound(number) {
            if (!this.isAudioEnabled || !this.userInteracted) {
                throw new Error('Audio disabled or user not interacted');
            }
            
            // تبدیل شماره به فرمت 4 رقمی صحیح
            let formattedNumber;
            if (number === 'پاس' || !number) {
                formattedNumber = '0001'; // استفاده از فایل پیش‌فرض برای پاس
            } else {
                // حذف صفرهای ابتدایی و تبدیل به عدد
                const num = parseInt(number.toString().replace(/^0+/, '') || '1');
                formattedNumber = String(num).padStart(4, '0');
            }
            
            const audioPath = `sounds/${formattedNumber}.mp3`;
            console.log(`🔊 Playing number sound: ${audioPath} (original: ${number})`);
            
            try {
                await this.playAudioFile(audioPath);
            } catch (error) {
                console.error(`❌ Error playing number sound ${audioPath}:`, error);
                throw error;
            }
        }

        // ✅ پخش فایل صوتی با کش کردن
        async playAudioFile(filePath) {
            return new Promise((resolve, reject) => {
                if (!this.userInteracted) {
                    reject(new Error('User has not interacted with document yet'));
                    return;
                }
                
                // بررسی کش
                if (this.audioCache.has(filePath)) {
                    const audio = this.audioCache.get(filePath);
                    audio.currentTime = 0;
                    audio.play().then(resolve).catch(reject);
                    return;
                }
                
                // ایجاد المان صوتی جدید
                const audio = new Audio(filePath);
                audio.volume = this.volume;
                
                audio.onended = () => {
                    console.log(`✅ Audio finished: ${filePath}`);
                    resolve();
                };
                
                audio.onerror = (error) => {
                    console.error(`❌ Audio error: ${filePath}`, error);
                    this.audioCache.delete(filePath);
                    reject(error);
                };
                
                // ذخیره در کش
                this.audioCache.set(filePath, audio);
                
                // پخش
                audio.play().then(resolve).catch(reject);
            });
        }

        // ✅ پیش‌بارگذاری صداهای مهم
        preloadImportantSounds() {
            if (!this.userInteracted) return;
            
            const importantSounds = [
                'sounds/0001.mp3',
                'sounds2/one.mp3',
                'sounds2/two.mp3',
                'sounds2/three.mp3'
            ];
            
            importantSounds.forEach(sound => {
                const audio = new Audio();
                audio.src = sound;
                audio.preload = 'auto';
                audio.load();
                this.audioCache.set(sound, audio);
            });
            
            console.log('🔊 Preloaded important sounds');
        }

        // ✅ فعال/غیرفعال کردن صدا
        toggleAudio() {
            this.isAudioEnabled = !this.isAudioEnabled;
            console.log(`🔊 Audio ${this.isAudioEnabled ? 'enabled' : 'disabled'}`);
            
            if (!this.isAudioEnabled) {
                this.stopAllAudio();
            }
            
            return this.isAudioEnabled;
        }

        // ✅ تنظیم حجم
        setVolume(volume) {
            this.volume = Math.max(0, Math.min(1, volume));
            console.log(`🔊 Volume set to: ${this.volume}`);
            
            // به‌روزرسانی حجم برای تمام صداهای کش‌شده
            this.audioCache.forEach(audio => {
                audio.volume = this.volume;
            });
        }
    }

    // --- Initialize Sound Manager ---
    const soundManager = new DisplaySoundManager();

    // --- State Management ---
    let lastCalledTickets = [];
    let waitingList = [];
    let photographyList = [];
    let services = [];
    let lastProcessedTicketId = null;
    let lastPhotographyTicketId = null;

    // --- DOM Elements ---
    const ticketsContainer = document.querySelector('.tickets-container');
    const waitingListElement = document.getElementById('waiting-list');
    const photographyListElement = document.querySelector('.photography-list');
    const photographyWaitingElement = document.querySelector('.photography-waiting');

    // --- Helper Functions ---
    function formatTime(date) {
        return new Date(date).toLocaleTimeString('fa-IR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function getCounterName(counterNumber) {
        const counterNames = {
            1: 'باجه ۱',
            2: 'باجه ۲',
            3: 'باجه ۳',
            4: 'باجه ۴',
            5: 'باجه ۵',
            6: 'باجه ۶',
            7: 'باجه ۷',
            8: 'باجه ۸',
            9: 'باجه ۹',
            10: 'باجه ۱۰'
        };
        return counterNames[counterNumber] || `باجه ${counterNumber}`;
    }

    function createTicketCard(ticket, index) {
        const card = document.createElement('div');
        card.className = `ticket-card ${index === 0 ? 'recent' : 'old'}`;
        
        const ticketNumber = ticket.specific_ticket || 'پاس';
        const counterName = ticket.called_by_counter_name || 'باجه';
        const callTime = ticket.call_time || ticket.$createdAt;
        
        card.innerHTML = `
            <div class="ticket-number-large">${ticketNumber}</div>
            <div class="ticket-info">
                <div>${counterName}</div>
                <div class="counter-name">${ticket.service_name || 'خدمات'}</div>
                ${ticket.returned_from_photography ? '<div class="photography-badge">📸 بازگشته از عکاسی</div>' : ''}
            </div>
            <div class="ticket-time">${formatTime(callTime)}</div>
        `;
        
        return card;
    }

    function updateTicketsDisplay(tickets) {
        ticketsContainer.innerHTML = '';
        
        if (tickets.length === 0) {
            const placeholder = document.createElement('div');
            placeholder.className = 'ticket-card placeholder';
            placeholder.innerHTML = `
                <div class="ticket-number-large">---</div>
                <div class="ticket-info">منتظر فراخوان...</div>
                <div class="ticket-time">--:--</div>
            `;
            ticketsContainer.appendChild(placeholder);
            return;
        }
        
        tickets.slice(0, 3).forEach((ticket, index) => {
            const card = createTicketCard(ticket, index);
            ticketsContainer.appendChild(card);
        });
    }

    function updateWaitingListDisplay() {
        waitingListElement.innerHTML = '';
        
        if (waitingList.length === 0) {
            waitingListElement.innerHTML = '<div class="waiting-empty">هیچ نوبتی در انتظار نیست</div>';
            return;
        }
        
        // گروه‌بندی بر اساس سرویس
        const serviceGroups = {};
        waitingList.forEach(item => {
            const serviceName = item.service_name || 'خدمت ناشناخته';
            if (!serviceGroups[serviceName]) {
                serviceGroups[serviceName] = [];
            }
            serviceGroups[serviceName].push(item);
        });
        
        // ایجاد آیتم برای هر سرویس
        Object.entries(serviceGroups).forEach(([serviceName, items]) => {
            const waitingItem = document.createElement('div');
            waitingItem.className = 'waiting-item';
            waitingItem.innerHTML = `
                <div class="service-name">${serviceName}</div>
                <div class="waiting-count">منتظران: ${items.length}</div>
            `;
            waitingListElement.appendChild(waitingItem);
        });
    }

    function updatePhotographyDisplay() {
        photographyListElement.innerHTML = '';
        
        if (photographyList.length === 0) {
            photographyListElement.innerHTML = '<div class="photography-empty">هیچ نوبتی در لیست عکاسی وجود ندارد</div>';
            photographyWaitingElement.textContent = 'منتظران: ۰';
            return;
        }
        
        photographyWaitingElement.textContent = `منتظران: ${photographyList.length}`;
        
        // نمایش نوبت‌های عکاسی به صورت ستونی
        photographyList.forEach((item, index) => {
            const photographyItem = document.createElement('div');
            photographyItem.className = 'photography-item';
            
            // اگر این نوبت جدید است، کلاس انیمیشن اضافه کن
            if (item.$id === lastPhotographyTicketId) {
                photographyItem.classList.add('new-item');
            }
            
            photographyItem.innerHTML = `
                <div class="photography-number">${index + 1}</div>
                <div class="photography-info">
                    <div class="photography-ticket">${item.ticketNumber || '---'}</div>
                    <div class="photography-customer-name">${item.firstName || ''} ${item.lastName || ''}</div>
                    <div class="photography-national-id">${item.nationalId || '---'}</div>
                    <div class="photography-status status-waiting">در انتظار عکاسی</div>
                </div>
            `;
            
            photographyListElement.appendChild(photographyItem);
        });
    }

    // --- Data Fetching Functions ---
    async function fetchLastCalledTickets() {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                TICKETS_COLLECTION_ID,
                [
                    Query.equal('status', 'در حال سرویس'),
                    Query.orderDesc('call_time'),
                    Query.limit(3)
                ]
            );
            
            // دریافت اطلاعات سرویس‌ها برای نمایش نام
            const servicesData = await fetchServices();
            const servicesMap = {};
            servicesData.forEach(service => {
                servicesMap[service.$id] = service.name;
            });
            
            const tickets = response.documents.map(doc => ({
                ...doc,
                service_name: servicesMap[doc.service_id] || 'خدمت ناشناخته'
            }));
            
            return tickets;
        } catch (error) {
            console.error('Error fetching last called tickets:', error);
            return [];
        }
    }

    async function fetchWaitingList() {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                TICKETS_COLLECTION_ID,
                [
                    Query.equal('status', 'در حال انتظار'),
                    Query.orderAsc('$createdAt')
                ]
            );
            
            // دریافت اطلاعات سرویس‌ها برای نمایش نام
            const servicesData = await fetchServices();
            const servicesMap = {};
            servicesData.forEach(service => {
                servicesMap[service.$id] = service.name;
            });
            
            const waiting = response.documents.map(doc => ({
                ...doc,
                service_name: servicesMap[doc.service_id] || 'خدمت ناشناخته'
            }));
            
            return waiting;
        } catch (error) {
            console.error('Error fetching waiting list:', error);
            return [];
        }
    }

    async function fetchPhotographyList() {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                PHOTOGRAPHY_COLLECTION_ID,
                [
                    Query.equal('status', 'در انتظار'),
                    Query.orderAsc('$createdAt')
                ]
            );
            
            return response.documents;
        } catch (error) {
            console.error('Error fetching photography list:', error);
            return [];
        }
    }

    async function fetchServices() {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                SERVICES_COLLECTION_ID
            );
            
            return response.documents;
        } catch (error) {
            console.error('Error fetching services:', error);
            return [];
        }
    }

    // --- Real-time Updates ---
    function setupRealTimeUpdates() {
        // Subscribe to tickets collection
        const unsubscribeTickets = client.subscribe(
            `databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents`,
            response => {
                console.log('Real-time update for tickets:', response);
                handleTicketsUpdate(response);
            }
        );

        // Subscribe to photography collection
        const unsubscribePhotography = client.subscribe(
            `databases.${DATABASE_ID}.collections.${PHOTOGRAPHY_COLLECTION_ID}.documents`,
            response => {
                console.log('Real-time update for photography:', response);
                handlePhotographyUpdate(response);
            }
        );

        return () => {
            unsubscribeTickets();
            unsubscribePhotography();
        };
    }

    async function handleTicketsUpdate(response) {
        const { event, payload } = response;
        
        if (event === 'databases.*.collections.*.documents.*.create' || 
            event === 'databases.*.collections.*.documents.*.update') {
            
            // اگر نوبت فراخوانده شده
            if (payload.status === 'در حال سرویس') {
                console.log('New called ticket detected:', payload);
                
                // جلوگیری از پردازش تکراری
                if (payload.$id === lastProcessedTicketId) {
                    console.log('Skipping duplicate ticket processing');
                    return;
                }
                
                lastProcessedTicketId = payload.$id;
                
                // پخش اعلان صوتی
                await soundManager.playCallAnnouncement(
                    payload.specific_ticket || 'پاس',
                    payload.counter_number || 1,
                    payload
                );
                
                // به‌روزرسانی نمایش
                await refreshAllData();
            }
        }
        
        // به‌روزرسانی لیست منتظران برای هر تغییری
        if (event.includes('.create') || event.includes('.update') || event.includes('.delete')) {
            await refreshWaitingList();
        }
    }

    async function handlePhotographyUpdate(response) {
        const { event, payload } = response;
        
        if (event === 'databases.*.collections.*.documents.*.create') {
            console.log('New photography ticket detected:', payload);
            
            // جلوگیری از پردازش تکراری
            if (payload.$id === lastPhotographyTicketId) {
                console.log('Skipping duplicate photography ticket processing');
                return;
            }
            
            lastPhotographyTicketId = payload.$id;
            
            // پخش اعلان صوتی برای نوبت عکاسی
            await soundManager.playPhotographyAnnouncement(
                payload.ticketNumber || 'پاس',
                payload.counter_number || 1,
                payload
            );
            
            // به‌روزرسانی نمایش
            await refreshPhotographyList();
        }
        
        // به‌روزرسانی لیست عکاسی برای هر تغییری
        if (event.includes('.create') || event.includes('.update') || event.includes('.delete')) {
            await refreshPhotographyList();
        }
    }

    // --- Data Refresh Functions ---
    async function refreshAllData() {
        await Promise.all([
            refreshLastCalledTickets(),
            refreshWaitingList(),
            refreshPhotographyList()
        ]);
    }

    async function refreshLastCalledTickets() {
        lastCalledTickets = await fetchLastCalledTickets();
        updateTicketsDisplay(lastCalledTickets);
    }

    async function refreshWaitingList() {
        waitingList = await fetchWaitingList();
        updateWaitingListDisplay();
    }

    async function refreshPhotographyList() {
        photographyList = await fetchPhotographyList();
        updatePhotographyDisplay();
    }

    // --- Initialization ---
    async function initialize() {
        try {
            console.log('Initializing display...');
            
            // بارگذاری اولیه داده‌ها
            await refreshAllData();
            
            // راه‌اندازی به‌روزرسانی‌های لحظه‌ای
            setupRealTimeUpdates();
            
            console.log('Display initialized successfully');
            
        } catch (error) {
            console.error('Error initializing display:', error);
        }
    }

    // شروع برنامه
    initialize();

    // به‌روزرسانی دوره‌ای برای اطمینان (هر 30 ثانیه)
    setInterval(() => {
        refreshAllData();
    }, 30000);

    // --- Global Functions for Testing ---
    window.testAnnouncement = (ticketNumber = 'A001', counterNumber = 1) => {
        soundManager.playCallAnnouncement(ticketNumber, counterNumber);
    };

    window.testPhotographyAnnouncement = (ticketNumber = 'P001', counterNumber = 1) => {
        soundManager.playPhotographyAnnouncement(ticketNumber, counterNumber);
    };

    window.repeatLastAnnouncement = () => {
        soundManager.repeatLastAnnouncement();
    };

    window.toggleAudio = () => {
        return soundManager.toggleAudio();
    };

    window.setVolume = (volume) => {
        soundManager.setVolume(volume);
    };
});