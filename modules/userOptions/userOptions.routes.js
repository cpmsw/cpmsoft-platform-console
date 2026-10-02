const service =
  require("./userOptions.service");


// ==================================================
// USER OPTIONS
// ==================================================

module.exports = async function (
  fastify
) {

  // ---------------------------------
  // GET ALL OPTIONS
  // ---------------------------------

  fastify.get(
    "/",
    async (request) => {

      const adminId =
        request.user.adminId;

      return service.getOptions(
        adminId
      );
    }
  );


  // ---------------------------------
  // GET ONE OPTION
  // ---------------------------------

  fastify.get(
    "/:optionKey",
    async (request) => {

      const adminId =
        request.user.adminId;

      const optionKey =
        request.params.optionKey;

      const option =
        await service.getOption(
          adminId,
          optionKey
        );

      return option || {
        option_key: optionKey,
        option_value: null
      };
    }
  );


  // ---------------------------------
  // SAVE OPTION
  // ---------------------------------

  fastify.put(
    "/:optionKey",
    {
      schema: {
        body: {
          type: "object",
          required: [
            "option_value"
          ],
          properties: {
            option_value: {}
          },
          additionalProperties: false
        }
      }
    },
    async (request) => {

      const adminId =
        request.user.adminId;

      const optionKey =
        request.params.optionKey;

      return service.saveOption(
        adminId,
        optionKey,
        request.body.option_value
      );
    }
  );


  // ---------------------------------
  // DELETE OPTION
  // ---------------------------------

  fastify.delete(
    "/:optionKey",
    async (request) => {

      const adminId =
        request.user.adminId;

      const optionKey =
        request.params.optionKey;

      const deleted =
        await service.deleteOption(
          adminId,
          optionKey
        );

      return {
        success: deleted
      };
    }
  );
};