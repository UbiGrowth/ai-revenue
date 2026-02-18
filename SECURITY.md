# Security Notes

## Known Vulnerabilities

### xlsx (SheetJS) v0.18.5

**Status**: Acknowledged - No patch available

The `xlsx` package (v0.18.5) has the following known vulnerabilities:

1. **Regular Expression Denial of Service (ReDoS)**
   - Affected versions: < 0.20.2
   - Patched version: Not available (0.20.2 not released)
   - Risk: Medium
   - Context: Used only in `MondayLeadConverter.tsx` for parsing user-uploaded Excel files

2. **Prototype Pollution**
   - Affected versions: < 0.19.3
   - Patched version: Not available (0.19.3 not released)
   - Risk: Medium
   - Context: Used only in `MondayLeadConverter.tsx` for parsing user-uploaded Excel files

**Mitigation**:
- The xlsx library is used in a controlled environment (authenticated users only)
- File size limits are enforced on uploads
- The feature is optional and not critical for core functionality
- Usage is limited to a single component (`MondayLeadConverter.tsx`)

**Action Items**:
- [ ] Monitor for SheetJS releases >= 0.19.3 or 0.20.2
- [ ] Upgrade immediately when patched version becomes available
- [ ] Consider alternative libraries if no patch is released in the next release cycle

**Last Updated**: 2026-02-18
