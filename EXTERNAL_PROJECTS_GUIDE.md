# External Lovable Projects Integration Guide

## Overview

The PlayKout Marketing Hub now supports importing landing pages and websites built in separate Lovable projects for review, approval, and deployment to custom domains.

## How It Works

### 1. Build Your Landing Page/Website in Lovable

- Create your landing page or website in a separate Lovable project
- Design and build it completely with all content and functionality
- Test it on the staging URL (e.g., `https://your-project-id.lovableproject.com`)

### 2. Import the Project into the Hub

**From New Asset Page:**
1. Navigate to **Create New Asset**
2. Select type: **Landing Page** or **Video** (if it needs a landing page)
3. Fill in basic info (Name, Vertical, Goal)
4. Scroll to **Import from Lovable Project** section
5. Enter your project's staging URL
6. (Optional) Enter the custom domain where it will be published
7. Click **Import Project**

**What Happens:**
- The hub extracts the page title and creates an asset record
- Preview URL is set to your Lovable project URL
- Asset status starts as "Draft"

### 3. Review and Approve

**For Reviewers:**
1. Go to **Approvals** page
2. Click on the imported asset
3. View live preview (iframe) of the Lovable project
4. Review metadata (vertical, goal, deployment status)
5. Check custom domain configuration
6. Click **Approve** or provide feedback

### 4. Deploy to Custom Domain

**After Approval:**

1. **In the Asset Detail page:**
   - Status changes to "Approved"
   - Deployment Status shows "Ready to Deploy"
   - Custom domain is displayed

2. **In your Lovable Project (the original project):**
   - Go to **Project Settings → Domains**
   - Click **Connect Domain**
   - Enter your custom domain (e.g., `www.yourdomain.com`)
   - Follow the DNS configuration instructions:
     - Add A record: `@` → `185.158.133.1`
     - Add A record: `www` → `185.158.133.1`
     - Add TXT record for verification
   - Wait for DNS propagation (up to 72 hours)

3. **Back in the Hub:**
   - Update Deployment Status to "Active"
   - Asset is now live on the custom domain!

## Asset Types Supported

- **Landing Pages**: Full landing page websites built in Lovable
- **Video Landing Pages**: Landing pages that showcase video content

## Best Practices

### Project Organization
- Keep each landing page in its own Lovable project
- Use descriptive project names that match your campaign
- Document any special configurations in the asset's Goal field

### Domain Management
- Plan your custom domains in advance
- Use subdomains for different campaigns (e.g., `promo.yourdomain.com`)
- Test DNS configuration before approval deadline

### Review Workflow
1. **Draft**: Project is imported and being prepared
2. **Review**: Ready for team review and approval
3. **Approved**: Cleared for deployment
4. **Live**: Deployed to custom domain and active

## Deployment Status Meanings

- **Staging**: Project is on Lovable's staging domain (.lovableproject.com)
- **Ready**: Approved and ready to be deployed to custom domain
- **Active**: Successfully deployed and live on custom domain
- **Failed**: Deployment encountered errors; check DNS or project settings

## Troubleshooting

### Preview Not Loading
- Verify the Lovable project URL is correct
- Check if the project is published in Lovable
- Ensure iframe embedding is not blocked

### Custom Domain Not Working
- Verify DNS records are correctly configured
- Allow up to 72 hours for DNS propagation
- Check for conflicting DNS records
- See [Lovable Custom Domain Docs](https://docs.lovable.dev/features/custom-domain)

### Deployment Status Stuck
- Refresh the asset detail page
- Verify the domain is actually connected in Lovable project
- Check domain status in Lovable's Project Settings → Domains

## Example Workflow

### Campaign Launch Scenario

1. **Marketing team** builds landing page in Lovable project: `playkout-spring-promo.lovableproject.com`
2. **Import** into hub with custom domain `spring.playkout.com`
3. **Content manager** reviews the imported asset
4. **Approve** after reviewing design and copy
5. **DevOps** connects `spring.playkout.com` to the Lovable project
6. **Update** deployment status to "Active"
7. **Campaign** goes live with analytics tracking

## Additional Resources

- [Lovable Custom Domains Documentation](https://docs.lovable.dev/features/custom-domain)
- [Lovable Project Settings](https://docs.lovable.dev/features/settings)
- [DNS Configuration Guide](https://docs.lovable.dev/features/custom-domain#dns-configuration)
