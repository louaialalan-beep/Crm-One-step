export interface SubNavItem {
  id: string;
  label: string;
  path: string;
}

export interface NavModuleItem {
  id: string;
  label: string;
  path: string;
  iconName:
    | 'LayoutDashboard'
    | 'UserPlus'
    | 'Users'
    | 'Building2'
    | 'Briefcase'
    | 'FileSpreadsheet'
    | 'CheckSquare'
    | 'BarChart3'
    | 'PieChart'
    | 'Settings'
    | 'MessageSquare'
    | 'Send';
  subItems?: SubNavItem[];
}

export const SIDEBAR_MODULES: NavModuleItem[] = [
  {
    id: 'dashboard',
    label: 'لوحة القيادة',
    path: '/',
    iconName: 'LayoutDashboard',
  },
  {
    id: 'leads',
    label: 'العملاء المحتملين',
    path: '/leads',
    iconName: 'UserPlus',
  },
  {
    id: 'contacts',
    label: 'جهات الاتصال',
    path: '/contacts',
    iconName: 'Users',
  },
  {
    id: 'accounts',
    label: 'الشركات والحسابات',
    path: '/accounts',
    iconName: 'Building2',
  },
  {
    id: 'deals',
    label: 'الصفقات والمبيعات',
    path: '/deals',
    iconName: 'Briefcase',
  },
  {
    id: 'whatsapp_inbox',
    label: 'صندوق واتساب والحملات',
    path: '/whatsapp-inbox',
    iconName: 'MessageSquare',
  },
  {
    id: 'campaigns',
    label: 'الحملات التسويقية',
    path: '/campaigns',
    iconName: 'Send',
  },
  {
    id: 'billing',
    label: 'عروض الأسعار والفواتير',
    path: '/quotes',
    iconName: 'FileSpreadsheet',
    subItems: [
      { id: 'quotes', label: 'عروض الأسعار', path: '/quotes' },
      { id: 'sales_orders', label: 'أوامر المبيعات', path: '/sales-orders' },
      { id: 'invoices', label: 'الفواتير', path: '/invoices' },
      { id: 'purchase_orders', label: 'أوامر الشراء للموردين', path: '/purchase-orders' },
    ],
  },
  {
    id: 'tasks',
    label: 'المهام والأنشطة',
    path: '/activities',
    iconName: 'CheckSquare',
    subItems: [
      { id: 'activities_list', label: 'قائمة المهام والأنشطة', path: '/activities' },
      { id: 'unified_calendar', label: 'التقويم الموحد (الشهر والأسبوع)', path: '/calendar' },
    ],
  },
  {
    id: 'reports',
    label: 'التقارير',
    path: '/reports',
    iconName: 'BarChart3',
  },
  {
    id: 'analytics',
    label: 'التحليلات',
    path: '/analytics',
    iconName: 'PieChart',
  },
  {
    id: 'settings',
    label: 'الإعدادات والنظام',
    path: '/settings',
    iconName: 'Settings',
    subItems: [
      { id: 'settings_overview', label: 'نظرة عامة للنظام', path: '/settings' },
      { id: 'profiles', label: 'الملفات والصلاحيات (FLS)', path: '/settings/profiles' },
      { id: 'roles', label: 'الهيكل الوظيفي والأدوار', path: '/settings/roles' },
      { id: 'custom_fields', label: 'منشئ الحقول والنماذج', path: '/settings/custom-fields' },
      { id: 'blueprints', label: 'مخططات المراحل (Blueprints)', path: '/settings/blueprints' },
      { id: 'workflows', label: 'الأتمتة وسير العمل', path: '/settings/workflows' },
      { id: 'recycle_bin', label: 'سلة المحذوفات', path: '/settings/recycle-bin' },
    ],
  },
];

export interface RouteMeta {
  title: string;
  section: string;
  description: string;
}

