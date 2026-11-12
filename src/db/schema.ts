import { relations, sql } from 'drizzle-orm';
import {
    boolean,
    doublePrecision,
    index,
    uniqueIndex,
    integer,
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    text,
    timestamp,
    unique,
    uuid,
} from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () =>
    timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
    timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date());

export const userRole = pgEnum('UserRole', [
    'ADMIN',
    'DINKES',
    'PUSKESMAS',
    'RUMAH_SAKIT',
]);
export const institutionType = pgEnum('InstitutionType', [
    'RUMAH_SAKIT',
    'PUSKESMAS',
    'DINAS_KESEHATAN',
]);
export const caseType = pgEnum('CaseType', [
    'DENGUE',
    'SUSPECTED_DENGUE',
    'DHF',
    'DSS',
]);
export const gender = pgEnum('Gender', ['L', 'P']);
export const reportRSStatus = pgEnum('ReportRSStatus', [
    'DRAFT',
    'SUBMITTED',
    'ASSIGNED',
    'ASSIGNED_ACCEPTED',
    'PUSKESMAS_REJECTED',
    'PE_COMPLETED',
    'VERIFIED',
    'REJECTED',
]);
export const reportPEStatus = pgEnum('ReportPEStatus', [
    'DRAFT',
    'SUBMITTED',
    'VERIFIED',
    'REJECTED',
]);
export const taskStatus = pgEnum('TaskStatus', [
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'OVERDUE',
]);
export const taskPriority = pgEnum('TaskPriority', [
    'LOW',
    'NORMAL',
    'HIGH',
    'CRITICAL',
]);
export const requestStatus = pgEnum('RequestStatus', [
    'PENDING',
    'APPROVED',
    'REJECTED',
]);
export const riskLevel = pgEnum('RiskLevel', [
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL',
]);
export const entityType = pgEnum('EntityType', [
    'REPORT_RS',
    'REPORT_PE',
    'PE_TASK',
    'KOREKSI_WILAYAH',
    'USER',
    'INSTITUTION',
]);
export const eventType = pgEnum('EventType', [
    'REPORT_CREATED',
    'REPORT_UPDATED',
    'REPORT_DELETED',
    'STATUS_CHANGE',
    'VERIFICATION',
    'CORRECTION',
    'ASSIGNMENT',
    'PE_TASK_CREATED',
    'NOTIFICATION_SENT',
    'COMMENT',
    'ATTACHMENT',
    'INVESTIGATION_STARTED',
    'FINDINGS_RECORDED',
    'DUE_DATE_UPDATED',
    'PRIORITY_UPDATED',
    'KOREKSI_REQUESTED',
    'KOREKSI_SUBMITTED',
    'KOREKSI_APPROVED',
    'KOREKSI_REJECTED',
]);
export const eventCategory = pgEnum('EventCategory', [
    'STATUS',
    'VERIFICATION',
    'ADMINISTRATION',
    'INVESTIGATION',
    'SYSTEM',
]);

