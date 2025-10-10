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
            this.setupUserInteraction();
        }

        // ✅ تنظیم تعامل کاربر
        setupUserInteraction() {
            // اضافه کردن event listeners برای تعامل کاربر
            const interactionHandler = () => {
                if (!this.userInteracted) {
                    console.log('✅ User interacted with document, audio enabled');
                    this.userInteracted = true;
                    this.hideAudioPrompt();
                }
            };

            document.addEventListener('click', interactionHandler, { once: true });
            document.addEventListener('keydown', interactionHandler, { once: true });
            document.addEventListener('touchstart', interactionHandler, { once: true });

            // نمایش پیام برای کاربر
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
                    background: rgba(0,0,0,0.9);
                    color: white;
                    padding: 30px;
                    border-radius: 15px;
                    text-align: center;
                    z-index: 10000;
                    font-family: 'Vazirmatn', sans-serif;
                    max-width: 350px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                `;
                prompt.innerHTML = `
                    <h3 style="margin-bottom: 15px;">🔊 فعالسازی سیستم صدا</h3>
                    <p style="margin-bottom: 20px; line-height: 1.5;">برای فعال شدن سیستم پخش صدا، لطفاً روی این صفحه کلیک کنید یا یک کلید را فشار دهید</p>
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

                // اضافه کردن event listener برای تعامل
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

        // ✅ پخش اعلان کامل
        async playCallAnnouncement(ticketNumber, counterNumber, ticketData = null) {
            if (!this.isAudioEnabled) return;
            
            // بررسی اینکه کاربر با صفحه تعامل داشته است
            if (!this.userInteracted) {
                console.log('🔇 Waiting for user interaction before playing audio');
                this.showAudioPrompt();
                return;
            }
            
            console.log(`🎵 Display: Playing announcement: Ticket ${ticketNumber}, Counter ${counterNumber}`);
            
            this.currentAnnouncement = { ticketNumber, counterNumber, ticketData };
            
            this.audioQueue.push({ ticketNumber, counterNumber, ticketData });
            
            if (this.isPlaying) {
                console.log('Audio already playing, added to queue');
                return;
            }
            
            await this.processQueue();
        }

        // ✅ پردازش صف
        async processQueue() {
            if (this.isPlaying || this.audioQueue.length === 0) return;
            
            this.isPlaying = true;
            
            while (this.audioQueue.length > 0) {
                const { ticketNumber, counterNumber, ticketData } = this.audioQueue[0];
                
                try {
                    console.log(`🔊 Display: Processing: Ticket ${ticketNumber}, Counter ${counterNumber}`);
                    await this.playSingleAnnouncement(ticketNumber, counterNumber);
                    console.log(`✅ Display: Completed: Ticket ${ticketNumber}, Counter ${counterNumber}`);
                } catch (error) {
                    console.error(`❌ Display: Failed: Ticket ${ticketNumber}, Counter ${counterNumber}`, error);
                    break;
                }
                
                this.audioQueue.shift();
                
                if (this.audioQueue.length > 0) {
                    await this.delay(1500);
                }
            }
            
            this.isPlaying = false;
            console.log('🎵 Display: Audio queue processing completed');
        }

        // ✅ پخش یک اعلان کامل
        async playSingleAnnouncement(ticketNumber, counterNumber) {
            try {
                // پخش شماره نوبت
                console.log(`🔢 Display: Playing ticket number: ${ticketNumber}`);
                await this.playNumberSound(ticketNumber);
                
                await this.delay(600);
                
                // پخش "به باجه"
                console.log('🏢 Display: Playing "به باجه"');
                await this.playAudioFile('sounds2/bajeh.mp3');
                
                await this.delay(400);
                
                // پخش شماره باجه
                console.log(`🔢 Display: Playing counter number: ${counterNumber}`);
                await this.playCounterSound(counterNumber);
                
            } catch (error) {
                console.error('Display: Error in single announcement:', error);
                throw error;
            }
        }

        // ✅ پخش شماره باجه
        async playCounterSound(counterNumber) {
            if (!this.isAudioEnabled || !this.userInteracted) {
                throw new Error('Audio disabled or user not interacted');
            }
            
            const counterFile = this.getCounterSoundFile(counterNumber);
            if (counterFile) {
                await this.playAudioFile(`sounds2/${counterFile}`);
            } else {
                console.warn(`Display: No sound file found for counter: ${counterNumber}`);
                // پخش فایل پیش‌فرض
                await this.playAudioFile('sounds2/one.mp3');
            }
        }

        // ✅ پخش شماره نوبت
        async playNumberSound(number) {
            if (!this.isAudioEnabled || !this.userInteracted) {
                throw new Error('Audio disabled or user not interacted');
            }
            
            const formattedNumber = String(number).padStart(4, '0');
            const audioPath = `sounds/${formattedNumber}.mp3`;
            await this.playAudioFile(audioPath);
        }

        // ✅ پیدا کردن فایل صوتی مناسب برای شماره باجه
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

        // ✅ پخش فایل صوتی با استفاده از کش
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
                const audio = new Audio(filePath);
                audio.volume = this.volume;
                audio.preload = 'auto';
                
                let hasResolved = false;

                const resolveOnce = () => {
                    if (!hasResolved) {
                        hasResolved = true;
                        console.log(`✅ Display: Audio completed: ${filePath}`);
                        resolve();
                    }
                };

                const rejectOnce = (error) => {
                    if (!hasResolved) {
                        hasResolved = true;
                        console.error(`❌ Display: Audio error for ${filePath}:`, error);
                        reject(error);
                    }
                };

                const onCanPlay = () => {
                    console.log(`✅ Display: Audio ready: ${filePath}`);
                    
                    // تلاش برای پخش صدا
                    const playPromise = audio.play();
                    
                    if (playPromise !== undefined) {
                        playPromise
                            .then(() => {
                                console.log(`🎵 Display: Audio playing: ${filePath}`);
                                audio.addEventListener('ended', resolveOnce, { once: true });
                                audio.addEventListener('error', rejectOnce, { once: true });
                                
                                // ذخیره در کش
                                this.audioCache.set(filePath, audio.cloneNode());
                            })
                            .catch(error => {
                                console.error(`❌ Display: Play error for ${filePath}:`, error);
                                
                                // اگر خطا به دلیل تعامل نبوده، دوباره تلاش کنیم
                                if (error.name === 'NotAllowedError') {
                                    console.log('🔇 Play not allowed, waiting for user interaction');
                                    this.userInteracted = false;
                                    this.showAudioPrompt();
                                }
                                
                                rejectOnce(error);
                            });
                    }
                };

                const onError = (e) => {
                    console.error(`❌ Display: Audio load error: ${filePath}`, e);
                    rejectOnce(e);
                };

                audio.addEventListener('canplaythrough', onCanPlay, { once: true });
                audio.addEventListener('error', onError, { once: true });

                // تایم‌اوت
                setTimeout(() => {
                    if (!hasResolved) {
                        console.warn(`⏰ Display: Audio timeout: ${filePath}`);
                        rejectOnce(new Error('Audio load timeout'));
                    }
                }, 5000);

                // شروع بارگذاری
                audio.load();
            });
        }

        // ✅ پخش صدا از کش
        playCachedAudio(audio, resolve, reject) {
            const audioClone = audio.cloneNode();
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

    // استخراج شماره باجه از نام باجه
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
            console.log('Display: Realtime update received:', response);
            
            if (response.events.includes(`databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents.*.update`)) {
                const updatedTicket = response.payload;

                if (updatedTicket.status === 'در حال سرویس') {
                    console.log('Display: New ticket called:', updatedTicket);
                    
                    const ticketNumber = updatedTicket.specific_ticket || '0001';
                    const counterNumber = extractCounterNumber(updatedTicket.called_by_counter_name);
                    
                    console.log(`Display: Triggering sound: Ticket ${ticketNumber}, Counter ${counterNumber}`);
                    
                    // بررسی اولویت برای نوبت‌های بازگشته از عکاسی
                    const isHighPriority = updatedTicket.priority === 'high' || 
                                         updatedTicket.returned_from_photography === true;
                    
                    if (isHighPriority) {
                        console.log('🚨 Display: High priority ticket - immediate announcement');
                    }
                    
                    // پخش صدا از طریق سیستم صوتی صفحه نمایش
                    displaySoundManager.playCallAnnouncement(ticketNumber, counterNumber, updatedTicket);
                }
            }
            
            updateDisplay();
        });
        
        client.subscribe(photographyChannel, response => {
            console.log('Display: Photography history updated via real-time');
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