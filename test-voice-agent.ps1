# Test Voice Agent - Make a Test Call with ElevenLabs
# Usage: .\test-voice-agent.ps1

Write-Host "🎯 Testing ElevenLabs Voice Agent..." -ForegroundColor Cyan
Write-Host ""

# Get your workspace ID
$workspaceId = Read-Host "Enter your workspace_id (or press Enter to use default)"
if ([string]::IsNullOrWhiteSpace($workspaceId)) {
    $workspaceId = "replace-with-your-workspace-id"
}

# Get test phone number
$phoneNumber = Read-Host "Enter a test phone number (e.g., +1234567890)"
if ([string]::IsNullOrWhiteSpace($phoneNumber)) {
    Write-Host "❌ Phone number is required!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 Step 1: Listing your agents..." -ForegroundColor Yellow

try {
    $listResponse = Invoke-RestMethod `
        -Uri "https://ddwqkkiqgjptguzoeohr.supabase.co/functions/v1/elevenlabs-list-agents" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkd3Fra2lxZ2pwdGd1em9lb2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3NjkzMDEsImV4cCI6MjA1MTM0NTMwMX0.b5H5aKI0EQRMcE3v4CQxYs7F8cNVX7Tq0x6tEzRjLzM"
            "Content-Type" = "application/json"
        }

    if ($listResponse.success -and $listResponse.agents.Count -gt 0) {
        Write-Host "✅ Found $($listResponse.agents.Count) agents:" -ForegroundColor Green
        $listResponse.agents | ForEach-Object -Begin { $i = 1 } -Process {
            Write-Host "  $i. $($_.name) (ID: $($_.agent_id))" -ForegroundColor White
            $i++
        }
        
        $agentId = $listResponse.agents[0].agent_id
        $agentName = $listResponse.agents[0].name
        
        Write-Host ""
        Write-Host "📞 Step 2: Making test call with '$agentName'..." -ForegroundColor Yellow
        Write-Host "   Calling: $phoneNumber" -ForegroundColor Cyan
        
        $callBody = @{
            agent_id = $agentId
            phone_number = $phoneNumber
        } | ConvertTo-Json

        $callResponse = Invoke-RestMethod `
            -Uri "https://ddwqkkiqgjptguzoeohr.supabase.co/functions/v1/elevenlabs-make-call" `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkd3Fra2lxZ2pwdGd1em9lb2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3NjkzMDEsImV4cCI6MjA1MTM0NTMwMX0.b5H5aKI0EQRMcE3v4CQxYs7F8cNVX7Tq0x6tEzRjLzM"
                "Content-Type" = "application/json"
            } `
            -Body $callBody

        Write-Host ""
        if ($callResponse.success) {
            Write-Host "🎉 SUCCESS! Call initiated!" -ForegroundColor Green
            Write-Host "   Call ID: $($callResponse.call_id)" -ForegroundColor White
            Write-Host "   Status: $($callResponse.status)" -ForegroundColor White
            Write-Host ""
            Write-Host "📱 Your phone should ring shortly!" -ForegroundColor Cyan
        } else {
            Write-Host "⚠️ Call response: $($callResponse | ConvertTo-Json -Depth 5)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ No agents found. Run auto-provision first!" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Test complete!" -ForegroundColor Green
