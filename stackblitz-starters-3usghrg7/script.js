// تنظیمات Supabase
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://qvvdudshxqczaototiaz.supabase.co';
const supabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dmR1ZHNoeHFjemFvdG90aWF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1NDE0OTksImV4cCI6MjA2OTExNzQ5OX0._gYhTsk10lR3K0hC138yNS5-NbMqkkC6zByCDv-FvXo';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// سرویس‌های موجود
const services = {
  '1': 'احراز هویت',
  '2': 'گذرنامه',
  '3': 'نظام وظیفه',
  '4': 'یارانه',
  '5': 'گواهینامه',
  '6': 'کارت سوخت'
};

// زمان تقریبی هر سرویس (به دقیقه)
const serviceTime = {
  '1': 5,
  '2': 8,
  '3': 6,
  '4': 4,
  '5': 7,
  '6': 3
};

// متغیرهای حالت
let currentUser = null;
let queue = [];
let counters = {
  general: 1,
  special: {'1': 101, '2': 201, '3': 301, '4': 401, '5': 501, '6': 601}
};
let currentlyServing = {}; // نوبت‌هایی که در حال سرویس هستند
let selectedServices = new Set(); // سرویس‌های انتخاب شده برای فراخوان
let lastCallTime = {}; // آخرین زمان فراخوان برای هر سرویس
let userId = null; // شناسه کاربر فعلی

// عناصر DOM
const root = document.getElementById('root');

// توابع کمکی
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.className = 'toast hidden', 3000);
}

