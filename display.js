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
    const callDisplay = document.getElementById('call-display');
    const historyList = document.getElementById('history-list');
    const photographyDisplay = document.getElementById('photography-display');
    const photographyListContainer = document.getElementById('photography-list');

    // --- Text-to-Speech Function ---
    function speak(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'fa-IR'; // Set language to Persian
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        } else {
            console.log('Text-to-Speech not supported in this browser.');
        }
    }

    // --- UI Update Functions ---
    async function updateDisplay() {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                TICKETS_COLLECTION_ID,
                [
                    Query.equal('status', 'در حال سرویس'),
                    Query.orderDesc('call_time'),
                    Query.limit(5) // Get the latest 5 called tickets
                ]
            );

            const calledTickets = response.documents;

            if (calledTickets.length > 0) {
                const latestTicket = calledTickets[0];
                
                // Update main display
                callDisplay.innerHTML = `
                    <div class="ticket-card">
                        <div class="ticket-number">${latestTicket.specific_ticket || 'پاس'}</div>
                        <div class="counter-name">${latestTicket.called_by_counter_name || 'باجه'}</div>
                    </div>
                `;

                // Update history list (next 4 tickets)
                historyList.innerHTML = '';
                calledTickets.slice(1).forEach(ticket => {
                    const historyItem = document.createElement('div');
                    historyItem.className = 'history-item';
                    historyItem.textContent = ticket.specific_ticket || 'پاس';
                    historyList.appendChild(historyItem);
                });

            } else {
                callDisplay.innerHTML = `
                    <div class="ticket-card placeholder">
                        <div class="ticket-number">---</div>
                        <div class="counter-name">منتظر فراخوان...</div>
                    </div>
                `;
                historyList.innerHTML = '';
            }

        } catch (error) {
            console.error("Error fetching called tickets:", error);
        }
    }

    // --- Realtime Subscription ---
    function setupRealtime() {
        const channel = `databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents`;
        
        client.subscribe(channel, response => {
            // Check if a ticket was just called
            if (response.events.includes(`databases.${DATABASE_ID}.collections.${TICKETS_COLLECTION_ID}.documents.*.update`)) {
                const updatedTicket = response.payload;

                // If a ticket's status changed to 'در حال سرویس'
                if (updatedTicket.status === 'در حال سرویس') {
                    // Flash effect
                    const ticketCard = callDisplay.querySelector('.ticket-card');
                    if(ticketCard) {
                        ticketCard.classList.add('flash');
                        setTimeout(() => ticketCard.classList.remove('flash'), 1000);
                    }
                    
                    // Announce the number
                    const numberToSpeak = updatedTicket.specific_ticket || 'نوبت پاس شده';
                    const counterName = updatedTicket.called_by_counter_name || 'باجه';
                    const textToSpeak = `شماره ${numberToSpeak} به ${counterName}`;
                    speak(textToSpeak);
                }
            }
            // Update the UI regardless of the event type
            updateDisplay();
        });
    }

    function updatePhotographyDisplay() {
    try {
        const savedList = localStorage.getItem('photographyList');
        if (savedList) {
            const photographyList = JSON.parse(savedList);
            
            if (photographyList.length === 0) {
                photographyListContainer.innerHTML = '<div class="photography-empty">هیچ نوبتی در لیست عکاسی وجود ندارد</div>';
                return;
            }
            
            // فقط 7 آیتم اول را نشان بده
            const displayItems = photographyList.slice(0, 7);
            
            photographyListContainer.innerHTML = displayItems.map((item, index) => `
                <div class="photography-item ${item.photoTaken ? 'photo-taken' : ''}">
                    <div class="photography-number">${index + 1}</div>
                    <div class="photography-info">
                        <div class="photography-ticket">${item.ticketNumber} - ${item.firstName} ${item.lastName}</div>
                        <div class="photography-national-id">${item.nationalId}</div>
                    </div>
                    <div class="photography-status ${item.photoTaken ? 'photo-taken' : ''}">
                        ${item.photoTaken ? 'عکس گرفته شد' : 'در انتظار'}
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error updating photography display:', error);
    }
}

// اضافه کردن به تابع updateDisplay
async function updateDisplay() {
    try {
        // کد موجود...
        
        // به‌روزرسانی لیست عکاسی
        updatePhotographyDisplay();
        
    } catch (error) {
        console.error("Error fetching called tickets:", error);
    }
}

// اضافه کردن به تابع setupRealtime
function setupRealtime() {
    // کد موجود...
    
    // اضافه کردن شنود برای تغییرات در localStorage (برای همگام‌سازی لیست عکاسی)
    window.addEventListener('storage', function(e) {
        if (e.key === 'photographyList') {
            updatePhotographyDisplay();
        }
    });
}

// فراخوانی اولیه
updatePhotographyDisplay();

    // --- Initial Load ---
    updateDisplay();
    setupRealtime();
});
