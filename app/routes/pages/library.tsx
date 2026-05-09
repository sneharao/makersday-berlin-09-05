import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import { libraryController, loginController } from "@backend-main/controller.instances";
import { enforceAuth } from "@backend-platform/infrastructure/route-utils/auth-middleware.server";
import {
  toAuthenticatedUserDto,
  type AuthenticatedUserDto,
} from "@backend-application/authentication/auth.dto";
import type { ArtifactDto, LibraryDto } from "@backend-application/library/library.dto";
import { LibraryView } from "@components/domain/library/LibraryView";

export const meta = (): Array<{ title: string }> => {
  return [{ title: "Scholastic AI | Library" }];
};

export interface LibraryLoaderData {
  user: AuthenticatedUserDto;
  library: LibraryDto;
  artifacts: ArtifactDto[];
}

export async function loader({ request }: LoaderFunctionArgs): Promise<LibraryLoaderData> {
  const ctx = await enforceAuth(loginController, request);
  const initialState = await libraryController.getInitialState(request);
  return {
    user: toAuthenticatedUserDto(ctx.user),
    library: initialState.library,
    artifacts: initialState.artifacts,
  };
}

export default function LibraryPage(): React.JSX.Element {
  const data = useLoaderData<typeof loader>();
  return <LibraryView user={data.user} library={data.library} artifacts={data.artifacts} />;
}
