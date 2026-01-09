# Test Lead Qualification Function
# Tests the AI-powered lead qualification with sample leads

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TESTING LEAD QUALIFICATION AGENT" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Get the anon key from Supabase
$SUPABASE_URL = "https://ddwqkkiqgjptguzoeohr.supabase.co"

Write-Host "Note: Get your SUPABASE_ANON_KEY from:" -ForegroundColor Yellow
Write-Host "https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/settings/api`n" -ForegroundColor Yellow

$ANON_KEY = Read-Host "Enter your Supabase anon key"

if (-not $ANON_KEY) {
    Write-Host "❌ No anon key provided. Exiting." -ForegroundColor Red
    exit
}

# Test Case 1: High-Quality Lead
Write-Host "`n--- Test 1: High-Quality Enterprise Lead ---" -ForegroundColor Green

$lead1 = @{
    name = "Sarah Johnson"
    company = "Acme Enterprise Solutions"
    email = "sarah.johnson@acme-ent.com"
    title = "VP of Marketing"
    industry = "B2B SaaS"
    company_size = "500-1000 employees"
    budget = "$50,000/year"
    timeline = "Ready to start in Q1"
    source = "LinkedIn referral"
    notes = "Looking for marketing automation. Currently using legacy systems. Mentioned budget is approved."
} | ConvertTo-Json

try {
    $response1 = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/qualify-lead" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $ANON_KEY"
            "Content-Type" = "application/json"
        } `
        -Body $lead1
    
    Write-Host "✅ Qualification Result:" -ForegroundColor Green
    Write-Host "Score: $($response1.qualification.score)/10" -ForegroundColor Cyan
    Write-Host "Quality: $($response1.qualification.quality)" -ForegroundColor Cyan
    Write-Host "Action: $($response1.qualification.recommended_action)" -ForegroundColor Cyan
    Write-Host "Priority: $($response1.qualification.priority)" -ForegroundColor Cyan
    Write-Host "Reasoning: $($response1.qualification.reasoning)" -ForegroundColor White
    Write-Host "Next Steps: $($response1.qualification.next_steps)`n" -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Case 2: Medium-Quality Lead
Write-Host "`n--- Test 2: Medium-Quality Startup Lead ---" -ForegroundColor Green

$lead2 = @{
    name = "John Doe"
    company = "StartupXYZ"
    email = "john@startupxyz.io"
    title = "Founder"
    industry = "E-commerce"
    company_size = "10-50 employees"
    budget = "Looking for pricing"
    timeline = "Researching options"
    source = "Website form"
    notes = "Just exploring options. No immediate timeline."
} | ConvertTo-Json

try {
    $response2 = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/qualify-lead" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $ANON_KEY"
            "Content-Type" = "application/json"
        } `
        -Body $lead2
    
    Write-Host "✅ Qualification Result:" -ForegroundColor Green
    Write-Host "Score: $($response2.qualification.score)/10" -ForegroundColor Cyan
    Write-Host "Quality: $($response2.qualification.quality)" -ForegroundColor Cyan
    Write-Host "Action: $($response2.qualification.recommended_action)" -ForegroundColor Cyan
    Write-Host "Priority: $($response2.qualification.priority)" -ForegroundColor Cyan
    Write-Host "Reasoning: $($response2.qualification.reasoning)" -ForegroundColor White
    Write-Host "Next Steps: $($response2.qualification.next_steps)`n" -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Case 3: Low-Quality Lead
Write-Host "`n--- Test 3: Low-Quality/Incomplete Lead ---" -ForegroundColor Green

$lead3 = @{
    email = "info@genericcompany.com"
    source = "Cold outreach"
    notes = "Generic inquiry. No specific details provided."
} | ConvertTo-Json

try {
    $response3 = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/qualify-lead" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $ANON_KEY"
            "Content-Type" = "application/json"
        } `
        -Body $lead3
    
    Write-Host "✅ Qualification Result:" -ForegroundColor Green
    Write-Host "Score: $($response3.qualification.score)/10" -ForegroundColor Cyan
    Write-Host "Quality: $($response3.qualification.quality)" -ForegroundColor Cyan
    Write-Host "Action: $($response3.qualification.recommended_action)" -ForegroundColor Cyan
    Write-Host "Priority: $($response3.qualification.priority)" -ForegroundColor Cyan
    Write-Host "Reasoning: $($response3.qualification.reasoning)" -ForegroundColor White
    Write-Host "Next Steps: $($response3.qualification.next_steps)`n" -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TESTING COMPLETE!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Your Lead Qualification Agent is working! 🎉" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Integrate this into your lead capture forms" -ForegroundColor White
Write-Host "2. Auto-route leads based on qualification" -ForegroundColor White
Write-Host "3. Build more agents in Agent Builder" -ForegroundColor White
Write-Host "4. Check the dashboard: https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/functions`n" -ForegroundColor White

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
