const service =
  require("./auth.service");

const bcrypt =
  require("bcryptjs");

const crypto =
  require("crypto");

const QRCode = require("qrcode");

const {
  sendEmail
} = require(
  "cpmsoft-core/common/services/emailService"
);

async function loadOtplib() {
  return import("otplib");
}

function getPlatformCookieOptions(request) {
  const origin =
    request.headers.origin || "";

  const isLocal =
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:") ||
    origin.startsWith("http://192.168.");

  return {
    path: "/",
    httpOnly: true,
    secure: !isLocal,
    sameSite: "strict"
  };
}

module.exports =
  async function (fastify) {

    fastify.post(
      "/login",
      {
        config: {
          rateLimit: {
            max: 10,
            timeWindow: "15 minutes"
          }
        },

        schema: {
          tags: ["Authentication"],
          summary:
            "Platform administrator login",

          body: {
            type: "object",
            required: [
              "email",
              "password"
            ],
            additionalProperties: false,

            properties: {
              email: {
                type: "string",
                format: "email"
              },

              password: {
                type: "string",
                minLength: 1
              }
            }
          }
        }
      },

      async (request, reply) => {

        try {

          const {
            email,
            password
          } = request.body;


          const admin =
            await service
              .getAdminByEmail(email);


          // Deliberately use the same error
          // for unknown/inactive/wrong password.
          if (!admin || !admin.is_active) {

            return reply
              .code(401)
              .send({
                code:
                  "INVALID_LOGIN",

                error:
                  "Invalid email or password."
              });
          }

          if (
            !admin.is_verified ||
            !admin.password_hash
          ) {

            return reply
              .code(403)
              .send({
                code:
                  "ACCOUNT_NOT_ACTIVATED",

                error:
                  "Your Platform Console account has not been activated."
              });
          }

          if (
            admin.locked_until &&
            new Date(
              admin.locked_until
            ) > new Date()
          ) {

            return reply
              .code(423)
              .send({
                code:
                  "ACCOUNT_LOCKED",

                error:
                  "Account temporarily locked. Please try again later."
              });
          }


          const valid =
            await service
              .verifyPassword(
                password,
                admin.password_hash
              );


          if (!valid) {

            await service
              .recordFailedLogin(
                admin
              );

            return reply
              .code(401)
              .send({
                code:
                  "INVALID_LOGIN",

                error:
                  "Invalid email or password."
              });
          }


          await service
            .clearFailedLogin(
              admin.id
            );


          // For now, do NOT issue the final
          // authenticated cookie.
          // First tell the UI whether TOTP
          // enrollment or verification is needed.

          const challengeToken =
            await reply.jwtSign(
              {
                adminId: admin.id,
                stage: "2fa"
              },
              {
                expiresIn: "10m"
              }
            );


          return {
            success: true,

            challengeToken,

            email:
              admin.email,

            displayName:
              admin.display_name,

            requiresTwoFactor:
              true,

            twoFactorEnabled:
              admin.twofa_enabled
          };


        } catch (error) {

          request.log.error(error);

          return reply
            .code(500)
            .send({
              code:
                "LOGIN_FAILED",

              error:
                "Unable to sign in."
            });
        }
      }
    );

    fastify.post(
      "/2fa/setup",
      {
        schema: {
          tags: ["Authentication"],
          summary:
            "Set up Platform administrator 2FA",

          body: {
            type: "object",
            required: [
              "challengeToken"
            ],
            additionalProperties: false,

            properties: {
              challengeToken: {
                type: "string"
              }
            }
          }
        }
      },

      async (request, reply) => {

        try {

          const payload =
            fastify.jwt.verify(
              request.body.challengeToken
            );


          if (
            payload.stage !== "2fa" ||
            !payload.adminId
          ) {
            return reply
              .code(401)
              .send({
                code:
                  "INVALID_CHALLENGE",

                error:
                  "Invalid or expired login challenge."
              });
          }


          const admin =
            await service.getAdminById(
              payload.adminId
            );


          if (!admin || !admin.is_active) {
            return reply
              .code(401)
              .send({
                code:
                  "INVALID_LOGIN",

                error:
                  "Invalid administrator."
              });
          }


          if (admin.twofa_enabled) {
            return reply
              .code(409)
              .send({
                code:
                  "TWOFA_ALREADY_ENABLED",

                error:
                  "Two-factor authentication is already enabled."
              });
          }


          const {
            generateSecret,
            generateURI
          } = await loadOtplib();


          const secret =
            generateSecret();


          await service.saveTwoFactorSecret(
            admin.id,
            secret
          );


          const uri =
            generateURI({
              issuer:
                "CPMSOFT Platform Console",

              label:
                admin.email,

              secret
            });

          const qrCode =
            await QRCode.toDataURL(uri);

          return {
            success: true,

            qrCode,

            manualCode:
              secret
          };


        } catch (error) {

          request.log.error(error);

          return reply
            .code(401)
            .send({
              code:
                "TWOFA_SETUP_FAILED",

              error:
                "Unable to set up two-factor authentication."
            });
        }
      }
    );

    fastify.post(
      "/2fa/verify",
      {
        config: {
          rateLimit: {
            max: 10,
            timeWindow: "10 minutes"
          }
        },

        schema: {
          tags: ["Authentication"],
          summary:
            "Verify Platform administrator 2FA",

          body: {
            type: "object",
            required: [
              "challengeToken",
              "code"
            ],
            additionalProperties: false,

            properties: {
              challengeToken: {
                type: "string"
              },

              code: {
                type: "string",
                minLength: 6,
                maxLength: 6
              }
            }
          }
        }
      },

      async (request, reply) => {

        try {

          const payload =
            fastify.jwt.verify(
              request.body.challengeToken
            );


          if (
            payload.stage !== "2fa" ||
            !payload.adminId
          ) {
            return reply
              .code(401)
              .send({
                code:
                  "INVALID_CHALLENGE",

                error:
                  "Invalid or expired login challenge."
              });
          }


          const admin =
            await service.getAdminById(
              payload.adminId
            );


          if (
            !admin ||
            !admin.is_active ||
            !admin.twofa_secret
          ) {
            return reply
              .code(401)
              .send({
                code:
                  "INVALID_TWOFA",

                error:
                  "Two-factor authentication is unavailable."
              });
          }


          const {
            verify
          } = await loadOtplib();


          const result =
            await verify({
              secret:
                admin.twofa_secret,

              token:
                request.body.code
            });


          if (!result.valid) {

            return reply
              .code(401)
              .send({
                code:
                  "INVALID_TWOFA_CODE",

                error:
                  "Invalid authentication code."
              });
          }


          // First successful verification
          // completes enrollment.
          if (!admin.twofa_enabled) {

            await service.enableTwoFactor(
              admin.id
            );

          } else {

            await service.recordSuccessfulLogin(
              admin.id
            );
          }


          const token =
            await reply.jwtSign({
              adminId:
                admin.id,

              email:
                admin.email,

              displayName:
                admin.display_name,

              role:
                "platform_admin",

              stage:
                "authenticated"
            });


          reply.setCookie(
            "cpmsoft_platform",
            token,
            {
              ...getPlatformCookieOptions(request),
              maxAge: 8 * 60 * 60
            }
          );


          return {
            success: true,

            admin: {
              id:
                admin.id,

              email:
                admin.email,

              displayName:
                admin.display_name
            }
          };


        } catch (error) {

          request.log.error(error);

          return reply
            .code(401)
            .send({
              code:
                "TWOFA_VERIFY_FAILED",

              error:
                "Unable to verify authentication code."
            });
        }
      }
    );

    // ---------------------------------
    // VALIDATE ACTIVATION INVITATION
    // ---------------------------------
    fastify.post(
      "/activation/validate",
      {
        schema: {
          tags: ["Authentication"],
          summary:
            "Validate Platform administrator activation invitation",

          body: {
            type: "object",
            required: [
              "token"
            ],
            additionalProperties: false,

            properties: {
              token: {
                type: "string",
                minLength: 1
              }
            }
          }
        }
      },

      async (request, reply) => {

        try {

          const token =
            String(
              request.body.token || ""
            ).trim();


          const tokenHash =
            crypto
              .createHash("sha256")
              .update(token)
              .digest("hex");


          const admin =
            await service
              .getAdminByInvitationTokenHash(
                tokenHash
              );


          if (
            !admin ||
            !admin.is_active ||
            admin.is_verified ||
            !admin.activation_invitation_expires_at ||
            new Date(
              admin.activation_invitation_expires_at
            ) < new Date()
          ) {

            return reply
              .code(400)
              .send({
                code:
                  "INVALID_ACTIVATION_INVITATION",

                error:
                  "This activation invitation is invalid or has expired."
              });
          }


          return {
            valid: true,

            email:
              admin.email,

            displayName:
              admin.display_name,

            twoFactorRequired:
              admin.twofa_enabled
          };


        } catch (error) {

          request.log.error(error);

          return reply
            .code(500)
            .send({
              code:
                "ACTIVATION_VALIDATION_FAILED",

              error:
                "Unable to validate activation invitation."
            });
        }
      }
    );


    // ---------------------------------
    // SEND ACTIVATION VERIFICATION CODE
    // ---------------------------------
    fastify.post(
      "/activation/send-code",
      {
        schema: {
          tags: ["Authentication"],
          summary:
            "Send Platform administrator activation verification code",

          body: {
            type: "object",
            required: [
              "token"
            ],
            additionalProperties: false,

            properties: {
              token: {
                type: "string",
                minLength: 1
              }
            }
          }
        }
      },

      async (request, reply) => {

        try {

          const token =
            String(
              request.body.token || ""
            ).trim();


          const tokenHash =
            crypto
              .createHash("sha256")
              .update(token)
              .digest("hex");


          const admin =
            await service
              .getAdminByInvitationTokenHash(
                tokenHash
              );


          if (
            !admin ||
            !admin.is_active ||
            admin.is_verified ||
            !admin.activation_invitation_expires_at ||
            new Date(
              admin.activation_invitation_expires_at
            ) < new Date()
          ) {

            return reply
              .code(400)
              .send({
                code:
                  "INVALID_ACTIVATION_INVITATION",

                error:
                  "This activation invitation is invalid or has expired."
              });
          }


          const verificationCode =
            crypto
              .randomInt(
                100000,
                1000000
              )
              .toString();


          const expires =
            new Date(
              Date.now() +
              15 * 60 * 1000
            );


          await service
            .setActivationVerificationCode(
              admin.id,
              verificationCode,
              expires
            );


          await sendEmail({
            to:
              admin.email,

            subject:
              "CPMSOFT Platform Console Verification Code",

            text:
              `Your CPMSOFT Platform Console verification code is: ${verificationCode}. ` +
              `This code expires in 15 minutes.`,

            html:
              `<p>Your CPMSOFT Platform Console verification code is:</p>
               <h2>${verificationCode}</h2>
               <p>This code expires in 15 minutes.</p>`
          });


          return {
            success: true,

            message:
              "Verification code sent."
          };


        } catch (error) {

          request.log.error(error);

          return reply
            .code(500)
            .send({
              code:
                "ACTIVATION_CODE_SEND_FAILED",

              error:
                "Unable to send activation verification code."
            });
        }
      }
    );


    // ---------------------------------
    // COMPLETE ACTIVATION
    // ---------------------------------
    fastify.post(
      "/activation/complete",
      {
        schema: {
          tags: ["Authentication"],
          summary:
            "Complete Platform administrator activation",

          body: {
            type: "object",

            required: [
              "token",
              "code",
              "newPassword"
            ],

            additionalProperties: false,

            properties: {
              token: {
                type: "string",
                minLength: 1
              },

              code: {
                type: "string",
                minLength: 6,
                maxLength: 6
              },

              newPassword: {
                type: "string",
                minLength: 1
              }
            }
          }
        }
      },

      async (request, reply) => {

        const token =
          String(
            request.body.token || ""
          ).trim();

        const code =
          String(
            request.body.code || ""
          ).trim();

        const {
          newPassword
        } = request.body;


        const passwordError =
          service.validatePassword(
            newPassword
          );


        if (passwordError) {

          return reply
            .code(400)
            .send({
              code:
                "PASSWORD_POLICY_FAILED",

              error:
                passwordError
            });
        }


        try {

          const tokenHash =
            crypto
              .createHash("sha256")
              .update(token)
              .digest("hex");


          const admin =
            await service
              .getAdminByInvitationTokenHash(
                tokenHash
              );


          if (
            !admin ||
            !admin.is_active ||
            admin.is_verified ||
            !admin.activation_invitation_expires_at ||
            new Date(
              admin.activation_invitation_expires_at
            ) < new Date()
          ) {

            return reply
              .code(400)
              .send({
                code:
                  "INVALID_ACTIVATION_INVITATION",

                error:
                  "This activation invitation is invalid or has expired."
              });
          }


          if (
            !admin.verification_code ||
            admin.verification_code !== code
          ) {

            return reply
              .code(400)
              .send({
                code:
                  "INVALID_VERIFICATION_CODE",

                error:
                  "Invalid verification code."
              });
          }


          if (
            !admin.verification_expires ||
            new Date(
              admin.verification_expires
            ) < new Date()
          ) {

            return reply
              .code(400)
              .send({
                code:
                  "VERIFICATION_CODE_EXPIRED",

                error:
                  "Verification code has expired."
              });
          }


          const passwordHash =
            await bcrypt.hash(
              newPassword,
              12
            );


          const activatedAdmin =
            await service
              .activatePlatformAdmin(
                admin.id,
                passwordHash
              );


          if (!activatedAdmin) {

            return reply
              .code(409)
              .send({
                code:
                  "ACTIVATION_FAILED",

                error:
                  "Unable to activate this Platform Console account."
              });
          }


          return {
            success: true,

            message:
              "Platform Console account activated successfully."
          };


        } catch (error) {

          request.log.error(error);

          return reply
            .code(500)
            .send({
              code:
                "ACTIVATION_FAILED",

              error:
                "Unable to activate Platform Console account."
            });
        }
      }
    );

    // ---------------------------------
    // SEND RESET CODE
    // ---------------------------------
    fastify.post(
      "/send-reset-code",
      {
        config: {
          rateLimit: {
            max: 5,
            timeWindow: "15 minutes"
          }
        },

        schema: {
          summary:
            "Send Platform administrator password reset code",

          tags: [
            "Authentication"
          ],

          body: {
            type: "object",

            required: [
              "email"
            ],

            additionalProperties: false,

            properties: {
              email: {
                type: "string"
              }
            }
          }
        }
      },

      async (request, reply) => {

        const email =
          request.body.email
            .trim()
            .toLowerCase();

        try {

          const admin =
            await service.getAdminForPasswordReset(
              email
            );


          if (!admin) {

            return {
              message:
                "If the email exists, a reset code has been sent."
            };
          }


          const resetCode =
            crypto
              .randomInt(
                100000,
                1000000
              )
              .toString();


          const expires =
            new Date();

          expires.setMinutes(
            expires.getMinutes() + 10
          );


          const resetCodeHash =
            crypto
              .createHash("sha256")
              .update(resetCode)
              .digest("hex");

          await service.setPasswordResetCode(
            admin.id,
            resetCodeHash,
            expires
          );
          await sendEmail({
            to: email,

            subject:
              "CPMSOFT Platform Console Password Reset Code",

            text:
              `Your CPMSOFT Platform Console password reset code is: ${resetCode}. ` +
              `This code expires in 10 minutes.`,

            html:
              `<p>Your CPMSOFT Platform Console password reset code is:</p>
           <h2>${resetCode}</h2>
           <p>This code expires in 10 minutes.</p>`
          });


          return {
            message:
              "If the email exists, a reset code has been sent."
          };

        } catch (error) {

          request.log.error(error);

          return reply
            .code(500)
            .send({
              code:
                "RESET_CODE_SEND_FAILED",

              error:
                "Unable to send reset code."
            });
        }
      }
    );

    // ---------------------------------
    // RESET PASSWORD WITH CODE
    // ---------------------------------
    fastify.post(
      "/reset-password-code",
      {
        config: {
          rateLimit: {
            max: 5,
            timeWindow: "10 minutes"
          }
        },

        schema: {
          summary:
            "Reset Platform administrator password using code",

          tags: [
            "Authentication"
          ],

          body: {
            type: "object",

            required: [
              "email",
              "code",
              "newPassword"
            ],

            additionalProperties: false,

            properties: {
              email: {
                type: "string"
              },

              code: {
                type: "string"
              },

              newPassword: {
                type: "string"
              }
            }
          }
        }
      },

      async (request, reply) => {

        const email =
          request.body.email
            .trim()
            .toLowerCase();

        const code =
          String(
            request.body.code || ""
          ).trim();

        const {
          newPassword
        } = request.body;


        const passwordError =
          service.validatePassword(
            newPassword
          );

        if (passwordError) {
          return reply
            .code(400)
            .send({
              code:
                "PASSWORD_POLICY_FAILED",

              error:
                passwordError
            });
        }


        try {

          const admin =
            await service.getAdminForPasswordReset(
              email
            );


          if (!admin) {
            return reply
              .code(400)
              .send({
                error:
                  "Invalid code or email."
              });
          }


          const resetCodeHash =
            crypto
              .createHash("sha256")
              .update(code)
              .digest("hex");

          if (
            !admin.reset_code ||
            admin.reset_code !== resetCodeHash
          ) {
            return reply
              .code(400)
              .send({
                error:
                  "Invalid code or email."
              });
          }


          if (
            !admin.reset_code_expires ||
            new Date(
              admin.reset_code_expires
            ) < new Date()
          ) {
            return reply
              .code(400)
              .send({
                error:
                  "Reset code expired."
              });
          }


          const newPasswordHash =
            await bcrypt.hash(
              newPassword,
              12
            );


          await service.updatePassword(
            admin.id,
            newPasswordHash
          );

          await service.clearPasswordResetCode(
            admin.id
          );

          return {
            message:
              "Password updated successfully."
          };

        } catch (error) {

          request.log.error(error);

          return reply
            .code(500)
            .send({
              code:
                "PASSWORD_RESET_FAILED",

              error:
                "Unable to reset password."
            });
        }
      }
    );

    // ---------------------------------
    // CURRENT AUTHENTICATED ADMIN
    // ---------------------------------
    fastify.get(
      "/me",
      {
        schema: {
          tags: ["Authentication"],
          summary:
            "Get authenticated Platform administrator"
        }
      },

      async (request, reply) => {

        try {

          await request.jwtVerify();

          if (
            request.user?.stage !==
            "authenticated" ||
            request.user?.role !==
            "platform_admin"
          ) {
            return reply
              .code(401)
              .send({
                code:
                  "PLATFORM_AUTH_REQUIRED",

                error:
                  "Platform administrator authentication is required."
              });
          }


          const admin =
            await service.getAdminById(
              request.user.adminId
            );


          if (!admin || !admin.is_active) {
            return reply
              .code(401)
              .send({
                code:
                  "PLATFORM_AUTH_REQUIRED",

                error:
                  "Platform administrator authentication is required."
              });
          }
          const screenAccess =
            await service.getAdminScreenAccess(
              admin.id
            );

          return {
            authenticated: true,

            admin: {
              id:
                admin.id,

              email:
                admin.email,

              displayName:
                admin.display_name,

              themeMode:
                admin.theme_mode,

              accentTheme:
                admin.accent_theme
            },

            screenAccess
          };

        } catch {

          return reply
            .code(401)
            .send({
              code:
                "PLATFORM_AUTH_REQUIRED",

              error:
                "Platform administrator authentication is required."
            });
        }
      }
    );


    // ---------------------------------
    // UPDATE THEME PREFERENCE
    // ---------------------------------
    fastify.put(
      "/theme",
      {
        schema: {
          tags: ["Authentication"],
          summary:
            "Update Platform administrator theme preference",

          body: {
            type: "object",
            required: [
              "themeMode",
              "accentTheme"
            ],
            additionalProperties: false,

            properties: {
              themeMode: {
                type: "string",
                enum: [
                  "light",
                  "dark"
                ]
              },

              accentTheme: {
                type: "string",
                enum: [
                  "blue",
                  "amber",
                  "teal"
                ]
              }
            }
          }
        }
      },

      async (request, reply) => {

        try {

          await request.jwtVerify();

          if (
            request.user?.stage !==
            "authenticated" ||
            request.user?.role !==
            "platform_admin"
          ) {
            return reply
              .code(401)
              .send({
                code:
                  "PLATFORM_AUTH_REQUIRED",

                error:
                  "Platform administrator authentication is required."
              });
          }

          const {
            themeMode,
            accentTheme
          } = request.body;

          const theme =
            await service.updateTheme(
              request.user.adminId,
              themeMode,
              accentTheme
            );

          if (!theme) {
            return reply
              .code(404)
              .send({
                code:
                  "PLATFORM_ADMIN_NOT_FOUND",

                error:
                  "Platform administrator not found."
              });
          }

          return {
            success: true,

            themeMode:
              theme.theme_mode,

            accentTheme:
              theme.accent_theme
          };

        } catch (error) {

          request.log.error(error);

          return reply
            .code(500)
            .send({
              code:
                "THEME_UPDATE_FAILED",

              error:
                "Unable to update theme preference."
            });
        }
      }
    );

    // ---------------------------------
    // CHANGE PASSWORD
    // ---------------------------------
    fastify.post(
      "/change-password",
      {
        schema: {
          tags: ["Authentication"],
          summary:
            "Change Platform administrator password",

          body: {
            type: "object",

            required: [
              "currentPassword",
              "newPassword"
            ],

            additionalProperties: false,

            properties: {
              currentPassword: {
                type: "string",
                minLength: 1
              },

              newPassword: {
                type: "string",
                minLength: 1
              }
            }
          }
        }
      },

      async (request, reply) => {

        try {

          await request.jwtVerify();

          if (
            request.user?.stage !==
            "authenticated" ||
            request.user?.role !==
            "platform_admin"
          ) {
            return reply
              .code(401)
              .send({
                code:
                  "PLATFORM_AUTH_REQUIRED",

                error:
                  "Platform administrator authentication is required."
              });
          }

          const {
            currentPassword,
            newPassword
          } = request.body;

          const passwordError =
            service.validatePassword(
              newPassword
            );

          if (passwordError) {
            return reply
              .code(400)
              .send({
                code:
                  "PASSWORD_POLICY_FAILED",

                error:
                  passwordError
              });
          }

          const admin =
            await service.getAdminById(
              request.user.adminId
            );

          if (!admin) {
            return reply
              .code(404)
              .send({
                code:
                  "PLATFORM_ADMIN_NOT_FOUND",

                error:
                  "Platform administrator not found."
              });
          }

          const currentPasswordValid =
            await service.verifyPassword(
              currentPassword,
              admin.password_hash
            );

          if (!currentPasswordValid) {
            return reply
              .code(400)
              .send({
                code:
                  "CURRENT_PASSWORD_INVALID",

                error:
                  "Current password is incorrect."
              });
          }

          const newPasswordHash =
            await bcrypt.hash(
              newPassword,
              12
            );

          await service.updatePassword(
            admin.id,
            newPasswordHash
          );

          return {
            success: true
          };

        } catch (error) {

          request.log.error(error);

          return reply
            .code(500)
            .send({
              code:
                "PASSWORD_CHANGE_FAILED",

              error:
                "Unable to change password."
            });
        }
      }
    );

    // ---------------------------------
    // LOGOUT
    // ---------------------------------
    fastify.post(
      "/logout",
      {
        schema: {
          tags: ["Authentication"],
          summary:
            "Log out Platform administrator"
        }
      },

      async (request, reply) => {

        reply.setCookie(
          "cpmsoft_platform",
          "",
          {
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 0,
            expires: new Date(0)
          }
        );

        return {
          success: true
        };
      }
    );

  };