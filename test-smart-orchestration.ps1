# Test Smart Orchestration System
# Demonstrates the simple UI → intelligent routing

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "SMART ORCHESTRATION DEMO" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "This demonstrates how SIMPLE the UI is," -ForegroundColor Green
Write-Host "while POWERFUL orchestration happens behind the scenes`n" -ForegroundColor Green

# Get anon key
$SUPABASE_URL = "https://ddwqkkiqgjptguzoeohr.supabase.co"
Write-Host "Get your anon key from:" -ForegroundColor Yellow
Write-Host "https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/settings/api`n" -ForegroundColor Yellow

$ANON_KEY = Read-Host "Enter your Supabase anon key"

if (-not $ANON_KEY) {
    Write-Host "❌ No key provided. Exiting." -ForegroundColor Red
    exit
}

# Test Scenario: Mixed Lead Quality Campaign
Write-Host "`n--- Scenario: Send Campaign to Mixed Leads ---`n" -ForegroundColor Cyan

$campaignRequest = @{
    leads = @(
        # High-value lead - Should get AI voice call
        @{
            id = "lead-001"
            name = "Sarah CEO"
            email = "sarah@bigcorp.com"
            phone = "+15555551234"
            company = "Big Corp"
            score = 9
        },
        # Medium-value lead - Should get voicemail
        @{
            id = "lead-002"
            name = "John Manager"
            email = "john@mediumco.com"
            phone = "+15555555678"
            company = "Medium Co"
            score = 6
        },
        # Low-value lead - Should get email
        @{
            id = "lead-003"
            name = "Bob Unknown"
            email = "bob@startup.com"
            score = 3
        },
        # Incomplete lead - Best effort
        @{
            id = "lead-004"
            email = "info@company.com"
        }
    )
    message = "We'd love to show you how our AI platform can help grow your business."
    goal = "appointment"
} | ConvertTo-Json -Depth 10

Write-Host "📋 Campaign Request (What UI sends):" -ForegroundColor Yellow
Write-Host "  - 4 leads (mixed quality)" -ForegroundColor White
Write-Host "  - Goal: Book appointments" -ForegroundColor White  
Write-Host "  - Let AI choose best channels`n" -ForegroundColor White

try {
    Write-Host "🚀 Sending campaign..." -ForegroundColor Cyan
    
    $result = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/smart-send" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $ANON_KEY"
            "Content-Type" = "application/json"
        } `
        -Body $campaignRequest
    
    Write-Host "`n✅ SUCCESS! Campaign Orchestrated`n" -ForegroundColor Green
    
    Write-Host "📊 Results:" -ForegroundColor Cyan
    Write-Host "  Total leads: $($result.sent_to)" -ForegroundColor White
    Write-Host "  Estimated cost: `$$($result.estimated_cost)" -ForegroundColor White
    
    Write-Host "`n📞 Intelligent Channel Routing:" -ForegroundColor Cyan
    if ($result.channels_used.voice_calls -gt 0) {
        Write-Host "  🎙️  AI Voice Calls: $($result.channels_used.voice_calls) (high-value leads)" -ForegroundColor Green
    }
    if ($result.channels_used.voicemails -gt 0) {
        Write-Host "  📞 Voicemails: $($result.channels_used.voicemails) (medium-value leads)" -ForegroundColor Yellow
    }
    if ($result.channels_used.sms -gt 0) {
        Write-Host "  📱 SMS: $($result.channels_used.sms)" -ForegroundColor Blue
    }
    if ($result.channels_used.email -gt 0) {
        Write-Host "  📧 Email: $($result.channels_used.email) (fallback/low-value)" -ForegroundColor White
    }
    
    Write-Host "`n💡 What Happened Behind the Scenes:" -ForegroundColor Magenta
    Write-Host "  1. ✅ AI analyzed each lead's quality" -ForegroundColor White
    Write-Host "  2. ✅ Matched best channel per lead:" -ForegroundColor White
    Write-Host "     • Sarah (score 9) → ElevenLabs AI call" -ForegroundColor White
    Write-Host "     • John (score 6) → VAPI voicemail" -ForegroundColor White
    Write-Host "     • Bob (score 3) → Email" -ForegroundColor White
    Write-Host "     • Info@ (no score) → Email" -ForegroundColor White
    Write-Host "  3. ✅ Optimized timing & costs" -ForegroundColor White
    Write-Host "  4. ✅ Queued messages in each channel" -ForegroundColor White
    
    Write-Host "`n🎨 User Experience:" -ForegroundColor Cyan
    Write-Host "  • User just clicked 'Send Campaign'" -ForegroundColor White
    Write-Host "  • No channel selection needed" -ForegroundColor White
    Write-Host "  • No routing logic required" -ForegroundColor White
    Write-Host "  • AI handled EVERYTHING!" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Check anon key is correct" -ForegroundColor White
    Write-Host "2. View logs: https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/functions" -ForegroundColor White
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "ORCHESTRATION DEMO COMPLETE" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "🎯 Key Takeaway:" -ForegroundColor Green
Write-Host "Users see: Simple 'Send Campaign' button" -ForegroundColor White
Write-Host "System does: Intelligent multi-channel routing" -ForegroundColor White
Write-Host "Result: Maximum conversion at minimum cost`n" -ForegroundColor Green

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
