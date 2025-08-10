/*
  # ایجاد سیستم نوبت‌دهی

  1. جداول جدید
    - `queue_tickets` - نوبت‌های ثبت شده
      - `id` (uuid, primary key)
      - `general_id` (integer) - شماره عمومی
      - `special_number` (integer) - شماره خاص سرویس
      - `button_number` (text) - شناسه سرویس
      - `service_type` (text) - نام سرویس
      - `last_name` (text, nullable) - نام خانوادگی
      - `national_id` (text, nullable) - کدملی
      - `called` (boolean) - آیا فراخوان شده
      - `call_time` (timestamptz, nullable) - زمان فراخوان
      - `created_by` (text) - کاربر ثبت‌کننده
      - `created_at` (timestamptz) - زمان ثبت
      - `updated_at` (timestamptz) - زمان آخرین بروزرسانی

    - `system_counters` - شمارنده‌های سیستم
      - `id` (uuid, primary key)
      - `counter_type` (text) - نوع شمارنده (general, special)
      - `service_id` (text, nullable) - شناسه سرویس
      - `current_value` (integer) - مقدار فعلی
      - `updated_at` (timestamptz) - زمان آخرین بروزرسانی

    - `active_services` - سرویس‌های فعال هر کاربر
      - `id` (uuid, primary key)
      - `user_id` (text) - شناسه کاربر
      - `service_id` (text) - شناسه سرویس
      - `is_active` (boolean) - آیا فعال است
      - `updated_at` (timestamptz) - زمان آخرین بروزرسانی

  2. امنیت
    - فعال‌سازی RLS برای همه جداول
    - سیاست‌های دسترسی برای کاربران احراز هویت شده
*/

-- جدول نوبت‌ها
CREATE TABLE IF NOT EXISTS queue_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  general_id integer NOT NULL,
  special_number integer NOT NULL,
  button_number text NOT NULL,
  service_type text NOT NULL,
  last_name text,
  national_id text,
  called boolean DEFAULT false,
  call_time timestamptz,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول شمارنده‌ها
CREATE TABLE IF NOT EXISTS system_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counter_type text NOT NULL,
  service_id text,
  current_value integer NOT NULL DEFAULT 1,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(counter_type, service_id)
);

-- جدول سرویس‌های فعال
CREATE TABLE IF NOT EXISTS active_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  service_id text NOT NULL,
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, service_id)
);

-- مقداردهی اولیه شمارنده‌ها
INSERT INTO system_counters (counter_type, service_id, current_value) VALUES
  ('general', null, 1),
  ('special', '1', 101),
  ('special', '2', 201),
  ('special', '3', 301),
  ('special', '4', 401),
  ('special', '5', 501),
  ('special', '6', 601)
ON CONFLICT (counter_type, service_id) DO NOTHING;

-- فعال‌سازی RLS
ALTER TABLE queue_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_services ENABLE ROW LEVEL SECURITY;

-- سیاست‌های دسترسی برای نوبت‌ها
CREATE POLICY "همه کاربران می‌توانند نوبت‌ها را مشاهده کنند"
  ON queue_tickets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "همه کاربران می‌توانند نوبت ثبت کنند"
  ON queue_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "همه کاربران می‌توانند نوبت‌ها را بروزرسانی کنند"
  ON queue_tickets
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "همه کاربران می‌توانند نوبت‌ها را حذف کنند"
  ON queue_tickets
  FOR DELETE
  TO authenticated
  USING (true);

-- سیاست‌های دسترسی برای شمارنده‌ها
CREATE POLICY "همه کاربران می‌توانند شمارنده‌ها را مشاهده کنند"
  ON system_counters
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "همه کاربران می‌توانند شمارنده‌ها را بروزرسانی کنند"
  ON system_counters
  FOR UPDATE
  TO authenticated
  USING (true);

-- سیاست‌های دسترسی برای سرویس‌های فعال
CREATE POLICY "کاربران می‌توانند سرویس‌های خود را مدیریت کنند"
  ON active_services
  FOR ALL
  TO authenticated
  USING (true);

-- ایجاد اندیس‌ها برای بهبود عملکرد
CREATE INDEX IF NOT EXISTS idx_queue_tickets_button_number ON queue_tickets(button_number);
CREATE INDEX IF NOT EXISTS idx_queue_tickets_called ON queue_tickets(called);
CREATE INDEX IF NOT EXISTS idx_queue_tickets_created_at ON queue_tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_active_services_user_id ON active_services(user_id);

-- تابع برای بروزرسانی updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ایجاد trigger برای بروزرسانی خودکار updated_at
CREATE TRIGGER update_queue_tickets_updated_at BEFORE UPDATE ON queue_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_counters_updated_at BEFORE UPDATE ON system_counters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_active_services_updated_at BEFORE UPDATE ON active_services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();