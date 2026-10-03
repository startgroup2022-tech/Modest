import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { PageHeader, Panel } from '@/components/admin/ui';
import { RoleMatrix } from '@/components/admin/RoleMatrix';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Roles & Permissions', robots: { index: false, follow: false } };

const ROLE_LABEL: Record<string, { en: string; ar: string }> = {
  ADMIN: { en: 'Administrator', ar: 'مدير النظام' },
  MANAGER: { en: 'Manager', ar: 'مدير' },
  SUPPORT: { en: 'Support', ar: 'دعم' },
  CUSTOMER: { en: 'Customer', ar: 'عميل' },
};

export default async function RolesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requireAdminPage('roles.manage', locale);
  const dict = getAdminDict(locale);

  const roles = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    include: { permissions: true, _count: { select: { users: true } } },
  });

  return (
    <>
      <PageHeader title={dict.system.roles} subtitle={dict.system.subtitle} />
      <div className="grid gap-6">
        {roles.map((role) => (
          <Panel key={role.id} title={`${ROLE_LABEL[role.name]?.[locale] ?? role.name} · ${role._count.users} ${locale === 'ar' ? 'مستخدم' : 'users'}`}>
            <RoleMatrix
              roleId={role.id}
              roleName={role.name}
              label={dict.system.permissions}
              selected={role.permissions.map((p) => p.permission)}
              locale={locale}
              dict={{ common: dict.common, system: dict.system }}
            />
          </Panel>
        ))}
      </div>
    </>
  );
}
