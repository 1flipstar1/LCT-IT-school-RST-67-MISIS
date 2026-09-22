CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- FUNCTION: автоматическое обновление updated_at


CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;



-- 1. USERS


CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keycloak_id VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),

    reports_to_user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- 2. ROLES


CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT
);



-- 3. PERMISSIONS


CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT
);



-- 4. USER ROLES


CREATE TABLE user_roles (
    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    role_id UUID NOT NULL
        REFERENCES roles(id)
        ON DELETE CASCADE,

    PRIMARY KEY (user_id, role_id)
);



-- 5. ROLE PERMISSIONS


CREATE TABLE role_permissions (
    role_id UUID NOT NULL
        REFERENCES roles(id)
        ON DELETE CASCADE,

    permission_id UUID NOT NULL
        REFERENCES permissions(id)
        ON DELETE CASCADE,

    PRIMARY KEY (role_id, permission_id)
);



-- 6. UNIVERSITIES


CREATE TABLE universities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name VARCHAR(500) NOT NULL,
    short_name VARCHAR(255),
    city VARCHAR(255),
    website_url TEXT,
    comment TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- 7. UNIVERSITY CONTACTS


CREATE TABLE university_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    university_id UUID NOT NULL
        REFERENCES universities(id)
        ON DELETE CASCADE,

    full_name VARCHAR(255) NOT NULL,
    position VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(100),
    comment TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- 8. USER UNIVERSITIES


CREATE TABLE user_universities (
    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    university_id UUID NOT NULL
        REFERENCES universities(id)
        ON DELETE CASCADE,

    PRIMARY KEY (user_id, university_id)
);



-- 9. IT DIRECTIONS


CREATE TABLE it_directions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- 10. IT PROGRAMS


CREATE TABLE it_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    direction_id UUID NOT NULL
        REFERENCES it_directions(id)
        ON DELETE RESTRICT,

    name VARCHAR(500) NOT NULL,
    description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (direction_id, name)
);



-- 11. VENDORS


CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name VARCHAR(255) NOT NULL UNIQUE,
    website_url TEXT,
    comment TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- 12. IT PRODUCTS


CREATE TABLE it_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    vendor_id UUID
        REFERENCES vendors(id)
        ON DELETE SET NULL,

    name VARCHAR(500) NOT NULL,
    version VARCHAR(100),
    description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- 13. PROGRAM PRODUCTS


CREATE TABLE program_products (
    program_id UUID NOT NULL
        REFERENCES it_programs(id)
        ON DELETE CASCADE,

    product_id UUID NOT NULL
        REFERENCES it_products(id)
        ON DELETE CASCADE,

    PRIMARY KEY (program_id, product_id)
);


-- 14. WORKFLOWS


CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name VARCHAR(255) NOT NULL,
    description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 15. WORKFLOW VERSIONS


CREATE TABLE workflow_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    workflow_id UUID NOT NULL
        REFERENCES workflows(id)
        ON DELETE CASCADE,

    version_number INTEGER NOT NULL
        CHECK (version_number > 0),

    is_published BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,

    UNIQUE (workflow_id, version_number)
);



-- 16. WORKFLOW STEPS


CREATE TABLE workflow_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    workflow_version_id UUID NOT NULL
        REFERENCES workflow_versions(id)
        ON DELETE CASCADE,

    code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    step_order INTEGER NOT NULL
        CHECK (step_order >= 1),

    is_initial BOOLEAN NOT NULL DEFAULT FALSE,
    is_final BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (workflow_version_id, code),
    UNIQUE (workflow_version_id, step_order),
    UNIQUE (workflow_version_id, id)
);



-- 17. WORKFLOW TRANSITIONS


CREATE TABLE workflow_transitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    workflow_version_id UUID NOT NULL
        REFERENCES workflow_versions(id)
        ON DELETE CASCADE,

    from_step_id UUID NOT NULL,
    to_step_id UUID NOT NULL,

    name VARCHAR(255),
    description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        workflow_version_id,
        from_step_id,
        to_step_id
    ),

    FOREIGN KEY (
        workflow_version_id,
        from_step_id
    )
        REFERENCES workflow_steps(
            workflow_version_id,
            id
        )
        ON DELETE CASCADE,

    FOREIGN KEY (
        workflow_version_id,
        to_step_id
    )
        REFERENCES workflow_steps(
            workflow_version_id,
            id
        )
        ON DELETE CASCADE,

    CHECK (from_step_id <> to_step_id)
);



