import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import { loginController } from "@backend-main/controller.instances";
import { enforceAuth } from "@backend-platform/infrastructure/route-utils/auth-middleware.server";
import {
  toAuthenticatedUserDto,
  type AuthenticatedUserDto,
} from "@backend-application/authentication/auth.dto";

export const meta = (): Array<{ title: string }> => {
  return [{ title: "Scholastic AI | Library" }];
};

export interface LibraryLoaderData {
  user: AuthenticatedUserDto;
}

export async function loader({ request }: LoaderFunctionArgs): Promise<LibraryLoaderData> {
  const ctx = await enforceAuth(loginController, request);
  return { user: toAuthenticatedUserDto(ctx.user) };
}

export default function LibraryPage(): React.JSX.Element {
  const data = useLoaderData<typeof loader>();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 py-12 text-on-surface">
      <h1 className="text-3xl font-semibold">Welcome, {data.user.displayName}.</h1>
      <p className="text-on-surface-variant">Your library is coming soon.</p>
    </main>
  );
}
