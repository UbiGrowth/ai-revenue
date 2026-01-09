#!/usr/bin/env pwsh
# ============================================================================
# Import Lovable Cloud Data to Phase 3 Database
# ============================================================================

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Lovable Cloud Data Import to Phase 3 Database          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if Phase 3 compatible file exists
if (-not (Test-Path "FULL_DATA_EXPORT_PHASE3.sql")) {
    Write-Host "❌ Error: FULL_DATA_EXPORT_PHASE3.sql not found!" -ForegroundColor Red
    Write-Host "   Please run the conversion first." -ForegroundColor Yellow
    exit 1
}

Write-Host "📋 Import Summary:" -ForegroundColor Yellow
Write-Host "   Source: Lovable Cloud (nyzgsizvtqhafoxixyrd)" -ForegroundColor Gray
Write-Host "   Target: Phase 3 Database (ddwqkkiqgjptguzoeohr)" -ForegroundColor Gray
Write-Host ""
Write-Host "📦 Data to Import:" -ForegroundColor Yellow
Write-Host "   ✓ 10 Workspaces" -ForegroundColor Green
Write-Host "   ✓ Workspace members" -ForegroundColor Green
Write-Host "   ✓ CMO brand profiles, ICPs, offers, funnels" -ForegroundColor Green
Write-Host "   ✓ Email sequences & automation" -ForegroundColor Green
Write-Host "   ✓ AI settings (email & voice)" -ForegroundColor Green
Write-Host "   ✓ CRM data (deals, tasks, prospects)" -ForegroundColor Green
Write-Host "   ✓ Reference data (industries)" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  NOT Included (import separately):" -ForegroundColor Yellow
Write-Host "   • Leads (~100k rows)" -ForegroundColor Gray
Write-Host "   • CMO Campaigns (~20 rows)" -ForegroundColor Gray
Write-Host "   • Assets (~1,300 rows)" -ForegroundColor Gray
Write-Host ""

# Confirm
$confirm = Read-Host "Do you want to proceed with the import? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "`n❌ Import cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host "`n🚀 Starting import..." -ForegroundColor Cyan
Write-Host ""

# Option 1: Direct SQL execution (requires psql or connection string)
Write-Host "📝 Import Options:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   OPTION 1: Manual (RECOMMENDED)" -ForegroundColor Green
Write-Host "   ----------------------------------------" -ForegroundColor Gray
Write-Host "   1. Open: https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/sql" -ForegroundColor White
Write-Host "   2. Open file: FULL_DATA_EXPORT_PHASE3.sql" -ForegroundColor White
Write-Host "   3. Copy the SQL content" -ForegroundColor White
Write-Host "   4. Paste into Supabase SQL Editor" -ForegroundColor White
Write-Host "   5. Click 'Run'" -ForegroundColor White
Write-Host ""
Write-Host "   OPTION 2: Via Supabase CLI" -ForegroundColor Green
Write-Host "   ----------------------------------------" -ForegroundColor Gray
Write-Host "   Run: supabase db execute --file FULL_DATA_EXPORT_PHASE3.sql" -ForegroundColor White
Write-Host ""

# Ask which option
$option = Read-Host "Which option do you want? (1 for Manual, 2 for CLI, 3 to exit)"

if ($option -eq "1") {
    Write-Host "`n✅ Opening SQL Editor in browser..." -ForegroundColor Green
    Start-Process "https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/sql"
    Write-Host "   Opening file location..." -ForegroundColor Gray
    Start-Process "explorer.exe" -ArgumentList "/select,`"$(Get-Location)\FULL_DATA_EXPORT_PHASE3.sql`""
    Write-Host "`n📋 Next steps:" -ForegroundColor Yellow
    Write-Host "   1. Copy content from FULL_DATA_EXPORT_PHASE3.sql" -ForegroundColor White
    Write-Host "   2. Paste into SQL Editor (opened in browser)" -ForegroundColor White
    Write-Host "   3. Click 'Run' button" -ForegroundColor White
}
elseif ($option -eq "2") {
    Write-Host "`n🔧 Attempting CLI import..." -ForegroundColor Cyan
    try {
        $output = supabase db execute --file "FULL_DATA_EXPORT_PHASE3.sql" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Import completed successfully!" -ForegroundColor Green
            Write-Host "`n📊 Verification:" -ForegroundColor Yellow
            Write-Host "   Run this query to verify import:" -ForegroundColor Gray
            Write-Host "   SELECT 'workspaces' as table_name, COUNT(*) FROM workspaces;" -ForegroundColor White
        } else {
            Write-Host "❌ Import failed!" -ForegroundColor Red
            Write-Host "   Error: $output" -ForegroundColor Yellow
            Write-Host "`n   Falling back to Manual option..." -ForegroundColor Yellow
            Start-Process "https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/sql"
        }
    }
    catch {
        Write-Host "❌ CLI import failed: $_" -ForegroundColor Red
        Write-Host "   Please use Manual option (Option 1)" -ForegroundColor Yellow
    }
}
else {
    Write-Host "`n✅ Exiting. No changes made." -ForegroundColor Yellow
}

Write-Host "`n════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