export const ROUTE_METADATA: Record<string, RouteMeta> = {
  '/': {
    title: 'لوحة القيادة التنفيذية',
    section: 'الرئيسية',
    description: 'ملخص الأداء التنفيذي، خط أنابيب المبيعات، والعملاء المحتملون المؤهلون في الوقت الفعلي.',
  },
  '/leads': {
    title: 'العملاء المحتملين',
    section: 'إدارة الإيرادات',
    description: 'تأهيل العملاء المحتملين بمعرفات RWQ-xxxxx وتقييم الذكاء الاصطناعي للمبيعات.',
  },
  '/contacts': {
    title: 'جهات الاتصال',
    section: 'إدارة الإيرادات',
    description: 'دليل صناع القرار وأصحاب المصلحة المرتبطين بحسابات الشركات.',
  },
  '/accounts': {
    title: 'الشركات والحسابات',
    section: 'إدارة الإيرادات',
    description: 'محفظة المؤسسات والعملاء الاستراتيجيين وتوزيع الإيرادات السنوية.',
  },
  '/deals': {
    title: 'الصفقات والمبيعات',
    section: 'إدارة الإيرادات',
    description: 'خط أنابيب الفرص البيعية ومراحل التفاوض والإغلاق المتوقع.',
  },
  '/quotes': {
    title: 'عروض الأسعار',
    section: 'عروض الأسعار والفواتير',
    description: 'إعداد وإرسال واعتماد عروض الأسعار التجارية المرتبطة بالصفقات.',
  },
  '/sales-orders': {
    title: 'أوامر المبيعات',
    section: 'عروض الأسعار والفواتير',
    description: 'متابعة تنفيذ وتجهيز أوامر المبيعات المعتمدة قبل الفوترة.',
  },
  '/invoices': {
    title: 'الفواتير',
    section: 'عروض الأسعار والفواتير',
    description: 'إدارة الفواتير المصدرة والتحصيل المالي وحالات الاستحقاق.',
  },
  '/purchase-orders': {
    title: 'أوامر الشراء للموردين (Purchase Orders)',
    section: 'عروض الأسعار والفواتير',
    description: 'إدارة أوامر الشراء الموجهة للموردين، تتبع التوريد والاستلام، وحساب ضريبة القيمة المضافة.',
  },
  '/tasks': {
    title: 'المهام والأنشطة',
    section: 'التشغيل والمتابعة',
    description: 'جدولة مهام المتابعة وسجل نقاط التماس اليومية مع العملاء.',
  },
  '/activities': {
    title: 'المهام والأنشطة اليومية',
    section: 'التشغيل والمتابعة',
    description: 'إدارة الجداول الزمنية، مكالمات المتابعة، والاجتماعات البيعية.',
  },
  '/calendar': {
    title: 'التقويم الموحد (المهام والاجتماعات والصفقات)',
    section: 'التشغيل والمتابعة',
    description: 'واجهة تقويم شهرية وأسبوعية تفاعلية تربط المهام والاجتماعات ومواعيد إغلاق الصفقات.',
  },
  '/reports': {
    title: 'التقارير',
    section: 'الذكاء التشغيلي',
    description: 'تقارير المبيعات الدورية وأداء المناديب ومعدلات التحويل.',
  },
  '/analytics': {
    title: 'التحليلات',
    section: 'الذكاء التشغيلي',
    description: 'تحليلات التنبؤ بالإيرادات واتجاهات النمو حسب القطاع والمرحلة.',
  },
  '/settings': {
    title: 'الإعدادات والنظام',
    section: 'إدارة النظام',
    description: 'مركز التحكم في الصلاحيات، الحقول المخصصة، الأتمتة، وسلة المحذوفات.',
  },
  '/settings/profiles': {
    title: 'الملفات والصلاحيات (CRUD + FLS)',
    section: 'الإعدادات والنظام',
    description: 'إدارة ملفات التعريف وصلاحيات الوصول على مستوى الوحدات والحقول.',
  },
  '/settings/roles': {
    title: 'الهيكل الوظيفي والأدوار',
    section: 'الإعدادات والنظام',
    description: 'تسلسل الصلاحيات الإدارية ونطاق مشاركة البيانات بين الفرق.',
  },
  '/settings/custom-fields': {
    title: 'منشئ الحقول والنماذج',
    section: 'الإعدادات والنظام',
    description: 'تخصيص الحقول الإضافية وتنظيم أقسام العرض لكل وحدة في رواق CRM.',
  },
  '/settings/blueprints': {
    title: 'مخططات المراحل (Blueprints)',
    section: 'الإعدادات والنظام',
    description: 'فرض شروط الانتقال الإلزامية بين مراحل الصفقات والعملاء.',
  },
  '/settings/workflows': {
    title: 'الأتمتة وسير العمل',
    section: 'الإعدادات والنظام',
    description: 'قواعد التشغيل التلقائي والإشعارات عند تحقق شروط السجلات.',
  },
  '/settings/recycle-bin': {
    title: 'سلة المحذوفات',
    section: 'الإعدادات والنظام',
    description: 'استعادة السجلات المحذوفة مؤقتاً أو إزالتها نهائياً قبل انتهاء فترة الاحتفاظ.',
  },
};
