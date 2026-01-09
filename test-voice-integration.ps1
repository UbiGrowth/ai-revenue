# Quick Test: ElevenLabs Integration
# Tests that VAPI is removed and ElevenLabs is working

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TESTING ELEVENLABS VOICE INTEGRATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$PROJECT_REF = "ddwqkkiqgjptguzoeohr"

# Test 1: Check if dev server is running
Write-Host "[TEST 1] Checking if dev server is running..." -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    Write-Host "SUCCESS: Dev server is running on http://localhost:8080" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "INFO: Dev server not running. Starting it now..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Run this command in a new terminal:" -ForegroundColor Cyan
    Write-Host "  npm run dev" -ForegroundColor White
    Write-Host ""
    Write-Host "Then open: http://localhost:8080/voice-agents" -ForegroundColor Cyan
    Write-Host ""
}

# Test 2: List deployed functions
Write-Host "[TEST 2] Checking deployed ElevenLabs functions..." -ForegroundColor Yellow
Write-Host ""

Write-Host "Running: supabase functions list | Select-String 'elevenlabs'" -ForegroundColor Gray
Write-Host ""

$functions = supabase functions list 2>&1 | Select-String "elevenlabs"

if ($functions) {
    Write-Host "SUCCESS: ElevenLabs functions are deployed:" -ForegroundColor Green
    $functions | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
    Write-Host ""
} else {
    Write-Host "ERROR: ElevenLabs functions not found" -ForegroundColor Red
    Write-Host ""
}

# Test 3: Instructions for browser test
Write-Host "[TEST 3] Test in Supabase Dashboard..." -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Go to: https://supabase.com/dashboard/project/$PROJECT_REF/functions" -ForegroundColor White
Write-Host "2. Click on 'elevenlabs-list-agents'" -ForegroundColor White
Write-Host "3. Click 'Invoke Function'" -ForegroundColor White
Write-Host "4. Body: {}" -ForegroundColor White
Write-Host "5. Click 'Invoke'" -ForegroundColor White
Write-Host ""
Write-Host "Expected result:" -ForegroundColor Cyan
Write-Host '  {"success": true, "agents": [...]}' -ForegroundColor Gray
Write-Host ""

# Test 4: Voice Agents UI test
Write-Host "[TEST 4] Test Voice Agents UI..." -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Make sure dev server is running: npm run dev" -ForegroundColor White
Write-Host "2. Open: http://localhost:8080/voice-agents" -ForegroundColor White
Write-Host ""
Write-Host "What you should see:" -ForegroundColor Cyan
Write-Host "  - Page loads (no VAPI error)" -ForegroundColor Green
Write-Host "  - ElevenLabs agents display (if you have any)" -ForegroundColor Green
Write-Host "  - No 'VAPI not configured' message" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  NEXT STEPS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If you don't have ElevenLabs agents yet:" -ForegroundColor Yellow
Write-Host "  1. Go to: https://elevenlabs.io/app/conversational-ai" -ForegroundColor White
Write-Host "  2. Create a new agent" -ForegroundColor White
Write-Host "  3. Configure voice and greeting" -ForegroundColor White
Write-Host "  4. Refresh Voice Agents UI" -ForegroundColor White
Write-Host ""
Write-Host "To cancel VAPI subscription:" -ForegroundColor Yellow
Write-Host "  1. Go to: https://dashboard.vapi.ai/" -ForegroundColor White
Write-Host "  2. Sign in: bill@ubigrowth.com" -ForegroundColor White
Write-Host "  3. Settings > Billing > Cancel Subscription" -ForegroundColor White
Write-Host "  4. Save: ~$50-100/month" -ForegroundColor Green
Write-Host ""
Write-Host "Documentation: REMOVE_VAPI_GUIDE.md" -ForegroundColor Cyan
Write-Host ""
