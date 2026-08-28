-- CPMSOFT
-- Migration: 20260828_navigation_architecture_authdb.sql
-- Database: authdb
-- Purpose:
--   1. Add customer-facing display_name to packages/resources.
--   2. Add/normalize core resources used by navigation.
--   3. Add Purchasing as a module resource.
--   4. Create/normalize navigation_items.
--   5. Backfill baseline/core and Purchasing tenant entitlements.
--   6. Seed navigation metadata.
--
-- Safe re-run behavior:
--   Structural/catalog upserts are repeatable.
--   Tenant entitlement backfills run only once, guarded by schema_migrations,
--   so a later administrator choice is not silently re-enabled.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations
(
    migration_key varchar(200) PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now(),
    notes text NULL
);

ALTER TABLE packages
    ADD COLUMN IF NOT EXISTS display_name varchar(150);

UPDATE packages
SET display_name = package_name
WHERE display_name IS NULL;

ALTER TABLE packages
    ALTER COLUMN display_name SET NOT NULL;

ALTER TABLE resources
    ADD COLUMN IF NOT EXISTS display_name varchar(150);

UPDATE resources
SET display_name = resource_name
WHERE display_name IS NULL;

ALTER TABLE resources
    ALTER COLUMN display_name SET NOT NULL;

INSERT INTO resources
(
    id,
    resource_key,
    resource_name,
    display_name,
    category,
    description,
    display_order,
    is_active
)
VALUES
(
    'f67f2d92-d897-4723-bfa6-bd1992844d20'::uuid,
    'dashboard',
    'Dashboard',
    'Dashboard',
    'core',
    'Main CPMSOFT dashboard.',
    1,
    true
),
(
    'ad8c5afb-596f-4ea4-a1a0-1a3261f99d18'::uuid,
    'settings',
    'Settings',
    'Settings',
    'administration',
    'Tenant application settings.',
    5,
    true
),
(
    '9082dbc2-edb7-462f-a729-749d9a871810'::uuid,
    'reports',
    'Reports',
    'Reports',
    'core',
    'CPMSOFT reports.',
    900,
    true
),
(
    'ddec8491-d211-4a96-bb34-bf0fba1f4bf5'::uuid,
    'purchasing',
    'Purchasing',
    'Purchasing',
    'purchasing',
    'Purchasing module.',
    190,
    true
)
ON CONFLICT (resource_key)
DO UPDATE
SET
    resource_name = EXCLUDED.resource_name,
    display_name = EXCLUDED.display_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

INSERT INTO package_resources
(
    package_id,
    resource_id,
    is_default,
    display_order
)
SELECT
    p.id,
    r.id,
    true,
    1
FROM packages p
JOIN resources r
    ON r.resource_key = 'purchasing'
WHERE p.package_key = 'purchasing'
ON CONFLICT (package_id, resource_id)
DO UPDATE
SET
    is_default = EXCLUDED.is_default,
    display_order = EXCLUDED.display_order;

CREATE TABLE IF NOT EXISTS navigation_items
(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nav_key varchar(100) NOT NULL UNIQUE,
    label varchar(150) NOT NULL,
    nav_area varchar(30) NOT NULL,
    target_key varchar(100) NOT NULL,
    package_id uuid NULL REFERENCES packages(id),
    resource_id uuid NULL REFERENCES resources(id),
    display_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    item_type varchar(30) NOT NULL DEFAULT 'page',
    option_type varchar(100) NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_navigation_area
        CHECK (nav_area IN ('top', 'settings'))
);

ALTER TABLE navigation_items
    ADD COLUMN IF NOT EXISTS item_type varchar(30) NOT NULL DEFAULT 'page';

ALTER TABLE navigation_items
    ADD COLUMN IF NOT EXISTS option_type varchar(100);

CREATE INDEX IF NOT EXISTS ix_navigation_items_area_order
    ON navigation_items(nav_area, display_order);

CREATE INDEX IF NOT EXISTS ix_navigation_items_package
    ON navigation_items(package_id)
    WHERE package_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_navigation_items_resource
    ON navigation_items(resource_id)
    WHERE resource_id IS NOT NULL;

INSERT INTO navigation_items
(
    nav_key,
    label,
    nav_area,
    target_key,
    package_id,
    resource_id,
    display_order,
    is_active,
    item_type,
    option_type
)
SELECT
    x.nav_key,
    x.label,
    'top',
    x.target_key,
    p.id,
    r.id,
    x.display_order,
    true,
    'page',
    NULL
FROM
(
    VALUES
        ('dashboard',  'Dashboard',  'dashboard',  NULL::varchar, 'dashboard', 10),
        ('contacts',   'Contacts',   'contacts',   'contacts',    'contacts', 100),
        ('scheduler',  'Scheduler',  'scheduler',  'scheduler',   'scheduler', 200),
        ('projects',   'Projects',   'projects',   'projects',    'projects', 300),
        ('purchasing', 'Purchasing', 'purchasing', 'purchasing',  'purchasing', 400),
        ('accounting', 'Accounting', 'accounting', 'accounting',  'accounting', 500),
        ('reports',    'Reports',    'reports',    NULL::varchar, 'reports', 900),
        ('settings',   'Settings',   'settings',   NULL::varchar, 'settings', 1000)
) AS x(nav_key, label, target_key, package_key, resource_key, display_order)
LEFT JOIN packages p
    ON p.package_key = x.package_key
JOIN resources r
    ON r.resource_key = x.resource_key
ON CONFLICT (nav_key)
DO UPDATE
SET
    label = EXCLUDED.label,
    nav_area = EXCLUDED.nav_area,
    target_key = EXCLUDED.target_key,
    package_id = EXCLUDED.package_id,
    resource_id = EXCLUDED.resource_id,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active,
    item_type = EXCLUDED.item_type,
    option_type = EXCLUDED.option_type,
    updated_at = now();

