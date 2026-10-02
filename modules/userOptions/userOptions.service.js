const userOptions =
  require("cpmsoft-core/userOptions");


const USER_TYPE =
  "platform_admin";


// ==================================================
// GET ALL OPTIONS FOR CURRENT ADMIN
// ==================================================

async function getOptions(
  adminId
) {

  return userOptions.getOptions(
    USER_TYPE,
    adminId
  );
}


// ==================================================
// GET ONE OPTION
// ==================================================

async function getOption(
  adminId,
  optionKey
) {

  return userOptions.getOption(
    USER_TYPE,
    adminId,
    optionKey
  );
}


// ==================================================
// SAVE OPTION
// ==================================================

async function saveOption(
  adminId,
  optionKey,
  optionValue
) {

  return userOptions.saveOption(
    USER_TYPE,
    adminId,
    optionKey,
    optionValue
  );
}


// ==================================================
// DELETE OPTION
// ==================================================

async function deleteOption(
  adminId,
  optionKey
) {

  return userOptions.deleteOption(
    USER_TYPE,
    adminId,
    optionKey
  );
}


module.exports = {
  getOptions,
  getOption,
  saveOption,
  deleteOption
};