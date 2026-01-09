# UbiGrowth AI CMO - Release Readiness Smoke Test Suite
# Run this script to verify all critical functionality works after deployment

param(
    [string]$ProjectUrl = "https://ddwqkkiqgjptguzoeohr.supabase.co",
    [string]$WorkspaceId = "",
    [switch]$Verbose
)

Write-Host "🧪 UbiGrowth AI CMO - Smoke Test Suite" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$results = @()
$passCount = 0
$failCount = 0

function Test-Function {
    param(
        [string]$Name,
        [string]$FunctionName,
        [hashtable]$Body = @{},
        [string]$ExpectedStatus = "200"
    )
    
    Write-Host "Testing: $Name..." -NoNewline
    
    try {
        # Get session token from environment or local storage simulation
        $token = $env:SUPABASE_USER_TOKEN
        if (-not $token) {
            Write-Host " ⚠️  SKIP (No auth token set)" -ForegroundColor Yellow
            $script:results += @{Name=$Name; Status="SKIP"; Reason="No auth token"}
            return
        }

        $headers = @{
            "Authorization" = "Bearer $token"
            "apikey" = $env:SUPABASE_ANON_KEY
            "Content-Type" = "application/json"
        }

        $url = "$ProjectUrl/functions/v1/$FunctionName"
        $bodyJson = $Body | ConvertTo-Json -Depth 10

        $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $bodyJson -ErrorAction Stop

        Write-Host " ✅ PASS" -ForegroundColor Green
        $script:results += @{Name=$Name; Status="PASS"; Response=$response}
        $script:passCount++
        
        if ($Verbose) {
            Write-Host "   Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
        }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host " ❌ FAIL ($statusCode)" -ForegroundColor Red
        
        $errorBody = ""
        if ($_.ErrorDetails.Message) {
            $errorBody = $_.ErrorDetails.Message
            if ($Verbose) {
                Write-Host "   Error: $errorBody" -ForegroundColor Red
            }
        }
        
        $script:results += @{Name=$Name; Status="FAIL"; Error=$errorBody; StatusCode=$statusCode}
        $script:failCount++
    }
}

# ============================================
# P0 TESTS: Auth & Tenant Resolution
# ============================================
Write-Host "`n📋 P0: Auth & Tenant Resolution" -ForegroundColor Yellow
Write-Host "-----------------------------------"

Test-Function -Name "Sync Campaign Metrics" -FunctionName "sync-campaign-metrics" -Body @{}

# ============================================
# P1 TESTS: Campaign Creation
# ============================================
Write-Host "`n📋 P1: Campaign Creation" -ForegroundColor Yellow
Write-Host "-----------------------------------"

if ($WorkspaceId) {
    Test-Function -Name "Autopilot Campaign Build" -FunctionName "ai-cmo-autopilot-build" -Body @{
        workspace_id = $WorkspaceId
        icp = "Small businesses in healthcare"
        offer = "Automated marketing platform"
        channels = @("email", "voice")
        desiredResult = "leads"
    }
}

# ============================================
# P1 TESTS: AI Quick Actions
# ============================================
Write-Host "`n📋 P1: AI Quick Actions" -ForegroundColor Yellow
Write-Host "-----------------------------------"

Test-Function -Name "AI Chat" -FunctionName "ai-chat" -Body @{
    messages = @(
        @{role="user"; content="Give me 3 creative campaign ideas for my business"}
    )
    context = @{
        businessName = "Test Business"
        industry = "Technology"
        currentRoute = "/dashboard"
        leadCount = 10
        campaignCount = 5
    }
}

Test-Function -Name "Lead Qualification" -FunctionName "qualify-lead" -Body @{
    name = "John Doe"
    company = "Acme Corp"
    email = "john@acme.com"
    title = "CTO"
    industry = "Technology"
}

# ============================================
# P1 TESTS: External API Functions
# ============================================
Write-Host "`n📋 P1: External API Integrations" -ForegroundColor Yellow
Write-Host "-----------------------------------"

Test-Function -Name "Test OpenAI" -FunctionName "test-openai" -Body @{}

Test-Function -Name "ElevenLabs List Agents" -FunctionName "elevenlabs-list-agents" -Body @{}

Test-Function -Name "Voice Health Check" -FunctionName "voice-health-check" -Body @{}

# ============================================
# RESULTS SUMMARY
# ============================================
Write-Host "`n" 
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📊 SMOKE TEST RESULTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Passed: $passCount" -ForegroundColor Green
Write-Host "❌ Failed: $failCount" -ForegroundColor Red
Write-Host "⚠️  Skipped: $($results | Where-Object {$_.Status -eq 'SKIP'} | Measure-Object | Select-Object -ExpandProperty Count)" -ForegroundColor Yellow
Write-Host ""

if ($failCount -eq 0 -and $passCount -gt 0) {
    Write-Host "🎉 ALL TESTS PASSED!" -ForegroundColor Green
    exit 0
} elseif ($failCount -gt 0) {
    Write-Host "⚠️  SOME TESTS FAILED - Review errors above" -ForegroundColor Red
    Write-Host ""
    Write-Host "Failed tests:" -ForegroundColor Red
    $results | Where-Object {$_.Status -eq "FAIL"} | ForEach-Object {
        Write-Host "  - $($_.Name): $($_.Error)" -ForegroundColor Red
    }
    exit 1
} else {
    Write-Host "⚠️  NO TESTS RUN - Set auth token first:" -ForegroundColor Yellow
    Write-Host '  $env:SUPABASE_USER_TOKEN = "your-jwt-token"' -ForegroundColor Gray
    Write-Host '  $env:SUPABASE_ANON_KEY = "your-anon-key"' -ForegroundColor Gray
    exit 2
}
