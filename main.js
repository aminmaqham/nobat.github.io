const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const escpos = require('escpos');
const USB = require('escpos-usb');

let mainWindow;

// تابع اصلی برای ایجاد پنجره برنامه
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        icon: path.join(__dirname, 'icon.png') // (اختیاری) می‌توانید یک آیکون برای برنامه قرار دهید
    });

    // فایل kiosk.html را به عنوان صفحه اصلی برنامه بارگذاری می‌کند
    mainWindow.loadFile('kiosk.html');
    
    // باز کردن ابزارهای توسعه‌دهنده (برای خطایابی)
    // mainWindow.webContents.openDevTools();
}

// گوش دادن به رویداد 'print-ticket' که از سمت صفحه وب ارسال می‌شود
ipcMain.on('print-ticket', (event, ticketData) => {
    try {
        const device = new USB(); // به صورت خودکار اولین پرینتر USB را پیدا می‌کند

        device.open((error) => {
            if (error) {
                console.error('Printer Error:', error);
                return;
            }

            const printer = new escpos.Printer(device);
            
            // تنظیمات چاپ به زبان فارسی و راست‌چین
            device.write(Buffer.from([0x1B, 0x74, 0x11])); // Select character code table (Farsi)
            device.write(Buffer.from([0x1B, 0x61, 0x02])); // Align Right

            printer
                .font('a')
                .align('ct')
                .style('bu')
                .size(2, 2)
                .text('Nobat Dehi System')
                .text('----------------')
                .size(1, 1)
                .align('rt')
                .text(`:شماره نوبت شما`)
                .size(3, 3)
                .text(`${ticketData.specific_ticket}`)
                .align('rt')
                .size(1, 1)
                .text(`:خدمت`)
                .text(`${ticketData.serviceName}`)
                .text(`زمان ثبت: ${new Date().toLocaleTimeString('fa-IR')}`)
                .text(`زمان تخمینی انتظار: ${ticketData.estimatedWait} دقیقه`)
                .feed(3) // اضافه کردن فضای خالی
                .cut()
                .close();
        });
    } catch (e) {
        console.error("Printing failed:", e);
    }
});

// اجرای برنامه پس از آماده شدن الکترون
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// خروج از برنامه با بستن تمام پنجره‌ها
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});