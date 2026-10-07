import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getRolePermissions, resolveEffectivePermissions } from '@/lib/permissions';
import { getAdminDict } from '@/i18n/admin-dict';
import { isLocale, type Locale } from '@/i18n/config';
import { formatDateTime } from '@/lib/admin-format';
import { PageHeader, Panel, StatusBadge, AdminEmpty } from '@/components/admin/ui';
import { Drawer } from '@/components/admin/Filters';
import { EmployeeForm } from '@/components/admin/EmployeeForm';
import { EmployeePermissions } from '@/components/admin/EmployeePermissions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Employees', robots: { index: false, follow: false } };

const ROLE_LABEL: Record<string, { en: string; ar: string }> = {
  ADMIN: { en: 'Administrator', ar: 'مدير النظام' },
  MANAGER: { en: 'Manager', ar: 'مدير' },
  SUPPORT: { en: 'Support', ar: 'دعم' },
  CUSTOMER: { en: 'Customer', ar: 'عميل' },
};

export default async function EmployeesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const admin = await requireAdminPage('users.manage', locale);
  const dict = getAdminDict(locale);

  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      where: { role: { name: { in: ['ADMIN', 'MANAGER', 'SUPPORT'] } } },
      orderBy: { createdAt: 'asc' },
      include: { role: true, permissionOverrides: true },
    }),
    prisma.role.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const roleOptions = roles.map((r) => ({ id: r.id, name: r.name, label: ROLE_LABEL[r.name]?.[locale] ?? r.name }));
  const isSuperAdmin = admin.role === 'ADMIN';
  const actorPermissions = [...admin.permissions];

  // Resolve each employee's effective permission set (role grants merged with
  // their individual overrides) so the list can show a live count.
  const effectiveCounts = new Map<string, number>();
  const rolePermsByUser = new Map<string, string[]>();
  await Promise.all(
    users.map(async (u) => {
      const rolePerms = await getRolePermissions(u.roleId);
      rolePermsByUser.set(u.id, [...rolePerms]);
      const effective = resolveEffectivePermissions(
        rolePerms,
        u.permissionOverrides.map((o) => ({ permission: o.permission, effect: o.effect })),
      );
      effectiveCounts.set(u.id, effective.size);
    }),
  );

  return (
    <>
      <PageHeader
        title={dict.system.employees}
        subtitle={dict.system.subtitle}
        actions={
          <Drawer trigger={`+ ${dict.system.newEmployee}`} title={dict.system.newEmployee} wide>
            <EmployeeForm roles={roleOptions} dict={{ common: dict.common, system: dict.system }} />
          </Drawer>
        }
      />
      <Panel bodyClassName="p-0">
        {users.length === 0 ? (
          <AdminEmpty title={dict.common.empty} hint={dict.common.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table adm-table-responsive">
              <thead>
                <tr>
                  <th>{dict.common.customer === 'Customer' ? 'Employee' : 'الموظف'}</th>
                  <th>{dict.system.role}</th>
                  <th>{dict.system.jobTitle}</th>
                  <th>{dict.system.permissions}</th>
                  <th>{dict.system.lastLogin}</th>
                  <th>{dict.common.status}</th>
                  <th>{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td data-label={dict.common.customer === 'Customer' ? 'Employee' : 'الموظف'} className="text-ink">
                      <span className="block">{[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email}</span>
                      <span className="block text-caption text-ink-faint">{u.email}</span>
                    </td>
                    <td data-label={dict.system.role} className="text-ink-muted">{u.role ? ROLE_LABEL[u.role.name]?.[locale] ?? u.role.name : '—'}</td>
                    <td data-label={dict.system.jobTitle} className="text-ink-muted">{u.jobTitle ?? '—'}</td>
                    <td data-label={dict.system.permissions} className="text-caption text-ink-muted">
                      {u.role?.name === 'ADMIN' ? (locale === 'ar' ? 'الكل' : 'All') : `${effectiveCounts.get(u.id) ?? 0}`}
                    </td>
                    <td data-label={dict.system.lastLogin} className="text-caption text-ink-faint">{u.lastLoginAt ? formatDateTime(u.lastLoginAt, locale) : '—'}</td>
                    <td data-label={dict.common.status}><StatusBadge status={u.status} /></td>
                    <td data-label={dict.common.actions}>
                      <div className="flex items-center gap-2">
                        <Drawer trigger={dict.common.edit} title={dict.common.edit} wide>
                          <EmployeeForm
                            roles={roleOptions}
                            initial={{
                              id: u.id, email: u.email, firstName: u.firstName ?? '', lastName: u.lastName ?? '',
                              phone: u.phone ?? '', jobTitle: u.jobTitle ?? '', roleId: u.roleId ?? '',
                              roleName: u.role?.name ?? '', status: u.status, locale: u.locale,
                            }}
                            dict={{ common: dict.common, system: dict.system }}
                          />
                        </Drawer>
                        {u.role?.name !== 'ADMIN' && (
                          <Drawer
                            trigger={locale === 'ar' ? 'الصلاحيات' : 'Permissions'}
                            title={`${locale === 'ar' ? 'صلاحيات' : 'Permissions'} · ${[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email}`}
                            wide
                          >
                            <EmployeePermissions
                              employeeId={u.id}
                              rolePermissions={rolePermsByUser.get(u.id) ?? []}
                              overrides={u.permissionOverrides.map((o) => ({ permission: o.permission, effect: o.effect }))}
                              actorPermissions={actorPermissions}
                              isSuperAdmin={isSuperAdmin}
                              locale={locale}
                            />
                          </Drawer>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
