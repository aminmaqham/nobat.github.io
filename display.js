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
        }, 500); // افزایش تأخیر بین پخش‌ها
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



// ✅ پخش اعلان کامل - دیباگ شده
async playSingleAnnouncement(ticketNumber, counterNumber) {
    try {
        console.log('🎵 Starting announcement sequence...');
        
        // 1. پخش شماره نوبت
        console.log(`🔢 Step 1: Playing ticket number: ${ticketNumber}`);
        await this.playNumberSound(ticketNumber);
        
        // 2. پخش شماره باجه
        console.log(`🔢 Step 2: Playing counter number (ignoring input: ${counterNumber})`);
        await this.playCounterSound(counterNumber); // اینجا counterNumber نادیده گرفته می‌شود
        
        console.log('✅ Announcement sequence completed');
        
    } catch (error) {
        console.error('❌ Display: Error in single announcement:', error);
        throw error;
    }
}
        // ✅ پخش یک اعلان کامل برای نوبت عکاسی
// ✅ پخش یک اعلان کامل برای نوبت عکاسی - بدون bajeh
// ✅ پخش یک اعلان کامل برای نوبت عکاسی - بدون تأخیر
async playPhotographySingleAnnouncement(ticketNumber, counterNumber) {
    try {
        // پخش شماره نوبت
        console.log(`🔢 Display: Playing photography ticket number: ${ticketNumber}`);
        await this.playNumberSound(ticketNumber);
        
        // ❌ حذف تأخیر بین پخش‌ها
        // await this.delay(800);
        
        // پخش شماره باجه
        console.log(`🔢 Display: Playing photography counter number: ${counterNumber}`);
        await this.playCounterSound(counterNumber);
        
    } catch (error) {
        console.error('Display: Error in photography announcement:', error);
        throw error;
    }
}

