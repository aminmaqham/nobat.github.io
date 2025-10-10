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
            this.volume = 0.5;
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
            
            // پخش "به باجه"
            await this.playAudioFile('sounds2/bajeh.mp3');
            
            // پخش شماره باجه
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
                '10': 'ten.mp3'
            };
            
            return numberMap[counterNumber] || null;
        }

        // پخش اعلان کامل برای فراخوانی نوبت
        async playCallAnnouncement(ticketNumber, counterNumber) {
            if (!this.isAudioEnabled) return;
            
            try {
                // پخش شماره نوبت (رقم به رقم)
                const ticketStr = String(ticketNumber).padStart(4, '0');
                for (let i = 0; i < ticketStr.length; i++) {
                    const digit = parseInt(ticketStr[i]);
                    await this.playNumberSound(digit);
                    await this.delay(300); // تأثیر بین ارقام
                }
                
                await this.delay(500); // تأثیر قبل از "به باجه"
                
                // پخش "به باجه"
                await this.playAudioFile('sounds2/bajeh.mp3');
                
                await this.delay(300); // تأثیر قبل از شماره باجه
                
                // پخش شماره باجه
                const counterFile = this.getCounterSoundFile(counterNumber);
                if (counterFile) {
                    await this.playAudioFile(`sounds2/${counterFile}`);
                }
                
            } catch (error) {
                console.error('Error in call announcement:', error);
            }
        }

        // پخش یک فایل صوتی
        async playAudioFile(filePath) {
            return new Promise((resolve, reject) => {
                if (!this.isAudioEnabled) {
                    resolve();
                    return;
                }

                const audio = new Audio(filePath);
                audio.volume = this.volume;
                audio.preload = 'auto';

                audio.addEventListener('canplaythrough', () => {
                    audio.play().then(resolve).catch(reject);
                });

                audio.addEventListener('error', (e) => {
                    console.warn(`Audio file not found: ${filePath}`);
                    resolve(); // حتی اگر فایل پیدا نشد ادامه بده
                });

                // Fallback در صورت عدم وجود canplaythrough
                setTimeout(() => {
                    if (audio.readyState >= 3) {
                        audio.play().then(resolve).catch(reject);
                    } else {
                        resolve();
                    }
                }, 100);
            });
        }

        // تأثیر بین پخش صداها
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

    // --- Realtime Subscription با پخش صدا ---
    function setupRealtime() {
        const ticketChannel = `databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents`;
        const photographyChannel = `databases.${DATABASE_ID}.collections.${PHOTOGRAPHY_COLLECTION_ID}.documents`;
        
        client.subscribe(ticketChannel, response => {
            if (response.events.includes(`databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents.*.update`)) {
                const updatedTicket = response.payload;

                if (updatedTicket.status === 'در حال سرویس') {
                    // پخش صدای فراخوانی
                    const ticketNumber = updatedTicket.specific_ticket || '0001';
                    const counterNumber = extractCounterNumber(updatedTicket.called_by_counter_name);
                    displaySoundManager.playCallAnnouncement(ticketNumber, counterNumber);
                    
                    // اعلام صوتی
                    const numberToSpeak = updatedTicket.specific_ticket || 'نوبت پاس شده';
                    const counterName = updatedTicket.called_by_counter_name || 'باجه';
                    const textToSpeak = `شماره ${numberToSpeak} به ${counterName}`;
                    speak(textToSpeak);
                }
            }
            
            updateDisplay();
        });
        
        client.subscribe(photographyChannel, response => {
            console.log('Display: Photography history updated via real-time');
            updatePhotographyDisplay();
        });
    }

    // استخراج شماره باجه از نام باجه
    function extractCounterNumber(counterName) {
        if (!counterName) return '1';
        
        // استخراج اعداد از نام باجه
        const numbers = counterName.match(/\d+/);
        return numbers ? numbers[0] : '1';
    }

    // --- Text-to-Speech Function ---
    function speak(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'fa-IR';
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }

    // --- Initial Load ---
    function initializeDisplay() {
        updateDisplay();
        setupRealtime();
        setInterval(updateDisplay, 30000); // به‌روزرسانی هر 30 ثانیه
    }

    // --- Start the Display ---
    initializeDisplay();
});