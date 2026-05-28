-- Owner-controlled staging/demo resident data reset.
-- This keeps platform configuration intact while clearing resident operations
-- for fresh UAT cycles. The RPC is service-role only and independently checks
-- that the actor is an owner/super-admin for the requested tenant.

begin;

create or replace function public.reset_resident_operational_data_for_staging(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_actor_user_id uuid default null,
  p_dry_run boolean default true,
  p_confirmation text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row_counts jsonb := '{}'::jsonb;
  v_deleted_counts jsonb := '{}'::jsonb;
  v_storage_objects jsonb := '[]'::jsonb;
  v_auth_users jsonb := '[]'::jsonb;
  v_preserved jsonb := jsonb_build_array(
    'organizations',
    'hostels',
    'rooms',
    'hostel_capacity',
    'room_capacity',
    'payment_settings',
    'payment-qr-codes storage bucket',
    'gallery',
    'gallery-images storage bucket',
    'website_settings',
    'facilities',
    'notices',
    'automation_settings',
    'feature flags',
    'owner/admin/staff auth accounts'
  );
  v_warnings jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_actor_is_owner boolean := false;
  v_audit_id uuid;
  v_action text;
begin
  if p_organization_id is null then
    raise exception 'demo_data_reset_organization_required';
  end if;

  if not public.is_service_context() then
    raise exception 'demo_data_reset_service_role_required';
  end if;

  if p_actor_user_id is null then
    raise exception 'demo_data_reset_actor_required';
  end if;

  if p_hostel_id is not null and not exists (
    select 1
    from public.hostels h
    where h.id = p_hostel_id
      and h.organization_id = p_organization_id
      and h.deleted_at is null
  ) then
    raise exception 'demo_data_reset_invalid_hostel_scope';
  end if;

  select exists (
    select 1
    from public.users u
    where u.id = p_actor_user_id
      and u.is_active is true
      and u.deleted_at is null
      and (
        u.is_platform_user is true
        or exists (
          select 1
          from public.user_roles ur
          where ur.user_id = u.id
            and ur.status = 'active'
            and ur.deleted_at is null
            and (
              ur.role::text = 'super_admin'
              or (
                ur.role::text = 'owner'
                and ur.organization_id = p_organization_id
                and (
                  p_hostel_id is null
                  or ur.hostel_id is null
                  or ur.hostel_id = p_hostel_id
                )
              )
            )
        )
      )
  )
  into v_actor_is_owner;

  if not v_actor_is_owner then
    raise exception 'demo_data_reset_owner_required';
  end if;

  if not coalesce(p_dry_run, true)
     and coalesce(p_confirmation, '') <> 'RESET DEMO DATA' then
    raise exception 'demo_data_reset_confirmation_required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_organization_id::text || ':' || coalesce(p_hostel_id::text, 'all') || ':demo-data-reset',
      0
    )
  );

  create temp table reset_resident_ids on commit drop as
  select distinct r.id
  from public.residents r
  left join public.hostels h on h.id = r.hostel_id
  left join public.users u on u.id = r.user_id
  where (
      r.organization_id = p_organization_id
      or (r.organization_id is null and h.organization_id = p_organization_id)
      or (r.organization_id is null and u.organization_id = p_organization_id)
    )
    and (
      p_hostel_id is null
      or r.hostel_id = p_hostel_id
      or h.id = p_hostel_id
    );

  create unique index reset_resident_ids_pk on reset_resident_ids(id);

  create temp table reset_auth_user_candidates on commit drop as
  select distinct
    u.id,
    u.email,
    u.phone,
    'resident/test auth user linked to reset resident'::text as reason
  from public.residents r
  join reset_resident_ids rr on rr.id = r.id
  join public.users u on u.id = r.user_id
  where r.user_id is not null
    and coalesce(u.is_platform_user, false) is false
    and not exists (
      select 1
      from public.user_roles ur
      where ur.user_id = u.id
        and ur.role::text not in ('resident', 'parent')
        and ur.deleted_at is null
    );

  create unique index reset_auth_user_candidates_pk on reset_auth_user_candidates(id);

  create temp table reset_lead_ids on commit drop as
  select distinct l.id
  from public.leads l
  where l.organization_id = p_organization_id
    and (p_hostel_id is null or l.hostel_id = p_hostel_id or l.hostel_id is null)
  union
  select distinct l.id
  from public.leads l
  join reset_resident_ids rr on rr.id = l.joined_resident_id;

  create unique index reset_lead_ids_pk on reset_lead_ids(id);

  create temp table reset_reservation_ids on commit drop as
  select distinct rv.id
  from public.reservations rv
  where rv.organization_id = p_organization_id
    and (p_hostel_id is null or rv.hostel_id = p_hostel_id)
  union
  select distinct rv.id
  from public.reservations rv
  join reset_lead_ids rl on rl.id = rv.lead_id
  union
  select distinct rv.id
  from public.reservations rv
  join reset_resident_ids rr on rr.id = rv.converted_resident_id;

  create unique index reset_reservation_ids_pk on reset_reservation_ids(id);

  create temp table reset_reservation_payment_ids on commit drop as
  select distinct rp.id
  from public.reservation_payments rp
  where rp.organization_id = p_organization_id
    and (p_hostel_id is null or rp.hostel_id = p_hostel_id)
  union
  select distinct rp.id
  from public.reservation_payments rp
  join reset_reservation_ids rr on rr.id = rp.reservation_id
  union
  select distinct rp.id
  from public.reservation_payments rp
  join reset_lead_ids rl on rl.id = rp.lead_id;

  create unique index reset_reservation_payment_ids_pk on reset_reservation_payment_ids(id);

  create temp table reset_payment_ids on commit drop as
  select distinct p.id
  from public.payments p
  where p.organization_id = p_organization_id
    and (p_hostel_id is null or p.hostel_id = p_hostel_id)
  union
  select distinct p.id
  from public.payments p
  join reset_resident_ids rr on rr.id = p.resident_id;

  create unique index reset_payment_ids_pk on reset_payment_ids(id);

  create temp table reset_invoice_ids on commit drop as
  select distinct i.id
  from public.invoices i
  where i.organization_id = p_organization_id
    and (p_hostel_id is null or i.hostel_id = p_hostel_id)
  union
  select distinct i.id
  from public.invoices i
  join reset_resident_ids rr on rr.id = i.resident_id;

  create unique index reset_invoice_ids_pk on reset_invoice_ids(id);

  create temp table reset_fee_record_ids on commit drop as
  select distinct f.id
  from public.monthly_fee_records f
  where f.organization_id = p_organization_id
    and (p_hostel_id is null or f.hostel_id = p_hostel_id)
  union
  select distinct f.id
  from public.monthly_fee_records f
  join reset_resident_ids rr on rr.id = f.resident_id;

  create unique index reset_fee_record_ids_pk on reset_fee_record_ids(id);

  create temp table reset_allocation_ids on commit drop as
  select distinct a.id
  from public.room_allocations a
  where a.organization_id = p_organization_id
    and (p_hostel_id is null or a.hostel_id = p_hostel_id)
  union
  select distinct a.id
  from public.room_allocations a
  join reset_resident_ids rr on rr.id = a.resident_id;

  create unique index reset_allocation_ids_pk on reset_allocation_ids(id);

  create temp table reset_invite_ids on commit drop as
  select distinct i.id
  from public.resident_invites i
  where i.organization_id = p_organization_id
    and (p_hostel_id is null or i.hostel_id = p_hostel_id)
  union
  select distinct i.id
  from public.resident_invites i
  join reset_resident_ids rr on rr.id = i.resident_id;

  create unique index reset_invite_ids_pk on reset_invite_ids(id);

  create temp table reset_leave_ids on commit drop as
  select distinct l.id
  from public.leave_requests l
  where l.organization_id = p_organization_id
    and (p_hostel_id is null or l.hostel_id = p_hostel_id)
  union
  select distinct l.id
  from public.leave_requests l
  join reset_resident_ids rr on rr.id = l.resident_id;

  create unique index reset_leave_ids_pk on reset_leave_ids(id);

  create temp table reset_support_request_ids on commit drop as
  select distinct s.id
  from public.support_requests s
  where s.organization_id = p_organization_id
    and (p_hostel_id is null or s.hostel_id = p_hostel_id)
  union
  select distinct s.id
  from public.support_requests s
  join reset_resident_ids rr on rr.id = s.resident_id
  union
  select distinct s.id
  from public.support_requests s
  join reset_auth_user_candidates au on au.id = s.created_by_user_id;

  create unique index reset_support_request_ids_pk on reset_support_request_ids(id);

  create temp table reset_notification_ids on commit drop as
  select distinct n.id
  from public.notifications n
  join reset_resident_ids rr on rr.id = n.resident_id
  where n.organization_id = p_organization_id
  union
  select distinct n.id
  from public.notifications n
  join reset_auth_user_candidates au on au.id = n.recipient_user_id
  where n.organization_id = p_organization_id;

  create unique index reset_notification_ids_pk on reset_notification_ids(id);

  create temp table reset_payment_webhook_ids on commit drop as
  select distinct w.id
  from public.payment_webhooks w
  join reset_payment_ids rp on rp.id = w.payment_id;

  create unique index reset_payment_webhook_ids_pk on reset_payment_webhook_ids(id);

  create temp table reset_document_ids on commit drop as
  select distinct d.id
  from public.documents d
  join reset_resident_ids rr on rr.id = d.resident_id
  where d.document_type::text not in ('gallery_image', 'facility_image')
  union
  select distinct d.id
  from public.documents d
  join reset_payment_ids rp on rp.id = d.payment_id
  where d.document_type::text not in ('gallery_image', 'facility_image')
  union
  select distinct d.id
  from public.documents d
  join reset_invoice_ids ri on ri.id = d.invoice_id
  where d.document_type::text not in ('gallery_image', 'facility_image')
  union
  select distinct d.id
  from public.documents d
  join public.reservation_payments rp on rp.proof_document_id = d.id
  join reset_reservation_payment_ids rpi on rpi.id = rp.id
  where d.document_type::text not in ('gallery_image', 'facility_image')
  union
  select distinct d.id
  from public.documents d
  join public.invoices i on i.pdf_document_id = d.id
  join reset_invoice_ids ri on ri.id = i.id
  where d.document_type::text not in ('gallery_image', 'facility_image')
  union
  select distinct d.id
  from public.documents d
  join public.residents r
    on d.id in (r.aadhaar_document_id, r.profile_image_document_id, r.student_id_document_id)
  join reset_resident_ids rr on rr.id = r.id
  where d.document_type::text not in ('gallery_image', 'facility_image')
  union
  select distinct d.id
  from public.documents d
  join public.users u on u.avatar_document_id = d.id
  join reset_auth_user_candidates au on au.id = u.id
  where d.document_type::text not in ('gallery_image', 'facility_image');

  create unique index reset_document_ids_pk on reset_document_ids(id);

  create temp table reset_storage_objects on commit drop as
  select distinct
    d.bucket_name as bucket,
    d.storage_path as path,
    'documents'::text as source_table,
    d.id as record_id
  from public.documents d
  join reset_document_ids rd on rd.id = d.id
  where d.bucket_name <> 'gallery-images'
  union
  select distinct
    'invoices'::text as bucket,
    i.pdf_storage_path as path,
    'invoices'::text as source_table,
    i.id as record_id
  from public.invoices i
  join reset_invoice_ids ri on ri.id = i.id
  where nullif(trim(coalesce(i.pdf_storage_path, '')), '') is not null;

  create index reset_storage_objects_bucket_path_idx on reset_storage_objects(bucket, path);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', au.id,
        'email', au.email,
        'phone', au.phone,
        'reason', au.reason
      )
      order by au.id
    ),
    '[]'::jsonb
  )
  into v_auth_users
  from reset_auth_user_candidates au;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bucket', so.bucket,
        'path', so.path,
        'sourceTable', so.source_table,
        'recordId', so.record_id
      )
      order by so.bucket, so.path
    ),
    '[]'::jsonb
  )
  into v_storage_objects
  from reset_storage_objects so;

  v_row_counts := jsonb_build_object(
    'residents', (select count(*) from reset_resident_ids),
    'residentInvites', (select count(*) from reset_invite_ids),
    'roomAllocations', (select count(*) from reset_allocation_ids),
    'monthlyFeeRecords', (select count(*) from reset_fee_record_ids),
    'invoices', (select count(*) from reset_invoice_ids),
    'payments', (select count(*) from reset_payment_ids),
    'paymentWebhooks', (select count(*) from reset_payment_webhook_ids),
    'leaveRequests', (select count(*) from reset_leave_ids),
    'supportRequests', (select count(*) from reset_support_request_ids),
    'notifications', (select count(*) from reset_notification_ids),
    'documents', (select count(*) from reset_document_ids),
    'leads', (select count(*) from reset_lead_ids),
    'reservations', (select count(*) from reset_reservation_ids),
    'reservationPayments', (select count(*) from reset_reservation_payment_ids),
    'authUsers', (select count(*) from reset_auth_user_candidates),
    'storageObjects', (select count(*) from reset_storage_objects)
  );

  if exists (
    select 1
    from public.residents r
    where r.organization_id is null
      and not exists (select 1 from reset_resident_ids rr where rr.id = r.id)
  ) then
    v_warnings := v_warnings || jsonb_build_array(
      'Some tenantless resident rows could not be safely associated with this organization and were not reset. Review Tenant Consistency Repair before launch.'
    );
  end if;

  if coalesce(p_dry_run, true) then
    v_action := 'demo_data_reset.dry_run';
  else
    v_action := 'demo_data_reset.executed';
  end if;

  if not coalesce(p_dry_run, true) then
    delete from public.notification_logs nl
    using reset_notification_ids rn
    where nl.notification_id = rn.id;
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('notificationLogs', v_count);

    delete from public.notifications n
    using reset_notification_ids rn
    where n.id = rn.id;
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('notifications', v_count);

    delete from public.support_requests s
    using reset_support_request_ids rs
    where s.id = rs.id;
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('supportRequests', v_count);

    delete from public.lead_activity_logs la
    using reset_lead_ids rl
    where la.lead_id = rl.id;
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('leadActivityLogs', v_count);

    delete from public.lead_activity_logs la
    using reset_reservation_ids rr
    where la.reservation_id = rr.id;
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('reservationActivityLogs', v_count);

    delete from public.lead_notes ln
    using reset_lead_ids rl
    where ln.lead_id = rl.id;
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('leadNotes', v_count);

    delete from public.reservation_payments rp
    using reset_reservation_payment_ids rpi
    where rp.id = rpi.id;
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('reservationPayments', v_count);

    delete from public.reservations rv
    using reset_reservation_ids rr
    where rv.id = rr.id;
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('reservations', v_count);

    delete from public.resident_invites i
    using reset_invite_ids ri
    where i.id = ri.id;
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('residentInvites', v_count);

    delete from public.leave_requests l
    using reset_leave_ids rl
    where l.id = rl.id;
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('leaveRequests', v_count);

    delete from public.payment_webhooks w
    using reset_payment_webhook_ids rw
    where w.id = rw.id;
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('paymentWebhooks', v_count);

    delete from public.payments p
    using reset_payment_ids rp
    where p.id = rp.id;
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('payments', v_count);

    delete from public.invoices i
    using reset_invoice_ids ri
    where i.id = ri.id;
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('invoices', v_count);

    delete from public.monthly_fee_records f
    using reset_fee_record_ids rf
    where f.id = rf.id;
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('monthlyFeeRecords', v_count);

    delete from public.room_allocations a
    using reset_allocation_ids ra
    where a.id = ra.id;
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('roomAllocations', v_count);

    update public.documents d
    set
      resident_id = null,
      payment_id = null,
      invoice_id = null,
      updated_at = now()
    where d.organization_id = p_organization_id
      and d.document_type::text in ('gallery_image', 'facility_image')
      and (
        exists (select 1 from reset_resident_ids rr where rr.id = d.resident_id)
        or exists (select 1 from reset_payment_ids rp where rp.id = d.payment_id)
        or exists (select 1 from reset_invoice_ids ri where ri.id = d.invoice_id)
      );
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('cmsDocumentsDetached', v_count);

    delete from public.residents r
    using reset_resident_ids rr
    where r.id = rr.id;
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('residents', v_count);

    delete from public.documents d
    using reset_document_ids rd
    where d.id = rd.id;
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('documents', v_count);

    delete from public.leads l
    using reset_lead_ids rl
    where l.id = rl.id;
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('leads', v_count);

    delete from public.user_roles ur
    using reset_auth_user_candidates au
    where ur.user_id = au.id;
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('residentUserRoles', v_count);

    delete from public.users u
    using reset_auth_user_candidates au
    where u.id = au.id;
    get diagnostics v_count = row_count;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('residentPublicUsers', v_count);

    perform public.recalculate_hostel_capacity(p_organization_id, h.id)
    from public.hostels h
    where h.organization_id = p_organization_id
      and h.deleted_at is null
      and (p_hostel_id is null or h.id = p_hostel_id);
  end if;

  insert into public.audit_logs (
    organization_id,
    hostel_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    metadata
  )
  values (
    p_organization_id,
    p_hostel_id,
    p_actor_user_id,
    'staging_demo_data_reset',
    p_organization_id,
    v_action,
    null,
    jsonb_build_object(
      'dryRun', coalesce(p_dry_run, true),
      'plannedRows', v_row_counts,
      'deletedRows', v_deleted_counts
    ),
    jsonb_build_object(
      'confirmationRequired', 'RESET DEMO DATA',
      'preserved', v_preserved,
      'storageObjects', v_storage_objects,
      'authUsers', v_auth_users,
      'warnings', v_warnings
    )
  )
  returning id into v_audit_id;

  return jsonb_build_object(
    'dryRun', coalesce(p_dry_run, true),
    'organizationId', p_organization_id,
    'hostelId', p_hostel_id,
    'rows', v_row_counts,
    'deletedRows', v_deleted_counts,
    'authUsers', v_auth_users,
    'storageObjects', v_storage_objects,
    'preserved', v_preserved,
    'warnings', v_warnings,
    'confirmationRequired', 'RESET DEMO DATA',
    'sequencesReset', jsonb_build_array(),
    'auditId', v_audit_id,
    'executedAt', now()
  );
end;
$$;

comment on function public.reset_resident_operational_data_for_staging(uuid, uuid, uuid, boolean, text) is
  'Service-role-only owner-controlled staging reset. Deletes resident/test operational data transactionally while preserving tenant configuration and admin/staff access. Storage objects and Supabase auth users are returned for server-side cleanup after DB commit.';

revoke execute on function public.reset_resident_operational_data_for_staging(uuid, uuid, uuid, boolean, text)
from public, anon, authenticated;
grant execute on function public.reset_resident_operational_data_for_staging(uuid, uuid, uuid, boolean, text)
to service_role;

commit;
