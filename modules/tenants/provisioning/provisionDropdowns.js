async function provisionDropdowns({
  appClient,
  tenantId,
  primaryUserId
}) {

  const result =
    await appClient.query(
      `INSERT INTO list_dropdowns
       (
         tenant_id,
         dropdown_type,
         dropdown_value,
         dropdown_code,
         sort_order,
         is_active,
         created_at,
         created_by
       )

       SELECT
         $1,
         dropdown_type,
         dropdown_value,
         dropdown_code,
         sort_order,
         true,
         now(),
         $2

       FROM list_dropdown_defaults

       WHERE is_active = true

       ORDER BY
         dropdown_type,
         sort_order,
         dropdown_value`,
      [
        tenantId,
        primaryUserId
      ]
    );


  return {
    dropdownDefaultCount:
      result.rowCount
  };
}


module.exports = {
  provisionDropdowns
};