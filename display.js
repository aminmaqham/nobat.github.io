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

        setupUserInteraction() {
            const interactionHandler = () => {
                if (!this.userInteracted) {
                    console.log('✅ User interacted with document, audio enabled');
                    this.userInteracted = true;
                    this.hideAudioPrompt();
                    this.preloadImportantSounds();
                }
            };

            document.addEventListener('click', interactionHandler, { once: true });
            document.addEventListener('keydown', interactionHandler, { once: true });
            document.addEventListener('touchstart', interactionHandler, { once: true });

            this.showAudioPrompt();
        }

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

        hideAudioPrompt() {
            const prompt = document.getElementById('audio-activation-prompt');
            if (prompt) {
                prompt.remove();
            }
        }

        async playCallAnnouncement(ticketNumber, counterNumber, ticketData = null) {
            if (!this.isAudioEnabled) return;
            
            if (!this.userInteracted) {
                console.log('🔇 Waiting for user interaction before playing audio');
                this.showAudioPrompt();
                return;
            }
            
            const currentTicketKey = `${ticketNumber}-${counterNumber}`;
            if (this.lastPlayedTicket === currentTicketKey) {
                console.log('🔇 Skipping duplicate ticket announcement:', currentTicketKey);
                return;
            }
            
            this.lastPlayedTicket = currentTicketKey;
            
            console.log(`🎵 Display: Playing announcement: Ticket ${ticketNumber}, Counter ${counterNumber}`);
            
            if (this.audioQueue.length > 0) {
                console.log('🔄 Clearing old audio queue, starting fresh');
                this.audioQueue = [];
                this.isPlaying = false;
            }
            
            this.currentAnnouncement = { ticketNumber, counterNumber, ticketData };
            this.audioQueue.push({ ticketNumber, counterNumber, ticketData, type: 'normal' });
            
            await this.processQueue();
        }

        async playPhotographyAnnouncement(ticketNumber, counterNumber, ticketData = null) {
            if (!this.isAudioEnabled) return;
            
            if (!this.userInteracted) {
                console.log('🔇 Waiting for user interaction before playing audio');
                this.showAudioPrompt();
                return;
            }
            
            console.log(`🎵 Display: Playing photography announcement: Ticket ${ticketNumber}, Counter ${counterNumber}`);
            
            if (this.audioQueue.length > 0) {
                console.log('🔄 Clearing old audio queue, starting fresh');
                this.audioQueue = [];
                this.isPlaying = false;
            }
            
            this.currentAnnouncement = { ticketNumber, counterNumber, ticketData };
            this.audioQueue.push({ ticketNumber, counterNumber, ticketData, type: 'photography' });
            
            await this.processQueue();
        }

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

            this.audioQueue.unshift({ ticketNumber, counterNumber, ticketData, type: 'repeat' });
            
            if (!this.isPlaying) {
                await this.processQueue();
            }
        }

        async processQueue() {
            if (this.isPlaying || this.audioQueue.length === 0) return;
            
            this.isPlaying = true;
            
            const { ticketNumber, counterNumber, ticketData, type } = this.audioQueue[0];
            
            try {
                console.log(`🔊 Display: Processing: Ticket ${ticketNumber}, Counter ${counterNumber}, Type: ${type}`);
                
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
            
            this.audioQueue.shift();
            this.isPlaying = false;
            
            if (this.audioQueue.length > 0) {
                setTimeout(() => {
                    this.processQueue();
                }, 500);
            }
        }

        stopAllAudio() {
            document.querySelectorAll('audio').forEach(audio => {
                audio.pause();
                audio.currentTime = 0;
            });
            
            this.audioCache.clear();
        }

        async playSingleAnnouncement(ticketNumber, counterNumber) {
            try {
                console.log('🎵 Starting announcement...');
                console.log('📊 Input - Ticket:', ticketNumber, 'Counter:', counterNumber);
                
                await this.playNumberSound(ticketNumber);
                await this.playCounterSound(counterNumber);
                
                console.log('✅ Announcement completed');
                
            } catch (error) {
                console.error('❌ Error in announcement:', error);
                throw error;
            }
        }

        async playPhotographySingleAnnouncement(ticketNumber, counterNumber) {
            try {
                console.log(`🔢 Display: Playing photography ticket number: ${ticketNumber}`);
                await this.playNumberSound(ticketNumber);
                console.log(`🔢 Display: Playing photography counter number: ${counterNumber}`);
                await this.playCounterSound(counterNumber);
                
            } catch (error) {
                console.error('Display: Error in photography announcement:', error);
                throw error;
            }
        }

        async playCounterSound(counterNumber) {
            if (!this.isAudioEnabled || !this.userInteracted) {
                throw new Error('Audio disabled or user not interacted');
            }
            
            console.log('🔊 playCounterSound called with:', counterNumber);
            
            const counterNum = parseInt(counterNumber) || 1;
            const safeCounterNum = Math.max(1, Math.min(10, counterNum));
            
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
                await this.playAudioFile('sounds2/one.mp3');
            }
        }

        async playNumberSound(number) {
            if (!this.isAudioEnabled || !this.userInteracted) {
                throw new Error('Audio disabled or user not interacted');
            }
            
            let formattedNumber;
            if (number === 'پاس' || !number) {
                formattedNumber = '0001';
            } else {
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

        async playAudioFile(filePath) {
            return new Promise((resolve, reject) => {
                if (!this.userInteracted) {
                    reject(new Error('User has not interacted with document yet'));
                    return;
                }
                
                if (this.audioCache.has(filePath)) {
                    const audio = this.audioCache.get(filePath);
                    audio.currentTime = 0;
                    audio.play().then(resolve).catch(reject);
                    return;
                }
                
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
                
                this.audioCache.set(filePath, audio);
                audio.play().then(resolve).catch(reject);
            });
        }

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

        toggleAudio() {
            this.isAudioEnabled = !this.isAudioEnabled;
            console.log(`🔊 Audio ${this.isAudioEnabled ? 'enabled' : 'disabled'}`);
            
            if (!this.isAudioEnabled) {
                this.stopAllAudio();
            }
            
            return this.isAudioEnabled;
        }

        setVolume(volume) {
            this.volume = Math.max(0, Math.min(1, volume));
            console.log(`🔊 Volume set to: ${this.volume}`);
            
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
    const customerName = `${ticket.first_name || ''} ${ticket.last_name || ''}`.trim() || 'نامشخص';
    
    card.innerHTML = `
        <div class="ticket-number-large">${ticketNumber}</div>
        <div class="ticket-info">
            <div>${counterName}</div>
            <div class="counter-name">${ticket.service_name || 'خدمات'}</div>
            <div class="customer-name">${customerName}</div>
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
            <div class="waiting-count">${items.length}</div>
        `;
        waitingListElement.appendChild(waitingItem);
    });
}

