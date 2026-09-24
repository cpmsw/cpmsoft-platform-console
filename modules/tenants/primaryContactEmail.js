function buildPrimaryContactChangedEmail({
  firstName,
  tenantName,
  companyNumber,
  changes = []
}) {

  const greeting =
    firstName
      ? `Hello ${firstName},`
      : "Hello,";


  const tenantText =
    companyNumber && tenantName
      ? `${companyNumber} - ${tenantName}`
      : tenantName ||
        companyNumber ||
        "your company";


  const changeLines =
    changes.length
      ? changes
          .map(
            (change) =>
              `- ${change.label}: ${formatValue(change.oldValue)} → ${formatValue(change.newValue)}`
          )
          .join("\n")
      : "- Primary Contact information was updated.";


  const changeRows =
    changes.length
      ? changes
          .map(
            (change) => `
              <tr>
                <td style="
                  padding:8px;
                  border-bottom:1px solid #ddd;
                  font-weight:bold;
                ">
                  ${escapeHtml(change.label)}
                </td>

                <td style="
                  padding:8px;
                  border-bottom:1px solid #ddd;
                ">
                  ${escapeHtml(
                    formatValue(
                      change.oldValue
                    )
                  )}
                </td>

                <td style="
                  padding:8px;
                  border-bottom:1px solid #ddd;
                ">
                  ${escapeHtml(
                    formatValue(
                      change.newValue
                    )
                  )}
                </td>
              </tr>
            `
          )
          .join("")
      : "";


  return {
    subject:
      "CPMSOFT Primary Contact Information Updated",

    text: `
${greeting}

Your Primary Contact information for ${tenantText} was updated by CPMSOFT administration.

Changes:

${changeLines}

If you were not expecting this change, please contact CPMSOFT.

CPMSOFT
`.trim(),

    html: `
      <div style="
        max-width:600px;
        font-family:Arial,sans-serif;
        font-size:15px;
        line-height:1.6;
        color:#222;
      ">

        <p>
          ${escapeHtml(greeting)}
        </p>

        <p>
          Your Primary Contact information for
          <strong>${escapeHtml(tenantText)}</strong>
          was updated by CPMSOFT administration.
        </p>

        ${
          changes.length
            ? `
              <table style="
                width:100%;
                border-collapse:collapse;
                margin-top:18px;
              ">
                <thead>
                  <tr>
                    <th style="
                      text-align:left;
                      padding:8px;
                      border-bottom:2px solid #ccc;
                    ">
                      Field
                    </th>

                    <th style="
                      text-align:left;
                      padding:8px;
                      border-bottom:2px solid #ccc;
                    ">
                      Previous
                    </th>

                    <th style="
                      text-align:left;
                      padding:8px;
                      border-bottom:2px solid #ccc;
                    ">
                      New
                    </th>
                  </tr>
                </thead>

                <tbody>
                  ${changeRows}
                </tbody>
              </table>
            `
            : ""
        }

        <p style="margin-top:22px;">
          If you were not expecting this change,
          please contact CPMSOFT.
        </p>

        <hr style="
          margin-top:25px;
          border:0;
          border-top:1px solid #ddd;
        ">

        <p style="
          font-size:13px;
          color:#666;
        ">
          CPMSOFT
        </p>

      </div>
    `
  };
}


function formatValue(
  value
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not specified";
  }


  if (value === true) {
    return "Yes";
  }


  if (value === false) {
    return "No";
  }


  return String(value);
}


function escapeHtml(
  value
) {

  return String(
    value ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


module.exports = {
  buildPrimaryContactChangedEmail
};