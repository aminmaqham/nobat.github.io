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
            this.setupUserInteraction();
        }

        // تنظیم تعامل کاربر
        setupUserInteraction() {
            const interactionEvents = ['click', 'touchstart', 'keydown', 'mousedown'];
            
            interactionEvents.forEach(event => {
                document.addEventListener(event, () => {
                    if (!this.userInteracted) {
                        console.log('✅ User interaction detected - audio enabled');
                        this.userInteracted = true;
                        this.hideAudioPrompt();
                    }
                }, { once: true });
            });

            // نمایش پیام برای کاربر
            this.showAudioPrompt();
        }

        // نمایش پیام برای تعامل کاربر
        showAudioPrompt() {
            if (document.getElementById('audio-prompt')) return;

            const prompt = document.createElement('div');
            prompt.id = 'audio-prompt';
            prompt.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #4CAF50;
                color: white;
                padding: 20px 30px;
                border-radius: 10px;
                z-index: 10000;
                font-family: 'Vazirmatn', sans-serif;
                text-align: center;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                cursor: pointer;
            `;
            prompt.innerHTML = `
                <h3>🔊 فعال‌سازی صدا</h3>
                <p>برای فعال‌سازی سیستم صوتی، روی این پیام کلیک کنید</p>
                <small>صفحه را لمس یا کلیک کنید</small>
            `;
            
            prompt.addEventListener('click', () => {
                this.userInteracted = true;
                this.hideAudioPrompt();
                console.log('✅ Audio system activated by user');
            });

            document.body.appendChild(prompt);

            // حذف خودکار پس از 10 ثانیه
            setTimeout(() => {
                this.hideAudioPrompt();
            }, 10000);
        }

        hideAudioPrompt() {
            const prompt = document.getElementById('audio-prompt');
            if (prompt && document.body.contains(prompt)) {
                document.body.removeChild(prompt);
            }
        }

        // تبدیل شماره به فرمت 4 رقمی برای نام فایل
        formatNumberForFile(number) {
            return String(number).padStart(4, '0');
        }

        // پخش صدا برای یک عدد خاص
        async playNumberSound(number) {
            if (!this.isAudioEnabled || !this.userInteracted) {
                throw new Error('Audio disabled or no user interaction');
            }
            
            const fileName = this.formatNumberForFile(number);
            const audioPath = `sounds/${fileName}.mp3`;
            
            return this.playAudioFile(audioPath);
        }

        // پخش صدا برای باجه
        async playCounterSound(counterNumber) {
            if (!this.isAudioEnabled || !this.userInteracted) {
                throw new Error('Audio disabled or no user interaction');
            }
            
            const counterFile = this.getCounterSoundFile(counterNumber);
            if (counterFile) {
                await this.playAudioFile(`sounds2/${counterFile}`);
            }
        }

        // پیدا کردن فایل صوتی مناسب برای شماره باجه
        getCounterSoundFile(counterNumber) {
            const numberMap = {
                '1': 'one.mp3',
                '2': 'two.mp3',
                '3': 'three.mp3',
                '4': 'four.mp3',
                '5': 'five.mp3',
                '6': 'six.mp3',
                '7': 'seven.mp3',
                '8': 'eight.mp3',
                '9': 'nine.mp3',
                '10': 'ten.mp3',
                '11': 'eleven.mp3',
                '12': 'twelve.mp3',
                '13': 'thirteen.mp3',
                '14': 'fourteen.mp3',
                '15': 'fifteen.mp3',
                '16': 'sixteen.mp3',
                '17': 'seventeen.mp3',
                '18': 'eighteen.mp3',
                '19': 'nineteen.mp3',
                '20': 'twenty.mp3'
            };
            
            return numberMap[counterNumber] || null;
        }

        // پخش اعلان کامل برای فراخوانی نوبت
        async playCallAnnouncement(ticketNumber, counterNumber, ticketData = null) {
            if (!this.isAudioEnabled) return;
            
            if (!this.userInteracted) {
                console.log('🔇 Audio disabled - waiting for user interaction');
                return;
            }
            
            console.log(`🎵 Playing announcement: Ticket ${ticketNumber}, Counter ${counterNumber}`);
            
            // ذخیره اطلاعات اعلان فعلی برای امکان تکرار
            this.currentAnnouncement = { ticketNumber, counterNumber, ticketData };
            
            // اضافه به صف برای جلوگیری از همپوشانی
            this.audioQueue.push({ ticketNumber, counterNumber, ticketData });
            
            if (this.isPlaying) {
                console.log('Audio already playing, added to queue');
                return;
            }
            
            await this.processQueue();
        }

        // تکرار اعلان آخر
        async repeatLastAnnouncement() {
            if (!this.currentAnnouncement || !this.userInteracted) return;
            
            const { ticketNumber, counterNumber, ticketData } = this.currentAnnouncement;
            console.log(`🔁 Repeating announcement: Ticket ${ticketNumber}, Counter ${counterNumber}`);
            
            // اضافه به ابتدای صف برای پخش فوری
            this.audioQueue.unshift({ ticketNumber, counterNumber, ticketData });
            
            if (!this.isPlaying) {
                await this.processQueue();
            }
        }

        // پردازش صف صداها با مدیریت خطا
        async processQueue() {
            if (this.isPlaying || this.audioQueue.length === 0) return;
            
            this.isPlaying = true;
            
            while (this.audioQueue.length > 0) {
                const { ticketNumber, counterNumber, ticketData } = this.audioQueue[0];
                
                try {
                    console.log(`🔊 Processing: Ticket ${ticketNumber}, Counter ${counterNumber}`);
                    await this.playSingleAnnouncement(ticketNumber, counterNumber);
                    console.log(`✅ Completed: Ticket ${ticketNumber}, Counter ${counterNumber}`);
                } catch (error) {
                    console.error(`❌ Failed: Ticket ${ticketNumber}, Counter ${counterNumber}`, error);
                    // در صورت خطا، بقیه صداها را ادامه نده
                    break;
                }
                
                this.audioQueue.shift();
                
                // تأثیر بین اعلان‌های مختلف
                if (this.audioQueue.length > 0) {
                    await this.delay(1000);
                }
            }
            
            this.isPlaying = false;
            console.log('🎵 Audio queue processing completed');
        }

        // پخش یک اعلان کامل با مدیریت خطا
        async playSingleAnnouncement(ticketNumber, counterNumber) {
            try {
                // پخش شماره نوبت
                console.log(`🔢 Playing ticket number: ${ticketNumber}`);
                await this.playNumberSound(ticketNumber);
                
                await this.delay(500); // تأثیر قبل از "به باجه"
                
                // پخش "به باجه"
                console.log('🏢 Playing "به باجه"');
                await this.playAudioFile('sounds2/bajeh.mp3');
                
                await this.delay(300); // تأثیر قبل از شماره باجه
                
                // پخش شماره باجه
                console.log(`🔢 Playing counter number: ${counterNumber}`);
                await this.playCounterSound(counterNumber);
                
            } catch (error) {
                console.error('Error in single announcement:', error);
                throw error; // خطا را به سطح بالا منتقل کن
            }
        }

        // پخش یک فایل صوتی با مدیریت خطا
        async playAudioFile(filePath) {
            return new Promise((resolve, reject) => {
                if (!this.isAudioEnabled || !this.userInteracted) {
                    reject(new Error('Audio disabled or no user interaction'));
                    return;
                }

                console.log(`🔊 Loading audio: ${filePath}`);

                const audio = new Audio(filePath);
                audio.volume = this.volume;
                audio.preload = 'auto';
                audio.crossOrigin = 'anonymous';

                let hasResolved = false;

                const resolveOnce = () => {
                    if (!hasResolved) {
                        hasResolved = true;
                        console.log(`✅ Audio completed: ${filePath}`);
                        resolve();
                    }
                };

                const rejectOnce = (error) => {
                    if (!hasResolved) {
                        hasResolved = true;
                        console.error(`❌ Audio error for ${filePath}:`, error);
                        reject(error);
                    }
                };

                const onCanPlay = () => {
                    console.log(`✅ Audio ready: ${filePath}`);
                    const playPromise = audio.play();
                    
                    playPromise
                        .then(() => {
                            console.log(`🎵 Audio playing: ${filePath}`);
                            audio.addEventListener('ended', resolveOnce, { once: true });
                            audio.addEventListener('error', rejectOnce, { once: true });
                        })
                        .catch(error => {
                            if (error.name === 'NotAllowedError') {
                                console.log('🔇 Audio blocked - waiting for user interaction');
                                this.userInteracted = false;
                                this.showAudioPrompt();
                            }
                            rejectOnce(error);
                        });
                };

                const onError = (e) => {
                    console.error(`❌ Audio load error: ${filePath}`, e);
                    rejectOnce(e);
                };

                audio.addEventListener('canplaythrough', onCanPlay, { once: true });
                audio.addEventListener('error', onError, { once: true });

                // Fallback timeout
                setTimeout(() => {
                    if (!hasResolved) {
                        console.warn(`⏰ Audio timeout: ${filePath}`);
                        rejectOnce(new Error('Audio load timeout'));
                    }
                }, 5000);

                // شروع بارگذاری
                audio.load();
            });
        }

        // تأثیر بین پخش صداها
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        // توقف تمام صداها
        stopAllSounds() {
            this.audioQueue = [];
            this.isPlaying = false;
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

    // استخراج شماره باجه از نام باجه - نسخه بهبود یافته
    function extractCounterNumber(counterName) {
        if (!counterName) return '1';
        
        console.log('🔍 Extracting counter number from:', counterName);
        
        // روش‌های مختلف استخراج شماره
        const methods = [
            // استخراج از انتهای نام (مثلاً "باجه ۵" -> "5")
            () => {
                const numbers = counterName.match(/\d+$/);
                return numbers ? numbers[0] : null;
            },
            // استخراج اولین عدد (مثلاً "باجه شماره ۳" -> "3")
            () => {
                const numbers = counterName.match(/\d+/);
                return numbers ? numbers[0] : null;
            },
            // جستجوی کلمات خاص
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

    // نمایش نوتیفیکیشن با گزینه تکرار
    function showAnnouncementNotification(ticket, counterNumber) {
        // حذف نوتیفیکیشن قبلی اگر وجود دارد
        const existingNotification = document.getElementById('announcement-notification');
        if (existingNotification) {
            document.body.removeChild(existingNotification);
        }

        const notification = document.createElement('div');
        notification.id = 'announcement-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #2196F3;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-family: 'Vazirmatn', sans-serif;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            min-width: 300px;
        `;

        const serviceName = 'خدمت'; // می‌توانید از دیتابیس دریافت کنید
        const actualCounterNumber = extractCounterNumber(ticket.called_by_counter_name);

        notification.innerHTML = `
            <div style="margin-bottom: 10px;">
                <strong>🔊 فراخوانی نوبت</strong>
            </div>
            <div style="font-size: 14px; margin-bottom: 10px;">
                <div>شماره نوبت: <strong>${ticket.specific_ticket || 'پاس'}</strong></div>
                <div>باجه: <strong>${ticket.called_by_counter_name || 'باجه'} (شماره ${actualCounterNumber})</strong></div>
                <div>نام: <strong>${ticket.first_name} ${ticket.last_name}</strong></div>
            </div>
            <div style="display: flex; gap: 10px; justify-content: space-between;">
                <button id="repeat-sound-btn" style="
                    flex: 1;
                    padding: 8px 12px;
                    background: #FF9800;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: 'Vazirmatn', sans-serif;
                ">تکرار صوت</button>
                <button id="close-notification-btn" style="
                    flex: 1;
                    padding: 8px 12px;
                    background: #f44336;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: 'Vazirmatn', sans-serif;
                ">بستن</button>
            </div>
        `;

        document.body.appendChild(notification);

        // رویدادهای دکمه‌ها
        document.getElementById('repeat-sound-btn').addEventListener('click', () => {
            console.log('🔁 User requested sound repetition');
            displaySoundManager.repeatLastAnnouncement();
        });

        document.getElementById('close-notification-btn').addEventListener('click', () => {
            document.body.removeChild(notification);
        });

        // حذف خودکار پس از 10 ثانیه
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 10000);
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
                    
                    // نمایش نوتیفیکیشن
                    showAnnouncementNotification(updatedTicket, counterNumber);
                    
                    // پخش صدا
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