function generateUserId() {
  return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

function calculateWaitTime(ticketId) {
  const ticket = queue.find(t => t.id === ticketId);
  if (!ticket || ticket.called) return 0;
  
  // تعداد نوبت‌های قبل از این نوبت برای همین سرویس که هنوز فراخوان نشده‌اند
  const queuePosition = queue.filter(t => 
    t.button_number === ticket.button_number && 
    !t.called && 
    new Date(t.created_at) < new Date(ticket.created_at)
  ).length;
  
  return queuePosition * serviceTime[ticket.button_number];
}

function calculateEstimatedCallTime(ticketId) {
  const ticket = queue.find(t => t.id === ticketId);
  if (!ticket || ticket.called) return null;
  
  // تعداد نوبت‌های قبل از این نوبت
  const queuePosition = queue.filter(t => 
    t.button_number === ticket.button_number && 
    !t.called && 
    new Date(t.created_at) < new Date(ticket.created_at)
  ).length;
  
  // زمان تخمینی بر اساس زمان آخرین فراخوان
  const lastCall = lastCallTime[ticket.button_number] || new Date();
  const estimatedTime = new Date(lastCall.getTime() + (queuePosition + 1) * serviceTime[ticket.button_number] * 60000);
  
  return estimatedTime;
}

function formatWaitTime(minutes) {
  if (minutes === 0) return 'نوبت شما';
  if (minutes < 60) return `${minutes} دقیقه`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} ساعت و ${remainingMinutes} دقیقه`;
}

function formatEstimatedTime(date) {
  if (!date) return '-';
  const now = new Date();
  const diffMinutes = Math.round((date - now) / 60000);
  
  if (diffMinutes <= 0) return 'اکنون';
  if (diffMinutes < 60) return `${diffMinutes} دقیقه دیگر`;
  
  return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

function getWaitingCount(serviceId) {
  return queue.filter(ticket => 
    ticket.button_number === serviceId && !ticket.called
  ).length;
}

function getNextTicketToCall() {
  if (selectedServices.size === 0) return null;

  // فیلتر نوبت‌های قابل فراخوان
  const availableTickets = queue.filter(ticket => 
    selectedServices.has(ticket.button_number) && 
    !ticket.called
  );

  if (availableTickets.length === 0) return null;

  // مرتب‌سازی بر اساس زمان ثبت (اولویت اول) و سپس شماره خاص
  availableTickets.sort((a, b) => {
    const timeA = new Date(a.created_at);
    const timeB = new Date(b.created_at);
    
    if (timeA.getTime() !== timeB.getTime()) {
      return timeA - timeB; // زودترین زمان ثبت
    }
    return a.special_number - b.special_number; // کوچکترین شماره خاص
  });

  return availableTickets[0];
}

function getNextTicketInQueue(serviceId) {
  const waitingTickets = queue.filter(ticket => 
    ticket.button_number === serviceId && !ticket.called
  );
  
  if (waitingTickets.length === 0) return null;
  
  waitingTickets.sort((a, b) => {
    const timeA = new Date(a.created_at);
    const timeB = new Date(b.created_at);
    return timeA - timeB;
  });
  
  return waitingTickets[0];
}

// توابع Supabase
async function loadQueueFromDB() {
  try {
    const { data, error } = await supabase
      .from('queue_tickets')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    queue = data || [];
    
    // بروزرسانی نوبت‌های در حال سرویس
    currentlyServing = {};
    queue.forEach(ticket => {
      if (ticket.called && ticket.call_time) {
        // بررسی اینکه آیا این نوبت هنوز در حال سرویس است
        const callTime = new Date(ticket.call_time);
        const now = new Date();
        const serviceTimeMs = serviceTime[ticket.button_number] * 60000;
        
        if (now - callTime < serviceTimeMs) {
          currentlyServing[ticket.button_number] = ticket;
        }
      }
    });
    
  } catch (error) {
    console.error('خطا در بارگذاری نوبت‌ها:', error);
    showToast('خطا در بارگذاری نوبت‌ها', 'error');
  }
}

async function loadCountersFromDB() {
  try {
    const { data, error } = await supabase
      .from('system_counters')
      .select('*');

    if (error) throw error;
    
    if (data && data.length > 0) {
      counters = { general: 1, special: {} };
      
      data.forEach(counter => {
        if (counter.counter_type === 'general') {
          counters.general = counter.current_value;
        } else if (counter.counter_type === 'special') {
          counters.special[counter.service_id] = counter.current_value;
        }
      });
    }
    
  } catch (error) {
    console.error('خطا در بارگذاری شمارنده‌ها:', error);
  }
}

async function loadActiveServicesFromDB() {
  try {
    const { data, error } = await supabase
      .from('active_services')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;
    
    selectedServices.clear();
    if (data) {
      data.forEach(service => {
        selectedServices.add(service.service_id);
      });
    }
    
  } catch (error) {
    console.error('خطا در بارگذاری سرویس‌های فعال:', error);
  }
}

async function saveTicketToDB(ticket) {
  try {
    const { data, error } = await supabase
      .from('queue_tickets')
      .insert([{
        general_id: ticket.general_id,
        special_number: ticket.special_number,
        button_number: ticket.button_number,
        service_type: ticket.service_type,
        last_name: ticket.last_name || null,
        national_id: ticket.national_id || null,
        called: ticket.called,
        call_time: ticket.call_time || null,
        created_by: ticket.created_by
      }])
      .select()
      .single();

    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('خطا در ذخیره نوبت:', error);
    throw error;
  }
}

async function updateCountersInDB() {
  try {
    // بروزرسانی شمارنده عمومی
    await supabase
      .from('system_counters')
      .update({ current_value: counters.general })
      .eq('counter_type', 'general')
      .is('service_id', null);

    // بروزرسانی شمارنده‌های خاص
    for (const [serviceId, value] of Object.entries(counters.special)) {
      await supabase
        .from('system_counters')
        .update({ current_value: value })
        .eq('counter_type', 'special')
        .eq('service_id', serviceId);
    }
    
  } catch (error) {
    console.error('خطا در بروزرسانی شمارنده‌ها:', error);
    throw error;
  }
}

async function updateTicketInDB(ticketId, updates) {
  try {
    const { error } = await supabase
      .from('queue_tickets')
      .update(updates)
      .eq('id', ticketId);

    if (error) throw error;
    
  } catch (error) {
    console.error('خطا در بروزرسانی نوبت:', error);
    throw error;
  }
}

async function saveActiveServicesToDB() {
  try {
    // ابتدا همه سرویس‌های این کاربر را غیرفعال کن
    await supabase
      .from('active_services')
      .update({ is_active: false })
      .eq('user_id', userId);

    // سپس سرویس‌های انتخاب شده را فعال کن
    for (const serviceId of selectedServices) {
      await supabase
        .from('active_services')
        .upsert({
          user_id: userId,
          service_id: serviceId,
          is_active: true
        });
    }
    
  } catch (error) {
    console.error('خطا در ذخیره سرویس‌های فعال:', error);
  }
}

async function clearAllData() {
  try {
    // حذف همه نوبت‌ها
    await supabase
      .from('queue_tickets')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // حذف همه

    // ریست شمارنده‌ها
    await supabase
      .from('system_counters')
      .update({ current_value: 1 })
      .eq('counter_type', 'general');

    const resetValues = {'1': 101, '2': 201, '3': 301, '4': 401, '5': 501, '6': 601};
    for (const [serviceId, value] of Object.entries(resetValues)) {
      await supabase
        .from('system_counters')
        .update({ current_value: value })
        .eq('counter_type', 'special')
        .eq('service_id', serviceId);
    }
    
  } catch (error) {
    console.error('خطا در پاک کردن داده‌ها:', error);
    throw error;
  }
}

// راه‌اندازی Real-time subscriptions
function setupRealtimeSubscriptions() {
  // اشتراک برای تغییرات نوبت‌ها
  supabase
    .channel('queue_tickets')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'queue_tickets' },
      async (payload) => {
        console.log('تغییر در نوبت‌ها:', payload);
        await loadQueueFromDB();
        if (currentUser) {
          renderMain();
        }
      }
    )
    .subscribe();

  // اشتراک برای تغییرات شمارنده‌ها
  supabase
    .channel('system_counters')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'system_counters' },
      async (payload) => {
        console.log('تغییر در شمارنده‌ها:', payload);
        await loadCountersFromDB();
        if (currentUser) {
          renderMain();
        }
      }
    )
    .subscribe();

  // اشتراک برای تغییرات سرویس‌های فعال سایر کاربران
  supabase
    .channel('active_services')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'active_services' },
      async (payload) => {
        console.log('تغییر در سرویس‌های فعال:', payload);
        // فقط اگر تغییر مربوط به کاربر دیگری باشد
        if (payload.new?.user_id !== userId && payload.old?.user_id !== userId) {
          if (currentUser) {
            renderMain();
          }
        }
      }
    )
    .subscribe();
}

// صفحه ورود
function renderLogin() {
  root.innerHTML = `
    <div class="login-container">
      <div class="login-card">
        <h1 class="login-title">ورود به سیستم</h1>
        <div class="login-form">
          <input id="username" type="text" placeholder="نام کاربری" class="login-input">
          <input id="password" type="password" placeholder="رمز عبور" class="login-input">
          <button id="login-btn" class="login-btn">
            ورود
          </button>
          <div class="login-help">
            <p>برای تست: admin / 123456</p>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('login-btn').addEventListener('click', handleLogin);
  
  // اضافه کردن قابلیت ورود با Enter
  document.getElementById('password').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      handleLogin();
    }
  });
}