// ✅ پخش شماره باجه - کاملاً اصلاح شده
async playCounterSound(counterNumber) {
    if (!this.isAudioEnabled || !this.userInteracted) {
        throw new Error('Audio disabled or user not interacted');
    }
    
    console.log('🔍 playCounterSound called with:', counterNumber);
    
    // همیشه از user-greeting استفاده کن، بدون توجه به ورودی
    const finalCounterNumber = extractCounterNumberFromGreeting();
    console.log('🔢 Final counter number to play:', finalCounterNumber);
    
    // تبدیل به عدد
    const counterNum = parseInt(finalCounterNumber) || 1;
    
    // تبدیل عدد به نام انگلیسی
    const numberToEnglish = {
        1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five',
        6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten',
        11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen',
        16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty'
    };
    
    const englishName = numberToEnglish[counterNum] || 'one';
    const counterFile = `${englishName}.mp3`;
    
    console.log(`🔊 Playing counter sound: sounds2/${counterFile} (number: ${counterNum})`);
    
    try {
        await this.playAudioFile(`sounds2/${counterFile}`);
        console.log('✅ Counter sound played successfully');
    } catch (error) {
        console.error(`❌ Error playing counter sound ${counterFile}:`, error);
        
        // فال‌بک
        console.log('🔄 Falling back to default counter sound: one.mp3');
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


// ✅ پخش فایل صوتی - مقاوم در برابر خطا با timeout کمتر
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

        // ❌ کاهش timeout به 3 ثانیه
        loadTimeout = setTimeout(() => {
            if (!hasResolved) {
                console.warn(`⏰ Display: Audio timeout: ${filePath}`);
                rejectOnce(new Error('Audio load timeout'));
            }
        }, 3000);

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

// ✅ پیش‌بارگذاری صداهای مهم - اصلاح شده برای فایل‌های انگلیسی
async preloadImportantSounds() {
    if (!this.userInteracted) return;
    
    console.log('🔄 Preloading important sounds...');
    
    // فایل‌های انگلیسی برای شماره‌های باجه
    const englishNumbers = [
        'one', 'two', 'three', 'four', 'five', 
        'six', 'seven', 'eight', 'nine', 'ten',
        
    ];
    
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

        // ✅ تأخیر
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
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
    
    // استفاده از طراحی جدید با عدد بزرگ و بدون "کیوسک الکترونیکی"
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

    // ✅ پیش‌بارگذاری صداهای مهم - بهبود یافته
async function preloadImportantSounds() {
    if (!this.userInteracted) return;
    
    console.log('🔄 Preloading important sounds...');
    
    const importantSounds = [
        'bajeh.mp3',
        // پیش‌بارگذاری شماره‌های باجه ۱ تا ۲۰
        ...Array.from({length: 20}, (_, i) => `${i + 1}.mp3`)
    ];
    
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



// --- تابع استخراج شماره باجه - کاملاً اصلاح شده ---
function extractCounterNumber(counterName) {
    if (!counterName) {
        console.log('❌ No counter name provided, using default: 1');
        return '1';
    }
    
    console.log('🔍 Extracting counter number from:', counterName);
    
    // اگر شماره مستقیم داده شده
    if (/^\d+$/.test(counterName)) {
        const num = counterName;
        console.log(`✅ Counter number is direct: ${num}`);
        return num;
    }
    
    // روش ۱: استخراج اعداد از انتهای رشته
    const numbersFromEnd = counterName.match(/\d+$/);
    if (numbersFromEnd) {
        const num = numbersFromEnd[0];
        console.log(`✅ Counter number extracted from end: ${num}`);
        return num;
    }
    
    // روش ۲: استخراج اولین عدد در رشته
    const numbersAnywhere = counterName.match(/\d+/);
    if (numbersAnywhere) {
        const num = numbersAnywhere[0];
        console.log(`✅ Counter number extracted from anywhere: ${num}`);
        return num;
    }
    
    // روش ۳: جستجوی کلمات فارسی
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
        'ده': '10', 'دهم': '10', '۱۰': '10',
        'یازده': '11', 'یازدهم': '11', '۱۱': '11',
        'دوازده': '12', 'دوازدهم': '12', '۱۲': '12'
    };
    
    const lowerCaseName = counterName.toLowerCase();
    for (const [word, num] of Object.entries(wordToNumber)) {
        if (lowerCaseName.includes(word)) {
            console.log(`✅ Counter number extracted from word "${word}": ${num}`);
            return num;
        }
    }
    
    // روش ۴: برای نام‌های خاص
    if (counterName.includes('عکاسی')) {
        console.log('✅ Counter is photography, using: 1');
        return '1';
    }
    
    console.log('❌ No counter number found, using default: 1');
    return '1';
}

// در فایل display.js - تابع setupRealtime را پیدا کرده و اینگونه تغییر دهید:
function setupRealtime() {
    const ticketChannel = `databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents`;
    const photographyChannel = `databases.${DATABASE_ID}.collections.${PHOTOGRAPHY_COLLECTION_ID}.documents`;
    
    client.subscribe(ticketChannel, response => {
        console.log('Display: Realtime update received (UI ONLY):', response);
        
        // ❌ فقط UI را آپدیت کن، صدا پخش نکن
        // if (response.events.includes(`databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents.*.update`)) {
        //     const updatedTicket = response.payload;
        //     if (updatedTicket.status === 'در حال سرویس') {
        //         // این قسمت کامنت شود تا صدا دو بار پخش نشود
        //     }
        // }
        
        updateDisplay(); // فقط UI آپدیت شود
    });
    
    client.subscribe(photographyChannel, response => {
        console.log('Display: Photography history updated via real-time');
        updatePhotographyDisplay(); // فقط UI آپدیت شود
    });
}
// در display.js - تابع extractCounterNumberFromGreeting را اینگونه اصلاح کنید:
function extractCounterNumberFromGreeting() {
    try {
        const greetingElement = document.getElementById('user-greeting');
        if (!greetingElement) {
            console.log('❌ user-greeting element not found, using default: 1');
            return 1;
        }
        
        const greetingText = greetingElement.textContent || '';
        console.log('🔍 Greeting text:', greetingText);
        
        // جستجوی اعداد فارسی و انگلیسی
        const persianNumbers = greetingText.match(/[۰۱۲۳۴۵۶۷۸۹]/g);
        const englishNumbers = greetingText.match(/\d/g);
        
        console.log('🔢 Persian numbers found:', persianNumbers);
        console.log('🔢 English numbers found:', englishNumbers);
        
        // اول اعداد فارسی را بررسی کن
        if (persianNumbers && persianNumbers.length > 0) {
            const persianToEnglish = {
                '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
                '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
            };
            const num = parseInt(persianToEnglish[persianNumbers[0]]);
            console.log(`✅ Persian counter number found: ${num}`);
            return num;
        }
        
        // سپس اعداد انگلیسی
        if (englishNumbers && englishNumbers.length > 0) {
            const num = parseInt(englishNumbers[0]);
            console.log(`✅ English counter number found: ${num}`);
            return num;
        }
        
        // جستجوی کلمات فارسی
        const wordToNumber = {
            'یک': 1, 'اول': 1, 'دو': 2, 'دوم': 2, 'سه': 3, 'سوم': 3,
            'چهار': 4, 'چهارم': 4, 'پنج': 5, 'پنجم': 5, 'شش': 6, 'ششم': 6,
            'هفت': 7, 'هفتم': 7, 'هشت': 8, 'هشتم': 8, 'نه': 9, 'نهم': 9,
            'ده': 10, 'دهم': 10
        };
        
        for (const [word, num] of Object.entries(wordToNumber)) {
            if (greetingText.includes(word)) {
                console.log(`✅ Counter number from word "${word}": ${num}`);
                return num;
            }
        }
        
        console.log('❌ No counter number found, using default: 1');
        return 1;
        
    } catch (error) {
        console.error('Error extracting counter number:', error);
        return 1;
    }
}

    // --- تابع پخش شماره باجه - بهبود یافته ---
async function playCounterSound(counterNumber) {
    if (!this.isAudioEnabled || !this.userInteracted) {
        throw new Error('Audio disabled or user not interacted');
    }
    
    // تبدیل به عدد و اعتبارسنجی
    const counterNum = parseInt(counterNumber);
    if (isNaN(counterNum) || counterNum < 1 || counterNum > 99) {
        console.warn(`⚠️ Invalid counter number: ${counterNumber}, using default: 1`);
        counterNumber = '1';
    } else {
        counterNumber = counterNum.toString();
    }
    
    // استفاده از فایل‌های جدید (1.mp3, 2.mp3, ...)
    const counterFile = `${counterNumber}.mp3`;
    console.log(`🔊 Looking for counter file: sounds2/${counterFile}`);
    
    try {
        await this.playAudioFile(`sounds2/${counterFile}`);
    } catch (error) {
        console.error(`❌ Error playing counter sound ${counterFile}:`, error);
        
        // فال‌بک: اگر فایل وجود نداشت، از فایل پیش‌فرض استفاده کن
        if (counterNumber !== '1') {
            console.log('🔄 Falling back to default counter sound: 1.mp3');
            await this.playAudioFile('sounds2/1.mp3');
        }
    }
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

    // ✅ اضافه کردن تابع تکرار صوت به global scope
    window.repeatLastAnnouncement = function() {
        displaySoundManager.repeatLastAnnouncement();
    };
});
// --- در انتهای فایل display.js ---
// ✅ قرار دادن displaySoundManager در global scope برای دسترسی از script.js
window.displaySoundManager = displaySoundManager;
console.log('✅ Display sound manager exposed to global scope');