# Diagnose Voice Agents Auto-Provisioning
# Quick check to see what's happening

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VOICE AGENTS DIAGNOSTICS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check 1: Browser Console
Write-Host "[ACTION REQUIRED] Check Browser Console" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Press F12 to open DevTools" -ForegroundColor White
Write-Host "2. Click 'Console' tab" -ForegroundColor White
Write-Host "3. Look for:" -ForegroundColor White
Write-Host "   - Any RED errors" -ForegroundColor Red
Write-Host "   - Messages about 'auto-provisioning'" -ForegroundColor Gray
Write-Host "   - Messages about 'voice_agents'" -ForegroundColor Gray
Write-Host ""
Write-Host "Please share what you see in the console!" -ForegroundColor Yellow
Write-Host ""

# Check 2: Network Tab
Write-Host "[ACTION REQUIRED] Check Network Activity" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. In DevTools (F12), click 'Network' tab" -ForegroundColor White
Write-Host "2. Refresh the page (Ctrl+R)" -ForegroundColor White
Write-Host "3. Look for:" -ForegroundColor White
Write-Host "   - 'elevenlabs-auto-provision' request" -ForegroundColor Gray
Write-Host "   - 'elevenlabs-list-agents' request" -ForegroundColor Gray
Write-Host "   - Any RED/failed requests" -ForegroundColor Red
Write-Host ""
Write-Host "Do you see these requests being made?" -ForegroundColor Yellow
Write-Host ""

# Check 3: What does the UI show?
Write-Host "[QUESTION] What do you see on the page?" -ForegroundColor Yellow
Write-Host ""
Write-Host "A. Loading spinner?" -ForegroundColor White
Write-Host "B. Empty state / 'No agents' message?" -ForegroundColor White
Write-Host "C. Error message?" -ForegroundColor White
Write-Host "D. Just blank/empty?" -ForegroundColor White
Write-Host ""
Write-Host "Please describe what the page looks like!" -ForegroundColor Yellow
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  QUICK MANUAL TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Let's manually trigger agent creation to see if it works:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Go to: https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/functions" -ForegroundColor White
Write-Host ""
Write-Host "2. Click: 'elevenlabs-list-agents'" -ForegroundColor White
Write-Host ""
Write-Host "3. Click: 'Invoke Function'" -ForegroundColor White
Write-Host ""
Write-Host "4. Body: {}" -ForegroundColor White
Write-Host ""
Write-Host "5. Click: 'Invoke'" -ForegroundColor White
Write-Host ""
Write-Host "What response do you get?" -ForegroundColor Yellow
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
