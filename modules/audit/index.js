const repository =
require("./audit.repository");

const service =
require("./audit.service");

module.exports = {
  createAudit:
    repository.createAudit,

  getTenantHistory:
    service.getTenantHistory
};