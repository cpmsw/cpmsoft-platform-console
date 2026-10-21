const PLATFORM_ACTIVATION_URL =
    process.env.CPMSOFT_PLATFORM_ACTIVATION_URL ||
    "https://console.cpmsoft.app/activate";


function buildActivationUrl(
    invitationToken
) {

    const separator =
        PLATFORM_ACTIVATION_URL.includes("?")
            ? "&"
            : "?";


    return (
        PLATFORM_ACTIVATION_URL +
        separator +
        "token=" +
        encodeURIComponent(
            invitationToken
        )
    );
}


function buildPlatformAdminActivationEmail({
    displayName,
    invitationToken,
    invitationExpires
}) {

    if (!invitationToken) {

        throw new Error(
            "Activation invitation token is required."
        );
    }


    const greeting =
        displayName
            ? `Hello ${displayName},`
            : "Hello,";


    const activationUrl =
        buildActivationUrl(
            invitationToken
        );


    const expirationText =
        invitationExpires
            ? new Date(
                invitationExpires
            ).toLocaleDateString(
                "en-US",
                {
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                }
            )
            : null;


    const expirationTextPlain =
        expirationText
            ? `This invitation is valid until ${expirationText}.`
            : "This invitation is valid for 30 days.";


    const expirationHtml =
        expirationText
            ? `
                <p>
                    This invitation is valid until
                    <strong>${expirationText}</strong>.
                </p>
              `
            : `
                <p>
                    This invitation is valid for
                    <strong>30 days</strong>.
                </p>
              `;


    const twofaText = `

Two-Factor Authentication

Your Platform Console account requires two-factor authentication.

After creating your password, the Platform Console will guide you through setting up an authenticator app on your first login.

Please have your authenticator app available when you sign in.
`;


    const twofaHtml = `
    <div style="
        margin-top:24px;
        padding:16px;
        background:#f4f6f8;
        border:1px solid #d8dde3;
        border-radius:6px;
    ">
        <h3 style="margin-top:0;">
            Two-Factor Authentication
        </h3>

        <p>
            Your Platform Console account requires
            two-factor authentication.
        </p>

        <p>
            After creating your password,
            the Platform Console will guide you
            through setting up an authenticator app
            on your first login.
        </p>

        <p style="margin-bottom:0;">
            Please have your authenticator app
            available when you sign in.
        </p>
    </div>
`;

    return {

        subject:
            "Welcome to CPMSOFT Platform Console – Activate Your Account",

        text: `
${greeting}

Your CPMSOFT Platform Console administrator account is ready.

When you are ready to activate your account, use the link below:

${activationUrl}

${expirationTextPlain}

After opening the activation page, CPMSOFT will send a short-lived verification code to your email address. You will use that code to verify your email and create your password.
${twofaText}
If you were not expecting this invitation, you may safely ignore this email.
        `.trim(),

        html: `
            <div style="
                max-width:600px;
                font-family:Arial,sans-serif;
                font-size:15px;
                line-height:1.6;
                color:#222;
            ">

                <p>${greeting}</p>

                <p>
                    Your CPMSOFT Platform Console
                    administrator account is ready.
                </p>

                <p>
                    When you are ready to activate
                    your account, click the button below.
                </p>

                <p>
                    <a
                        href="${activationUrl}"
                        style="
                            display:inline-block;
                            padding:11px 18px;
                            background:#1769aa;
                            color:#fff;
                            text-decoration:none;
                            border-radius:5px;
                            font-weight:bold;
                        "
                    >
                        Activate Your Account
                    </a>
                </p>

                ${expirationHtml}

                <p>
                    After opening the activation page,
                    CPMSOFT will send a short-lived
                    verification code to your email
                    address. You will use that code to
                    verify your email and create your
                    password.
                </p>

                <p>
                    You may also copy and paste this
                    address into your browser:
                </p>

                <p style="word-break:break-all;">
                    <a href="${activationUrl}">
                        ${activationUrl}
                    </a>
                </p>

                ${twofaHtml}

                <hr style="
                    margin-top:25px;
                    border:0;
                    border-top:1px solid #ddd;
                ">

                <p style="
                    font-size:13px;
                    color:#666;
                ">
                    If you were not expecting this
                    invitation, you may safely ignore
                    this email.
                </p>

            </div>
        `
    };
}


module.exports = {
    buildPlatformAdminActivationEmail
};