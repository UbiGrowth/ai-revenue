# AI Features Smoke Test
# Tests both onboarding assistant and AI chat with proper authentication

param(
    [string]$Email,
    [string]$Password,
    [string]$ProjectUrl = $env:VITE_SUPABASE_URL,
    [string]$AnonKey = $env:VITE_SUPABASE_PUBLISHABLE_KEY
)

if (-not $ProjectUrl -or -not $AnonKey) {
    Write-Host "ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set" -ForegroundColor Red
    Write-Host "Usage: .\test-ai-features.ps1 -Email 'user@example.com' -Password 'password'" -ForegroundColor Yellow
    exit 1
}

if (-not $Email -or -not $Password) {
    Write-Host "ERROR: Email and Password are required" -ForegroundColor Red
    Write-Host "Usage: .\test-ai-features.ps1 -Email 'user@example.com' -Password 'password'" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n=== AI Features Smoke Test ===" -ForegroundColor Cyan
Write-Host "Project: $ProjectUrl" -ForegroundColor Gray

# Step 1: Authenticate
Write-Host "`n[1/3] Authenticating..." -ForegroundColor Yellow
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
    -Body $authBody `
    -ErrorAction Stop

$accessToken = $authResponse.access_token
$userName = $authResponse.user.email.Split('@')[0]
Write-Host "✓ Authenticated as $userName" -ForegroundColor Green

# Step 2: Test Onboarding Assistant
Write-Host "`n[2/3] Testing Onboarding Assistant..." -ForegroundColor Yellow
$onboardingBody = @{
    messages = @()
    userName = $userName
} | ConvertTo-Json

try {
    $onboardingUrl = "$ProjectUrl/functions/v1/onboarding-assistant"
    Write-Host "  URL: $onboardingUrl" -ForegroundColor Gray
    
    # Use WebRequest to handle streaming response
    $response = Invoke-WebRequest -Uri $onboardingUrl `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $accessToken"
            "apikey" = $AnonKey
            "Content-Type" = "application/json"
        } `
        -Body $onboardingBody `
        -ErrorAction Stop

    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Onboarding Assistant: 200 OK" -ForegroundColor Green
        Write-Host "  Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Gray
        $contentPreview = ($response.Content -split "`n" | Select-Object -First 3) -join "`n  "
        Write-Host "  Preview:" -ForegroundColor Gray
        Write-Host "  $contentPreview" -ForegroundColor DarkGray
    } else {
        Write-Host "✗ Onboarding Assistant: $($response.StatusCode)" -ForegroundColor Red
        Write-Host $response.Content
        exit 1
    }
} catch {
    Write-Host "✗ Onboarding Assistant FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Host $reader.ReadToEnd() -ForegroundColor Red
    }
    exit 1
}

# Step 3: Test AI Chat
Write-Host "`n[3/3] Testing AI Chat..." -ForegroundColor Yellow
$chatBody = @{
    messages = @(
        @{
            role = "user"
            content = "What is my industry?"
        }
    )
    context = @{
        businessName = "Test Business"
        industry = "Technology"
        currentRoute = "/test"
        leadCount = 0
        campaignCount = 0
        modulesEnabled = @()
        icpSegments = @()
    }
} | ConvertTo-Json -Depth 10

try {
    $chatUrl = "$ProjectUrl/functions/v1/ai-chat"
    Write-Host "  URL: $chatUrl" -ForegroundColor Gray
    
    $response = Invoke-WebRequest -Uri $chatUrl `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $accessToken"
            "apikey" = $AnonKey
            "Content-Type" = "application/json"
        } `
        -Body $chatBody `
        -ErrorAction Stop

    if ($response.StatusCode -eq 200) {
        Write-Host "✓ AI Chat: 200 OK" -ForegroundColor Green
        Write-Host "  Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Gray
        $contentPreview = ($response.Content -split "`n" | Select-Object -First 3) -join "`n  "
        Write-Host "  Preview:" -ForegroundColor Gray
        Write-Host "  $contentPreview" -ForegroundColor DarkGray
    } else {
        Write-Host "✗ AI Chat: $($response.StatusCode)" -ForegroundColor Red
        Write-Host $response.Content
        exit 1
    }
} catch {
    Write-Host "✗ AI Chat FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Host $reader.ReadToEnd() -ForegroundColor Red
    }
    exit 1
}

Write-Host "`n=== ✓ ALL TESTS PASSED ===" -ForegroundColor Green
Write-Host "Both AI features are working correctly with authentication" -ForegroundColor Green
exit 0
