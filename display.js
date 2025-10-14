document.addEventListener('DOMContentLoaded', () => {
    // --- APPWRITE SETUP ---
    const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
    const APPWRITE_PROJECT_ID = '68a8d1b0000e80bdc1f3';
    const DATABASE_ID = '68a8d24b003cd6609e37';
    const TICKETS_COLLECTION_ID = '68a8d63a003a3a6afa24';
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
                
                // فال‌بک: استفاده از فایل پیش‌فرض
                if (formattedNumber !== '0001') {
                    console.log('🔄 Falling back to default number sound: 0001.mp3');
                    await this.playAudioFile('sounds/0001.mp3');
                }
            }
        }

        // ✅ پخش فایل صوتی - مقاوم در برابر خطا
        async playAudioFile(filePath) {
            return new Promise((resolve, reject) => {
                if (!this.isAudioEnabled || !this.userInteracted) {
                    reject(new Error('Audio disabled or user not interacted'));
                    return;
                }

                console.log(`🔊 Display: Loading audio: ${filePath}`);

                // بررسی کش
                if (this.audioCache.has(filePath)) {
                    const cachedAudio = this.audioCache.get(filePath);
                    console.log(`✅ Display: Using cached audio: ${filePath}`);
                    this.playCachedAudio(cachedAudio, resolve, reject);
                    return;
                }

                // بارگذاری جدید
                const audio = new Audio();
                audio.volume = this.volume;
                audio.preload = 'auto';
                
                let hasResolved = false;
                let loadTimeout;

                const resolveOnce = () => {
                    if (!hasResolved) {
                        hasResolved = true;
                        clearTimeout(loadTimeout);
                        console.log(`✅ Display: Audio completed: ${filePath}`);
                        resolve();
                    }
                };

                const rejectOnce = (error) => {
                    if (!hasResolved) {
                        hasResolved = true;
                        clearTimeout(loadTimeout);
                        console.error(`❌ Display: Audio error for ${filePath}:`, error);
                        reject(error);
                    }
                };

                const onCanPlay = () => {
                    console.log(`✅ Display: Audio ready: ${filePath}`);
                    
                    const playPromise = audio.play();
                    
                    if (playPromise !== undefined) {
                        playPromise
                            .then(() => {
                                console.log(`🎵 Display: Audio playing: ${filePath}`);
                                audio.addEventListener('ended', resolveOnce, { once: true });
                                audio.addEventListener('error', rejectOnce, { once: true });
                                
                                // ذخیره در کش
                                if (!this.audioCache.has(filePath)) {
                                    const audioClone = new Audio();
                                    audioClone.src = audio.src;
                                    audioClone.preload = 'auto';
                                    this.audioCache.set(filePath, audioClone);
                                }
                            })
                            .catch(error => {
                                console.error(`❌ Display: Play error for ${filePath}:`, error);
                                rejectOnce(error);
                            });
                    }
                };

                const onError = (e) => {
                    console.error(`❌ Display: Audio load error: ${filePath}`, e);
                    rejectOnce(new Error(`File not found or cannot load: ${filePath}`));
                };

                audio.addEventListener('canplaythrough', onCanPlay, { once: true });
                audio.addEventListener('error', onError, { once: true });

                // افزایش timeout به 10 ثانیه
                loadTimeout = setTimeout(() => {
                    if (!hasResolved) {
                        console.warn(`⏰ Display: Audio timeout: ${filePath}`);
                        rejectOnce(new Error('Audio load timeout'));
                    }
                }, 10000);

                // تنظیم src و شروع بارگذاری
                audio.src = filePath;
            });
        }

        // ✅ پخش صدا از کش
        playCachedAudio(audio, resolve, reject) {
            const audioClone = new Audio();
            audioClone.src = audio.src;
            audioClone.volume = this.volume;
            
            const playPromise = audioClone.play();
            
            playPromise
                .then(() => {
                    audioClone.addEventListener('ended', () => {
                        console.log('✅ Display: Cached audio completed');
                        resolve();
                    }, { once: true });
                    
                    audioClone.addEventListener('error', (error) => {
                        console.error('❌ Display: Cached audio error:', error);
                        reject(error);
                    }, { once: true });
                })
                .catch(error => {
                    console.error('❌ Display: Cached audio play error:', error);
                    reject(error);
                });
        }

        // ✅ پیش‌بارگذاری صداهای مهم
        async preloadImportantSounds() {
            if (!this.userInteracted) return;
            
            console.log('🔄 Preloading important sounds...');
            
            // فایل‌های انگلیسی برای شماره‌های باجه
            const englishNumbers = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
            
            const importantSounds = englishNumbers.map(name => `${name}.mp3`);
            
            // پیش‌بارگذاری موازی برای عملکرد بهتر
            const preloadPromises = importantSounds.map(soundFile => 
                this.preloadAudioFile(`sounds2/${soundFile}`)
            );
            
            try {
                await Promise.all(preloadPromises);
                console.log('✅ Important sounds preloaded');
            } catch (error) {
                console.warn('⚠️ Some sounds failed to preload:', error);
            }
        }

        // ✅ پیش‌بارگذاری فایل صوتی
        async preloadAudioFile(filePath) {
            return new Promise((resolve) => {
                if (this.audioCache.has(filePath)) {
                    resolve();
                    return;
                }

                const audio = new Audio();
                audio.preload = 'auto';
                
                audio.addEventListener('canplaythrough', () => {
                    this.audioCache.set(filePath, audio);
                    console.log(`✅ Preloaded: ${filePath}`);
                    resolve();
                }, { once: true });
                
                audio.addEventListener('error', () => {
                    console.warn(`❌ Failed to preload: ${filePath}`);
                    resolve();
                }, { once: true });
                
                audio.src = filePath;
            });
        }
    }

    // ایجاد نمونه و قرار دادن در global scope
    const displaySoundManager = new DisplaySoundManager();
    window.displaySoundManager = displaySoundManager;

    // --- DOM Elements ---
    const ticketsContainer = document.querySelector('.tickets-container');
    const photographyList = document.querySelector('.photography-list');
    const photographyWaiting = document.querySelector('.photography-waiting');

