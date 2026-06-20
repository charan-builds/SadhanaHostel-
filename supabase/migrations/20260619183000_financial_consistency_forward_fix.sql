-- Forward-only repair for paid fee synchronization and advance separation.

begin;

do $$
begin
  if to_regprocedure(
    'public.finance_dashboard_aggregates_including_advance(uuid,uuid,date)'
  ) is null then
    alter function public.finance_dashboard_aggregates(uuid, uuid, date)
      rename to finance_dashboard_aggregates_including_advance;
  end if;
end;
$$;

create or replace function public.finance_dashboard_aggregates(
  p_organization_id uuid,
  p_hostel_id uuid default null,
  p_today date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_month_start date := date_trunc('month', p_today)::date;
  v_next_month date := (date_trunc('month', p_today) + interval '1 month')::date;
  v_advance_collected numeric(12,2);
  v_advance_balance numeric(12,2);
begin
  if not public.can_manage_finance(p_organization_id, p_hostel_id) then
    raise exception 'finance_dashboard_forbidden' using errcode = '42501';
  end if;

  v_result := public.finance_dashboard_aggregates_including_advance(
    p_organization_id,
    p_hostel_id,
    p_today
  );

  select coalesce(sum(p.amount), 0)
  into v_advance_collected
  from public.payments p
  where p.organization_id = p_organization_id
    and (p_hostel_id is null or p.hostel_id = p_hostel_id)
    and p.status = 'verified'::public.payment_status_enum
    and p.is_advance is true
    and p.verified_at >= v_month_start::timestamptz
    and p.verified_at < v_next_month::timestamptz
    and p.deleted_at is null;

  select coalesce(sum(ab.remaining_advance_balance), 0)
  into v_advance_balance
  from public.advance_balance_view ab
  where ab.organization_id = p_organization_id
    and (p_hostel_id is null or ab.hostel_id = p_hostel_id);

  v_result := jsonb_set(
    v_result,
    '{kpis,collectedAmount}',
    to_jsonb(
      greatest(
        0,
        coalesce((v_result #>> '{kpis,collectedAmount}')::numeric, 0)
          - v_advance_collected
      )
    ),
    true
  );

  return jsonb_set(
    v_result,
    '{kpis,advanceBalance}',
    to_jsonb(v_advance_balance),
    true
  );
end;
$$;

revoke execute on function public.finance_dashboard_aggregates_including_advance(
  uuid,
  uuid,
  date
) from public, anon, authenticated;

revoke execute on function public.finance_dashboard_aggregates(
  uuid,
  uuid,
  date
) from public, anon;

grant execute on function public.finance_dashboard_aggregates(
  uuid,
  uuid,
  date
) to authenticated, service_role;

create or replace function public.apply_resident_financial_correction_atomic(
  p_organization_id uuid,
  p_resident_id uuid,
  p_change_type text,
  p_new_value numeric,
  p_reason text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_resident public.residents%rowtype;
  v_fee_record public.monthly_fee_records%rowtype;
  v_payment public.payments%rowtype;
  v_old_value numeric(12,2);
  v_new_value numeric(12,2);
  v_delta numeric(12,2);
  v_audit_log_id uuid;
  v_correction_record_id uuid;
  v_corrected_at timestamptz := clock_timestamp();
  v_admin_name text;
  v_admin_email text;
begin
  perform public.assert_service_role_rpc(
    'apply_resident_financial_correction_atomic'
  );

  if p_change_type not in ('monthly_fee', 'advance_balance') then
    raise exception 'financial_correction_invalid_change_type:%', p_change_type
      using errcode = '22023';
  end if;

  if p_new_value is null or p_new_value < 0 then
    raise exception 'financial_correction_invalid_value'
      using errcode = '22023';
  end if;

  if p_change_type = 'monthly_fee' and p_new_value <= 0 then
    raise exception 'financial_correction_monthly_fee_must_be_positive'
      using errcode = '22023';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 6 then
    raise exception 'financial_correction_reason_required'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_organization_id::text || ':' || p_resident_id::text ||
      ':financial-correction',
      0
    )
  );

  select *
  into v_resident
  from public.residents
  where id = p_resident_id
    and organization_id = p_organization_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'financial_correction_resident_not_found'
      using errcode = 'P0002';
  end if;

  select full_name, email::text
  into v_admin_name, v_admin_email
  from public.users
  where id = p_actor_user_id;

  v_new_value := round(p_new_value, 2);

  if p_change_type = 'monthly_fee' then
    v_old_value := round(v_resident.monthly_fee_amount, 2);
    v_delta := round(v_new_value - v_old_value, 2);

    if v_delta = 0 then
      raise exception 'financial_correction_no_change'
        using errcode = '22023';
    end if;

    select mfr.*
    into v_fee_record
    from public.monthly_fee_records mfr
    where mfr.organization_id = p_organization_id
      and mfr.resident_id = p_resident_id
      and mfr.deleted_at is null
      and mfr.period_month = date_trunc(
        'month',
        coalesce(v_resident.joined_on, v_resident.created_at::date)
      )::date
    order by
      coalesce(
        (mfr.metadata ->> 'generated_for_initial_collection')::boolean,
        false
      ) desc,
      mfr.created_at asc
    limit 1
    for update;

    if v_fee_record.id is not null then
      select p.*
      into v_payment
      from public.payments p
      where p.organization_id = p_organization_id
        and p.resident_id = p_resident_id
        and p.monthly_fee_record_id = v_fee_record.id
        and p.status = 'verified'
        and p.is_advance is false
        and p.deleted_at is null
      order by
        coalesce((p.metadata ->> 'first_month_fee')::boolean, false) desc,
        p.verified_at asc nulls last,
        p.created_at asc
      limit 1
      for update;
    end if;

    update public.residents
    set monthly_fee_amount = v_new_value,
        updated_by = p_actor_user_id,
        updated_at = v_corrected_at
    where id = v_resident.id;

    if v_fee_record.id is not null then
      update public.monthly_fee_records
      set base_amount = v_new_value,
          total_amount = v_new_value,
          paid_amount = case when v_payment.id is null then 0 else v_new_value end,
          balance_amount = case when v_payment.id is null then v_new_value else 0 end,
          status = case
            when v_payment.id is null then 'pending'::public.fee_record_status_enum
            else 'paid'::public.fee_record_status_enum
          end,
          metadata = metadata || jsonb_build_object(
            'financial_correction_applied', true,
            'financial_correction_reason', trim(p_reason),
            'financial_correction_at', v_corrected_at
          ),
          updated_by = p_actor_user_id,
          updated_at = v_corrected_at
      where id = v_fee_record.id;

      if v_payment.id is not null then
        update public.payments
        set amount = v_new_value,
            is_partial = false,
            metadata = metadata || jsonb_build_object(
              'financial_correction_applied', true,
              'financial_correction_old_amount', v_payment.amount,
              'financial_correction_new_amount', v_new_value,
              'financial_correction_reason', trim(p_reason),
              'financial_correction_at', v_corrected_at
            ),
            updated_by = p_actor_user_id,
            updated_at = v_corrected_at
        where id = v_payment.id;

        update public.invoices
        set subtotal_amount = v_new_value,
            total_amount = v_new_value,
            paid_amount = v_new_value,
            balance_amount = 0,
            status = 'paid'::public.invoice_status_enum,
            metadata = metadata || jsonb_build_object(
              'financial_correction_applied', true,
              'financial_correction_reason', trim(p_reason),
              'financial_correction_at', v_corrected_at,
              'pdf_regeneration_required', true
            ),
            updated_by = p_actor_user_id,
            updated_at = v_corrected_at
        where organization_id = p_organization_id
          and resident_id = p_resident_id
          and deleted_at is null
          and (
            id = v_payment.invoice_id
            or monthly_fee_record_id = v_fee_record.id
          );
      end if;

      v_correction_record_id := v_fee_record.id;
    else
      v_correction_record_id := v_resident.id;
    end if;
  else
    select greatest(
      0,
      coalesce((
        select sum(amount)
        from public.advance_payment_deposits
        where organization_id = p_organization_id
          and resident_id = p_resident_id
          and status = 'received'
          and deleted_at is null
      ), 0)
      - coalesce((
        select sum(amount)
        from public.advance_payment_allocations
        where organization_id = p_organization_id
          and resident_id = p_resident_id
          and allocation_status = 'applied'
          and deleted_at is null
      ), 0)
      - coalesce((
        select sum(amount)
        from public.advance_payment_refunds
        where organization_id = p_organization_id
          and resident_id = p_resident_id
          and status in ('approved', 'paid')
          and deleted_at is null
      ), 0)
    )::numeric(12,2)
    into v_old_value;

    v_delta := round(v_new_value - v_old_value, 2);

    if v_delta = 0 then
      raise exception 'financial_correction_no_change'
        using errcode = '22023';
    end if;

    if v_delta > 0 then
      insert into public.advance_payment_deposits (
        organization_id,
        hostel_id,
        resident_id,
        amount,
        payment_mode,
        received_date,
        received_by,
        notes,
        status,
        metadata,
        created_by,
        updated_by
      )
      values (
        v_resident.organization_id,
        v_resident.hostel_id,
        v_resident.id,
        v_delta,
        'adjustment'::public.payment_method_enum,
        v_corrected_at::date,
        p_actor_user_id,
        trim(p_reason),
        'received',
        jsonb_build_object(
          'source', 'financial_correction',
          'changeType', p_change_type,
          'oldValue', v_old_value,
          'newValue', v_new_value,
          'delta', v_delta,
          'reason', trim(p_reason)
        ),
        p_actor_user_id,
        p_actor_user_id
      )
      returning id into v_correction_record_id;
    else
      insert into public.advance_payment_refunds (
        organization_id,
        hostel_id,
        resident_id,
        amount,
        reason,
        status,
        requested_by,
        approved_by,
        approved_at,
        paid_by,
        paid_at,
        notes,
        metadata,
        created_by,
        updated_by
      )
      values (
        v_resident.organization_id,
        v_resident.hostel_id,
        v_resident.id,
        abs(v_delta),
        trim(p_reason),
        'paid',
        p_actor_user_id,
        p_actor_user_id,
        v_corrected_at,
        p_actor_user_id,
        v_corrected_at,
        trim(p_reason),
        jsonb_build_object(
          'source', 'financial_correction',
          'changeType', p_change_type,
          'oldValue', v_old_value,
          'newValue', v_new_value,
          'delta', v_delta,
          'reason', trim(p_reason)
        ),
        p_actor_user_id,
        p_actor_user_id
      )
      returning id into v_correction_record_id;

      insert into public.advance_payment_refund_audit_logs (
        organization_id,
        hostel_id,
        resident_id,
        refund_id,
        actor_user_id,
        action,
        old_status,
        new_status,
        notes,
        metadata
      )
      values (
        v_resident.organization_id,
        v_resident.hostel_id,
        v_resident.id,
        v_correction_record_id,
        p_actor_user_id,
        'advance_balance.correction_recorded',
        null,
        'paid',
        trim(p_reason),
        jsonb_build_object(
          'source', 'financial_correction',
          'oldValue', v_old_value,
          'newValue', v_new_value,
          'delta', v_delta
        )
      );
    end if;
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
    metadata,
    created_at,
    updated_at,
    created_by,
    updated_by
  )
  values (
    v_resident.organization_id,
    v_resident.hostel_id,
    p_actor_user_id,
    'residents',
    v_resident.id,
    case
      when p_change_type = 'monthly_fee'
        then 'finance_correction.monthly_fee_updated'
      else 'finance_correction.advance_balance_updated'
    end,
    case
      when p_change_type = 'monthly_fee'
        then jsonb_build_object('monthly_fee_amount', v_old_value)
      else jsonb_build_object('remaining_advance_balance', v_old_value)
    end,
    case
      when p_change_type = 'monthly_fee'
        then jsonb_build_object('monthly_fee_amount', v_new_value)
      else jsonb_build_object('remaining_advance_balance', v_new_value)
    end,
    jsonb_build_object(
      'source', 'financial_correction',
      'residentId', v_resident.id,
      'residentName', v_resident.full_name,
      'changeType', p_change_type,
      'reason', trim(p_reason),
      'delta', v_delta,
      'correctionRecordId', v_correction_record_id,
      'adminName', coalesce(v_admin_name, 'Hostel admin'),
      'adminEmail', v_admin_email
    ),
    v_corrected_at,
    v_corrected_at,
    p_actor_user_id,
    p_actor_user_id
  )
  returning id into v_audit_log_id;

  return jsonb_build_object(
    'residentId', v_resident.id,
    'organizationId', v_resident.organization_id,
    'hostelId', v_resident.hostel_id,
    'changeType', p_change_type,
    'oldValue', v_old_value,
    'newValue', v_new_value,
    'delta', v_delta,
    'reason', trim(p_reason),
    'auditLogId', v_audit_log_id,
    'correctionRecordId', v_correction_record_id,
    'correctedAt', v_corrected_at
  );
end;
$$;

revoke execute on function public.apply_resident_financial_correction_atomic(
  uuid,
  uuid,
  text,
  numeric,
  text,
  uuid
) from public, anon, authenticated;

grant execute on function public.apply_resident_financial_correction_atomic(
  uuid,
  uuid,
  text,
  numeric,
  text,
  uuid
) to service_role;

with latest_corrections as (
  select distinct on (al.organization_id, al.record_id)
    al.organization_id,
    al.record_id as resident_id,
    round((al.new_values ->> 'monthly_fee_amount')::numeric, 2) as corrected_amount,
    al.actor_user_id,
    al.created_at
  from public.audit_logs al
  where al.action = 'finance_correction.monthly_fee_updated'
    and al.record_id is not null
    and al.new_values ? 'monthly_fee_amount'
  order by al.organization_id, al.record_id, al.created_at desc
),
targets as (
  select
    lc.*,
    mfr.id as fee_record_id
  from latest_corrections lc
  join public.residents r
    on r.id = lc.resident_id
   and r.organization_id = lc.organization_id
   and r.deleted_at is null
  join lateral (
    select fee.id
    from public.monthly_fee_records fee
    where fee.organization_id = lc.organization_id
      and fee.resident_id = lc.resident_id
      and fee.deleted_at is null
      and fee.period_month = date_trunc(
        'month',
        coalesce(r.joined_on, r.created_at::date)
      )::date
    order by
      coalesce(
        (fee.metadata ->> 'generated_for_initial_collection')::boolean,
        false
      ) desc,
      fee.created_at asc
    limit 1
  ) mfr on true
),
payment_targets as (
  select
    t.*,
    p.id as payment_id,
    p.invoice_id
  from targets t
  join lateral (
    select payment.id, payment.invoice_id
    from public.payments payment
    where payment.organization_id = t.organization_id
      and payment.resident_id = t.resident_id
      and payment.monthly_fee_record_id = t.fee_record_id
      and payment.status = 'verified'
      and payment.is_advance is false
      and payment.deleted_at is null
    order by
      coalesce((payment.metadata ->> 'first_month_fee')::boolean, false) desc,
      payment.verified_at asc nulls last,
      payment.created_at asc
    limit 1
  ) p on true
),
updated_fees as (
  update public.monthly_fee_records fee
  set base_amount = pt.corrected_amount,
      total_amount = pt.corrected_amount,
      paid_amount = pt.corrected_amount,
      balance_amount = 0,
      status = 'paid'::public.fee_record_status_enum,
      updated_by = pt.actor_user_id,
      updated_at = clock_timestamp()
  from payment_targets pt
  where fee.id = pt.fee_record_id
  returning fee.id
),
updated_payments as (
  update public.payments payment
  set amount = pt.corrected_amount,
      is_partial = false,
      updated_by = pt.actor_user_id,
      updated_at = clock_timestamp()
  from payment_targets pt
  where payment.id = pt.payment_id
  returning payment.id
)
update public.invoices invoice
set subtotal_amount = pt.corrected_amount,
    total_amount = pt.corrected_amount,
    paid_amount = pt.corrected_amount,
    balance_amount = 0,
    status = 'paid'::public.invoice_status_enum,
    metadata = invoice.metadata || jsonb_build_object(
      'financial_correction_applied', true,
      'pdf_regeneration_required', true
    ),
    updated_by = pt.actor_user_id,
    updated_at = clock_timestamp()
from payment_targets pt
where invoice.organization_id = pt.organization_id
  and invoice.resident_id = pt.resident_id
  and invoice.deleted_at is null
  and (
    invoice.id = pt.invoice_id
    or invoice.monthly_fee_record_id = pt.fee_record_id
  );

commit;
