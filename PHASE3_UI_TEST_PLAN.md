# 🖥️ PHASE 3 UI TEST PLAN

**Status:** Ready to Execute  
**Duration:** ~15 minutes  
**Goal:** Verify all Phase 3 features work end-to-end

---

## 🎯 **UI TEST CHECKLIST**

### **TEST 1: Start Dev Server (2 min)**

```powershell
cd "C:\Users\bill\.cursor\ubigrowth-marketing-hub"
npm run dev
```

**Expected:** Server starts on http://localhost:5173

**Result:** [ ] ✅ PASS  [ ] ❌ FAIL

---

### **TEST 2: Verify Workspace Selection (1 min)**

1. Open http://localhost:5173
2. Log in (if needed)
3. Check top navigation for workspace selector
4. Try switching between workspaces

**Expected:** Can see and switch workspaces

**Result:** [ ] ✅ PASS  [ ] ❌ FAIL

---

### **TEST 3: CRM - View Imported Leads (2 min)**

1. Go to **CRM** page
2. Look for the imported Lovable leads:
   - Suzi Chen (UbiGrowth)
   - Fjel Maranan (IIX Global)
   - Tracy Schuly (Janssen)
   - (and 3 more)

**Expected:** See 6+ leads with Lovable data

**Result:** [ ] ✅ PASS  [ ] ❌ FAIL

**Notes:** _______________________

---

### **TEST 4: CRM - Check Pagination & Total Count (1 min)**

1. Still on CRM page
2. Check if pagination controls appear
3. Verify total count displays at top or bottom

**Expected:** Shows "X total leads" and pagination works

**Result:** [ ] ✅ PASS  [ ] ❌ FAIL

---

### **TEST 5: CRM - Test Filters (2 min)**

1. Try the search box (search for "Suzi" or "Chen")
2. Try status filter dropdown
3. Try sorting dropdown

**Expected:** Filters work, results update

**Result:** [ ] ✅ PASS  [ ] ❌ FAIL

---

### **TEST 6: Reports - View Tag Counts (1 min)**

1. Go to **CRM** → **Reports** tab
2. Check "Tags" section

**Expected:** Shows tag counts (even if empty/zero)

**Result:** [ ] ✅ PASS  [ ] ❌ FAIL

---

### **TEST 7: Reports - View Segment Counts (1 min)**

1. Still on Reports tab
2. Check "Segments" section

**Expected:** Shows segment breakdown

**Result:** [ ] ✅ PASS  [ ] ❌ FAIL

---

### **TEST 8: Campaigns - View Imported Campaigns (2 min)**

1. Go to **Campaigns** page
2. Look for imported Lovable campaigns:
   - "LinkedIn Thought Leadership"
   - "Camp Interest Nurture"
   - "AI CMO Test"
   - (and 2 more)

**Expected:** See 5 imported campaigns

**Result:** [ ] ✅ PASS  [ ] ❌ FAIL

**Notes:** _______________________

---

### **TEST 9: Create New Campaign (3 min)**

1. Click **"New Campaign"** or **"Create Campaign"**
2. Fill out basic info:
   - Name: "Phase 3 Test Campaign"
   - Type: Email or Multi-channel
   - Select workspace: "Brain Surgery Inc" or "First Touch Soccer"
3. Try adding targeting:
   - Add a tag filter (if UI supports it)
   - OR add segment filter
4. Save as Draft

**Expected:** Campaign created successfully

**Result:** [ ] ✅ PASS  [ ] ❌ FAIL

**Notes:** _______________________

---

### **TEST 10: View Campaign Details (1 min)**

1. Click on the campaign you just created
2. Verify details display correctly
3. Check if you can edit it

**Expected:** Campaign details page loads, editable

**Result:** [ ] ✅ PASS  [ ] ❌ FAIL

---

## 🚀 **BONUS TESTS (If Time Permits)**

### **BONUS 1: Launch Test Campaign**

1. Create a simple email campaign
2. Target ONE lead (use a test email you own)
3. Click "Launch"
4. Check `channel_outbox` table for entry:
   ```sql
   SELECT * FROM channel_outbox 
   WHERE created_at > NOW() - INTERVAL '10 minutes'
   ORDER BY created_at DESC;
   ```

**Expected:** Outbox entry created with status "queued" or "sent"

**Result:** [ ] ✅ PASS  [ ] ❌ FAIL  [ ] ⏭️ SKIPPED

---

### **BONUS 2: Check Autopilot Campaign Builder**

1. Go to CMO/Autopilot section (if exists)
2. Try the campaign builder wizard
3. Enter ICP, offer, channels
4. See if it generates a campaign

**Expected:** Wizard works, generates campaign plan

**Result:** [ ] ✅ PASS  [ ] ❌ FAIL  [ ] ⏭️ SKIPPED

---

## 📊 **TEST SUMMARY**

**Total Tests:** 10 (+ 2 bonus)  
**Tests Passed:** _____  
**Tests Failed:** _____  
**Tests Skipped:** _____

**Overall Status:** [ ] ✅ READY FOR PRODUCTION  [ ] ⚠️ NEEDS FIXES

---

## 🚨 **IF TESTS FAIL**

### **Common UI Issues:**

**Issue:** Server won't start
```powershell
# Try reinstalling dependencies
npm install
npm run dev
```

**Issue:** Can't see workspaces
- Check browser console for errors
- Verify logged in
- Check Supabase connection

**Issue:** Leads page is empty
- SQL tests might have failed
- Data not imported
- RLS blocking data (check SQL Editor)

**Issue:** Can't create campaign
- Check browser console errors
- Verify Edge Functions deployed
- Check API errors in Network tab

---

## ✅ **SUCCESS CRITERIA**

**Phase 3 UI is READY if:**

- ✅ Tests 1-8 all pass (core functionality)
- ✅ Can view imported Lovable data
- ✅ Can create new campaigns
- ✅ No critical errors in browser console
- ✅ Workspace switching works

**When this passes:** 🚀 **READY TO DEPLOY!**

---

## 🎯 **AFTER UI TESTS PASS**

**Next Steps:**

1. ✅ Deploy Edge Functions
   ```powershell
   supabase functions deploy --no-verify-jwt
   ```

2. ✅ Configure API Secrets
   ```powershell
   supabase secrets set RESEND_API_KEY="your-key"
   supabase secrets set TWILIO_ACCOUNT_SID="your-sid"
   supabase secrets set VAPI_PRIVATE_KEY="your-key"
   ```

3. ✅ Launch real campaign with real lead

4. ✅ **SHIP TO PRODUCTION!** 🎉

---

*Generated: 2026-01-08*  
*Phase 3 UI Testing Guide*