// --- به‌روزرسانی تابع updateDisplay ---
async function updateDisplay() {
    try {
        const ticketsResponse = await databases.listDocuments(
            DATABASE_ID,
            TICKETS_COLLECTION_ID,
            [
                Query.equal('status', 'در حال سرویس'),
                Query.orderDesc('call_time'),
                Query.limit(3)
            ]
        );

        const calledTickets = ticketsResponse.documents;
        updateTicketsDisplay(calledTickets);
        await updateWaitingList(); // اضافه کردن این خط
        await updatePhotographyDisplay();

    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

    async function updatePhotographyDisplay() {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                PHOTOGRAPHY_COLLECTION_ID,
                [
                    Query.equal('status', 'در انتظار'),
                    Query.equal('photoTaken', false),
                    Query.orderAsc('timestamp'),
                    Query.limit(10)
                ]
            );
            
            updatePhotographyList(response.documents);

        } catch (error) {
            console.error("Error fetching photography history:", error);
        }
    }

    // --- تابع جدید برای به‌روزرسانی لیست منتظران ---
async function updateWaitingList() {
    try {
        // دریافت تمام سرویس‌ها
        const servicesResponse = await databases.listDocuments(
            DATABASE_ID,
            SERVICES_COLLECTION_ID,
            [Query.orderAsc('name')]
        );
        
        const activeServices = servicesResponse.documents.filter(service => 
            service.disabled !== true
        );
        
        // دریافت تعداد منتظران برای هر سرویس فعال
        const waitingPromises = activeServices.map(async (service) => {
            const waitingResponse = await databases.listDocuments(
                DATABASE_ID,
                TICKETS_COLLECTION_ID,
                [
                    Query.equal('service_id', service.$id),
                    Query.equal('status', 'در حال انتظار'),
                    Query.limit(1000)
                ]
            );
            
            return {
                name: service.name,
                waitingCount: waitingResponse.documents.length
            };
        });
        
        const waitingData = await Promise.all(waitingPromises);
        
        // رندر لیست منتظران
        renderWaitingList(waitingData);
        
    } catch (error) {
        console.error("Error fetching waiting list:", error);
    }
}

