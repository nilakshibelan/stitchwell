/**
 * Google Apps Script backend for LJ Boutique manager.
 *
 * Instructions:
 * 1. Create a new Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Replace the default code with this script.
 * 4. Save and deploy as a web app.
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web App URL and paste it into app.js as SHEETS_ENDPOINT.
 *
 * The script stores the full app state as JSON in a single cell.
 */

const STATE_SHEET_NAME = 'State';
const STATE_CELL = 'A1';

function doGet() {
  const sheet = getStateSheet();
  const stored = sheet.getRange(STATE_CELL).getValue();
  const payload = stored ? JSON.parse(stored) : { members: [], vouchers: [], lastDraw: null };
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const requestBody = JSON.parse(e.postData.contents);
    const sheet = getStateSheet();
    sheet.getRange(STATE_CELL).setValue(JSON.stringify(requestBody));
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getStateSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(STATE_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(STATE_SHEET_NAME);
    sheet.getRange(STATE_CELL).setValue(JSON.stringify({ members: [], vouchers: [], lastDraw: null }));
  }
  return sheet;
}