-- 18. INTERACTIONS


CREATE TABLE interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    university_id UUID NOT NULL
        REFERENCES universities(id)
        ON DELETE RESTRICT,

    program_id UUID
        REFERENCES it_programs(id)
        ON DELETE RESTRICT,

    product_id UUID
        REFERENCES it_products(id)
        ON DELETE RESTRICT,

    workflow_version_id UUID NOT NULL
        REFERENCES workflow_versions(id)
        ON DELETE RESTRICT,

    current_step_id UUID NOT NULL,

    manager_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    primary_contact_id UUID
        REFERENCES university_contacts(id)
        ON DELETE SET NULL,

    contract_number VARCHAR(255),

    license_signed_at DATE,

    license_term_years INTEGER
        CHECK (
            license_term_years IS NULL
            OR license_term_years > 0
        ),

    license_expires_at DATE,

    transfer_status VARCHAR(100),

    comment TEXT,

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (
        workflow_version_id,
        current_step_id
    )
        REFERENCES workflow_steps(
            workflow_version_id,
            id
        )
        ON DELETE RESTRICT
);



-- 19. INTERACTION CONTACTS


CREATE TABLE interaction_contacts (
    interaction_id UUID NOT NULL
        REFERENCES interactions(id)
        ON DELETE CASCADE,

    contact_id UUID NOT NULL
        REFERENCES university_contacts(id)
        ON DELETE RESTRICT,

    is_primary BOOLEAN NOT NULL DEFAULT FALSE,

    PRIMARY KEY (interaction_id, contact_id)
);



-- 20. INTERACTION STATUS LOGS


CREATE TABLE interaction_status_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    interaction_id UUID NOT NULL
        REFERENCES interactions(id)
        ON DELETE CASCADE,

    from_step_id UUID,

    to_step_id UUID NOT NULL,

    changed_by_user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    comment TEXT,

    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- 21. STEP ATTACHMENTS


CREATE TABLE step_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    interaction_id UUID NOT NULL
        REFERENCES interactions(id)
        ON DELETE CASCADE,

    workflow_step_id UUID NOT NULL,

    uploaded_by_user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    original_file_name VARCHAR(500) NOT NULL,

    storage_key TEXT NOT NULL UNIQUE,

    mime_type VARCHAR(255),

    file_size_bytes BIGINT
        CHECK (
            file_size_bytes IS NULL
            OR file_size_bytes >= 0
        ),

    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (workflow_step_id)
        REFERENCES workflow_steps(id)
        ON DELETE RESTRICT
);



-- 22. EXTERNAL SYSTEMS


CREATE TABLE external_systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,

    base_url TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- 23. EXTERNAL METRICS


CREATE TABLE external_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    interaction_id UUID
        REFERENCES interactions(id)
        ON DELETE CASCADE,

    external_system_id UUID NOT NULL
        REFERENCES external_systems(id)
        ON DELETE RESTRICT,

    external_record_id VARCHAR(255),

    metric_code VARCHAR(100) NOT NULL,

    metric_value NUMERIC,

    metric_json JSONB,

    period_start DATE,
    period_end DATE,

    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        external_system_id,
        external_record_id,
        metric_code,
        period_start,
        period_end
    )
);



-- 24. EXTERNAL SYNC LOGS


CREATE TABLE external_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    external_system_id UUID NOT NULL
        REFERENCES external_systems(id)
        ON DELETE RESTRICT,

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,

    status VARCHAR(30) NOT NULL
        CHECK (
            status IN (
                'STARTED',
                'SUCCESS',
                'FAILED'
            )
        ),

    records_received INTEGER NOT NULL DEFAULT 0,

    error_message TEXT
);



-- 25. DATA IMPORTS


CREATE TABLE data_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    entity_type VARCHAR(100) NOT NULL,

    file_name VARCHAR(500) NOT NULL,

    source_format VARCHAR(20) NOT NULL
        CHECK (
            source_format IN (
                'XLS',
                'XLSX'
            )
        ),

    uploaded_by_user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    status VARCHAR(30) NOT NULL
        CHECK (
            status IN (
                'STARTED',
                'SUCCESS',
                'FAILED'
            )
        ),

    total_rows INTEGER NOT NULL DEFAULT 0,
    imported_rows INTEGER NOT NULL DEFAULT 0,
    failed_rows INTEGER NOT NULL DEFAULT 0,

    error_report JSONB,

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);


-- 26. AUDIT LOGS


CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    entity_type VARCHAR(100) NOT NULL,

    entity_id UUID,

    action VARCHAR(50) NOT NULL,

    old_data JSONB,
    new_data JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- INDEXES


CREATE INDEX idx_users_reports_to
ON users(reports_to_user_id);

CREATE INDEX idx_university_contacts_university
ON university_contacts(university_id);

CREATE INDEX idx_user_universities_university
ON user_universities(university_id);

CREATE INDEX idx_programs_direction
ON it_programs(direction_id);

CREATE INDEX idx_products_vendor
ON it_products(vendor_id);

CREATE INDEX idx_workflow_versions_workflow
ON workflow_versions(workflow_id);

CREATE INDEX idx_workflow_steps_version
ON workflow_steps(workflow_version_id);

CREATE INDEX idx_workflow_transitions_from
ON workflow_transitions(
    workflow_version_id,
    from_step_id
);

CREATE INDEX idx_interactions_university
ON interactions(university_id);

CREATE INDEX idx_interactions_program
ON interactions(program_id);

CREATE INDEX idx_interactions_product
ON interactions(product_id);

CREATE INDEX idx_interactions_manager
ON interactions(manager_id);

CREATE INDEX idx_interactions_workflow_step
ON interactions(
    workflow_version_id,
    current_step_id
);

CREATE INDEX idx_interactions_started_at
ON interactions(started_at);

CREATE INDEX idx_status_logs_interaction
ON interaction_status_logs(
    interaction_id,
    changed_at
);

CREATE INDEX idx_attachments_interaction_step
ON step_attachments(
    interaction_id,
    workflow_step_id
);

CREATE INDEX idx_external_metrics_interaction
ON external_metrics(interaction_id);

CREATE INDEX idx_external_metrics_period
ON external_metrics(
    period_start,
    period_end
);

CREATE INDEX idx_audit_entity
ON audit_logs(
    entity_type,
    entity_id,
    created_at
);



-- UPDATED_AT TRIGGERS


CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_universities_updated_at
BEFORE UPDATE ON universities
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_university_contacts_updated_at
BEFORE UPDATE ON university_contacts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_it_directions_updated_at
BEFORE UPDATE ON it_directions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_it_programs_updated_at
BEFORE UPDATE ON it_programs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_vendors_updated_at
BEFORE UPDATE ON vendors
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_it_products_updated_at
BEFORE UPDATE ON it_products
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_workflows_updated_at
BEFORE UPDATE ON workflows
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_interactions_updated_at
BEFORE UPDATE ON interactions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();



-- REPORT VIEW


CREATE VIEW v_interaction_report AS
SELECT
    i.id AS interaction_id,

    u.name AS university_name,

    d.name AS direction_name,

    p.name AS program_name,

    prod.name AS product_name,

    v.name AS vendor_name,

    w.name AS workflow_name,

    ws.name AS current_status,

    usr.full_name AS manager_name,

    i.contract_number,

    i.license_signed_at,

    i.license_term_years,

    i.license_expires_at,

    i.transfer_status,

    i.started_at,

    i.completed_at,

    i.updated_at

FROM interactions i

JOIN universities u
    ON u.id = i.university_id

LEFT JOIN it_programs p
    ON p.id = i.program_id

LEFT JOIN it_directions d
    ON d.id = p.direction_id

LEFT JOIN it_products prod
    ON prod.id = i.product_id

LEFT JOIN vendors v
    ON v.id = prod.vendor_id

JOIN workflow_versions wv
    ON wv.id = i.workflow_version_id

JOIN workflows w
    ON w.id = wv.workflow_id

JOIN workflow_steps ws
    ON ws.id = i.current_step_id

LEFT JOIN users usr
    ON usr.id = i.manager_id;



-- DEFAULT ROLES


INSERT INTO roles (
    code,
    name,
    description
)
VALUES
(
    'KAM',
    'KAM / Пользователь',
    'Работа со своими взаимодействиями'
),
(
    'MANAGER_LEAD',
    'Менеджер / Lead',
    'Управление взаимодействиями команды'
),
(
    'ADMIN',
    'Администратор',
    'Полный доступ и настройка системы'
)
ON CONFLICT (code) DO NOTHING;



-- EXTERNAL SYSTEMS

INSERT INTO external_systems (
    code,
    name
)
VALUES
(
    'LMS',
    'LMS'
),
(
    'WEBSITE',
    'Website / Laravel CMS'
)
ON CONFLICT (code) DO NOTHING;