// --- تابع رندر لیست منتظران ---
function renderWaitingList(waitingData) {
    const waitingList = document.getElementById('waiting-list');
    
    if (!waitingList) return;
    
    if (waitingData.length === 0) {
        waitingList.innerHTML = '<div class="waiting-empty">هیچ نوبتی در انتظار نیست</div>';
        return;
    }
    
    // فیلتر کردن سرویس‌هایی که حداقل یک منتظر دارند
    const servicesWithWaiting = waitingData.filter(item => item.waitingCount > 0);
    
    if (servicesWithWaiting.length === 0) {
        waitingList.innerHTML = '<div class="waiting-empty">هیچ نوبتی در انتظار نیست</div>';
        return;
    }
    
    waitingList.innerHTML = servicesWithWaiting.map((item, index) => `
        <div class="waiting-item">
            <div class="service-name">${index + 1}-${item.name}</div>
            <div class="waiting-count">منتظران: ${item.waitingCount}</div>
        </div>
    `).join('');
}


    function updateTicketsDisplay(tickets) {
        ticketsContainer.innerHTML = '';
        
        if (tickets.length === 0) {
            ticketsContainer.innerHTML = `
                <div class="ticket-card placeholder">
                    <div class="ticket-number-large">---</div>
                    <div class="ticket-info">منتظر فراخوان...</div>
                    <div class="ticket-time">--:--</div>
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
            } else {
                cardClass += ' old';
            }

            // اضافه کردن کلاس برای نوبت‌های بازگشته از عکاسی
            if (ticket.returned_from_photography) {
                cardClass += ' returned-from-photography';
            }

            ticketElement.className = cardClass;
            ticketElement.innerHTML = `
                <div class="ticket-number-large">${ticket.specific_ticket || 'پاس'}</div>
                <div class="ticket-info">
                    <div>شماره ${ticket.specific_ticket || 'پاس'} به ${ticket.called_by_counter_name || 'باجه'}</div>
                    <div class="counter-name">${ticket.called_by_name || 'سیستم'}</div>
                    ${ticket.returned_from_photography ? '<div class="photography-badge">📸 بازگشته از عکاسی</div>' : ''}
                </div>
                <div class="ticket-time">${formatTime(callTime)}</div>
            `;
            
            ticketsContainer.appendChild(ticketElement);
        });
    }

    function updatePhotographyList(photographyItems) {
        const waitingCount = photographyItems.length;
        photographyWaiting.textContent = `منتظران: ${waitingCount}`;

        if (photographyItems.length === 0) {
            photographyList.innerHTML = '<div class="photography-empty">هیچ نوبتی در انتظار عکاسی وجود ندارد</div>';
            return;
        }
        
        photographyList.innerHTML = photographyItems.map((item, index) => `
            <div class="photography-item ${index === 0 ? 'new-item' : ''}">
                <div class="photography-number">${index + 1}</div>
                <div class="photography-info">
                    <div class="photography-ticket">${item.ticketNumber}</div>
                    <div class="photography-customer-name"></div>
                    <div class="photography-national-id">${item.nationalId}</div>
                    <div class="photography-status status-waiting">
                        در انتظار
                    </div>
                </div>
            </div>
        `).join('');
    }

    function formatTime(date) {
        return date.toLocaleTimeString('fa-IR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // گوش دادن به درخواست‌های صدا از طریق Appwrite
    function setupAudioRealtime() {
        const audioChannel = `databases.${DATABASE_ID}.collections.${AUDIO_ANNOUNCEMENTS_COLLECTION_ID}.documents`;
        
        console.log('🔊 Setting up audio real-time listener...');
        
        client.subscribe(audioChannel, response => {
            console.log('🎵 Audio real-time update:', response);
            
            if (response.events.includes(`databases.${DATABASE_ID}.collections.${AUDIO_ANNOUNCEMENTS_COLLECTION_ID}.documents.*.create`)) {
                const audioRequest = response.payload;
                
                // جلوگیری از پردازش درخواست‌های قدیمی
                const requestTime = new Date(audioRequest.timestamp);
                const now = new Date();
                const timeDiff = (now - requestTime) / 1000; // تفاوت به ثانیه
                
                if (timeDiff > 10) { // اگر درخواست بیش از 10 ثانیه قدیمی است، نادیده بگیر
                    console.log('🔇 Ignoring old audio request:', timeDiff, 'seconds ago');
                    return;
                }
                
                console.log('🎵 New audio request received:', audioRequest);
                
                if (audioRequest.type === 'photography') {
                    displaySoundManager.playPhotographyAnnouncement(
                        audioRequest.ticket_number,
                        audioRequest.counter_number,
                        audioRequest
                    );
                } else {
                    displaySoundManager.playCallAnnouncement(
                        audioRequest.ticket_number,
                        audioRequest.counter_number,
                        audioRequest
                    );
                }
            }
        });
    }

// --- به‌روزرسانی تابع setupRealtime ---
function setupRealtime() {
    const ticketChannel = `databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents`;
    const photographyChannel = `databases.${DATABASE_ID}.collections.${PHOTOGRAPHY_COLLECTION_ID}.documents`;
    const servicesChannel = `databases.${DATABASE_ID}.collections.${SERVICES_COLLECTION_ID}.documents`;
    
    client.subscribe(ticketChannel, response => {
        console.log('Display: Realtime update received (UI ONLY):', response);
        updateDisplay(); // فقط UI آپدیت شود
    });
    
    client.subscribe(photographyChannel, response => {
        console.log('Display: Photography history updated via real-time');
        updatePhotographyDisplay(); // فقط UI آپدیت شود
    });
    
    client.subscribe(servicesChannel, response => {
        console.log('Display: Services updated via real-time');
        updateWaitingList(); // به‌روزرسانی لیست منتظران
    });
}

    // تابع initializeDisplay
    function initializeDisplay() {
        console.log('🚀 Initializing display system...');
        
        updateDisplay();
        setupRealtime();
        setupAudioRealtime();
        setInterval(updateDisplay, 30000);
        
        console.log('✅ Display system initialized');
    }

    // --- Start the Display ---
    initializeDisplay();

    // ✅ اضافه کردن تابع تکرار صوت به global scope
    window.repeatLastAnnouncement = function() {
        displaySoundManager.repeatLastAnnouncement();
    };
});