INSERT INTO navigation_items
(
    nav_key,
    label,
    nav_area,
    target_key,
    package_id,
    resource_id,
    display_order,
    is_active,
    item_type,
    option_type
)
SELECT
    x.nav_key,
    x.label,
    'settings',
    x.target_key,
    p.id,
    r.id,
    x.display_order,
    true,
    x.item_type,
    x.option_type
FROM
(
    VALUES
        ('settings_users',     'Users',               'users',     NULL::varchar, 'users',             10,  'page',     NULL::varchar),
        ('settings_company',   'Company',             'company',   NULL::varchar, 'company',           20,  'page',     NULL::varchar),
        ('settings_roles',     'Roles & Permissions', 'roles',     'rbac',        'roles_permissions', 30,  'page',     NULL::varchar),
        ('settings_customers', 'Customers',           'customers', NULL::varchar, 'customers',         100, 'page',     NULL::varchar),
        ('settings_suppliers', 'Suppliers',           'suppliers', NULL::varchar, 'suppliers',         110, 'page',     NULL::varchar),
        ('settings_status',    'Status',              'status',    NULL::varchar, 'status',            900, 'dropdown', 'STATUS')
) AS x(nav_key, label, target_key, package_key, resource_key, display_order, item_type, option_type)
LEFT JOIN packages p
    ON p.package_key = x.package_key
JOIN resources r
    ON r.resource_key = x.resource_key
ON CONFLICT (nav_key)
DO UPDATE
SET
    label = EXCLUDED.label,
    nav_area = EXCLUDED.nav_area,
    target_key = EXCLUDED.target_key,
    package_id = EXCLUDED.package_id,
    resource_id = EXCLUDED.resource_id,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active,
    item_type = EXCLUDED.item_type,
    option_type = EXCLUDED.option_type,
    updated_at = now();

WITH gate AS
(
    SELECT 1
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM schema_migrations
        WHERE migration_key = '20260828_navigation_architecture_v1'
    )
)
INSERT INTO resource_set_resources
(
    resource_set_id,
    resource_id,
    is_required,
    display_order,
    created_at,
    updated_at
)
SELECT
    rs.id,
    r.id,
    true,
    CASE r.resource_key
        WHEN 'dashboard' THEN 1
        WHEN 'settings'  THEN 5
        WHEN 'reports'   THEN 900
    END,
    now(),
    now()
FROM gate
CROSS JOIN resource_sets rs
JOIN resources r
    ON r.resource_key IN ('dashboard', 'settings', 'reports')
WHERE rs.is_active = true
  AND rs.is_baseline = true
ON CONFLICT (resource_set_id, resource_id)
DO UPDATE
SET
    is_required = EXCLUDED.is_required,
    display_order = EXCLUDED.display_order,
    updated_at = now();

WITH gate AS
(
    SELECT 1
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM schema_migrations
        WHERE migration_key = '20260828_navigation_architecture_v1'
    )
)
INSERT INTO tenant_resources
(
    tenant_id,
    resource_id,
    is_enabled,
    enabled_at,
    disabled_at,
    created_at,
    updated_at
)
SELECT
    t.id,
    r.id,
    true,
    now(),
    NULL,
    now(),
    now()
FROM gate
CROSS JOIN tenants t
CROSS JOIN resources r
WHERE t.is_active = true
  AND r.is_active = true
  AND r.resource_key IN ('dashboard', 'settings', 'reports')
ON CONFLICT (tenant_id, resource_id)
DO UPDATE
SET
    is_enabled = true,
    enabled_at = now(),
    disabled_at = NULL,
    updated_at = now();

WITH gate AS
(
    SELECT 1
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM schema_migrations
        WHERE migration_key = '20260828_navigation_architecture_v1'
    )
)
INSERT INTO tenant_resources
(
    tenant_id,
    resource_id,
    is_enabled,
    enabled_at,
    disabled_at,
    created_at,
    updated_at
)
SELECT
    tp.tenant_id,
    r.id,
    true,
    now(),
    NULL,
    now(),
    now()
FROM gate
CROSS JOIN resources r
JOIN packages p
    ON p.package_key = 'purchasing'
JOIN tenant_packages tp
    ON tp.package_id = p.id
   AND tp.is_active = true
WHERE r.resource_key = 'purchasing'
  AND r.is_active = true
  AND p.is_active = true
ON CONFLICT (tenant_id, resource_id)
DO UPDATE
SET
    is_enabled = true,
    enabled_at = now(),
    disabled_at = NULL,
    updated_at = now();

INSERT INTO schema_migrations
(
    migration_key,
    notes
)
VALUES
(
    '20260828_navigation_architecture_v1',
    'Navigation architecture, display names, core resources, Purchasing module resource, and entitlement backfill.'
)
ON CONFLICT (migration_key) DO NOTHING;

DO $$
BEGIN
    IF EXISTS
    (
        SELECT 1
        FROM navigation_items
        WHERE is_active = true
          AND resource_id IS NULL
    )
    THEN
        RAISE EXCEPTION
            'Migration validation failed: active navigation item exists without resource_id.';
    END IF;
END
$$;

COMMIT;

SELECT
    n.nav_key,
    n.label,
    n.nav_area,
    n.target_key,
    p.package_key,
    r.resource_key,
    n.item_type,
    n.option_type,
    n.display_order,
    n.is_active
FROM navigation_items n
LEFT JOIN packages p
    ON p.id = n.package_id
LEFT JOIN resources r
    ON r.id = n.resource_id
ORDER BY n.nav_area, n.display_order, n.label;
