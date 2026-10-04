module.exports = async function (fastify) {
  fastify.register(
    require("./attachments.routes")
  );
};