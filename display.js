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
            this.audioContext = null;
            this.isPlaying = false;
            this.audioQueue = [];
        }

        // تبدیل شماره به فرمت 4 رقمی برای نام فایل
        formatNumberForFile(number) {
            return String(number).padStart(4, '0');
        }

        // پخش صدا برای یک عدد خاص
        async playNumberSound(number) {
            if (!this.isAudioEnabled) return;
            
            const fileName = this.formatNumberForFile(number);
            const audioPath = `sounds/${fileName}.mp3`;
            
            return this.playAudioFile(audioPath);
        }

        // پخش صدا برای باجه
        async playCounterSound(counterNumber) {
            if (!this.isAudioEnabled) return;
            
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
        async playCallAnnouncement(ticketNumber, counterNumber) {
            if (!this.isAudioEnabled) return;
            
            console.log(`🎵 Playing announcement: Ticket ${ticketNumber}, Counter ${counterNumber}`);
            
            // اضافه به صف برای جلوگیری از همپوشانی
            this.audioQueue.push({ ticketNumber, counterNumber });
            
            if (this.isPlaying) {
                console.log('Audio already playing, added to queue');
                return;
            }
            
            await this.processQueue();
        }

        // پردازش صف صداها
        async processQueue() {
            if (this.isPlaying || this.audioQueue.length === 0) return;
            
            this.isPlaying = true;
            
            while (this.audioQueue.length > 0) {
                const { ticketNumber, counterNumber } = this.audioQueue[0];
                
                try {
                    await this.playSingleAnnouncement(ticketNumber, counterNumber);
                    await this.delay(1000); // تأثیر بین اعلان‌ها
                } catch (error) {
                    console.error('Error in announcement:', error);
                }
                
                this.audioQueue.shift();
            }
            
            this.isPlaying = false;
        }

        // پخش یک اعلان کامل
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
            }
        }

        // پخش یک فایل صوتی با مدیریت بهتر
        async playAudioFile(filePath) {
            return new Promise((resolve, reject) => {
                if (!this.isAudioEnabled) {
                    resolve();
                    return;
                }

                console.log(`🔊 Loading audio: ${filePath}`);

                const audio = new Audio(filePath);
                audio.volume = this.volume;
                audio.preload = 'auto';
                
                // برای حل مشکل CORS
                audio.crossOrigin = 'anonymous';

                let hasResolved = false;

                const resolveOnce = () => {
                    if (!hasResolved) {
                        hasResolved = true;
                        resolve();
                    }
                };

                const rejectOnce = (error) => {
                    if (!hasResolved) {
                        hasResolved = true;
                        console.warn(`Audio error for ${filePath}:`, error);
                        resolve(); // حتی با خطا ادامه بده
                    }
                };

                audio.addEventListener('canplaythrough', () => {
                    console.log(`✅ Audio ready: ${filePath}`);
                    const playPromise = audio.play();
                    
                    if (playPromise !== undefined) {
                        playPromise
                            .then(() => {
                                console.log(`🎵 Audio playing: ${filePath}`);
                                audio.addEventListener('ended', resolveOnce, { once: true });
                                audio.addEventListener('error', rejectOnce, { once: true });
                            })
                            .catch(rejectOnce);
                    } else {
                        // Fallback for older browsers
                        audio.addEventListener('ended', resolveOnce, { once: true });
                        audio.addEventListener('error', rejectOnce, { once: true });
                        audio.play();
                    }
                });

                audio.addEventListener('error', (e) => {
                    console.warn(`❌ Audio load error: ${filePath}`, e);
                    rejectOnce(e);
                });

                // Fallback timeout
                setTimeout(() => {
                    if (!hasResolved) {
                        console.log(`⏰ Audio timeout: ${filePath}`);
                        resolveOnce();
                    }
                }, 3000);

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

        // فعال/غیرفعال کردن صدا
        toggleSound(enabled) {
            this.isAudioEnabled = enabled;
            if (!enabled) {
                this.stopAllSounds();
            }
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
            // دریافت ۳ نوبت آخر
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

    // --- تابع برای بارگذاری تاریخچه عکاسی از Appwrite ---
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
        
        // استخراج اعداد از نام باجه
        const numbers = counterName.match(/\d+/);
        return numbers ? numbers[0] : '1';
    }

    // --- Realtime Subscription با پخش صدا ---
    function setupRealtime() {
        const ticketChannel = `databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents`;
        const photographyChannel = `databases.${DATABASE_ID}.collections.${PHOTOGRAPHY_COLLECTION_ID}.documents`;
        
        client.subscribe(ticketChannel, response => {
            console.log('Realtime update received:', response);
            
            if (response.events.includes(`databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents.*.update`)) {
                const updatedTicket = response.payload;

                if (updatedTicket.status === 'در حال سرویس') {
                    console.log('New ticket called:', updatedTicket);
                    
                    // پخش صدای فراخوانی
                    const ticketNumber = updatedTicket.specific_ticket || '0001';
                    const counterNumber = extractCounterNumber(updatedTicket.called_by_counter_name);
                    
                    console.log(`Triggering sound: Ticket ${ticketNumber}, Counter ${counterNumber}`);
                    displaySoundManager.playCallAnnouncement(ticketNumber, counterNumber);
                }
            }
            
            updateDisplay();
        });
        
        client.subscribe(photographyChannel, response => {
            console.log('Photography history updated via real-time');
            updatePhotographyDisplay();
        });
    }

    // --- Text-to-Speech Function ---
    function speak(text) {
        if ('speechSynthesis' in window) {
            // توقف صحبت‌های قبلی
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'fa-IR';
            utterance.rate = 0.8;
            utterance.pitch = 1;
            utterance.volume = 0.7;
            
            window.speechSynthesis.speak(utterance);
        }
    }

    // --- Initial Load ---
    function initializeDisplay() {
        console.log('🚀 Initializing display system...');
        
        // تست اولیه صدا
        setTimeout(() => {
            console.log('🔊 Testing audio system...');
            // تست صدا با یک شماره نمونه
            displaySoundManager.playAudioFile('sounds2/bajeh.mp3')
                .then(() => console.log('✅ Audio test passed'))
                .catch(err => console.warn('⚠️ Audio test warning:', err));
        }, 1000);
        
        updateDisplay();
        setupRealtime();
        setInterval(updateDisplay, 30000); // به‌روزرسانی هر 30 ثانیه
        
        console.log('✅ Display system initialized');
    }

    // --- Start the Display ---
    initializeDisplay();
});