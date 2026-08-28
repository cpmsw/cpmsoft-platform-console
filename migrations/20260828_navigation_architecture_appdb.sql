-- CPMSOFT
-- Migration: 20260828_navigation_architecture_appdb.sql
-- Database: appdb
--
-- Purpose:
--   Backfill role permissions for:
--     Dashboard
--     Settings
--     Reports
--     Purchasing
--
-- Safe to rerun:
--   Uses NOT EXISTS to prevent duplicate role_permissions.
--   schema_migrations prevents the backfill from being repeated later
--   after an administrator intentionally changes permissions.

BEGIN;


-- ============================================================
-- MIGRATION TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS schema_migrations
(
    migration_key varchar(200) PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now(),
    notes text NULL
);


-- ============================================================
-- PRIMARY + ADMIN
--
-- Full generic access to:
--   Dashboard
--   Settings
--   Reports
-- ============================================================

WITH gate AS
(
    SELECT 1
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM schema_migrations
        WHERE migration_key =
              '20260828_navigation_architecture_v1'
    )
),
new_resources(resource_id) AS
(
    VALUES
        (
            'f67f2d92-d897-4723-bfa6-bd1992844d20'::uuid
        ), -- Dashboard

        (
            'ad8c5afb-596f-4ea4-a1a0-1a3261f99d18'::uuid
        ), -- Settings

        (
            '9082dbc2-edb7-462f-a729-749d9a871810'::uuid
        )  -- Reports
)

INSERT INTO role_permissions
(
    tenant_id,
    role_id,
    resource_id,
    permission_id,
    created_at,
    created_by
)

SELECT
    r.tenant_id,
    r.id,
    nr.resource_id,
    p.id,
    now(),
    NULL

FROM gate

CROSS JOIN roles r

CROSS JOIN new_resources nr

CROSS JOIN permissions p

WHERE r.is_active = true

  AND r.role_code IN
      (
        'PRIMARY',
        'ADMIN'
      )

  AND p.is_active = true

  AND p.permission_key IN
      (
        'view',
        'create',
        'edit',
        'deactivate',
        'history_view'
      )

  AND NOT EXISTS
      (
          SELECT 1

          FROM role_permissions rp

          WHERE rp.tenant_id =
                r.tenant_id

            AND rp.role_id =
                r.id

            AND rp.resource_id =
                nr.resource_id

            AND rp.permission_id =
                p.id
      );


-- ============================================================
-- MANAGER
--
-- View/Create/Edit access to:
--   Dashboard
--   Settings
--   Reports
-- ============================================================

WITH gate AS
(
    SELECT 1
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM schema_migrations
        WHERE migration_key =
              '20260828_navigation_architecture_v1'
    )
),
new_resources(resource_id) AS
(
    VALUES
        (
            'f67f2d92-d897-4723-bfa6-bd1992844d20'::uuid
        ),

        (
            'ad8c5afb-596f-4ea4-a1a0-1a3261f99d18'::uuid
        ),

        (
            '9082dbc2-edb7-462f-a729-749d9a871810'::uuid
        )
)

INSERT INTO role_permissions
(
    tenant_id,
    role_id,
    resource_id,
    permission_id,
    created_at,
    created_by
)

SELECT
    r.tenant_id,
    r.id,
    nr.resource_id,
    p.id,
    now(),
    NULL

FROM gate

CROSS JOIN roles r

CROSS JOIN new_resources nr

JOIN permissions p
  ON p.permission_key IN
     (
       'view',
       'create',
       'edit'
     )

 AND p.is_active = true

WHERE r.is_active = true

  AND r.role_code =
      'MANAGER'

  AND NOT EXISTS
      (
          SELECT 1

          FROM role_permissions rp

          WHERE rp.tenant_id =
                r.tenant_id

            AND rp.role_id =
                r.id

            AND rp.resource_id =
                nr.resource_id

            AND rp.permission_id =
                p.id
      );


-- ============================================================
-- VIEWER
--
-- View-only access to:
--   Dashboard
--   Settings
--   Reports
-- ============================================================

WITH gate AS
(
    SELECT 1
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM schema_migrations
        WHERE migration_key =
              '20260828_navigation_architecture_v1'
    )
),
new_resources(resource_id) AS
(
    VALUES
        (
            'f67f2d92-d897-4723-bfa6-bd1992844d20'::uuid
        ),

        (
            'ad8c5afb-596f-4ea4-a1a0-1a3261f99d18'::uuid
        ),

        (
            '9082dbc2-edb7-462f-a729-749d9a871810'::uuid
        )
)

INSERT INTO role_permissions
(
    tenant_id,
    role_id,
    resource_id,
    permission_id,
    created_at,
    created_by
)

