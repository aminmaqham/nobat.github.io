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

    // --- Text-to-Speech Function ---
    function speak(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'fa-IR';
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }

    // --- UI Update Functions ---
    async function updateDisplay() {
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
            updateTicketsDisplay(calledTickets);
            updatePhotographyDisplay();

        } catch (error) {
            console.error("Error fetching data:", error);
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

    function updatePhotographyDisplay() {
        try {
            const savedList = localStorage.getItem('photographyList');
            if (!savedList) {
                photographyList.innerHTML = '<div class="photography-empty">هیچ نوبتی در لیست عکاسی وجود ندارد</div>';
                photographyWaiting.textContent = 'منتظران: ۰';
                return;
            }

            const photographyListData = JSON.parse(savedList);
            const waitingCount = photographyListData.filter(item => !item.photoTaken).length;
            
            photographyWaiting.textContent = `منتظران: ${waitingCount}`;

            if (photographyListData.length === 0) {
                photographyList.innerHTML = '<div class="photography-empty">هیچ نوبتی در لیست عکاسی وجود ندارد</div>';
                return;
            }

            // مرتب‌سازی بر اساس زمان اضافه شدن (جدیدترین اول)
            const sortedList = [...photographyListData].sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
            
            photographyList.innerHTML = `
                <table class="photography-table">
                    <thead>
                        <tr>
                            <th>ردیف</th>
                            <th>شماره نوبت</th>
                            <th>وضعیت</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedList.map((item, index) => `
                            <tr>
                                <td class="photography-row-number">${index + 1}</td>
                                <td>
                                    <div class="photography-ticket-number">${item.ticketNumber}</div>
                                    <div class="photography-national-id">${item.nationalId}</div>
                                </td>
                                <td>
                                    <span class="photography-status ${item.photoTaken ? 'status-done' : 'status-waiting'}">
                                        ${item.photoTaken ? 'تکمیل' : 'در انتظار'}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

        } catch (error) {
            console.error('Error updating photography display:', error);
        }
    }

    function formatTime(date) {
        return date.toLocaleTimeString('fa-IR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // --- Realtime Subscription ---
    function setupRealtime() {
        const channel = `databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents`;
        
        client.subscribe(channel, response => {
            if (response.events.includes(`databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents.*.update`)) {
                const updatedTicket = response.payload;

                if (updatedTicket.status === 'در حال سرویس') {
                    // اعلام صوتی
                    const numberToSpeak = updatedTicket.specific_ticket || 'نوبت پاس شده';
                    const counterName = updatedTicket.called_by_counter_name || 'باجه';
                    const textToSpeak = `شماره ${numberToSpeak} به ${counterName}`;
                    speak(textToSpeak);
                }
            }
            
            // همچنین تغییرات در localStorage برای لیست عکاسی
            window.addEventListener('storage', function(e) {
                if (e.key === 'photographyList') {
                    updatePhotographyDisplay();
                }
            });
            
            updateDisplay();
        });
    }

    // --- Initial Load ---
    updateDisplay();
    setupRealtime();

    // به‌روزرسانی هر 30 ثانیه برای بررسی تغییر رنگ
    setInterval(updateDisplay, 30000);
});