function updatePhotographyDisplay() {
    photographyListElement.innerHTML = '';
    
    if (photographyList.length === 0) {
        photographyListElement.innerHTML = '<div class="photography-empty">هیچ نوبتی در لیست عکاسی وجود ندارد</div>';
        photographyWaitingElement.textContent = '۰';
        return;
    }
    
    photographyWaitingElement.textContent = `${photographyList.length}`;
    
    photographyList.forEach((item, index) => {
        const photographyItem = document.createElement('div');
        photographyItem.className = 'photography-item';
        
        if (item.$id === lastPhotographyTicketId) {
            photographyItem.classList.add('new-item');
        }
        
        photographyItem.innerHTML = `
            <div class="photography-number">${index + 1}</div>
            <div class="photography-info">
                <div class="photography-ticket-line">
                    <div class="photography-ticket">${item.ticketNumber || '---'}</div>
                    <div class="photography-status">در انتظار</div>
                </div>
                <div class="photography-national-id">${item.nationalId || '---'}</div>
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
        console.log('🔔 Setting up real-time updates...');
        
        try {
            // Subscribe to tickets collection
            client.subscribe(
                `databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents`,
                response => {
                    console.log('📡 Real-time update for tickets:', response);
                    handleTicketsUpdate(response);
                }
            );

            // Subscribe to photography collection
            client.subscribe(
                `databases.${DATABASE_ID}.collections.${PHOTOGRAPHY_COLLECTION_ID}.documents`,
                response => {
                    console.log('📡 Real-time update for photography:', response);
                    handlePhotographyUpdate(response);
                }
            );
            
            console.log('✅ Real-time updates setup completed');
        } catch (error) {
            console.error('❌ Error setting up real-time updates:', error);
        }
    }

    async function handleTicketsUpdate(response) {
        try {
            console.log('🔄 Processing tickets update:', response);
            
            if (!response || !response.events) {
                console.log('⚠️ Invalid response format, skipping');
                return;
            }
            
            const events = response.events;
            const payload = response.payload;
            
            console.log('📋 Events:', events);
            console.log('📦 Payload:', payload);
            
            // بررسی ایجاد یا به‌روزرسانی نوبت
            if (events.some(event => 
                event.includes('.create') || 
                event.includes('.update') || 
                event.includes('.delete')
            )) {
                console.log('🔄 Ticket change detected, refreshing data...');
                
                // اگر نوبت جدید فراخوانده شده
                if (payload && payload.status === 'در حال سرویس') {
                    console.log('🎯 New called ticket detected:', payload);
                    
                    if (payload.$id === lastProcessedTicketId) {
                        console.log('🔇 Skipping duplicate ticket processing');
                        return;
                    }
                    
                    lastProcessedTicketId = payload.$id;
                    
                    // پخش اعلان صوتی
                    await soundManager.playCallAnnouncement(
                        payload.specific_ticket || 'پاس',
                        extractCounterNumber(payload.called_by_counter_name) || 1,
                        payload
                    );
                }
                
                // به‌روزرسانی تمام داده‌ها
                await refreshAllData();
            }
            
        } catch (error) {
            console.error('❌ Error handling tickets update:', error);
        }
    }

    async function handlePhotographyUpdate(response) {
        try {
            console.log('🔄 Processing photography update:', response);
            
            if (!response || !response.events) {
                console.log('⚠️ Invalid response format, skipping');
                return;
            }
            
            const events = response.events;
            const payload = response.payload;
            
            console.log('📋 Photography Events:', events);
            console.log('📦 Photography Payload:', payload);
            
            // بررسی ایجاد نوبت عکاسی جدید
            if (events.some(event => event.includes('.create'))) {
                console.log('🎯 New photography ticket detected:', payload);
                
                if (payload.$id === lastPhotographyTicketId) {
                    console.log('🔇 Skipping duplicate photography ticket processing');
                    return;
                }
                
                lastPhotographyTicketId = payload.$id;
                
                // پخش اعلان صوتی برای نوبت عکاسی
                await soundManager.playPhotographyAnnouncement(
                    payload.ticketNumber || 'پاس',
                    extractCounterNumber(payload.originalCounterName) || 1,
                    payload
                );
                
                await refreshPhotographyList();
            }
            
            // به‌روزرسانی برای تغییرات دیگر
            if (events.some(event => 
                event.includes('.update') || 
                event.includes('.delete')
            )) {
                await refreshPhotographyList();
            }
            
        } catch (error) {
            console.error('❌ Error handling photography update:', error);
        }
    }

    // تابع استخراج شماره باجه
    function extractCounterNumber(counterName) {
        if (!counterName) return '1';
        
        console.log('🔍 Extracting counter number from:', counterName);
        
        const numbersFromEnd = counterName.match(/\d+$/);
        if (numbersFromEnd) {
            const num = numbersFromEnd[0];
            console.log(`✅ Counter number extracted from end: ${num}`);
            return num;
        }
        
        const numbersAnywhere = counterName.match(/\d+/);
        if (numbersAnywhere) {
            const num = numbersAnywhere[0];
            console.log(`✅ Counter number extracted from anywhere: ${num}`);
            return num;
        }
        
        const wordToNumber = {
            'یک': '1', 'اول': '1', '۱': '1',
            'دو': '2', 'دوم': '2', '۲': '2',
            'سه': '3', 'سوم': '3', '۳': '3', 
            'چهار': '4', 'چهارم': '4', '۴': '4',
            'پنج': '5', 'پنجم': '5', '۵': '5',
            'شش': '6', 'ششم': '6', '۶': '6',
            'هفت': '7', 'هفتم': '7', '۷': '7',
            'هشت': '8', 'هشتم': '8', '۸': '8',
            'نه': '9', 'نهم': '9', '۹': '9',
            'ده': '10', 'دهم': '10', '۱۰': '10'
        };
        
        for (const [word, num] of Object.entries(wordToNumber)) {
            if (counterName.includes(word)) {
                console.log(`✅ Counter number extracted from word "${word}": ${num}`);
                return num;
            }
        }
        
        console.log('❌ No counter number found, using default: 1');
        return '1';
    }

    // --- Data Refresh Functions ---
    async function refreshAllData() {
        try {
            console.log('🔄 Refreshing all data...');
            await Promise.all([
                refreshLastCalledTickets(),
                refreshWaitingList(),
                refreshPhotographyList()
            ]);
            console.log('✅ All data refreshed successfully');
        } catch (error) {
            console.error('❌ Error refreshing all data:', error);
        }
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
            console.log('🚀 Initializing display system...');
            
            // بارگذاری اولیه داده‌ها
            await refreshAllData();
            
            // راه‌اندازی به‌روزرسانی‌های لحظه‌ای
            setupRealTimeUpdates();
            
            console.log('✅ Display system initialized successfully');
            
        } catch (error) {
            console.error('❌ Error initializing display system:', error);
        }
    }

    // شروع برنامه
    initialize();

    // به‌روزرسانی دوره‌ای برای اطمینان (هر 30 ثانیه)
    setInterval(() => {
        console.log('⏰ Periodic refresh...');
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

    // تابع برای تست real-time
    window.forceRefresh = () => {
        console.log('🔄 Forcing manual refresh...');
        refreshAllData();
    };
});