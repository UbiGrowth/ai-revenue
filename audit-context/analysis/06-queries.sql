-- Re-run before any fix lands to confirm nothing is mid-flight.
-- Project: ddwqkkiqgjptguzoeohr (AI Revenue). Read-only.

-- 1) In-flight / non-terminal work
select 'channel_outbox' tbl, status, count(*) from channel_outbox group by status
union all select 'job_queue', status, count(*) from job_queue group by status
union all select 'outbound_sequence_runs', status, count(*) from outbound_sequence_runs group by status
union all select 'sequence_enrollments', status, count(*) from sequence_enrollments group by status
union all select 'campaigns', status, count(*) from campaigns group by status
order by tbl, status;

-- 2) Kernel events that never reached a terminal state (NOTE: verify a status column exists first)
-- select count(*) from kernel_events;  -- table has no status/processed_at column per live schema

-- 3) Which tables carry tenant_id vs workspace_id (canonical-column source of truth)
select t.table_name,
  bool_or(c.column_name='tenant_id')    as has_tenant_id,
  bool_or(c.column_name='workspace_id') as has_workspace_id
from information_schema.tables t
join information_schema.columns c using (table_schema, table_name)
where t.table_schema='public' and t.table_type='BASE TABLE'
group by t.table_name
having bool_or(c.column_name in ('tenant_id','workspace_id'))
order by 2 desc, 3 desc, 1;
