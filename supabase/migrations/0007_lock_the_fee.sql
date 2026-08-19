-- ===========================================================================
-- Vouch — the fee is set by the platform, not by the employer
--
-- THE HOLE
-- The trigger that works out a job's fee only filled it in when it arrived
-- empty. Anything the caller sent was kept. Since an employer may legitimately
-- create jobs for their own company, an employer could post a salaried role
-- (a $2,000 fee) carrying a fee of one cent — and the price would be frozen
-- at one cent for the life of that job.
--
-- Nothing in the app sends those columns, so nobody reached this by clicking.
-- It was reachable by anyone talking to the API directly with their own login.
--
-- THE FIX
-- The fee is always computed from the pay type, whatever the caller sent,
-- unless the change comes from Vouch's own server code — which is what makes
-- a deliberate override (a negotiated rate, say) still possible.
--
-- Found by a test that tried to post a $2,000 role for a cent.
-- ===========================================================================

begin;

create or replace function public.set_job_fee_snapshot()
returns trigger
language plpgsql
as $$
declare
  -- service_role = our own server; postgres = the SQL editor. Anything else
  -- is an ordinary logged-in person and doesn't get to name its own price.
  v_trusted boolean := current_user in ('service_role', 'postgres');
begin
  -- The tier follows the pay type. Only trusted callers may override it.
  if not (v_trusted and new.tier_overridden) then
    new.fee_tier := case new.pay_type
                      when 'hourly'   then 'tier_1'::public.fee_tier
                      when 'salaried' then 'tier_2'::public.fee_tier
                    end;
    new.tier_overridden := false;
  end if;

  -- The amount follows the tier. A caller-supplied amount is only honoured
  -- when it comes from our own server.
  if new.fee_amount_cents is null or not v_trusted then
    new.fee_amount_cents := case new.fee_tier
                              when 'tier_1' then public.platform_setting_int('fee_tier_1_cents', 50000)
                              when 'tier_2' then public.platform_setting_int('fee_tier_2_cents', 200000)
                            end;
  end if;

  if new.voucher_share_bps is null or not v_trusted then
    new.voucher_share_bps := public.platform_setting_int('voucher_share_bps', 5000);
  end if;

  return new;
end;
$$;

commit;
