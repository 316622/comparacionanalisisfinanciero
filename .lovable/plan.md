

# Financial Document Analysis Platform

A public web application with a tabbed interface for financial professionals to review bilingual (Spanish/English) financial data, view presentations, and compare documents using AI.

---

## Tab 1: Bilingual Glossary (ES/EN)

- A searchable, filterable glossary of financial and accounting terms in both Spanish and English
- Search bar that works across both languages (type in Spanish → find English equivalent and vice versa)
- Alphabetical navigation for quick access
- Clean table/card layout with Spanish term, English term, and definition

---

## Tab 2: Financial Data Presentation

- PowerPoint-style slide presentation view displaying financial/accounting data
- **Dropdown selectors** at the top:
  - **Data category** dropdown (e.g., balance sheet, income statement, cash flow — you'll define the specific options)
  - **Year** dropdown to select the reporting period
- Based on selections, the presentation updates to show the relevant financial data with charts, tables, and key figures
- Navigation controls (previous/next slide, slide counter)
- The underlying data will come from a database that you'll upload

---

## Tab 3: Document Comparison (AI-Powered)

- Upload area for **two Excel files** and **two Word files** (one typically in Spanish, one in English)
- AI-powered cross-language comparison that:
  - Translates and aligns content between Spanish and English documents
  - Identifies mismatches, discrepancies, and missing data
- Results displayed as:
  - **Side-by-side visual comparison** with highlighted differences
  - **Summary report** listing all discrepancies found
  - Option to **download** the comparison report

---

## Future Tabs

- The interface will be designed to easily accommodate additional tabs as needed

---

## Design & General

- Colors will be applied once you share the reference numbers
- Clean, professional design appropriate for financial/accounting use
- Responsive layout
- No login required — publicly accessible
- Backend powered by Lovable Cloud (database for financial data + AI for document comparison)

