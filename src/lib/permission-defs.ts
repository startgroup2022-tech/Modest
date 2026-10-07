/**
 * Permission catalogue — plain data, importable from both the server runtime
 * and the seed script. Enforcement lives in `permissions.ts` / `admin-auth.ts`.
 */

export const PERMISSIONS = {
  // Overview
  'dashboard.view': { group: 'overview', en: 'View dashboard', ar: 'عرض لوحة التحكم' },

  // Commerce
  'orders.view': { group: 'orders', en: 'View orders', ar: 'عرض الطلبات' },
  'orders.create': { group: 'orders', en: 'Create orders / quick orders', ar: 'إنشاء الطلبات والطلبات السريعة' },
  'orders.edit': { group: 'orders', en: 'Edit orders', ar: 'تعديل الطلبات' },
  'orders.cancel': { group: 'orders', en: 'Cancel orders', ar: 'إلغاء الطلبات' },
  'orders.assign': { group: 'orders', en: 'Assign tailors', ar: 'تعيين الخياطين' },
  'orders.refund': { group: 'orders', en: 'Record refunds', ar: 'تسجيل المبالغ المسترجعة' },

  'products.view': { group: 'catalogue', en: 'View products', ar: 'عرض المنتجات' },
  'products.create': { group: 'catalogue', en: 'Create products', ar: 'إنشاء المنتجات' },
  'products.edit': { group: 'catalogue', en: 'Edit products', ar: 'تعديل المنتجات' },
  'products.approve': { group: 'catalogue', en: 'Approve products', ar: 'اعتماد المنتجات' },
  'products.delete': { group: 'catalogue', en: 'Archive products', ar: 'أرشفة المنتجات' },

  'inventory.view': { group: 'inventory', en: 'View inventory', ar: 'عرض المخزون' },
  'inventory.adjust': { group: 'inventory', en: 'Adjust inventory', ar: 'تعديل المخزون' },

  'promotions.view': { group: 'promotions', en: 'View promotions', ar: 'عرض العروض' },
  'promotions.create': { group: 'promotions', en: 'Create promotions', ar: 'إنشاء العروض' },
  'promotions.edit': { group: 'promotions', en: 'Edit promotions', ar: 'تعديل العروض' },
  'promotions.toggle': { group: 'promotions', en: 'Enable / disable promotions', ar: 'تفعيل وإيقاف العروض' },
  'promotions.usage': { group: 'promotions', en: 'View promotion usage', ar: 'عرض استخدام العروض' },

  // Customers
  'customers.view': { group: 'customers', en: 'View customers', ar: 'عرض العملاء' },
  'customers.edit': { group: 'customers', en: 'Edit customers', ar: 'تعديل العملاء' },
  'measurements.view': { group: 'customers', en: 'View measurements', ar: 'عرض القياسات' },
  'measurements.edit': { group: 'customers', en: 'Edit measurements', ar: 'تعديل القياسات' },

  // Production
  'production.view': { group: 'production', en: 'View production', ar: 'عرض الإنتاج' },
  'production.manage': { group: 'production', en: 'Manage production', ar: 'إدارة الإنتاج' },
  'qc.view': { group: 'production', en: 'View quality control', ar: 'عرض ضبط الجودة' },
  'qc.manage': { group: 'production', en: 'Run quality control', ar: 'تشغيل ضبط الجودة' },
  'tailors.view': { group: 'production', en: 'View tailors', ar: 'عرض الخياطين' },
  'tailors.manage': { group: 'production', en: 'Manage tailors & credentials', ar: 'إدارة الخياطين وبيانات الدخول' },

  // Delivery
  'shipping.view': { group: 'delivery', en: 'View shipping', ar: 'عرض الشحن' },
  'shipping.manage': { group: 'delivery', en: 'Manage shipping', ar: 'إدارة الشحن' },

  // Finance
  'finance.view': { group: 'finance', en: 'View finance', ar: 'عرض المالية' },
  'finance.approve': { group: 'finance', en: 'Approve finance', ar: 'اعتماد المالية' },
  'payments.view': { group: 'finance', en: 'View payments', ar: 'عرض المدفوعات' },
  'payments.verify': { group: 'finance', en: 'Verify payments', ar: 'التحقق من المدفوعات' },
  'payments.send': { group: 'finance', en: 'Send payment links', ar: 'إرسال روابط الدفع' },
  'expenses.view': { group: 'finance', en: 'View expenses', ar: 'عرض المصروفات' },
  'expenses.manage': { group: 'finance', en: 'Manage expenses', ar: 'إدارة المصروفات' },
  'expenses.approve': { group: 'finance', en: 'Approve expenses', ar: 'اعتماد المصروفات' },
  'expenses.delete': { group: 'finance', en: 'Delete expenses', ar: 'حذف المصروفات' },
  'settlements.view': { group: 'finance', en: 'View settlements', ar: 'عرض التسويات' },
  'settlements.manage': { group: 'finance', en: 'Manage settlements', ar: 'إدارة التسويات' },

  // Reports
  'reports.view': { group: 'reports', en: 'View reports', ar: 'عرض التقارير' },
  'reports.profits': { group: 'reports', en: 'View profits', ar: 'عرض الأرباح' },
  'reports.export': { group: 'reports', en: 'Export reports', ar: 'تصدير التقارير' },

  // Content
  'content.view': { group: 'content', en: 'View content', ar: 'عرض المحتوى' },
  'content.edit': { group: 'content', en: 'Edit content', ar: 'تعديل المحتوى' },
  'website.manage': { group: 'content', en: 'Design & manage website', ar: 'تصميم وإدارة الموقع' },
  'seo.view': { group: 'seo', en: 'View SEO', ar: 'عرض تحسين محركات البحث' },
  'seo.edit': { group: 'seo', en: 'Edit SEO', ar: 'تعديل تحسين محركات البحث' },

  // System
  'users.manage': { group: 'system', en: 'Manage employees', ar: 'إدارة الموظفين' },
  'roles.manage': { group: 'system', en: 'Manage roles & permission templates', ar: 'إدارة الأدوار وقوالب الصلاحيات' },
  'settings.view': { group: 'system', en: 'View settings', ar: 'عرض الإعدادات' },
  'settings.edit': { group: 'system', en: 'Edit settings', ar: 'تعديل الإعدادات' },
  'notifications.view': { group: 'system', en: 'View notifications', ar: 'عرض الإشعارات' },
  'notifications.manage': { group: 'system', en: 'Manage notification settings', ar: 'إدارة إعدادات الإشعارات' },
  'audit.view': { group: 'system', en: 'View audit logs', ar: 'عرض سجل التدقيق' },
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const PERMISSION_GROUPS: { key: string; en: string; ar: string }[] = [
  { key: 'overview', en: 'Overview', ar: 'نظرة عامة' },
  { key: 'orders', en: 'Orders', ar: 'الطلبات' },
  { key: 'catalogue', en: 'Catalogue', ar: 'الكتالوج' },
  { key: 'inventory', en: 'Inventory', ar: 'المخزون' },
  { key: 'promotions', en: 'Promotions', ar: 'العروض' },
  { key: 'customers', en: 'Customers', ar: 'العملاء' },
  { key: 'production', en: 'Production', ar: 'الإنتاج' },
  { key: 'delivery', en: 'Delivery', ar: 'التوصيل' },
  { key: 'finance', en: 'Finance', ar: 'المالية' },
  { key: 'reports', en: 'Reports', ar: 'التقارير' },
  { key: 'content', en: 'Content', ar: 'المحتوى' },
  { key: 'seo', en: 'SEO', ar: 'تحسين محركات البحث' },
  { key: 'system', en: 'System', ar: 'النظام' },
];

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Total number of defined permissions. UI uses this instead of a literal. */
export const PERMISSION_COUNT = ALL_PERMISSIONS.length;

export function isPermission(value: string): value is Permission {
  return value in PERMISSIONS;
}

/** Sensible defaults per role. Roles can be tuned in Roles & Permissions. */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN: ALL_PERMISSIONS,
  MANAGER: [
    'dashboard.view',
    'orders.view', 'orders.create', 'orders.edit', 'orders.cancel', 'orders.assign', 'orders.refund',
    'products.view', 'products.create', 'products.edit', 'products.approve', 'products.delete',
    'inventory.view', 'inventory.adjust',
    'promotions.view', 'promotions.create', 'promotions.edit', 'promotions.toggle', 'promotions.usage',
    'customers.view', 'customers.edit', 'measurements.view', 'measurements.edit',
    'production.view', 'production.manage', 'qc.view', 'qc.manage', 'tailors.view', 'tailors.manage',
    'shipping.view', 'shipping.manage',
    'finance.view', 'payments.view', 'payments.verify', 'payments.send',
    'expenses.view', 'expenses.manage', 'expenses.approve', 'expenses.delete',
    'settlements.view', 'settlements.manage',
    'reports.view', 'reports.profits', 'reports.export',
    'content.view', 'content.edit', 'website.manage', 'seo.view', 'seo.edit',
    'notifications.view',
  ],
  SUPPORT: [
    'dashboard.view',
    'orders.view', 'orders.create', 'orders.edit',
    'products.view',
    'inventory.view',
    'promotions.view',
    'customers.view', 'measurements.view',
    'production.view', 'qc.view',
    'shipping.view',
    'payments.view',
    'notifications.view',
  ],
  CUSTOMER: [],
  // Tailors authenticate through a separate credential and never hold staff
  // permissions; the role exists only for completeness.
  TAILOR: [],
};
