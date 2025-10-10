document.addEventListener('DOMContentLoaded', () => {
    // --- APPWRITE SETUP ---
    const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
    const APPWRITE_PROJECT_ID = '68a8d1b0000e80bdc1f3';
    const DATABASE_ID = '68a8d24b003cd6609e37';
    const TICKETS_COLLECTION_ID = '68a8d63a003a3a6afa24';
    const PHOTOGRAPHY_COLLECTION_ID = 'photography_history';

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
            this.userInteracted = true;
            this.currentAnnouncement = null;
            this.audioCache = new Map();
            this.persistentCache = new Map(); // ✅ کش دائمی برای فایل‌های دانلود شده
            
            // ✅ تنظیم مسیرهای صوتی با آدرس GitHub شما
            this.soundsBasePath = 'https://raw.githubusercontent.com/aminmaqham/nobat.github.io/main/sounds/';
            this.sounds2BasePath = 'https://raw.githubusercontent.com/aminmaqham/nobat.github.io/main/sounds2/';
            
            this.setupAutoInteraction();
            this.setupPersistentCache(); // ✅ راه‌اندازی کش دائمی
        }

        // ✅ راه‌اندازی کش دائمی
        setupPersistentCache() {
            try {
                const cached = localStorage.getItem('audioCache');
                if (cached) {
                    const cacheData = JSON.parse(cached);
                    cacheData.forEach(([key, audioData]) => {
                        if (audioData && audioData.url) {
                            this.persistentCache.set(key, audioData);
                        }
                    });
                    console.log(`✅ Loaded ${this.persistentCache.size} audio files from persistent cache`);
                }
            } catch (error) {
                console.warn('❌ Could not load persistent cache:', error);
            }
        }

        // ✅ ذخیره کش دائمی
        savePersistentCache() {
            try {
                const cacheArray = Array.from(this.persistentCache.entries());
                localStorage.setItem('audioCache', JSON.stringify(cacheArray));
            } catch (error) {
                console.warn('❌ Could not save persistent cache:', error);
            }
        }

        // ✅ تبدیل مسیر نسبی به مطلق
        convertToAbsolutePath(relativePath) {
            if (relativePath.startsWith('sounds/')) {
                return this.soundsBasePath + relativePath.replace('sounds/', '');
            } else if (relativePath.startsWith('sounds2/')) {
                return this.sounds2BasePath + relativePath.replace('sounds2/', '');
            }
            return relativePath;
        }

        // ✅ تنظیم خودکار تعامل
        setupAutoInteraction() {
            console.log('✅ Audio system auto-activated');
            this.userInteracted = true;
            this.preloadImportantSounds();
        }

        // ✅ پیش‌بارگذاری صداهای مهم
        async preloadImportantSounds() {
            const importantSounds = ['bajeh.mp3'];
            
            // پیش‌بارگذاری اعداد ۱ تا ۲۰ برای شماره باجه
            for (let i = 1; i <= 20; i++) {
                const soundFile = this.getCounterSoundFile(i.toString());
                if (soundFile) {
                    importantSounds.push(soundFile);
                }
            }
            
            // پیش‌بارگذاری اعداد ۰۰۰۱ تا ۰۰۲۰ برای نوبت‌ها
            for (let i = 1; i <= 20; i++) {
                const number = String(i).padStart(4, '0');
                importantSounds.push(`${number}.mp3`);
            }
            
            console.log('🔊 Preloading important sounds:', importantSounds);
            
            for (const sound of importantSounds) {
                if (sound) {
                    const filePath = sound.includes('.mp3') ? `sounds2/${sound}` : `sounds/${sound}`;
                    await this.preloadAndCacheAudio(filePath);
                }
            }
        }

        // ✅ پیش‌بارگذاری و کش کردن فایل صوتی
        async preloadAndCacheAudio(filePath) {
            return new Promise((resolve) => {
                // اگر از قبل در کش دائمی وجود دارد، نیازی به دانلود مجدد نیست
                if (this.persistentCache.has(filePath)) {
                    console.log(`✅ Already in persistent cache: ${filePath}`);
                    resolve();
                    return;
                }

                const absolutePath = this.convertToAbsolutePath(filePath);
                const audio = new Audio(absolutePath);
                audio.preload = 'auto';
                audio.crossOrigin = 'anonymous';
                
                audio.addEventListener('canplaythrough', () => {
                    // ذخیره در کش موقت
                    this.audioCache.set(filePath, audio);
                    
                    // ذخیره در کش دائمی
                    this.persistentCache.set(filePath, {
                        url: absolutePath,
                        lastUsed: Date.now(),
                        size: 0 // اندازه فایل (اختیاری)
                    });
                    
                    this.savePersistentCache();
                    
                    console.log(`✅ Preloaded and cached: ${filePath}`);
                    resolve();
                }, { once: true });
                
                audio.addEventListener('error', (e) => {
                    console.warn(`❌ Failed to preload: ${filePath}`, e);
                    resolve();
                }, { once: true });
                
                setTimeout(() => {
                    audio.load();
                    resolve();
                }, 100);
            });
        }

        // ✅ پخش اعلان کامل با بررسی نوبت‌های در انتظار
        async playCallAnnouncement(ticketNumber, counterNumber, ticketData = null) {
            if (!this.isAudioEnabled) return;
            
            console.log(`🎵 Playing announcement: Ticket ${ticketNumber}, Counter ${counterNumber}`);
            
            // ✅ بررسی اولویت: نوبت‌های بازگشته از عکاسی اولویت اول دارند
            const isHighPriority = ticketData && (
                ticketData.priority === 'high' || 
                ticketData.returned_from_photography === true ||
                ticketData.ticket_type === 'returned_from_photography'
            );
            
            if (isHighPriority) {
                console.log('🚨 High priority ticket - immediate announcement');
                // اضافه به ابتدای صف برای اولویت بالا
                this.audioQueue.unshift({ ticketNumber, counterNumber, ticketData, highPriority: true });
            } else {
                this.audioQueue.push({ ticketNumber, counterNumber, ticketData, highPriority: false });
            }
            
            if (this.isPlaying) {
                console.log('Audio already playing, added to queue');
                return;
            }
            
            await this.processQueue();
        }

        // ✅ پردازش صف با اولویت‌بندی
        async processQueue() {
            if (this.isPlaying || this.audioQueue.length === 0) return;
            
            this.isPlaying = true;
            
            while (this.audioQueue.length > 0) {
                // اولویت‌بندی: نوبت‌های با اولویت بالا اول پخش شوند
                let nextAnnouncement;
                const highPriorityIndex = this.audioQueue.findIndex(item => item.highPriority);
                
                if (highPriorityIndex !== -1) {
                    nextAnnouncement = this.audioQueue.splice(highPriorityIndex, 1)[0];
                } else {
                    nextAnnouncement = this.audioQueue.shift();
                }
                
                const { ticketNumber, counterNumber, ticketData } = nextAnnouncement;
                
                try {
                    console.log(`🔊 Processing: Ticket ${ticketNumber}, Counter ${counterNumber}`);
                    await this.playSingleAnnouncement(ticketNumber, counterNumber);
                    console.log(`✅ Completed: Ticket ${ticketNumber}, Counter ${counterNumber}`);
                } catch (error) {
                    console.error(`❌ Failed: Ticket ${ticketNumber}, Counter ${counterNumber}`, error);
                    break;
                }
                
                if (this.audioQueue.length > 0) {
                    await this.delay(1000); // کاهش تأثیر برای سرعت بیشتر
                }
            }
            
            this.isPlaying = false;
            console.log('🎵 Audio queue processing completed');
        }

        // ✅ پخش یک اعلان کامل
        async playSingleAnnouncement(ticketNumber, counterNumber) {
            try {
                console.log(`🔢 Playing ticket number: ${ticketNumber}`);
                await this.playNumberSound(ticketNumber);
                
                await this.delay(500); // کاهش تأثیر برای سرعت بیشتر
                
                console.log('🏢 Playing "به باجه"');
                await this.playAudioFile('sounds2/bajeh.mp3');
                
                await this.delay(300); // کاهش تأثیر برای سرعت بیشتر
                
                console.log(`🔢 Playing counter number: ${counterNumber}`);
                await this.playCounterSound(counterNumber);
                
            } catch (error) {
                console.error('Error in single announcement:', error);
                throw error;
            }
        }

        // ✅ پخش شماره نوبت
        async playNumberSound(number) {
            if (!this.isAudioEnabled) {
                throw new Error('Audio disabled');
            }
            
            const formattedNumber = String(number).padStart(4, '0');
            const audioPath = `sounds/${formattedNumber}.mp3`;
            
            await this.playAudioFile(audioPath);
        }

        // ✅ پخش شماره باجه
        async playCounterSound(counterNumber) {
            if (!this.isAudioEnabled) {
                throw new Error('Audio disabled');
            }
            
            const counterFile = this.getCounterSoundFile(counterNumber);
            if (counterFile) {
                await this.playAudioFile(`sounds2/${counterFile}`);
            } else {
                console.warn(`No sound file found for counter: ${counterNumber}`);
                throw new Error(`No sound file for counter: ${counterNumber}`);
            }
        }

        // ✅ پیدا کردن فایل صوتی مناسب برای شماره باجه
        getCounterSoundFile(counterNumber) {
            const numberMap = {
                '1': 'one.mp3', '2': 'two.mp3', '3': 'three.mp3', '4': 'four.mp3',
                '5': 'five.mp3', '6': 'six.mp3', '7': 'seven.mp3', '8': 'eight.mp3',
                '9': 'nine.mp3', '10': 'ten.mp3', '11': 'eleven.mp3', '12': 'twelve.mp3',
                '13': 'thirteen.mp3', '14': 'fourteen.mp3', '15': 'fifteen.mp3',
                '16': 'sixteen.mp3', '17': 'seventeen.mp3', '18': 'eighteen.mp3',
                '19': 'nineteen.mp3', '20': 'twenty.mp3'
            };
            
            return numberMap[counterNumber] || null;
        }

        // ✅ پخش فایل صوتی با استفاده از کش‌های مختلف
        async playAudioFile(filePath) {
            return new Promise((resolve, reject) => {
                if (!this.isAudioEnabled) {
                    reject(new Error('Audio disabled'));
                    return;
                }

                const absolutePath = this.convertToAbsolutePath(filePath);
                console.log(`🔊 Loading audio: ${absolutePath}`);

                // اولویت ۱: کش موقت (حافظه)
                if (this.audioCache.has(filePath)) {
                    const cachedAudio = this.audioCache.get(filePath);
                    console.log(`✅ Using memory cache: ${filePath}`);
                    this.playCachedAudio(cachedAudio, resolve, reject);
                    return;
                }

                // اولویت ۲: کش دائمی (localStorage)
                if (this.persistentCache.has(filePath)) {
                    console.log(`✅ Using persistent cache: ${filePath}`);
                    this.playFromPersistentCache(filePath, resolve, reject);
                    return;
                }

                // اولویت ۳: دانلود جدید
                this.downloadAndPlay(filePath, absolutePath, resolve, reject);
            });
        }

        // ✅ پخش از کش دائمی
        playFromPersistentCache(filePath, resolve, reject) {
            const cacheData = this.persistentCache.get(filePath);
            const audio = new Audio(cacheData.url);
            audio.volume = this.volume;
            audio.preload = 'auto';
            audio.crossOrigin = 'anonymous';

            let hasResolved = false;

            const resolveOnce = () => {
                if (!hasResolved) {
                    hasResolved = true;
                    console.log(`✅ Persistent cache audio completed: ${filePath}`);
                    resolve();
                }
            };

            const rejectOnce = (error) => {
                if (!hasResolved) {
                    hasResolved = true;
                    console.error(`❌ Persistent cache audio error: ${filePath}`, error);
                    reject(error);
                }
            };

            audio.addEventListener('canplaythrough', () => {
                const playPromise = audio.play();
                
                playPromise
                    .then(() => {
                        audio.addEventListener('ended', resolveOnce, { once: true });
                        audio.addEventListener('error', rejectOnce, { once: true });
                        
                        // ذخیره در کش موقت برای استفاده سریع‌تر بعدی
                        this.audioCache.set(filePath, audio.cloneNode());
                    })
                    .catch(error => {
                        console.error(`❌ Play error from persistent cache: ${filePath}`, error);
                        rejectOnce(error);
                    });
            }, { once: true });

            audio.addEventListener('error', rejectOnce, { once: true });

            setTimeout(() => {
                if (!hasResolved) {
                    console.warn(`⏰ Persistent cache audio timeout: ${filePath}`);
                    rejectOnce(new Error('Audio load timeout'));
                }
            }, 3000);

            audio.load();
        }

        // ✅ دانلود و پخش جدید
        downloadAndPlay(filePath, absolutePath, resolve, reject) {
            const audio = new Audio(absolutePath);
            audio.volume = this.volume;
            audio.preload = 'auto';
            audio.crossOrigin = 'anonymous';

            let hasResolved = false;

            const resolveOnce = () => {
                if (!hasResolved) {
                    hasResolved = true;
                    console.log(`✅ Downloaded audio completed: ${filePath}`);
                    resolve();
                }
            };

            const rejectOnce = (error) => {
                if (!hasResolved) {
                    hasResolved = true;
                    console.error(`❌ Downloaded audio error: ${filePath}`, error);
                    reject(error);
                }
            };

            audio.addEventListener('canplaythrough', () => {
                console.log(`✅ Audio ready: ${filePath}`);
                const playPromise = audio.play();
                
                playPromise
                    .then(() => {
                        console.log(`🎵 Audio playing: ${filePath}`);
                        audio.addEventListener('ended', resolveOnce, { once: true });
                        audio.addEventListener('error', rejectOnce, { once: true });
                        
                        // ذخیره در هر دو کش
                        this.audioCache.set(filePath, audio.cloneNode());
                        this.persistentCache.set(filePath, {
                            url: absolutePath,
                            lastUsed: Date.now()
                        });
                        this.savePersistentCache();
                    })
                    .catch(error => {
                        console.error(`❌ Play error for downloaded: ${filePath}`, error);
                        rejectOnce(error);
                    });
            }, { once: true });

            audio.addEventListener('error', rejectOnce, { once: true });

            setTimeout(() => {
                if (!hasResolved) {
                    console.warn(`⏰ Download audio timeout: ${filePath}`);
                    rejectOnce(new Error('Audio load timeout'));
                }
            }, 4000);

            audio.load();
        }

        // ✅ پخش صدا از کش موقت
        playCachedAudio(audio, resolve, reject) {
            const audioClone = audio.cloneNode();
            audioClone.volume = this.volume;
            
            const playPromise = audioClone.play();
            
            playPromise
                .then(() => {
                    audioClone.addEventListener('ended', () => {
                        console.log('✅ Cached audio completed');
                        resolve();
                    }, { once: true });
                    
                    audioClone.addEventListener('error', (error) => {
                        console.error('❌ Cached audio error:', error);
                        reject(error);
                    }, { once: true });
                })
                .catch(error => {
                    console.error('❌ Cached audio play error:', error);
                    reject(error);
                });
        }

        // ✅ تأخیر
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        // ✅ تنظیم حجم صدا
        setVolume(level) {
            this.volume = Math.max(0, Math.min(1, level));
        }

        // ✅ فعال/غیرفعال کردن صدا
        toggleSound(enabled) {
            this.isAudioEnabled = enabled;
            console.log(`🔊 Sound ${enabled ? 'enabled' : 'disabled'}`);
        }

        // ✅ پاک کردن کش
        clearCache() {
            this.audioCache.clear();
            this.persistentCache.clear();
            localStorage.removeItem('audioCache');
            console.log('🧹 Audio cache cleared');
        }
    }

    const displaySoundManager = new DisplaySoundManager();

    // --- DOM Elements ---
    const ticketsContainer = document.querySelector('.tickets-container');
    const photographyList = document.querySelector('.photography-list');
    const photographyWaiting = document.querySelector('.photography-waiting');

    // --- UI Update Functions ---
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

    function updateTicketsDisplay(tickets) {
        ticketsContainer.innerHTML = '';
        
        if (tickets.length === 0) {
            ticketsContainer.innerHTML = `
                <div class="ticket-card">
                    <div class="ticket-number">---</div>
                    <div class="ticket-info">منتظر فراخوان...</div>
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

            // ✅ نمایش نوبت‌های بازگشته از عکاسی با استایل خاص
            if (ticket.returned_from_photography || ticket.ticket_type === 'returned_from_photography') {
                cardClass += ' returned-ticket';
            }

            ticketElement.className = cardClass;
            ticketElement.innerHTML = `
                <div class="ticket-number">${ticket.specific_ticket || 'پاس'}</div>
                <div class="ticket-info">
                    <div>شماره ${ticket.specific_ticket || 'پاس'} به ${ticket.called_by_counter_name || 'باجه'}</div>
                    <div class="counter-name">${ticket.called_by_name || 'سیستم'}</div>
                    ${ticket.returned_from_photography ? '<div class="photography-origin">📸 بازگشته از عکاسی</div>' : ''}
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
        
        photographyList.innerHTML = `
            <table class="photography-table">
                <thead>
                    <tr>
                        <th>ردیف</th>
                        <th>شماره نوبت</th>
                        <th>نام مشتری</th>
                        <th>کد ملی</th>
                        <th>وضعیت</th>
                    </tr>
                </thead>
                <tbody>
                    ${photographyItems.map((item, index) => `
                        <tr>
                            <td class="photography-row-number">${index + 1}</td>
                            <td>
                                <div class="photography-ticket-number">${item.ticketNumber}</div>
                            </td>
                            <td>${item.firstName} ${item.lastName}</td>
                            <td class="photography-national-id">${item.nationalId}</td>
                            <td>
                                <span class="photography-status status-waiting">
                                    در انتظار
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function formatTime(date) {
        return date.toLocaleTimeString('fa-IR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // استخراج شماره باجه از نام باجه
    function extractCounterNumber(counterName) {
        if (!counterName) return '1';
        
        console.log('🔍 Extracting counter number from:', counterName);
        
        const methods = [
            () => {
                const numbers = counterName.match(/\d+$/);
                return numbers ? numbers[0] : null;
            },
            () => {
                const numbers = counterName.match(/\d+/);
                return numbers ? numbers[0] : null;
            },
            () => {
                const wordToNumber = {
                    'یک': '1', 'اول': '1',
                    'دو': '2', 'دوم': '2',
                    'سه': '3', 'سوم': '3', 
                    'چهار': '4', 'چهارم': '4',
                    'پنج': '5', 'پنجم': '5',
                    'شش': '6', 'ششم': '6',
                    'هفت': '7', 'هفتم': '7',
                    'هشت': '8', 'هشتم': '8',
                    'نه': '9', 'نهم': '9',
                    'ده': '10', 'دهم': '10'
                };
                
                for (const [word, num] of Object.entries(wordToNumber)) {
                    if (counterName.includes(word)) {
                        return num;
                    }
                }
                return null;
            }
        ];
        
        for (const method of methods) {
            const result = method();
            if (result) {
                console.log(`✅ Counter number extracted: ${result}`);
                return result;
            }
        }
        
        console.log('❌ No counter number found, using default: 1');
        return '1';
    }

    // --- Realtime Subscription ---
    function setupRealtime() {
        const ticketChannel = `databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents`;
        const photographyChannel = `databases.${DATABASE_ID}.collections.${PHOTOGRAPHY_COLLECTION_ID}.documents`;
        
        client.subscribe(ticketChannel, response => {
            console.log('Realtime update received:', response);
            
            if (response.events.includes(`databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents.*.update`)) {
                const updatedTicket = response.payload;

                if (updatedTicket.status === 'در حال سرویس') {
                    console.log('New ticket called:', updatedTicket);
                    
                    const ticketNumber = updatedTicket.specific_ticket || '0001';
                    const counterNumber = extractCounterNumber(updatedTicket.called_by_counter_name);
                    
                    console.log(`Triggering sound: Ticket ${ticketNumber}, Counter ${counterNumber}`);
                    
                    // ✅ بررسی اولویت: نوبت‌های بازگشته از عکاسی اولویت اول
                    const isHighPriority = updatedTicket.priority === 'high' || 
                                         updatedTicket.returned_from_photography === true ||
                                         updatedTicket.ticket_type === 'returned_from_photography';
                    
                    if (isHighPriority) {
                        console.log('🚨 High priority ticket - immediate announcement');
                    }
                    
                    // ✅ پخش صوت برای تمام فراخوانی‌ها
                    displaySoundManager.playCallAnnouncement(ticketNumber, counterNumber, updatedTicket);
                }
            }
            
            updateDisplay();
        });
        
        client.subscribe(photographyChannel, response => {
            console.log('Photography history updated via real-time');
            updatePhotographyDisplay();
        });
    }

    // --- Initial Load ---
    function initializeDisplay() {
        console.log('🚀 Initializing display system...');
        
        updateDisplay();
        setupRealtime();
        setInterval(updateDisplay, 30000);
        
        console.log('✅ Display system initialized');
    }

    // --- Start the Display ---
    initializeDisplay();
});