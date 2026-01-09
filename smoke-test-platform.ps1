# Platform Stability Smoke Test
# Tests 4 critical flows: Auth + Tenant, AI Chat, Onboarding, Campaign Create

param(
    [Parameter(Mandatory=$true)]
    [string]$Email,
    
    [Parameter(Mandatory=$true)]
    [string]$Password,
    
    [string]$ProjectUrl = $env:VITE_SUPABASE_URL,
    [string]$AnonKey = $env:VITE_SUPABASE_PUBLISHABLE_KEY
)

$ErrorActionPreference = "Stop"

if (-not $ProjectUrl -or -not $AnonKey) {
    Write-Host "ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set" -ForegroundColor Red
    exit 1
}

$passed = 0
$failed = 0

function Test-Flow {
    param([string]$Name, [scriptblock]$Test)
    Write-Host "`n[$Name]" -ForegroundColor Yellow
    try {
        & $Test
        Write-Host "  ✓ PASS" -ForegroundColor Green
        $script:passed++
    } catch {
        Write-Host "  ✗ FAIL: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails) {
            Write-Host "  Details: $($_.ErrorDetails.Message)" -ForegroundColor DarkRed
        }
        $script:failed++
    }
}

Write-Host "=== PLATFORM STABILITY SMOKE TEST ===" -ForegroundColor Cyan
Write-Host "Project: $ProjectUrl" -ForegroundColor Gray
Write-Host "Testing 4 critical flows..." -ForegroundColor Gray

# ====================
# FLOW 1: Auth + Tenant Resolution
# ====================
Test-Flow "1. Auth + Tenant Resolution" {
    $authBody = @{
        email = $Email
        password = $Password
    } | ConvertTo-Json

    $authResponse = Invoke-RestMethod -Uri "$ProjectUrl/auth/v1/token?grant_type=password" `
        -Method POST `
        -Headers @{
            "apikey" = $AnonKey
            "Content-Type" = "application/json"
        } `
        -Body $authBody

    $script:accessToken = $authResponse.access_token
    $script:userId = $authResponse.user.id
    Write-Host "    User ID: $($script:userId)" -ForegroundColor DarkGray

    # Get workspace/tenant
    $workspaceResponse = Invoke-RestMethod -Uri "$ProjectUrl/rest/v1/workspaces?select=id,tenant_id&owner_id=eq.$($script:userId)&limit=1" `
        -Method GET `
        -Headers @{
            "apikey" = $AnonKey
            "Authorization" = "Bearer $($script:accessToken)"
        }

    if ($workspaceResponse.Count -eq 0) {
        throw "No workspace found for user"
    }

    $script:workspaceId = $workspaceResponse[0].id
    $script:tenantId = $workspaceResponse[0].tenant_id
    Write-Host "    Workspace ID: $($script:workspaceId)" -ForegroundColor DarkGray
    Write-Host "    Tenant ID: $($script:tenantId)" -ForegroundColor DarkGray
}

# ====================
# FLOW 2: AI Chat (Quick Actions)
# ====================
Test-Flow "2. AI Chat (Quick Actions)" {
    if (-not $script:accessToken) { throw "Auth flow must pass first" }

    $chatBody = @{
        messages = @(
            @{
                role = "user"
                content = "What is my industry?"
            }
        )
        context = @{
            businessName = "Test Co"
            industry = "Technology"
            currentRoute = "/dashboard"
            leadCount = 0
            campaignCount = 0
            modulesEnabled = @()
            icpSegments = @()
            workspaceId = $script:workspaceId
        }
    } | ConvertTo-Json -Depth 10

    $response = Invoke-WebRequest -Uri "$ProjectUrl/functions/v1/ai-chat" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $($script:accessToken)"
            "apikey" = $AnonKey
            "Content-Type" = "application/json"
        } `
        -Body $chatBody

    if ($response.StatusCode -ne 200) {
        throw "HTTP $($response.StatusCode)"
    }

    if ($response.Headers['Content-Type'] -notmatch 'text/event-stream') {
        throw "Expected streaming response, got $($response.Headers['Content-Type'])"
    }

    Write-Host "    Streaming response received" -ForegroundColor DarkGray
}

# ====================
# FLOW 3: Onboarding Assistant
# ====================
Test-Flow "3. Onboarding Assistant" {
    if (-not $script:accessToken) { throw "Auth flow must pass first" }

    $onboardingBody = @{
        messages = @()
        userName = $Email.Split('@')[0]
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$ProjectUrl/functions/v1/onboarding-assistant" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $($script:accessToken)"
            "apikey" = $AnonKey
            "Content-Type" = "application/json"
        } `
        -Body $onboardingBody

    if ($response.StatusCode -ne 200) {
        throw "HTTP $($response.StatusCode)"
    }

    if ($response.Headers['Content-Type'] -notmatch 'text/event-stream') {
        throw "Expected streaming response, got $($response.Headers['Content-Type'])"
    }

    Write-Host "    Streaming response received" -ForegroundColor DarkGray
}

# ====================
# FLOW 4: Campaign Create (Autopilot)
# ====================
Test-Flow "4. Campaign Create (Autopilot)" {
    if (-not $script:accessToken -or -not $script:tenantId) { 
        throw "Auth and tenant resolution must pass first" 
    }

    # Call via cmo-kernel -> cmo-campaign-builder
    $campaignBody = @{
        mode = "campaign-builder"
        tenant_id = $script:tenantId
        workspace_id = $script:workspaceId
        payload = @{
            icp = "B2B SaaS founders looking for marketing automation"
            offer = "AI-powered marketing platform that creates and deploys campaigns in minutes"
            channels = @("email")
            desired_result = "leads"
        }
    } | ConvertTo-Json -Depth 10

    $response = Invoke-RestMethod -Uri "$ProjectUrl/functions/v1/cmo-kernel" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $($script:accessToken)"
            "apikey" = $AnonKey
            "Content-Type" = "application/json"
        } `
        -Body $campaignBody

    if (-not $response.campaign_id) {
        throw "Response missing campaign_id. Got: $($response | ConvertTo-Json -Compress)"
    }

    Write-Host "    Campaign ID: $($response.campaign_id)" -ForegroundColor DarkGray
    Write-Host "    Campaign Name: $($response.campaign_name)" -ForegroundColor DarkGray
}

# ====================
# SUMMARY
# ====================
Write-Host "`n====================" -ForegroundColor Cyan
if ($failed -eq 0) {
    Write-Host "✓ ALL $passed FLOWS PASSED" -ForegroundColor Green
    Write-Host "Platform is stable on new database" -ForegroundColor Green
    exit 0
} else {
    Write-Host "✗ $failed/$($passed + $failed) FLOWS FAILED" -ForegroundColor Red
    Write-Host "Platform needs fixes before deployment" -ForegroundColor Red
    exit 1
}
