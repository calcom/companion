import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  type TextInputProps,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { OAuthCancelledError } from "@/services/oauthService";
import { openInAppBrowser } from "@/utils/browser";
import {
  getNativeSignupErrorField,
  getNativeSignupErrorMessage,
  isValidVerificationCode,
  type NativeSignupAccount,
  NativeSignupError,
  type NativeSignupField,
  normalizeNativeSignupAccount,
  SignupUnderReviewError,
  validateNativeSignupAccount,
} from "@/utils/native-signup";
import { type CalRegion, getCalWebUrl } from "@/utils/region";

type Step = "details" | "code";
type FieldErrors = Partial<Record<NativeSignupField | "code", string>>;

interface SignupScreenProps {
  region: CalRegion;
  onBack: () => void;
}

export function SignupScreen({ region, onBack }: SignupScreenProps) {
  const { loginWithOAuth, requestSignupVerificationCode, completeNativeSignup } = useAuth();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";
  const [step, setStep] = useState<Step>("details");
  const [account, setAccount] = useState<NativeSignupAccount>({
    email: "",
    username: "",
    password: "",
  });
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<"code" | "create" | "resend" | "provider" | null>(null);
  const signupUnavailable = region === "eu";
  const profileHost = new URL(getCalWebUrl(region)).host;

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step === "code") {
        setStep("details");
      } else {
        onBack();
      }
      return true;
    });
    return () => subscription.remove();
  }, [step, onBack]);

  const updateAccount = (field: NativeSignupField, value: string) => {
    setAccount((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  const showError = (error: unknown) => {
    if (error instanceof OAuthCancelledError) return;
    if (error instanceof SignupUnderReviewError) {
      Alert.alert("Account created", error.message, [{ text: "OK", onPress: onBack }]);
      return;
    }
    if (error instanceof NativeSignupError) {
      const message = getNativeSignupErrorMessage(error.code, error.suggestion);
      const field = getNativeSignupErrorField(error.code);
      if (field === "code" || (field && step === "details")) {
        setFieldErrors({ [field]: message });
        return;
      }
      // A details problem found at the last step: send the person back to fix it.
      if (field) {
        setStep("details");
        setFieldErrors({ [field]: message });
        return;
      }
      setFormError(message);
      return;
    }
    setFormError(getNativeSignupErrorMessage("unknown"));
  };

  const sendCode = async (action: "code" | "resend") => {
    const errors = validateNativeSignupAccount(account);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setPending(action);
    setFormError(null);
    try {
      await requestSignupVerificationCode(normalizeNativeSignupAccount(account));
      setStep("code");
      setCode("");
      setFieldErrors({});
    } catch (error) {
      showError(error);
    }
    setPending(null);
  };

  const createAccount = async () => {
    if (!isValidVerificationCode(code)) {
      setFieldErrors({ code: "Enter the 6-digit code from the email." });
      return;
    }
    setPending("create");
    setFormError(null);
    try {
      await completeNativeSignup(normalizeNativeSignupAccount(account), code);
    } catch (error) {
      showError(error);
    }
    setPending(null);
  };

  const continueWithProvider = async (provider: "google" | "microsoft") => {
    setPending("provider");
    setFormError(null);
    try {
      await loginWithOAuth(provider);
    } catch (error) {
      showError(error);
    }
    setPending(null);
  };

  const colors = {
    text: isDark ? "#FFFFFF" : "#111827",
    muted: isDark ? "#A3A3A3" : "#6B7280",
    border: isDark ? "#4D4D4D" : "#E5E7EB",
    field: isDark ? "#171717" : "#FFFFFF",
    error: isDark ? "#F87171" : "#DC2626",
  };
  const busy = pending !== null;
  // App Store 4.8: native Google/Microsoft buttons would require Sign in with Apple. On iOS they
  // stay on Cal.com's web login (behind Sign in), like other scheduling apps.
  const showSocialSignup = Platform.OS !== "ios";

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-black"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 28,
          paddingHorizontal: 24,
        }}
      >
        <TouchableOpacity
          onPress={step === "code" ? () => setStep("details") : onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="-ml-2 mb-6 h-10 w-10 items-center justify-center"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>

        <Text className="mb-2 text-[28px] font-bold" style={{ color: colors.text }}>
          {step === "details" ? "Create your account" : "Check your email"}
        </Text>
        <Text className="mb-8 text-[15px] leading-[21px]" style={{ color: colors.muted }}>
          {step === "details"
            ? "Free forever, no credit card needed."
            : `We sent a 6-digit code to ${normalizeNativeSignupAccount(account).email}.`}
        </Text>

        {signupUnavailable ? (
          <Text
            accessibilityRole="alert"
            className="text-[15px] leading-[21px]"
            style={{ color: colors.text }}
          >
            New accounts can't be created in the European Union data region. Go back and switch the
            data region to United States to sign up.
          </Text>
        ) : step === "details" ? (
          <>
            {showSocialSignup ? (
              <>
                <ProviderButton
                  icon="logo-google"
                  label="Continue with Google"
                  onPress={() => continueWithProvider("google")}
                  disabled={busy}
                  colors={colors}
                />
                <ProviderButton
                  icon="logo-microsoft"
                  label="Continue with Microsoft"
                  onPress={() => continueWithProvider("microsoft")}
                  disabled={busy}
                  colors={colors}
                />

                <View className="my-5 flex-row items-center">
                  <View className="h-px flex-1" style={{ backgroundColor: colors.border }} />
                  <Text className="mx-3 text-[13px]" style={{ color: colors.muted }}>
                    or sign up with email
                  </Text>
                  <View className="h-px flex-1" style={{ backgroundColor: colors.border }} />
                </View>
              </>
            ) : null}

            <Field
              label="Email"
              value={account.email}
              onChangeText={(value) => updateAccount("email", value)}
              error={fieldErrors.email}
              colors={colors}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              spellCheck={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <Field
              label="Username"
              prefix={`${profileHost}/`}
              value={account.username}
              onChangeText={(value) => updateAccount("username", value)}
              error={fieldErrors.username}
              colors={colors}
              autoCapitalize="none"
              autoComplete="username-new"
              autoCorrect={false}
              textContentType="username"
            />
            <Field
              label="Password"
              value={account.password}
              onChangeText={(value) => updateAccount("password", value)}
              error={fieldErrors.password}
              colors={colors}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              trailing={
                <TouchableOpacity
                  onPress={() => setShowPassword((shown) => !shown)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  hitSlop={8}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={colors.muted}
                  />
                </TouchableOpacity>
              }
            />

            {formError ? <FormError message={formError} color={colors.error} /> : null}

            <PrimaryButton
              label="Continue"
              loading={pending === "code"}
              disabled={busy}
              onPress={() => sendCode("code")}
              isDark={isDark}
            />

            <Text
              className="mt-5 text-center text-[13px] leading-[19px]"
              style={{ color: colors.muted }}
            >
              By creating an account you agree to our{" "}
              <Text
                className="underline"
                onPress={() => openInAppBrowser(`${getCalWebUrl(region)}/terms`, "Terms")}
              >
                Terms
              </Text>{" "}
              and{" "}
              <Text
                className="underline"
                onPress={() =>
                  openInAppBrowser(`${getCalWebUrl(region)}/privacy`, "Privacy Policy")
                }
              >
                Privacy Policy
              </Text>
              .
            </Text>
          </>
        ) : (
          <>
            <Field
              label="Verification code"
              value={code}
              onChangeText={(value) => {
                setCode(value.replace(/\D/g, "").slice(0, 6));
                setFieldErrors({});
                setFormError(null);
              }}
              error={fieldErrors.code}
              colors={colors}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              autoFocus
            />

            {formError ? <FormError message={formError} color={colors.error} /> : null}

            <PrimaryButton
              label="Create account"
              loading={pending === "create"}
              disabled={busy}
              onPress={createAccount}
              isDark={isDark}
            />

            <TouchableOpacity
              onPress={() => sendCode("resend")}
              disabled={busy}
              accessibilityRole="button"
              className="mt-4 items-center py-2"
            >
              {pending === "resend" ? (
                <ActivityIndicator color={colors.muted} />
              ) : (
                <Text className="text-[15px] font-medium" style={{ color: colors.text }}>
                  Resend code
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface Colors {
  text: string;
  muted: string;
  border: string;
  field: string;
  error: string;
}

function Field({
  label,
  prefix,
  error,
  colors,
  trailing,
  ...inputProps
}: TextInputProps & {
  label: string;
  prefix?: string;
  error?: string;
  colors: Colors;
  trailing?: React.ReactNode;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-[13px] font-medium" style={{ color: colors.muted }}>
        {label}
      </Text>
      <View
        className="flex-row items-center rounded-xl border px-4"
        style={{ borderColor: error ? colors.error : colors.border, backgroundColor: colors.field }}
      >
        {prefix ? (
          <Text className="text-[16px]" style={{ color: colors.muted }}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          {...inputProps}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          className="flex-1 py-3 text-[16px]"
          style={{ color: colors.text }}
        />
        {trailing}
      </View>
      {error ? (
        <Text
          className="mt-1.5 text-[13px]"
          style={{ color: colors.error }}
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function ProviderButton({
  icon,
  label,
  onPress,
  disabled,
  colors,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  disabled: boolean;
  colors: Colors;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className="mb-3 flex-row items-center justify-center rounded-2xl border py-[15px]"
      style={{ borderColor: colors.border, backgroundColor: colors.field }}
      activeOpacity={0.8}
    >
      <Ionicons name={icon} size={18} color={colors.text} />
      <Text className="ml-2.5 text-[16px] font-semibold" style={{ color: colors.text }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function PrimaryButton({
  label,
  loading,
  disabled,
  onPress,
  isDark,
}: {
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
  isDark: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="mt-2 items-center justify-center rounded-2xl py-[18px]"
      style={{ backgroundColor: disabled ? "#9CA3AF" : isDark ? "#FFFFFF" : "#000000" }}
      activeOpacity={0.9}
    >
      {loading ? (
        <ActivityIndicator color={isDark ? "#000000" : "#FFFFFF"} />
      ) : (
        <Text
          className="text-[17px] font-semibold"
          style={{ color: isDark ? "#000000" : "#FFFFFF" }}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function FormError({ message, color }: { message: string; color: string }) {
  return (
    <Text className="mb-3 text-[14px]" style={{ color }} accessibilityRole="alert">
      {message}
    </Text>
  );
}

export default SignupScreen;
