# Quick script to help get workspace ID for manual agent creation

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  GET WORKSPACE ID" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "METHOD 1: From Browser Console" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. On the Voice Agents page, press F12" -ForegroundColor White
Write-Host "2. Click 'Console' tab" -ForegroundColor White
Write-Host "3. Type this and press Enter:" -ForegroundColor White
Write-Host ""
Write-Host "   localStorage.getItem('sb-ddwqkkiqgjptguzoeohr-auth-token')" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Look for 'workspace_id' in the output" -ForegroundColor White
Write-Host ""

Write-Host "METHOD 2: Check URL or UI" -ForegroundColor Yellow
Write-Host ""
Write-Host "Look in the top navigation bar for a workspace selector dropdown" -ForegroundColor White
Write-Host "The workspace name should be visible" -ForegroundColor White
Write-Host ""

Write-Host "METHOD 3: Query Database" -ForegroundColor Yellow
Write-Host ""
Write-Host "Go to: https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/editor" -ForegroundColor White
Write-Host ""
Write-Host "Run this SQL query:" -ForegroundColor White
Write-Host ""
Write-Host "SELECT id, name FROM workspaces ORDER BY created_at DESC LIMIT 5;" -ForegroundColor Cyan
Write-Host ""
Write-Host "Copy the 'id' value" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ONCE YOU HAVE THE WORKSPACE ID" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Go to: https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/functions" -ForegroundColor White
Write-Host ""
Write-Host "2. Click: elevenlabs-auto-provision" -ForegroundColor White
Write-Host ""
Write-Host "3. Click: 'Invoke Function'" -ForegroundColor White
Write-Host ""
Write-Host "4. Body:" -ForegroundColor White
Write-Host '   {"workspace_id": "your-workspace-id-here"}' -ForegroundColor Cyan
Write-Host ""
Write-Host "5. Click: 'Invoke'" -ForegroundColor White
Write-Host ""
Write-Host "6. Wait 3-5 seconds" -ForegroundColor White
Write-Host ""
Write-Host "7. Refresh Voice Agents page" -ForegroundColor White
Write-Host ""
Write-Host "8. You should see 3 agents!" -ForegroundColor Green
Write-Host ""