export const institutions = pgTable(
    'institutions',
    {
        id: id(),
        name: text('name').notNull(),
        type: institutionType('type').notNull(),
        address: text('address'),
        province: text('province'),
        city: text('city'),
        district: text('district'),
        subDistrict: text('sub_district'),
        village: text('village'),
        phoneNumber: text('phone_number'),
        phone: text('phone'),
        latitude: doublePrecision('latitude'),
        longitude: doublePrecision('longitude'),
        kelurahanList: text('kelurahan_list')
            .array()
            .notNull()
            .default(sql`'{}'::text[]`),
        isActive: boolean('is_active').notNull().default(true),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [index('institutions_type_idx').on(t.type)],
);

export const users = pgTable(
    'users',
    {
        id: id(),
        email: text('email').notNull().unique(),
        emailVerified: boolean('email_verified').notNull().default(false),
        name: text('name').notNull(),
        image: text('image'),
        role: userRole('role').notNull().default('PUSKESMAS'),
        institutionId: uuid('institution_id').references(
            () => institutions.id,
            {
                onDelete: 'set null',
            },
        ),
        isActive: boolean('is_active').notNull().default(true),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [
        index('users_email_idx').on(t.email),
        index('users_institution_idx').on(t.institutionId),
    ],
);

export const sessions = pgTable(
    'sessions',
    {
        id: id(),
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        token: text('token').notNull().unique(),
        ipAddress: text('ip_address'),
        userAgent: text('user_agent'),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [index('sessions_user_idx').on(t.userId)],
);

export const accounts = pgTable(
    'accounts',
    {
        id: id(),
        accountId: text('account_id').notNull(),
        providerId: text('provider_id').notNull(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        accessToken: text('access_token'),
        refreshToken: text('refresh_token'),
        idToken: text('id_token'),
        accessTokenExpiresAt: timestamp('access_token_expires_at', {
            withTimezone: true,
        }),
        refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
            withTimezone: true,
        }),
        scope: text('scope'),
        password: text('password'),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [index('accounts_user_idx').on(t.userId)],
);

export const verifications = pgTable(
    'verifications',
    {
        id: id(),
        identifier: text('identifier').notNull(),
        value: text('value').notNull(),
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [index('verifications_identifier_idx').on(t.identifier)],
);

export const reportsRS = pgTable(
    'reports_rs',
    {
        id: id(),
        reportNumber: text('report_number').notNull().unique(),
        patientNameEncrypted: text('patient_name_encrypted').notNull(),
        patientNikEncrypted: text('patient_nik_encrypted').notNull(),
        // Keyed hash of the NIK so exact lookups stay possible without
        // decrypting (or indexing) plaintext. See src/lib/crypto.ts.
        patientNikHash: text('patient_nik_hash'),
        patientBirthDate: timestamp('patient_birth_date', {
            withTimezone: true,
        }),
        patientAddressEncrypted: text('patient_address_encrypted').notNull(),
        patientAge: integer('patient_age').notNull(),
        patientGender: gender('patient_gender').notNull(),
        caseType: caseType('case_type').notNull(),
        // Ciphertext like the other patient identifiers: this is a contact
        // number for a named dengue patient, and it was the one PII column
        // still sitting in the clear (renamed so no plaintext value can be
        // mistaken for encrypted after the migration).
        phoneNumberEncrypted: text('phone_number_encrypted'),
        initialDiagnosis: text('initial_diagnosis'),
        finalDiagnosis: text('final_diagnosis'),
        symptomOnsetDate: timestamp('symptom_onset_date', {
            withTimezone: true,
        }),
        admissionDate: timestamp('admission_date', {
            withTimezone: true,
        }).notNull(),
        diagnosisDate: timestamp('diagnosis_date', { withTimezone: true }),
        dischargeDate: timestamp('discharge_date', { withTimezone: true }),
        dischargeStatus: text('discharge_status'),
        fever: text('fever'),
        bleeding: text('bleeding'),
        tourniquetTest: text('tourniquet_test'),
        hepatomegaly: text('hepatomegaly'),
        shock: text('shock'),
        plateletCount: integer('platelet_count'),
        hematocrit: numeric('hematocrit', { precision: 5, scale: 2 }),
        dengueBlot: text('dengue_blot'),
        igg: text('igg'),
        igm: text('igm'),
        diagnosis: text('diagnosis'),
        kota: text('kota'),
        provinsi: text('provinsi'),
        kelurahan: text('kelurahan'),
        kecamatan: text('kecamatan'),
        institutionId: uuid('institution_id')
            .notNull()
            .references(() => institutions.id),
        assignedPuskesmasId: uuid('assigned_puskesmas_id').references(
            () => institutions.id,
        ),
        createdById: uuid('created_by_id')
            .notNull()
            .references(() => users.id),
        assignedToId: uuid('assigned_to_id').references(() => users.id),
        updatedById: uuid('updated_by_id').references(() => users.id),
        status: reportRSStatus('status').notNull().default('DRAFT'),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
        puskesmasReviewedAt: timestamp('puskesmas_reviewed_at', {
            withTimezone: true,
        }),
        rejectionReason: text('rejection_reason'),
        rejectionCategory: text('rejection_category'),
        rejectedBy: uuid('rejected_by'),
    },
    (t) => [
        index('reports_rs_institution_idx').on(t.institutionId),
        index('reports_rs_assigned_idx').on(t.assignedPuskesmasId),
        index('reports_rs_status_idx').on(t.status),
        index('reports_rs_updated_at_idx').on(t.updatedAt),
        index('reports_rs_nik_hash_idx').on(t.patientNikHash),
    ],
);

export const reportsPE = pgTable(
    'reports_pe',
    {
        id: id(),
        reportRSId: uuid('report_rs_id')
            .notNull()
            .unique()
            .references(() => reportsRS.id, { onDelete: 'cascade' }),
        institutionId: uuid('institution_id')
            .notNull()
            .references(() => institutions.id),
        peDate: timestamp('pe_date', { withTimezone: true }).notNull(),
        investigationDate: timestamp('investigation_date', {
            withTimezone: true,
        }),
        investigatorName: text('investigator_name'),
        officerName: text('officer_name').notNull(),
        officerId: uuid('officer_id')
            .notNull()
            .references(() => users.id),
        createdById: uuid('created_by_id').references(() => users.id),
        updatedById: uuid('updated_by_id').references(() => users.id),
        houseIndex: numeric('house_index', { precision: 5, scale: 2 }),
        containerIndex: numeric('container_index', { precision: 5, scale: 2 }),
        breteauIndex: numeric('breteau_index', { precision: 5, scale: 2 }),
        sourceInvestigationDone: boolean('source_investigation_done'),
        sourceLocation: text('source_location'),
        formData: jsonb('form_data'),
        conclusion: text('conclusion'),
        recommendation: text('recommendation'),
        version: integer('version').notNull().default(1),
        status: reportPEStatus('status').notNull().default('DRAFT'),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [
        index('reports_pe_report_rs_idx').on(t.reportRSId),
        index('reports_pe_institution_idx').on(t.institutionId),
    ],
);

export const peTasks = pgTable(
    'pe_tasks',
    {
        id: id(),
        reportPEId: uuid('report_pe_id')
            .notNull()
            .references(() => reportsPE.id, { onDelete: 'cascade' }),
        assignedPuskesmasId: uuid('assigned_puskesmas_id'),
        assignedUserId: uuid('assigned_user_id').references(() => users.id),
        createdById: uuid('created_by_id')
            .notNull()
            .references(() => users.id),
        status: taskStatus('status').notNull().default('PENDING'),
        priority: taskPriority('priority').notNull().default('NORMAL'),
        dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
        completedAt: timestamp('completed_at', { withTimezone: true }),
        notes: text('notes'),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [
        index('pe_tasks_report_pe_idx').on(t.reportPEId),
        index('pe_tasks_assigned_user_idx').on(t.assignedUserId),
        index('pe_tasks_status_idx').on(t.status),
    ],
);

export const assets = pgTable(
    'assets',
    {
        id: id(),
        name: text('name').notNull(),
        code: text('code').notNull().unique(),
        category: text('category').notNull(),
        unit: text('unit').notNull(),
        currentStock: integer('current_stock').notNull().default(0),
        minimumStock: integer('minimum_stock').notNull().default(10),
        institutionId: uuid('institution_id')
            .notNull()
            .references(() => institutions.id),
        createdById: uuid('created_by_id')
            .notNull()
            .references(() => users.id),
        isActive: boolean('is_active').notNull().default(true),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [
        index('assets_code_idx').on(t.code),
        index('assets_institution_idx').on(t.institutionId),
    ],
);

export const assetRequests = pgTable(
    'asset_requests',
    {
        id: id(),
        assetId: uuid('asset_id')
            .notNull()
            .references(() => assets.id),
        institutionId: uuid('institution_id')
            .notNull()
            .references(() => institutions.id),
        quantity: integer('quantity').notNull(),
        status: requestStatus('status').notNull().default('PENDING'),
        requestedById: uuid('requested_by_id')
            .notNull()
            .references(() => users.id),
        requestedAt: timestamp('requested_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        approvedAt: timestamp('approved_at', { withTimezone: true }),
        approvedById: uuid('approved_by_id').references(() => users.id),
        notes: text('notes'),
    },
    (t) => [
        index('asset_requests_asset_idx').on(t.assetId),
        index('asset_requests_institution_idx').on(t.institutionId),
        index('asset_requests_status_idx').on(t.status),
    ],
);

export const assetTransactions = pgTable(
    'asset_transactions',
    {
        id: id(),
        assetId: uuid('asset_id')
            .notNull()
            .references(() => assets.id),
        type: text('type').notNull(),
        quantity: integer('quantity').notNull(),
        reference: text('reference'),
        notes: text('notes'),
        createdAt: createdAt(),
    },
    (t) => [index('asset_transactions_asset_idx').on(t.assetId)],
);

export const riskPredictions = pgTable(
    'risk_predictions',
    {
        id: id(),
        modelType: text('model_type').notNull(),
        predictionData: jsonb('prediction_data').notNull(),
        riskLevel: text('risk_level').notNull(),
        confidence: numeric('confidence', { precision: 5, scale: 4 }).notNull(),
        createdById: uuid('created_by_id')
            .notNull()
            .references(() => users.id),
        modelVersion: text('model_version'),
        featuresUsed: jsonb('features_used'),
        targetId: text('target_id').notNull(),
        targetType: text('target_type').notNull(),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [
        index('risk_predictions_model_type_idx').on(t.modelType),
        index('risk_predictions_target_idx').on(t.targetId, t.targetType),
        index('risk_predictions_risk_level_idx').on(t.riskLevel),
        index('risk_predictions_created_at_idx').on(t.createdAt),
    ],
);

export const dataQualityAlerts = pgTable(
    'data_quality_alerts',
    {
        id: id(),
        type: text('type').notNull(),
        severity: text('severity').notNull(),
        description: text('description').notNull(),
        reportId: text('report_id'),
        institution: text('institution'),
        isResolved: boolean('is_resolved').notNull().default(false),
        resolvedAt: timestamp('resolved_at', { withTimezone: true }),
        createdAt: createdAt(),
    },
    (t) => [index('data_quality_alerts_resolved_idx').on(t.isResolved)],
);

export const notifications = pgTable(
    'notifications',
    {
        id: id(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        title: text('title').notNull(),
        message: text('message').notNull(),
        type: text('type').notNull(),
        entityType: text('entity_type'),
        entityId: text('entity_id'),
        isRead: boolean('is_read').notNull().default(false),
        readAt: timestamp('read_at', { withTimezone: true }),
        createdAt: createdAt(),
    },
    (t) => [
        index('notifications_user_idx').on(t.userId),
        index('notifications_is_read_idx').on(t.isRead),
        // One SLA breach notice per report per user per day. Declared here so
        // `generate` sees it; the worker relies on it to dedupe safely under
        // concurrency instead of a check-then-insert.
        uniqueIndex('notifications_sla_once_per_day')
            .on(
                t.userId,
                t.entityId,
                t.type,
                sql`date_trunc('day', ${t.createdAt})`,
            )
            .where(sql`${t.type} = 'SLA_BREACH'`),
    ],
);

export const conversations = pgTable('conversations', {
    id: id(),
    name: text('name'),
    type: text('type').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
});

export const conversationUsers = pgTable(
    'conversation_users',
    {
        id: id(),
        conversationId: uuid('conversation_id')
            .notNull()
            .references(() => conversations.id, { onDelete: 'cascade' }),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        joinedAt: timestamp('joined_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (t) => [
        unique('conversation_users_conversation_user_key').on(
            t.conversationId,
            t.userId,
        ),
        index('conversation_users_user_idx').on(t.userId),
    ],
);

export const messages = pgTable(
    'messages',
    {
        id: id(),
        conversationId: uuid('conversation_id')
            .notNull()
            .references(() => conversations.id, { onDelete: 'cascade' }),
        senderId: uuid('sender_id')
            .notNull()
            .references(() => users.id),
        content: text('content').notNull(),
        isRead: boolean('is_read').notNull().default(false),
        readAt: timestamp('read_at', { withTimezone: true }),
        createdAt: createdAt(),
    },
    (t) => [
        index('messages_conversation_idx').on(t.conversationId),
        index('messages_sender_idx').on(t.senderId),
    ],
);

export const comments = pgTable(
    'comments',
    {
        id: id(),
        reportRSId: uuid('report_rs_id')
            .notNull()
            .references(() => reportsRS.id, { onDelete: 'cascade' }),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id),
        content: text('content').notNull(),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [
        index('comments_report_rs_idx').on(t.reportRSId),
        index('comments_user_idx').on(t.userId),
    ],
);

export const auditLogs = pgTable(
    'audit_logs',
    {
        id: id(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id),
        action: text('action').notNull(),
        entityType: text('entity_type').notNull(),
        entityId: text('entity_id').notNull(),
        changes: jsonb('changes'),
        ipAddress: text('ip_address'),
        userAgent: text('user_agent'),
        createdAt: createdAt(),
    },
    (t) => [
        index('audit_logs_user_idx').on(t.userId),
        index('audit_logs_entity_idx').on(t.entityType, t.entityId),
        index('audit_logs_created_at_idx').on(t.createdAt),
    ],
);

export const systemSettings = pgTable(
    'system_settings',
    {
        id: id(),
        key: text('key').notNull().unique(),
        value: text('value').notNull(),
        type: text('type').notNull(),
        category: text('category'),
        description: text('description'),
        isPublic: boolean('is_public').notNull().default(false),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [index('system_settings_key_idx').on(t.key)],
);

export const roles = pgTable('roles', {
    id: id(),
    name: text('name').notNull().unique(),
    description: text('description'),
    permissions: jsonb('permissions'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
});

export const permissions = pgTable(
    'permissions',
    {
        id: id(),
        resource: text('resource').notNull(),
        action: text('action').notNull(),
        description: text('description'),
        createdAt: createdAt(),
    },
    (t) => [unique('permissions_resource_action_key').on(t.resource, t.action)],
);

export const caseReassignments = pgTable(
    'case_reassignments',
    {
        id: id(),
        reportRSId: uuid('report_rs_id').notNull(),
        fromUserId: uuid('from_user_id').notNull(),
        toUserId: uuid('to_user_id').notNull(),
        reason: text('reason').notNull(),
        reassignedBy: uuid('reassigned_by').notNull(),
        reassignedAt: timestamp('reassigned_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (t) => [index('case_reassignments_report_rs_idx').on(t.reportRSId)],
);

export const attachments = pgTable(
    'attachments',
    {
        id: id(),
        reportRSId: uuid('report_rs_id').references(() => reportsRS.id, {
            onDelete: 'cascade',
        }),
        reportPEId: uuid('report_pe_id').references(() => reportsPE.id, {
            onDelete: 'cascade',
        }),
        fileName: text('file_name').notNull(),
        filePath: text('file_path').notNull(),
        fileType: text('file_type').notNull(),
        fileSize: integer('file_size').notNull(),
        uploadedBy: uuid('uploaded_by').notNull(),
        createdAt: createdAt(),
    },
    (t) => [
        index('attachments_report_rs_idx').on(t.reportRSId),
        index('attachments_report_pe_idx').on(t.reportPEId),
    ],
);

export const masterData = pgTable(
    'master_data',
    {
        id: id(),
        type: text('type').notNull(),
        code: text('code').notNull().unique(),
        name: text('name').notNull(),
        parentId: uuid('parent_id'),
        isActive: boolean('is_active').notNull().default(true),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [
        index('master_data_type_idx').on(t.type),
        index('master_data_parent_idx').on(t.parentId),
    ],
);

export const peHouseholdSurveys = pgTable(
    'pe_household_surveys',
    {
        id: id(),
        reportPEId: uuid('report_pe_id')
            .notNull()
            .references(() => reportsPE.id, { onDelete: 'cascade' }),
        address: text('address').notNull(),
        houseCount: integer('house_count').notNull(),
        population: integer('population').notNull(),
        larvaCount: integer('larva_count').notNull(),
        larvaType: text('larva_type'),
        abateUsed: boolean('abate_used').notNull().default(false),
        notes: text('notes'),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [index('pe_household_surveys_report_pe_idx').on(t.reportPEId)],
);

export const entityHistory = pgTable(
    'entity_history',
    {
        id: id(),
        entityType: entityType('entity_type').notNull(),
        entityId: uuid('entity_id').notNull(),
        eventType: eventType('event_type').notNull(),
        eventDate: timestamp('event_date', { withTimezone: true })
            .notNull()
            .defaultNow(),
        description: text('description').notNull(),
        performedById: uuid('performed_by_id').references(() => users.id, {
            onDelete: 'set null',
        }),
        previousValue: text('previous_value'),
        newValue: text('new_value'),
        metadata: jsonb('metadata'),
        category: eventCategory('category').notNull().default('STATUS'),
        relatedReportId: uuid('related_report_id'),
        createdAt: createdAt(),
    },
    (t) => [
        index('entity_history_entity_idx').on(
            t.entityType,
            t.entityId,
            t.eventDate,
        ),
        index('entity_history_performer_idx').on(t.performedById),
        index('entity_history_related_report_idx').on(t.relatedReportId),
    ],
);

export const kelurahan = pgTable(
    'kelurahan',
    {
        id: id(),
        name: text('name').notNull(),
        kecamatan: text('kecamatan').notNull(),
        kota: text('kota').notNull(),
        provinsi: text('provinsi').notNull(),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [
        index('kelurahan_kecamatan_idx').on(t.kecamatan),
        index('kelurahan_kota_idx').on(t.kota),
    ],
);

// Re-exported with better-auth's expected singular names.
export const user = users;
export const session = sessions;
export const account = accounts;
export const verification = verifications;

export const schema = {
    user,
    session,
    account,
    verification,
    institutions,
    users,
    sessions,
    accounts,
    verifications,
    reportsRS,
    reportsPE,
    peTasks,
    assets,
    assetRequests,
    assetTransactions,
    riskPredictions,
    dataQualityAlerts,
    notifications,
    conversations,
    conversationUsers,
    messages,
    comments,
    auditLogs,
    systemSettings,
    roles,
    permissions,
    caseReassignments,
    attachments,
    masterData,
    peHouseholdSurveys,
    entityHistory,
    kelurahan,
};

export const institutionsRelations = relations(institutions, ({ many }) => ({
    users: many(users),
    reportsRS: many(reportsRS),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
    institution: one(institutions, {
        fields: [users.institutionId],
        references: [institutions.id],
    }),
    notifications: many(notifications),
}));

export const reportsRSRelations = relations(reportsRS, ({ one, many }) => ({
    institution: one(institutions, {
        fields: [reportsRS.institutionId],
        references: [institutions.id],
    }),
    createdBy: one(users, {
        fields: [reportsRS.createdById],
        references: [users.id],
    }),
    reportsPE: many(reportsPE),
    attachments: many(attachments),
    comments: many(comments),
}));

export const reportsPERelations = relations(reportsPE, ({ one, many }) => ({
    reportRS: one(reportsRS, {
        fields: [reportsPE.reportRSId],
        references: [reportsRS.id],
    }),
    tasks: many(peTasks),
    surveys: many(peHouseholdSurveys),
    attachments: many(attachments),
}));