// صفحه اصلی
function renderMain() {
  root.innerHTML = `
    <div class="main-container">
      <header class="main-header">
        <h1 class="header-title">سیستم نوبت دهی آنلاین</h1>
        <div class="header-info">
          <span class="user-info">کاربر: ${currentUser?.email || 'مهمان'}</span>
          <button id="logout-btn" class="logout-btn">
            خروج
          </button>
        </div>
      </header>

      <div class="main-content">
        <!-- بخش ثبت نوبت -->
        <div class="section register-section">
          <div class="section-card">
            <h2 class="section-title">ثبت نوبت جدید</h2>
            <div class="services-grid">
              ${Object.entries(services).map(([id, name]) => {
                const waitingCount = getWaitingCount(id);
                return `
                  <button 
                    data-service="${id}" 
                    class="service-btn"
                  >
                    <div class="service-btn-content">
                      <span class="service-name">${name}</span>
                      <span class="waiting-count">${waitingCount} نفر منتظر</span>
                    </div>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- بخش انتخاب سرویس‌ها برای فراخوان -->
        <div class="section call-section">
          <div class="section-card">
            <h2 class="section-title">انتخاب سرویس‌ها برای فراخوان</h2>
            <div class="services-selection">
              ${Object.entries(services).map(([id, name]) => {
                const waitingCount = getWaitingCount(id);
                const isServing = currentlyServing[id];
                const nextTicket = getNextTicketInQueue(id);
                
                return `
                  <label class="service-checkbox-label ${isServing ? 'serving' : ''}">
                    <input 
                      type="checkbox" 
                      data-service="${id}" 
                      class="service-checkbox"
                      ${selectedServices.has(id) ? 'checked' : ''}
                    >
                    <div class="service-info">
                      <span class="service-name">${name}</span>
                      <span class="service-details">
                        <span class="service-time">(${serviceTime[id]} دقیقه)</span>
                        <span class="waiting-count">${waitingCount} نفر منتظر</span>
                      </span>
                      ${isServing ? `
                        <div class="serving-status">
                          <span class="serving-indicator">🔄 در حال سرویس</span>
                          <span class="serving-details">${isServing.last_name || 'نامشخص'} - ${isServing.special_number}</span>
                        </div>
                      ` : ''}
                      ${nextTicket && selectedServices.has(id) ? `
                        <div class="next-ticket-preview">
                          <span class="next-indicator">⏭️ بعدی: ${nextTicket.special_number}</span>
                          <span class="next-details">${nextTicket.last_name || 'نامشخص'}</span>
                        </div>
                      ` : ''}
                    </div>
                  </label>
                `;
              }).join('')}
            </div>
            <button id="call-next-btn" class="call-btn">
              فراخوان نوبت بعدی
            </button>
            <div id="next-ticket-info" class="next-ticket-info">
              ${renderNextTicketInfo()}
            </div>
          </div>
        </div>

        <!-- نوبت در حال سرویس -->
        <div class="section serving-section">
          <div class="section-card">
            <h2 class="section-title">در حال سرویس</h2>
            <div id="currently-serving">
              ${renderCurrentlyServing()}
            </div>
          </div>
        </div>

        <!-- لیست نوبت‌ها -->
        <div class="section queue-section">
          <div class="section-card">
            <h2 class="section-title">لیست نوبت‌ها</h2>
            <div class="queue-controls">
              <button id="clear-queue-btn" class="clear-btn">
                پاک کردن همه نوبت‌ها
              </button>
            </div>
            <div id="queue-list" class="queue-list">
              ${renderQueueList()}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal برای تأیید ثبت نوبت -->
    <div id="ticket-modal" class="modal hidden">
      <div class="modal-content">
        <h3 class="modal-title">تأیید ثبت نوبت</h3>
        <div id="ticket-details" class="ticket-details"></div>
        <div class="modal-actions">
          <button id="confirm-ticket" class="confirm-btn">تأیید</button>
          <button id="cancel-ticket" class="cancel-btn">لغو</button>
        </div>
      </div>
    </div>
  `;

  // اضافه کردن event listeners
  document.querySelectorAll('.service-btn').forEach(btn => {
    btn.addEventListener('click', handleRegisterTicket);
  });

  document.querySelectorAll('.service-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', handleServiceSelection);
  });

  document.getElementById('call-next-btn').addEventListener('click', handleCallNext);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('clear-queue-btn').addEventListener('click', handleClearQueue);
}

// رندر اطلاعات نوبت بعدی
function renderNextTicketInfo() {
  const nextTicket = getNextTicketToCall();
  
  if (!nextTicket) {
    return '<p class="no-ticket">هیچ نوبتی برای فراخوان انتخاب نشده</p>';
  }

  return `
    <div class="next-ticket-card">
      <h4>نوبت بعدی برای فراخوان:</h4>
      <div class="ticket-info">
        <span class="ticket-number">نوبت ${nextTicket.special_number}</span>
        <span class="ticket-service">${nextTicket.service_type}</span>
      </div>
      <div class="ticket-details-small">
        <span>نام: ${nextTicket.last_name || 'نامشخص'}</span>
        ${nextTicket.national_id ? `<span>کدملی: ${nextTicket.national_id}</span>` : ''}
      </div>
    </div>
  `;
}

// رندر نوبت‌های در حال سرویس
function renderCurrentlyServing() {
  const servingTickets = Object.values(currentlyServing);
  
  if (servingTickets.length === 0) {
    return '<p class="no-serving">هیچ نوبتی در حال سرویس نیست</p>';
  }

  return `
    <div class="serving-grid">
      ${servingTickets.map(ticket => `
        <div class="serving-card">
          <div class="serving-header">
            <span class="serving-number">نوبت ${ticket.special_number}</span>
            <span class="serving-service">${ticket.service_type}</span>
          </div>
          <div class="serving-details">
            <p><strong>نام:</strong> ${ticket.last_name || 'نامشخص'}</p>
            ${ticket.national_id ? `<p><strong>کدملی:</strong> ${ticket.national_id}</p>` : ''}
            <p><strong>شماره عمومی:</strong> ${ticket.general_id}</p>
            <p><strong>زمان فراخوان:</strong> ${new Date(ticket.call_time).toLocaleTimeString('fa-IR')}</p>
            <p><strong>مدت سرویس:</strong> ${serviceTime[ticket.button_number]} دقیقه</p>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// رندر لیست نوبت‌ها
function renderQueueList() {
  if (queue.length === 0) {
    return '<p class="no-queue">نوبتی ثبت نشده است</p>';
  }

  // مرتب‌سازی نوبت‌ها بر اساس وضعیت، سپس زمان ثبت
  const sortedQueue = [...queue].sort((a, b) => {
    // ابتدا نوبت‌های در انتظار، سپس فراخوانی شده
    if (a.called !== b.called) {
      return a.called ? 1 : -1;
    }
    // سپس بر اساس زمان ثبت
    return new Date(a.created_at) - new Date(b.created_at);
  });

  return `
    <div class="queue-table-container">
      <table class="queue-table">
        <thead>
          <tr>
            <th>شماره نوبت</th>
            <th>خدمت</th>
            <th>نام</th>
            <th>زمان انتظار</th>
            <th>تخمین فراخوان</th>
            <th>وضعیت</th>
          </tr>
        </thead>
        <tbody>
          ${sortedQueue.map(item => {
            const waitTime = calculateWaitTime(item.id);
            const estimatedCallTime = calculateEstimatedCallTime(item.id);
            const isCurrentlyServing = currentlyServing[item.button_number]?.id === item.id;
            const nextTicket = getNextTicketToCall();
            const isNextToCall = nextTicket?.id === item.id;
            
            return `
              <tr class="queue-row ${item.called ? 'called' : 'waiting'} ${isNextToCall ? 'next-to-call' : ''}">
                <td class="ticket-number-cell">
                  <div class="number-info">
                    <span class="special-number">${item.special_number}</span>
                    <span class="general-number">عمومی: ${item.general_id}</span>
                  </div>
                </td>
                <td class="service-cell">${item.service_type}</td>
                <td class="name-cell">
                  <div class="customer-info">
                    <span class="name">${item.last_name || 'نامشخص'}</span>
                    ${item.national_id ? `<span class="national-id">${item.national_id}</span>` : ''}
                  </div>
                </td>
                <td class="wait-time-cell">
                  <span class="wait-time">${formatWaitTime(waitTime)}</span>
                </td>
                <td class="estimated-time-cell">
                  <span class="estimated-time">${formatEstimatedTime(estimatedCallTime)}</span>
                </td>
                <td class="status-cell">
                  ${item.called 
                    ? (isCurrentlyServing 
                        ? '<span class="status serving">🔄 در حال سرویس</span>'
                        : '<span class="status completed">✅ تکمیل شده</span>')
                    : (isNextToCall 
                        ? '<span class="status next">⏭️ نوبت بعدی</span>'
                        : '<span class="status waiting">⏳ در انتظار</span>')}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// مدیریت رویدادها
async function handleLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!username || !password) {
    showToast('لطفاً نام کاربری و رمز عبور را وارد کنید', 'error');
    return;
  }

  // ورود ساده بدون Supabase Auth برای تست
  if (username === 'admin' && password === '123456') {
    currentUser = { email: 'admin@system.com', id: 'admin' };
    userId = generateUserId();
    
    await loadInitialData();
    setupRealtimeSubscriptions();
    renderMain();
    showToast('ورود موفقیت‌آمیز');
    return;
  }

  showToast('نام کاربری یا رمز عبور اشتباه است', 'error');
}

async function handleLogout() {
  currentUser = null;
  userId = null;
  queue = [];
  currentlyServing = {};
  selectedServices.clear();
  lastCallTime = {};
  
  // قطع اتصالات real-time
  supabase.removeAllChannels();
  
  renderLogin();
  showToast('با موفقیت خارج شدید');
}

let pendingTicket = null;

async function handleRegisterTicket(e) {
  const serviceId = e.target.dataset.service;
  
  // ایجاد نوبت موقت
  pendingTicket = {
    general_id: counters.general,
    button_number: serviceId,
    special_number: counters.special[serviceId],
    service_type: services[serviceId],
    called: false,
    created_by: currentUser?.email || 'مهمان'
  };

  // نمایش modal برای تأیید
  showTicketModal();
}

function showTicketModal() {
  const modal = document.getElementById('ticket-modal');
  const ticketDetails = document.getElementById('ticket-details');
  
  ticketDetails.innerHTML = `
    <div class="ticket-preview">
      <div class="ticket-numbers">
        <div class="number-item">
          <label>شماره نوبت خاص:</label>
          <span class="number-value">${pendingTicket.special_number}</span>
        </div>
        <div class="number-item">
          <label>شماره نوبت عمومی:</label>
          <span class="number-value">${pendingTicket.general_id}</span>
        </div>
      </div>
      
      <div class="service-info">
        <label>سرویس:</label>
        <span>${pendingTicket.service_type}</span>
      </div>
      
      <div class="customer-inputs">
        <input 
          id="customer-lastname" 
          type="text" 
          placeholder="نام خانوادگی (اختیاری)"
          class="customer-input"
        >
        <input 
          id="customer-nationalid" 
          type="text" 
          placeholder="کدملی (اختیاری)"
          class="customer-input"
          maxlength="10"
        >
      </div>
    </div>
  `;

  modal.classList.remove('hidden');

  // Event listeners برای modal
  document.getElementById('confirm-ticket').onclick = confirmTicket;
  document.getElementById('cancel-ticket').onclick = cancelTicket;
  
  // Focus روی input نام
  setTimeout(() => {
    document.getElementById('customer-lastname').focus();
  }, 100);
}

async function confirmTicket() {
  const lastName = document.getElementById('customer-lastname').value.trim();
  const nationalId = document.getElementById('customer-nationalid').value.trim();

  // اضافه کردن اطلاعات مشتری به نوبت
  if (lastName) {
    pendingTicket.last_name = lastName;
  }
  if (nationalId) {
    pendingTicket.national_id = nationalId;
  }

  try {
    // ذخیره در دیتابیس
    const savedTicket = await saveTicketToDB(pendingTicket);
    
    // افزایش شمارنده‌ها
    counters.general += 1;
    counters.special[pendingTicket.button_number] += 1;
    
    // بروزرسانی شمارنده‌ها در دیتابیس
    await updateCountersInDB();

    // بستن modal
    document.getElementById('ticket-modal').classList.add('hidden');
    
    const waitTime = calculateWaitTime(savedTicket.id);
    showToast(`نوبت ${savedTicket.special_number} برای ${savedTicket.service_type} ثبت شد - زمان انتظار: ${formatWaitTime(waitTime)}`);
    
  } catch (error) {
    showToast('خطا در ثبت نوبت: ' + error.message, 'error');
  }
  
  pendingTicket = null;
}

function cancelTicket() {
  document.getElementById('ticket-modal').classList.add('hidden');
  pendingTicket = null;
}

async function handleServiceSelection(e) {
  const serviceId = e.target.dataset.service;
  
  if (e.target.checked) {
    selectedServices.add(serviceId);
  } else {
    selectedServices.delete(serviceId);
  }

  // ذخیره در دیتابیس
  await saveActiveServicesToDB();

  // بروزرسانی اطلاعات نوبت بعدی
  document.getElementById('next-ticket-info').innerHTML = renderNextTicketInfo();
}

async function handleCallNext() {
  if (selectedServices.size === 0) {
    showToast('لطفاً حداقل یک سرویس را انتخاب کنید', 'warning');
    return;
  }

  const nextTicket = getNextTicketToCall();

  if (!nextTicket) {
    showToast('هیچ نوبتی برای سرویس‌های انتخاب شده در انتظار نیست', 'warning');
    return;
  }

  try {
    // اگر نوبتی در حال سرویس برای این سرویس وجود دارد، ابتدا آن را تکمیل کن
    if (currentlyServing[nextTicket.button_number]) {
      delete currentlyServing[nextTicket.button_number];
    }

    // بروزرسانی نوبت در دیتابیس
    const callTime = new Date().toISOString();
    await updateTicketInDB(nextTicket.id, {
      called: true,
      call_time: callTime
    });
    
    // ثبت زمان آخرین فراخوان
    lastCallTime[nextTicket.button_number] = new Date();

    // اضافه کردن به نوبت‌های در حال سرویس
    nextTicket.called = true;
    nextTicket.call_time = callTime;
    currentlyServing[nextTicket.button_number] = nextTicket;

    // بروزرسانی نمایش
    renderMain();

    const customerInfo = nextTicket.last_name || 'نامشخص';
    const nationalInfo = nextTicket.national_id ? ` - کدملی: ${nextTicket.national_id}` : '';
    showToast(`نوبت ${nextTicket.special_number} برای ${nextTicket.service_type} فراخوانی شد - ${customerInfo}${nationalInfo}`);
    
  } catch (error) {
    showToast('خطا در فراخوانی نوبت: ' + error.message, 'error');
  }
}

async function handleClearQueue() {
  if (confirm('آیا مطمئن هستید که می‌خواهید همه نوبت‌ها را پاک کنید؟')) {
    try {
      await clearAllData();
      
      // ریست کردن متغیرهای محلی
      queue = [];
      currentlyServing = {};
      lastCallTime = {};
      
      // ریست کردن شمارنده‌ها
      counters = {
        general: 1,
        special: {'1': 101, '2': 201, '3': 301, '4': 401, '5': 501, '6': 601}
      };
      
      renderMain();
      showToast('همه نوبت‌ها پاک شدند و شمارنده‌ها ریست شدند');
      
    } catch (error) {
      showToast('خطا در پاک کردن نوبت‌ها: ' + error.message, 'error');
    }
  }
}

// توابع داده
async function loadInitialData() {
  try {
    await loadCountersFromDB();
    await loadQueueFromDB();
    await loadActiveServicesFromDB();
    console.log('داده‌های اولیه بارگذاری شد');
  } catch (error) {
    console.error('خطا در بارگذاری داده‌های اولیه:', error);
    showToast('خطا در بارگذاری داده‌های اولیه', 'error');
  }
}

// مقداردهی اولیه
async function init() {
  try {
    renderLogin();
  } catch (error) {
    console.error('خطا در مقداردهی اولیه:', error);
    showToast('خطا در بارگذاری سیستم', 'error');
  }
}

// شروع برنامه
document.addEventListener('DOMContentLoaded', init);