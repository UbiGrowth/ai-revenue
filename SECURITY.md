# Security Notes

## Resolved Security Issues

### ✅ xlsx (SheetJS) Vulnerabilities - FIXED

**Previous Status**: The `xlsx` package (v0.18.5) had known vulnerabilities.

**Resolution**: Replaced with `exceljs` v4.4.0 (2026-02-18)
- ✅ No known vulnerabilities in exceljs v4.4.0
- ✅ Actively maintained (last update: Dec 2024)
- ✅ Better API and performance
- ✅ Used in `MondayLeadConverter.tsx` for Excel file parsing

**Previous Vulnerabilities (now resolved)**:
1. **Regular Expression Denial of Service (ReDoS)** - xlsx < 0.20.2
2. **Prototype Pollution** - xlsx < 0.19.3

**Migration Details**:
- Replaced `import * as XLSX from "xlsx"` with `import ExcelJS from "exceljs"`
- Updated parsing logic to use ExcelJS Workbook API
- Maintained same functionality with improved security

**Last Updated**: 2026-02-18