SELECT
    r.tenant_id,
    r.id,
    nr.resource_id,
    p.id,
    now(),
    NULL

FROM gate

CROSS JOIN roles r

CROSS JOIN new_resources nr

JOIN permissions p
  ON p.permission_key =
     'view'

 AND p.is_active = true

WHERE r.is_active = true

  AND r.role_code =
      'VIEWER'

  AND NOT EXISTS
      (
          SELECT 1

          FROM role_permissions rp

          WHERE rp.tenant_id =
                r.tenant_id

            AND rp.role_id =
                r.id

            AND rp.resource_id =
                nr.resource_id

            AND rp.permission_id =
                p.id
      );


-- ============================================================
-- PURCHASING MODULE RESOURCE
--
-- Determine existing Purchasing tenants from permissions
-- already assigned to:
--
--   Suppliers
--   Purchase Orders
--   Receiving
--
-- Then grant the new Purchasing module-level resource.
-- ============================================================

WITH gate AS
(
    SELECT 1
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM schema_migrations
        WHERE migration_key =
              '20260828_navigation_architecture_v1'
    )
),

purchasing_tenants AS
(
    SELECT DISTINCT
        rp.tenant_id

    FROM role_permissions rp

    WHERE rp.resource_id IN
    (
        -- Suppliers
        '1c5e5d08-50b3-4299-bd12-7625dc91715a'::uuid,

        -- Purchase Orders
        '750c673c-e3e4-496e-bc64-b350df64ff07'::uuid,

        -- Receiving
        '9cb81bbc-1a70-4eb7-ab55-4477af2c1df4'::uuid
    )
)

INSERT INTO role_permissions
(
    tenant_id,
    role_id,
    resource_id,
    permission_id,
    created_at,
    created_by
)

SELECT
    r.tenant_id,

    r.id,

    -- Purchasing module resource
    'ddec8491-d211-4a96-bb34-bf0fba1f4bf5'::uuid,

    p.id,

    now(),

    NULL

FROM gate

CROSS JOIN purchasing_tenants pt

JOIN roles r
  ON r.tenant_id =
     pt.tenant_id

 AND r.is_active = true

CROSS JOIN permissions p

WHERE
(
    (
        r.role_code IN
        (
            'PRIMARY',
            'ADMIN'
        )

        AND p.permission_key IN
        (
            'view',
            'create',
            'edit',
            'deactivate',
            'history_view'
        )
    )

    OR

    (
        r.role_code =
            'MANAGER'

        AND p.permission_key IN
        (
            'view',
            'create',
            'edit'
        )
    )

    OR

    (
        r.role_code =
            'VIEWER'

        AND p.permission_key =
            'view'
    )
)

AND p.is_active = true

AND NOT EXISTS
(
    SELECT 1

    FROM role_permissions rp

    WHERE rp.tenant_id =
          r.tenant_id

      AND rp.role_id =
          r.id

      AND rp.resource_id =
          'ddec8491-d211-4a96-bb34-bf0fba1f4bf5'::uuid

      AND rp.permission_id =
          p.id
);


-- ============================================================
-- RECORD MIGRATION
-- ============================================================

INSERT INTO schema_migrations
(
    migration_key,
    notes
)

VALUES
(
    '20260828_navigation_architecture_v1',

    'Role-permission backfill for Dashboard, Settings, Reports, and Purchasing module resource.'
)

ON CONFLICT
(
    migration_key
)
DO NOTHING;


COMMIT;


-- ============================================================
-- VERIFY MIGRATION RECORD
-- ============================================================

SELECT
    migration_key,
    applied_at,
    notes

FROM schema_migrations

WHERE migration_key =
      '20260828_navigation_architecture_v1';


-- ============================================================
-- VERIFY PERMISSIONS
-- ============================================================

SELECT
    r.tenant_id,
    r.role_code,
    rp.resource_id,
    p.permission_key

FROM role_permissions rp

JOIN roles r
  ON r.id =
     rp.role_id

JOIN permissions p
  ON p.id =
     rp.permission_id

WHERE rp.resource_id IN
(
    -- Dashboard
    'f67f2d92-d897-4723-bfa6-bd1992844d20'::uuid,

    -- Settings
    'ad8c5afb-596f-4ea4-a1a0-1a3261f99d18'::uuid,

    -- Reports
    '9082dbc2-edb7-462f-a729-749d9a871810'::uuid,

    -- Purchasing
    'ddec8491-d211-4a96-bb34-bf0fba1f4bf5'::uuid
)

ORDER BY
    r.tenant_id,
    r.role_code,
    rp.resource_id,
    p.permission_key;