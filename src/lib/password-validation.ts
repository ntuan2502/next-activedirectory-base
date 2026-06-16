export interface PasswordValidationInput {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

export interface PasswordSecuritySettings {
  passwordMinLength: number;
  passwordPreventCommon: boolean;
  passwordNoUserInfo: boolean;
  passwordRequireLetter: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSymbol: boolean;
  passwordRequireMixedCase: boolean;
}

export interface ValidationError {
  key: string;
  variables?: Record<string, string | number>;
}

const COMMON_PASSWORDS = [
  "123456",
  "12345678",
  "123456789",
  "password",
  "password123",
  "admin123",
  "admin12345",
  "qwerty",
  "1234567",
  "12345",
  "1234567890",
  "password!",
  "admin",
  "administrator",
  "root",
  "guest",
  "welcome",
  "welcome123",
];

export function validatePassword(
  password: string,
  settings: PasswordSecuritySettings,
  userInfo?: PasswordValidationInput
): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Min characters check
  if (password.length < settings.passwordMinLength) {
    errors.push({
      key: "usersPage.passwordMinLengthError",
      variables: { min: settings.passwordMinLength },
    });
  }

  // 2. Prevent common passwords
  if (settings.passwordPreventCommon) {
    const lowerPassword = password.toLowerCase();
    if (COMMON_PASSWORDS.includes(lowerPassword)) {
      errors.push({ key: "usersPage.passwordCommonError" });
    }
  }

  // 3. Password cannot contain or be contained in first name, last name, email prefix, or username (allowing letter paddings)
  if (settings.passwordNoUserInfo && userInfo) {
    const lowerPassword = password.toLowerCase();
    const { username, email, firstName, lastName } = userInfo;

    let matchesUserInfo = false;

    const checkMatch = (val: string | undefined): boolean => {
      if (!val) return false;
      const lowerVal = val.toLowerCase();
      
      // Escape special regex characters in the user info value
      const escapedVal = lowerVal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      
      // We block if the password is just the user info padded ONLY by non-letters (digits, spaces, symbols).
      // If the padding contains letters (e.g. "thuận theo ý trời" where padding is " theo ý trời"), it is ALLOWED.
      const regex = new RegExp("^[^\\p{L}]*" + escapedVal + "[^\\p{L}]*$", "ui");
      return regex.test(lowerPassword);
    };

    if (checkMatch(username)) {
      matchesUserInfo = true;
    }
    if (checkMatch(firstName)) {
      matchesUserInfo = true;
    }
    if (checkMatch(lastName)) {
      matchesUserInfo = true;
    }
    if (email) {
      if (checkMatch(email)) {
        matchesUserInfo = true;
      } else {
        const emailPrefix = email.split("@")[0];
        if (checkMatch(emailPrefix)) {
          matchesUserInfo = true;
        }
      }
    }

    if (matchesUserInfo) {
      errors.push({ key: "usersPage.passwordNoUserInfoError" });
    }
  }

  // 4. Require at least one letter
  if (settings.passwordRequireLetter) {
    if (!/[a-zA-Z]/.test(password)) {
      errors.push({ key: "usersPage.passwordRequireLetterError" });
    }
  }

  // 5. Require at least one number
  if (settings.passwordRequireNumber) {
    if (!/\d/.test(password)) {
      errors.push({ key: "usersPage.passwordRequireNumberError" });
    }
  }

  // 6. Require at least one symbol
  if (settings.passwordRequireSymbol) {
    if (!/[\W_]/.test(password)) {
      errors.push({ key: "usersPage.passwordRequireSymbolError" });
    }
  }

  // 7. Require at least one uppercase and one lowercase
  if (settings.passwordRequireMixedCase) {
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
      errors.push({ key: "usersPage.passwordRequireMixedCaseError" });
    }
  }

  return errors;
}
