// تنظیمات Supabase
const supabaseUrl = 'https://qvvdudshxqczaototiaz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dmR1ZHNoeHFjemFvdG90aWF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1NDE0OTksImV4cCI6MjA2OTExNzQ5OX0._gYhTsk10lR3K0hC138yNS5-NbMqkkC6zByCDv-FvXo';
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

// عناصر DOM
const root = document.getElementById('root');

// توابع کمکی
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.className = 'toast hidden', 3000);
}

function calculateWaitTime(ticketId) {
  const ticket = queue.find(t => t.id === ticketId);
  if (!ticket || ticket.called) return 0;
  
  // تعداد نوبت‌های قبل از این نوبت برای همین سرویس که هنوز فراخوان نشده‌اند
  const queuePosition = queue.filter(t => 
    t.button_number === ticket.button_number && 
    !t.called && 
    (t.special_number < ticket.special_number || 
     (t.special_number === ticket.special_number && new Date(t.timestamp) < new Date(ticket.timestamp)))
  ).length;
  
  return queuePosition * serviceTime[ticket.button_number];
}

function formatWaitTime(minutes) {
  if (minutes === 0) return 'نوبت شما';
  if (minutes < 60) return `${minutes} دقیقه`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} ساعت و ${remainingMinutes} دقیقه`;
}

function getNextTicketToCall() {
  if (selectedServices.size === 0) return null;

  // فیلتر نوبت‌های قابل فراخوان
  const availableTickets = queue.filter(ticket => 
    selectedServices.has(ticket.button_number) && 
    !ticket.called
  );

  if (availableTickets.length === 0) return null;

  // مرتب‌سازی بر اساس شماره خاص (کوچکترین) و سپس زمان ثبت (زودترین)
  availableTickets.sort((a, b) => {
    if (a.special_number !== b.special_number) {
      return a.special_number - b.special_number;
    }
    return new Date(a.timestamp) - new Date(b.timestamp);
  });

  return availableTickets[0];
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
              ${Object.entries(services).map(([id, name]) => `
                <button 
                  data-service="${id}" 
                  class="service-btn"
                >
                  ${name}
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- بخش انتخاب سرویس‌ها برای فراخوان -->
        <div class="section call-section">
          <div class="section-card">
            <h2 class="section-title">انتخاب سرویس‌ها برای فراخوان</h2>
            <div class="services-selection">
              ${Object.entries(services).map(([id, name]) => `
                <label class="service-checkbox-label">
                  <input 
                    type="checkbox" 
                    data-service="${id}" 
                    class="service-checkbox"
                    ${selectedServices.has(id) ? 'checked' : ''}
                  >
                  <span class="service-name">${name}</span>
                  <span class="service-time">(${serviceTime[id]} دقیقه)</span>
                </label>
              `).join('')}
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
            <div id="queue-list" class="queue-list">
              ${renderQueueList()}
            </div>
          </div>
        </div>

        <!-- اطلاعات سیستم -->
        <div class="section info-section">
          <div class="section-card">
            <h2 class="section-title">اطلاعات سیستم</h2>
            <div class="system-info">
              <div class="info-item">
                <span class="info-label">شمارنده عمومی:</span>
                <span class="info-value">${counters.general}</span>
              </div>
              ${Object.entries(counters.special).map(([id, value]) => `
                <div class="info-item">
                  <span class="info-label">${services[id]}:</span>
                  <span class="info-value">${value}</span>
                </div>
              `).join('')}
            </div>
            <button id="clear-queue-btn" class="clear-btn">
              پاک کردن همه نوبت‌ها
            </button>
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

  // مرتب‌سازی نوبت‌ها بر اساس وضعیت، سپس شماره خاص
  const sortedQueue = [...queue].sort((a, b) => {
    // ابتدا نوبت‌های در انتظار، سپس فراخوانی شده
    if (a.called !== b.called) {
      return a.called ? 1 : -1;
    }
    // سپس بر اساس شماره خاص
    return a.special_number - b.special_number;
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
            <th>وضعیت</th>
          </tr>
        </thead>
        <tbody>
          ${sortedQueue.map(item => {
            const waitTime = calculateWaitTime(item.id);
            return `
              <tr class="queue-row ${item.called ? 'called' : 'waiting'}">
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
                <td class="status-cell">
                  ${item.called 
                    ? (currentlyServing[item.button_number]?.id === item.id 
                        ? '<span class="status serving">🔄 در حال سرویس</span>'
                        : '<span class="status completed">✅ تکمیل شده</span>')
                    : '<span class="status waiting">⏳ در انتظار</span>'}
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
    await loadInitialData();
    renderMain();
    showToast('ورود موفقیت‌آمیز');
    return;
  }

  showToast('نام کاربری یا رمز عبور اشتباه است', 'error');
}

async function handleLogout() {
  currentUser = null;
  queue = [];
  currentlyServing = {};
  selectedServices.clear();
  renderLogin();
  showToast('با موفقیت خارج شدید');
}

let pendingTicket = null;

async function handleRegisterTicket(e) {
  const serviceId = e.target.dataset.service;
  
  // ایجاد نوبت موقت
  pendingTicket = {
    id: Date.now(),
    general_id: counters.general,
    button_number: serviceId,
    special_number: counters.special[serviceId],
    service_type: services[serviceId],
    timestamp: new Date().toISOString(),
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
          placeholder="نام خانوادگی (اجباری)"
          class="customer-input"
          required
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

function confirmTicket() {
  const lastName = document.getElementById('customer-lastname').value.trim();
  const nationalId = document.getElementById('customer-nationalid').value.trim();

  if (!lastName) {
    showToast('لطفاً نام خانوادگی را وارد کنید', 'error');
    return;
  }

  // اضافه کردن اطلاعات مشتری به نوبت
  pendingTicket.last_name = lastName;
  if (nationalId) {
    pendingTicket.national_id = nationalId;
  }

  // اضافه کردن به صف
  queue.unshift(pendingTicket);

  // افزایش شمارنده‌ها
  counters.general += 1;
  counters.special[pendingTicket.button_number] += 1;

  // بستن modal
  document.getElementById('ticket-modal').classList.add('hidden');

  // بروزرسانی نمایش
  renderMain();
  
  const waitTime = calculateWaitTime(pendingTicket.id);
  showToast(`نوبت ${pendingTicket.special_number} برای ${pendingTicket.service_type} ثبت شد - زمان انتظار: ${formatWaitTime(waitTime)}`);
  
  pendingTicket = null;
}

function cancelTicket() {
  document.getElementById('ticket-modal').classList.add('hidden');
  pendingTicket = null;
}

function handleServiceSelection(e) {
  const serviceId = e.target.dataset.service;
  
  if (e.target.checked) {
    selectedServices.add(serviceId);
  } else {
    selectedServices.delete(serviceId);
  }

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

    // علامت‌گذاری به عنوان فراخوانی شده
    nextTicket.called = true;
    nextTicket.call_time = new Date().toISOString();

    // اضافه کردن به نوبت‌های در حال سرویس
    currentlyServing[nextTicket.button_number] = nextTicket;

    // بروزرسانی نمایش
    renderMain();

    showToast(`نوبت ${nextTicket.special_number} برای ${nextTicket.service_type} فراخوانی شد`);
  } catch (error) {
    showToast('خطا در فراخوانی نوبت: ' + error.message, 'error');
  }
}

async function handleClearQueue() {
  if (confirm('آیا مطمئن هستید که می‌خواهید همه نوبت‌ها را پاک کنید؟')) {
    queue = [];
    currentlyServing = {};
    renderMain();
    showToast('همه نوبت‌ها پاک شدند');
  }
}

// توابع داده
async function loadInitialData() {
  try {
    // در حالت آفلاین، داده‌های پیش‌فرض را نگه می‌داریم
    console.log('داده‌های اولیه بارگذاری شد');
  } catch (error) {
    console.error('خطا در بارگذاری داده‌های اولیه:', error);
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