import { redirect, type LoaderFunctionArgs } from "react-router";
import { LoginView } from "@components/domain/auth/LoginView";
import { loginController } from "@backend-main/controller.instances";

export const meta = (): Array<{ title: string }> => {
  return [{ title: "Scholastic AI | Login" }];
};

export async function loader({ request }: LoaderFunctionArgs): Promise<Response | null> {
  const ctx = await loginController.getSessionContext(request);
  if (ctx) {
    throw redirect("/library");
  }
  return null;
}

export default function Login(): React.JSX.Element {
  return <LoginView />;
}
