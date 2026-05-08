import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { callLoginApi } from "../../../../../routes/api/api.auth._sdk";

export interface FieldErrors {
  email?: string;
  password?: string;
}

export interface UseLoginFormApi {
  email: string;
  password: string;
  isSubmitting: boolean;
  submitError: string | null;
  fieldErrors: FieldErrors;
  emailRef: React.RefObject<HTMLInputElement | null>;
  passwordRef: React.RefObject<HTMLInputElement | null>;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export function useLoginForm(): UseLoginFormApi {
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();

      const trimmedEmail = email.trim();
      const nextFieldErrors: FieldErrors = {};
      if (trimmedEmail.length === 0) nextFieldErrors.email = "Email is required";
      if (password.length === 0) nextFieldErrors.password = "Password is required";

      if (nextFieldErrors.email || nextFieldErrors.password) {
        setFieldErrors(nextFieldErrors);
        setSubmitError(null);
        if (nextFieldErrors.email) emailRef.current?.focus();
        else passwordRef.current?.focus();
        return;
      }

      setFieldErrors({});
      setSubmitError(null);
      setIsSubmitting(true);

      const result = await callLoginApi({ email: trimmedEmail, password });

      setIsSubmitting(false);

      if (result.ok) {
        navigate("/library");
        return;
      }

      if (result.reason === "invalid-credentials") {
        setSubmitError("Invalid email or password");
        setPassword("");
        passwordRef.current?.focus();
        return;
      }

      if (result.reason === "field-errors") {
        const apiFieldErrors: FieldErrors = {};
        if (result.fieldErrors?.email?.length) apiFieldErrors.email = result.fieldErrors.email[0];
        if (result.fieldErrors?.password?.length) apiFieldErrors.password = result.fieldErrors.password[0];
        setFieldErrors(apiFieldErrors);
        return;
      }

      console.error("[useLoginForm] Unexpected login failure:", result.message);
      setSubmitError(GENERIC_ERROR_MESSAGE);
    },
    [email, password, navigate],
  );

  return {
    email,
    password,
    isSubmitting,
    submitError,
    fieldErrors,
    emailRef,
    passwordRef,
    setEmail,
    setPassword,
    handleSubmit,
  };
}
