-- Simple lead check - all info in one query
SELECT 
  l.id,
  l.first_name || ' ' || l.last_name as name,
  l.email,
  l.company,
  l.workspace_id,
  w.name as workspace_name
FROM leads l
LEFT JOIN workspaces w ON l.workspace_id = w.id
WHERE l.id IN (
  '58fcdf13-6156-498b-bf2d-70211d2506c5',
  'b17b1ea5-4dd1-49b0-bbbe-b1d95af6f699',
  '0576457f-f803-4e95-8cab-16877e26ca0e',
  '5bda55fc-af7f-439e-9ba8-02b906a157f4',
  '11b9d662-aaab-4c1b-828c-2ba3b6829d0c',
  'c495afa3-eb01-4e7f-9719-7343e526a073'
)
ORDER BY l.created_at;

