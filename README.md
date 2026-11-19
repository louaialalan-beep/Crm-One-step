# Crm-One-step — Enterprise Multi-Tenant SaaS CRM Platform

منصة **Crm-One-step** هي منظومة SaaS سحابية متكاملة لإدارة علاقات العملاء، أتمتة المبيعات (Blueprints & Workflows)، محادثات واتساب السحابي اللحظية (WhatsApp Cloud API + WebSockets)، إسناد الحملات الإعلانية المتعدد (Meta CAPI + Multi-Order Attribution)، والفوترة الضريبية الإلكترونية المتوافقة مع هيئة الزكاة والضريبة والجمارك (**ZATCA المرحلة الأولى — ضريبة 15% + رمز QR TLV Base64**).

---

## المعمارية التقنية (Tech Stack)

- **الواجهة الأمامية (Frontend)**: React 19 + TypeScript + Tailwind CSS (RTL) + Vite، تُقدَّم إنتاجياً عبر **Nginx** مع دعم توجيه `React Router` وتمرير `/api/` و`/ws/` عبر Reverse Proxy.
- **الواجهة الخلفية (Backend)**: Python 3.11 + **FastAPI** + **SQLAlchemy 2.0 (Async)** + **Pydantic v2** + **Alembic**.
- **عزل المستأجرين (Multi-Tenancy)**: **PostgreSQL 16 Row-Level Security (RLS)** مع تفعيل `SET LOCAL app.current_org_id` تلقائياً في كل معاملة.
- **المهام الخلفية (Background Worker)**: **Redis 7 + ARQ** لتنفيذ مهام Meta CAPI، قواعد الأتمتة، استيراد ملفات CSV الضخمة، وإرسال رسائل البريد الإلكتروني عبر **SMTP**.
- **بوابة الدفع والاشتراكات**: محوّل دفع موحد يدعم **Moyasar / Tap / Stripe** مع فرض حدود الباقات (**Free / Growth / Enterprise**) ولوحة تحكم مالك المنصة (`/super-admin`).

---

## التشغيل الإنتاجي بأمر واحد عبر Docker Compose

### 1. تجهيز ملف البيئة
انسخ ملف `.env.example` إلى `.env` وعدّل القيم الإنتاجية عند الحاجة:

```bash
cp .env.example .env
```

### 2. بناء وتشغيل المنظومة الكاملة (5 حاويات)
شغّل جميع الخدمات (`db`, `redis`, `backend`, `worker`, `frontend`) بأمر واحد:

```bash
docker compose up -d --build
```

عند الإقلاع:
1. تبدأ قاعدة بيانات **PostgreSQL 16** وخدمة **Redis 7** مع فحوصات الجاهزية (`healthcheck`).
2. تنفّذ حاوية **FastAPI (`backend`)** ترحيلات قاعدة البيانات وسياسات RLS تلقائياً عبر `alembic upgrade head` ثم تشغّل `uvicorn` على المنفذ `8000`.
3. تبدأ حاوية **ARQ (`worker`)** لمعالجة طابور المهام غير المتزامنة.
4. تبدأ حاوية **Nginx (`frontend`)** على المنفذ `3000` (والمنفذ `80`) مع توجيه `/api/` و`/ws/` إلى الخادم الخلفي.

---

## الروابط الأساسية بعد التشغيل

| الخدمة | الرابط |
| :--- | :--- |
| **واجهة المنصة (Frontend SPA)** | `http://localhost:3000` |
| **لوحة مالك المنصة (Super Admin)** | `http://localhost:3000/super-admin` |
| **توثيق الواجهة البرمجية (Swagger UI)** | `http://localhost:8000/docs` |
| **فحص جاهزية الخادم (Health Check)** | `http://localhost:8000/health` |

---

## مستويات الباقات وحدود الاستخدام (Plan Quotas)

| الباقة | الحد الأقصى للمستخدمين | الحد الأقصى للعملاء | الميزات المفعّلة |
| :--- | :---: | :---: | :--- |
| **Free** | 3 مستخدمين | 500 عميل | إدارة العملاء والصفقات الأساسية (بدون Blueprints أو Meta CAPI) |
| **Growth** | 15 مستخدماً | 10,000 عميل | واتساب السحابي + Meta CAPI + الفوترة الضريبية ZATCA المرحلة الأولى |
| **Enterprise** | غير محدود | غير محدود | جميع الميزات + Blueprints + Workflows + API + دعم مخصص |
