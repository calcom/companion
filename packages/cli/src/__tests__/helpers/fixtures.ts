export const validConfig = {
  apiKey: "cal_test_api_key_123",
  apiUrl: "https://api.cal.com",
  appUrl: "https://app.cal.com",
};

export const oauthConfig = {
  oauth: {
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    accessToken: "test-access-token",
    refreshToken: "test-refresh-token",
    accessTokenExpiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
  },
};

export const expiredOauthConfig = {
  oauth: {
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    accessToken: "expired-access-token",
    refreshToken: "test-refresh-token",
    accessTokenExpiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  },
};

export const tokenRefreshResponse = {
  access_token: "new-access-token",
  refresh_token: "new-refresh-token",
  expires_in: 3600,
};

export const validationErrorBody = {
  status: "error",
  error: {
    code: "VALIDATION_ERROR",
    message: "Validation failed",
    details: {
      errors: [
        {
          property: "email",
          constraints: {
            isEmail: "email must be a valid email address",
          },
        },
      ],
    },
  },
};

export const nestedValidationErrorBody = {
  status: "error",
  error: {
    code: "VALIDATION_ERROR",
    message: "Validation failed",
    details: {
      errors: [
        {
          property: "user",
          children: [
            {
              property: "profile",
              children: [
                {
                  property: "name",
                  constraints: {
                    isNotEmpty: "name should not be empty",
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  },
};

export const simpleErrorBody = {
  status: "error",
  message: "Something went wrong",
};

export const errorWithStringError = {
  status: "error",
  error: "Not found",
};

export const sdkErrorObject = {
  status: "error",
  error: {
    code: "NOT_FOUND",
    message: "Resource not found",
  },
};
